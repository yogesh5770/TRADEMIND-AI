import asyncio
import json
import threading
import time
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from backend.config import settings
from backend.database import engine, Base, get_db
from backend.data_engine import market_engine
from backend.ai_engine import AIAnaEngine
from backend.portfolio_manager import PortfolioManager
from backend import models
from backend.backtest_engine import BacktestEngine
from backend.self_evaluation import SelfEvaluationEngine
from backend.regime_detector import MarketRegimeDetector

# Initialize SQLAlchemy Tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                # Remove stale connection
                pass

manager = ConnectionManager()

# Background task to sync database portfolios with live ticker fluctuations
def run_portfolio_pnl_loop():
    """Loops every 1.5 seconds to compute PnL fluctuations and check SL/Target triggers."""
    print("Background portfolio P&L synchronizer running...")
    while market_engine.running:
        try:
            # Create a new DB session scope
            from backend.database import SessionLocal
            db = SessionLocal()
            try:
                # Update P&L
                PortfolioManager.update_positions_pnl(db)
                
                # Check Risk stop-losses/targets
                alerts = PortfolioManager.check_risk_triggers(db)
                if alerts and manager.active_connections:
                    # Send alert details via socket
                    for alert in alerts:
                        asyncio.run(manager.broadcast({
                            "type": "RISK_ALERT",
                            "message": alert,
                            "timestamp": time.time()
                        }))
            finally:
                db.close()
        except Exception as e:
            print(f"Error in portfolio synchronizer loop: {e}")
        time.sleep(1.5)

def run_automated_trading_loop():
    """Loops every 5 seconds. If bot is active, fetches AI signals and executes trades."""
    print("Background automated trading loop running...")
    while market_engine.running:
        try:
            from backend.database import SessionLocal
            db = SessionLocal()
            try:
                user = PortfolioManager.get_or_create_user(db)
                if user.is_bot_active:
                    recommendations = AIAnaEngine.generate_recommendations()
                    for rec in recommendations:
                        symbol = rec["symbol"]
                        action = rec["action"]
                        confidence = rec["confidence"]
                        quantity = rec["quantity"]
                        price = rec["suggested_price"]
                        
                        if quantity <= 0:
                            continue
                            
                        # Check existing open position in DB
                        position = db.query(models.Position).filter(
                            models.Position.user_id == user.id,
                            models.Position.symbol == symbol
                        ).first()
                        
                        if action == "BUY" and confidence >= 0.65:
                            # Automatically buy if we don't have an active position
                            if not position:
                                res = PortfolioManager.place_paper_order(
                                    db, 
                                    symbol=symbol, 
                                    order_type="BUY", 
                                    quantity=quantity,
                                    stop_loss=rec["stop_loss"],
                                    target=rec["target"]
                                )
                                if res.get("success"):
                                    print(f"[AUTO-BOT] Automatically BOUGHT {quantity} {symbol} at Rs.{price:.2f}")
                                    # Broadcast order placement through socket
                                    asyncio.run(manager.broadcast({
                                        "type": "AUTO_ORDER",
                                        "message": f"Bought {quantity} {symbol} at Rs.{price:.2f} (Confidence: {confidence*100:.0f}%)",
                                        "timestamp": time.time()
                                    }))
                                    
                        elif action == "SELL":
                            # Automatically sell if we have a position
                            if position:
                                res = PortfolioManager.place_paper_order(
                                    db,
                                    symbol=symbol,
                                    order_type="SELL",
                                    quantity=position.quantity
                                )
                                if res.get("success"):
                                    print(f"[AUTO-BOT] Automatically SOLD/SQUARED-OFF {symbol} at Rs.{price:.2f}")
                                    asyncio.run(manager.broadcast({
                                        "type": "AUTO_ORDER",
                                        "message": f"Sold {position.quantity} {symbol} at Rs.{price:.2f} (AI Sell Signal)",
                                        "timestamp": time.time()
                                    }))
            finally:
                db.close()
        except Exception as e:
            print(f"Error in automated trading loop: {e}")
        time.sleep(5.0)

# Thread listener that acts as a callback target for our data engine ticks
def handle_live_tick(tick_info: dict):
    """Callback triggered whenever a market asset fluctuates in price."""
    # We broadcast this tick to all connected React dashboards
    if manager.active_connections:
        # Use asyncio to push JSON in a thread-safe way
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        coro = manager.broadcast({
            "type": "TICK",
            "data": tick_info
        })
        
        if loop.is_running():
            asyncio.run_coroutine_threadsafe(coro, loop)
        else:
            loop.run_until_complete(coro)

@app.on_event("startup")
def startup_event():
    # Setup broker callbacks
    market_engine.subscribe(handle_live_tick)
    # Sync active symbols from database connections
    db = next(get_db())
    try:
        market_engine.sync_with_broker(db)
    finally:
        db.close()
    # Start price updates
    market_engine.start_simulation()
    # Start portfolio tracking thread
    pnl_thread = threading.Thread(target=run_portfolio_pnl_loop, daemon=True)
    pnl_thread.start()
    # Start automated trading bot loop thread
    bot_thread = threading.Thread(target=run_automated_trading_loop, daemon=True)
    bot_thread.start()

@app.on_event("shutdown")
def shutdown_event():
    market_engine.unsubscribe(handle_live_tick)
    market_engine.stop_simulation()

# WebSocket Route
@app.websocket("/api/v1/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive by receiving messages
            data = await websocket.receive_text()
            # Respond to ping
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# API ENDPOINTS

@app.get("/api/v1/market/summary")
def get_market_summary():
    """Returns the latest ticker states for Indices and Equities."""
    results = {}
    # Always include index symbols
    for sym in settings.INDEX_SYMBOLS:
        results[sym] = market_engine.get_latest_data(sym)
    # Include all actively tracked symbols (broker or simulation)
    for sym in market_engine.active_symbols:
        results[sym] = market_engine.get_latest_data(sym)
    return results

@app.get("/api/v1/market/candles/{symbol}")
def get_candles(symbol: str):
    """Returns 30 recent daily candles for charting purposes."""
    if symbol not in market_engine.historical_data:
        raise HTTPException(status_code=404, detail="Symbol not tracked")
        
    df = market_engine.historical_data[symbol]
    candles = []
    for index, row in df.iterrows():
        candles.append({
            "time": int(index.timestamp()),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
            "volume": int(row["Volume"]),
            "rsi": float(row.get("RSI_14", 50)),
            "macd": float(row.get("MACD", 0)),
            "macd_signal": float(row.get("MACD_Signal", 0))
        })
    return {"symbol": symbol, "candles": candles}

@app.get("/api/v1/ai/recommendations")
def get_ai_recommendations():
    """Computes technical models consensus for all watchlist assets."""
    return AIAnaEngine.generate_recommendations()

@app.get("/api/v1/portfolio/summary")
def get_portfolio_summary(db: Session = Depends(get_db)):
    """Computes cash reserves, active open positions, holdings and trading history."""
    user = PortfolioManager.get_or_create_user(db)
    
    positions = db.query(models.Position).filter(models.Position.user_id == user.id).all()
    trades = db.query(models.Trade).filter(models.Trade.user_id == user.id).order_by(models.Trade.timestamp.desc()).limit(30).all()
    brokers = db.query(models.BrokerConnection).filter(models.BrokerConnection.user_id == user.id).all()
    
    pos_list = []
    for pos in positions:
        pos_list.append({
            "id": pos.id,
            "symbol": pos.symbol,
            "quantity": pos.quantity,
            "avg_price": round(pos.avg_price, 2),
            "current_price": round(pos.current_price, 2),
            "pnl": round(pos.pnl, 2)
        })
        
    trade_list = []
    for trade in trades:
        trade_list.append({
            "id": trade.id,
            "symbol": trade.symbol,
            "order_type": trade.order_type,
            "trade_type": trade.trade_type,
            "quantity": trade.quantity,
            "price": round(trade.price, 2),
            "stop_loss": round(trade.stop_loss, 2) if trade.stop_loss else None,
            "target": round(trade.target, 2) if trade.target else None,
            "status": trade.status,
            "pnl": round(trade.pnl, 2),
            "timestamp": trade.timestamp.isoformat()
        })
        
    broker_list = []
    for broker in brokers:
        broker_list.append({
            "broker_name": broker.broker_name,
            "client_id": broker.client_id,
            "connected_at": broker.connected_at.isoformat(),
            "is_active": broker.is_active
        })

    return {
        "balance": round(user.balance, 2),
        "margin": round(user.margin, 2),
        "daily_pnl": round(user.daily_pnl, 2),
        "total_value": round(user.balance + sum(pos.pnl + (pos.avg_price * pos.quantity) for pos in positions), 2),
        "positions": pos_list,
        "trades": trade_list,
        "connected_brokers": broker_list,
        "is_bot_active": user.is_bot_active,
        "halt_reason": user.halt_reason
    }


@app.post("/api/v1/portfolio/order")
def execute_order(order: dict, db: Session = Depends(get_db)):
    """Executes a buy or sell paper trade transaction."""
    required = ["symbol", "order_type", "quantity"]
    for field in required:
        if field not in order:
            raise HTTPException(status_code=400, detail=f"Missing field: {field}")
            
    symbol = order["symbol"]
    order_type = order["order_type"].upper()
    quantity = float(order["quantity"])
    stop_loss = order.get("stop_loss")
    target = order.get("target")
    
    if order_type not in ["BUY", "SELL"]:
        raise HTTPException(status_code=400, detail="order_type must be BUY or SELL")
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be greater than 0")
        
    result = PortfolioManager.place_paper_order(
        db, symbol, order_type, quantity, stop_loss, target
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return result

@app.post("/api/v1/broker/connect")
def connect_broker(conn: dict, db: Session = Depends(get_db)):
    """Simulates broker authorization callback and registers credentials."""
    required = ["broker_name", "client_id", "access_token"]
    for field in required:
        if field not in conn:
            raise HTTPException(status_code=400, detail=f"Missing field: {field}")
            
    user = PortfolioManager.get_or_create_user(db)
    
    # Check if this broker is already connected
    existing = db.query(models.BrokerConnection).filter(
        models.BrokerConnection.user_id == user.id,
        models.BrokerConnection.broker_name == conn["broker_name"]
    ).first()
    
    if existing:
        existing.client_id = conn["client_id"]
        existing.access_token = conn["access_token"]
        existing.is_active = True
        existing.connected_at = datetime.datetime.utcnow()
    else:
        new_conn = models.BrokerConnection(
            user_id=user.id,
            broker_name=conn["broker_name"],
            client_id=conn["client_id"],
            access_token=conn["access_token"],
            is_active=True
        )
        db.add(new_conn)
        
    db.commit()
    # Dynamically sync assets from connected broker API
    market_engine.sync_with_broker(db)
    return {"status": "success", "message": f"Successfully connected to {conn['broker_name']}"}

@app.post("/api/v1/portfolio/bot/toggle")
def toggle_bot(db: Session = Depends(get_db)):
    """Toggles the AI automated bot state on/off, clearing halt reasons if enabling."""
    user = PortfolioManager.get_or_create_user(db)
    user.is_bot_active = not user.is_bot_active
    if user.is_bot_active:
        user.halt_reason = None
    db.commit()
    return {"status": "success", "is_bot_active": user.is_bot_active, "halt_reason": user.halt_reason}

@app.get("/api/v1/backtest")
def run_strategy_backtest(symbol: str, strategy: str, days: int = 60):
    """Triggers the backtesting engine on historical intraday bars."""
    return BacktestEngine.run_backtest(symbol, strategy, days)

@app.get("/api/v1/portfolio/evaluation")
def get_portfolio_evaluation(db: Session = Depends(get_db)):
    """Computes a detailed Weekly Performance Report based on Learning Log records."""
    report_md = SelfEvaluationEngine.generate_weekly_report(db)
    return {"report": report_md}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
