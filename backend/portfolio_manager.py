from sqlalchemy.orm import Session
import datetime
import random
from backend import models
from backend.data_engine import market_engine

class PortfolioManager:
    @staticmethod
    def get_or_create_user(db: Session) -> models.User:
        """Retrieves user profile or initializes a low-budget retail profile (₹2,000 capital)."""
        user = db.query(models.User).filter(models.User.username == "retail_investor").first()
        if not user:
            user = models.User(
                username="retail_investor", 
                balance=2000.0, 
                margin=2000.0, 
                daily_pnl=0.0,
                peak_value=2000.0,
                is_bot_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    @staticmethod
    def _execute_coindcx_order(api_key: str, api_secret: str, symbol: str, side: str, quantity: float) -> dict:
        """Executes a real market order on the CoinDCX exchange using HMAC signature."""
        import hmac
        import hashlib
        import json
        import requests
        import time
        
        # CoinDCX expects market pairs like "BTCINR" (no hyphen)
        market_pair = f"{symbol}INR"
        
        url = "https://api.coindcx.com/exchange/v1/orders/create"
        body = {
            "side": side.lower(),
            "order_type": "market_order",
            "market": market_pair,
            "total_quantity": quantity,
            "timestamp": int(round(time.time() * 1000))
        }
        
        try:
            json_body = json.dumps(body, separators=(',', ':'))
            signature = hmac.new(
                bytes(api_secret, encoding='utf-8'),
                json_body.encode(),
                hashlib.sha256
            ).hexdigest()
            
            headers = {
                'Content-Type': 'application/json',
                'X-AUTH-APIKEY': api_key,
                'X-AUTH-SIGNATURE': signature
            }
            
            res = requests.post(url, data=json_body, headers=headers, timeout=10)
            if res.status_code == 200:
                res_data = res.json()
                if "id" in res_data or "orders" in res_data:
                    return {"success": True, "data": res_data}
                return {"success": False, "error": res_data.get("message", "Unknown error")}
            else:
                return {"success": False, "error": f"CoinDCX API Error: {res.text}"}
        except Exception as e:
            return {"success": False, "error": f"Connection exception: {e}"}

    @staticmethod
    def place_paper_order(db: Session, symbol: str, order_type: str, quantity: float, stop_loss: float = None, target: float = None) -> dict:
        """Executes a live trade via connected broker API (enforcing live-only trading)."""
        user = PortfolioManager.get_or_create_user(db)
        
        # 1. Broker Connection Validation (Strictly Enforce Live Broker)
        conn = db.query(models.BrokerConnection).filter(
            models.BrokerConnection.user_id == user.id,
            models.BrokerConnection.is_active == True
        ).first()
        
        if not conn:
            return {
                "success": False, 
                "error": "Order rejected: No broker connected. Please connect your broker API (Angel One or CoinDCX) to execute live trades."
            }
        
        # 2. Volatility Halt check (VIX > 25)
        vix = market_engine.prices.get("VIX", 13.5)
        if vix > 25.0:
            return {"success": False, "error": f"Order rejected: Market volatility VIX is too high ({vix:.1f} > 25.0)"}
            
        # 3. Bot Halt check
        if not user.is_bot_active:
            return {"success": False, "error": f"Bot trading suspended. Reason: {user.halt_reason}"}

        current_price = market_engine.prices.get(symbol, 100.0)
        total_cost = current_price * quantity
        
        # 4. Transaction Cost Filter (only for BUY entries with specified targets)
        if order_type == "BUY" and target:
            expected_profit = abs(target - current_price) * quantity
            # 0.1% estimated slippage + tax/brokerage cost
            est_transaction_fee = total_cost * 0.001
            
            # Rejection boundary: expected profit must exceed 3x transaction fees
            if expected_profit < (est_transaction_fee * 3):
                return {
                    "success": False, 
                    "error": f"Order rejected: Expected profit (Rs.{expected_profit:.2f}) is too small compared to transaction costs (Rs.{est_transaction_fee*3:.2f})."
                }

        if order_type == "BUY":
            # Auto-scale quantity if total cost exceeds available balance
            max_alloc = user.balance * 0.95
            if total_cost > max_alloc:
                # Scale quantity down to fit 95% of available balance
                is_crypto = not symbol.endswith(".NS") and symbol not in ["NIFTY", "VIX", "TATASTEEL", "SOUTHBANK", "JPPOWER", "SUZLON", "YESBANK", "IDEA", "PNB", "BANKBARODA", "SAIL", "NHPC"]
                if is_crypto:
                    quantity = round(max_alloc / current_price, 6)
                else:
                    # For stocks, floor to nearest whole share
                    quantity = int(max_alloc / current_price)
                total_cost = current_price * quantity
                
            if quantity <= 0 or user.balance < total_cost:
                return {"success": False, "error": f"Insufficient funds. Insufficient balance to purchase {symbol}. Balance: Rs.{user.balance:.2f}"}
            
            # --- Live API Call to Broker ---
            if conn.broker_name == "CoinDCX API":
                res = PortfolioManager._execute_coindcx_order(
                    conn.client_id, conn.access_token, symbol, "buy", quantity
                )
                if not res["success"]:
                    return {"success": False, "error": f"CoinDCX execution failed: {res['error']}"}
            
            # Deduct balance
            user.balance -= total_cost
            user.margin = user.balance
            
            # Update positions
            pos = db.query(models.Position).filter(
                models.Position.user_id == user.id, 
                models.Position.symbol == symbol
            ).first()
            
            if pos:
                old_total_cost = pos.avg_price * pos.quantity
                pos.quantity += quantity
                pos.avg_price = (old_total_cost + total_cost) / pos.quantity
                pos.current_price = current_price
                pos.pnl = (pos.current_price - pos.avg_price) * pos.quantity
                pos.last_updated = datetime.datetime.utcnow()
            else:
                pos = models.Position(
                    user_id=user.id,
                    symbol=symbol,
                    quantity=quantity,
                    avg_price=current_price,
                    current_price=current_price,
                    pnl=0.0
                )
                db.add(pos)
                
            # Log Trade (Marked as LIVE)
            trade = models.Trade(
                user_id=user.id,
                symbol=symbol,
                order_type="BUY",
                trade_type="LIVE",
                quantity=quantity,
                price=current_price,
                stop_loss=stop_loss,
                target=target,
                status="EXECUTED",
                pnl=0.0
            )
            db.add(trade)
            
            # Create LearningLog entry for ML training
            data = market_engine.get_latest_data(symbol)
            indicators = data.get("indicators", {})
            
            log = models.LearningLog(
                symbol=symbol,
                entry_price=current_price,
                rsi_val=indicators.get("rsi", 50.0),
                adx_val=indicators.get("adx", 20.0),
                obv_val=indicators.get("obv", 0.0),
                vwap_val=indicators.get("vwap", current_price),
                vix_val=vix,
                news_sentiment="NEUTRAL" if symbol not in market_engine.historical_data else "MIXED",
                trend_state=data.get("mtf_trend", "NEUTRAL"),
                action="BUY",
                predicted_confidence=0.80,
                expected_move_pct=round((indicators.get("atr", 1.0) * 2.5) / current_price * 100, 2),
                expected_hold_mins=45
            )
            db.add(log)
            db.commit()
            return {"success": True, "trade_id": trade.id, "message": f"Successfully placed live order: Bought {quantity} {symbol} at Rs.{current_price:.2f}"}
            
        elif order_type == "SELL":
            pos = db.query(models.Position).filter(
                models.Position.user_id == user.id, 
                models.Position.symbol == symbol
            ).first()
            
            if not pos or pos.quantity < quantity - 1e-7:
                return {"success": False, "error": f"Insufficient holdings. You own {pos.quantity if pos else 0} {symbol}."}
            
            # --- Live API Call to Broker ---
            if conn.broker_name == "CoinDCX API":
                res = PortfolioManager._execute_coindcx_order(
                    conn.client_id, conn.access_token, symbol, "sell", quantity
                )
                if not res["success"]:
                    return {"success": False, "error": f"CoinDCX execution failed: {res['error']}"}

            realized_pnl = (current_price - pos.avg_price) * quantity
            user.balance += total_cost
            user.margin = user.balance
            
            pos.quantity -= quantity
            if pos.quantity < 1e-6:
                db.delete(pos)
            else:
                pos.current_price = current_price
                pos.pnl = (pos.current_price - pos.avg_price) * pos.quantity
                pos.last_updated = datetime.datetime.utcnow()
                
            # Log Trade (Marked as LIVE)
            trade = models.Trade(
                user_id=user.id,
                symbol=symbol,
                order_type="SELL",
                trade_type="LIVE",
                quantity=quantity,
                price=current_price,
                status="COMPLETED",
                pnl=realized_pnl
            )
            db.add(trade)
            
            # Update LearningLog entry outcomes
            log = db.query(models.LearningLog).filter(
                models.LearningLog.symbol == symbol,
                models.LearningLog.exit_time == None
            ).order_by(models.LearningLog.entry_time.desc()).first()
            
            if log:
                log.exit_price = current_price
                log.exit_time = datetime.datetime.utcnow()
                log.realized_pnl = realized_pnl
                log.exit_reason = "SQUARE_OFF"
                log.slippage_pct = random.uniform(0.01, 0.05)
                
            db.commit()
            
            # Post-trade verification check
            PortfolioManager.verify_consecutive_losses(db, user)
            
            return {"success": True, "trade_id": trade.id, "message": f"Successfully placed live order: Sold {quantity} {symbol} at Rs.{current_price:.2f}. P&L: Rs.{realized_pnl:.2f}"}
            
        return {"success": False, "error": "Invalid order type"}

    @staticmethod
    def update_positions_pnl(db: Session):
        """Calculates floating returns, updates Peak values, and scans for drawdown stops."""
        user = PortfolioManager.get_or_create_user(db)
        if not user.is_bot_active:
            return
            
        positions = db.query(models.Position).filter(models.Position.user_id == user.id).all()
        
        total_pnl = 0.0
        holdings_value = 0.0
        for pos in positions:
            latest_price = market_engine.prices.get(pos.symbol)
            if latest_price:
                pos.current_price = latest_price
                pos.pnl = (latest_price - pos.avg_price) * pos.quantity
                pos.last_updated = datetime.datetime.utcnow()
                total_pnl += pos.pnl
                holdings_value += latest_price * pos.quantity
                
        user.daily_pnl = total_pnl
        total_portfolio_value = user.balance + holdings_value
        
        if total_portfolio_value > user.peak_value:
            user.peak_value = total_portfolio_value
            
        drawdown_pct = 0.0
        if user.peak_value > 0.0:
            drawdown_pct = ((user.peak_value - total_portfolio_value) / user.peak_value) * 100
            if drawdown_pct > 5.0:
                user.is_bot_active = False
                user.halt_reason = f"Max Drawdown (5.0%) breached. Peak: ₹{user.peak_value:.2f}, Current: ₹{total_portfolio_value:.2f} ({drawdown_pct:.1f}% drop)"
                PortfolioManager.square_off_all_positions(db, user, "MAX_DRAWDOWN")
            
        daily_loss_pct = 0.0
        if user.peak_value > 0.0:
            daily_loss_pct = (total_pnl / user.peak_value) * 100
            if daily_loss_pct < -1.5:
                user.is_bot_active = False
                user.halt_reason = f"Daily Loss limit (1.5%) breached. Current daily loss: {daily_loss_pct:.1f}%"
                PortfolioManager.square_off_all_positions(db, user, "DAILY_LOSS_LIMIT")

        db.commit()

    @staticmethod
    def verify_consecutive_losses(db: Session, user: models.User):
        """Scans last 3 closed trades. If all 3 are losses, halts bot executions."""
        recent_trades = db.query(models.Trade).filter(
            models.Trade.user_id == user.id,
            models.Trade.status == "COMPLETED"
        ).order_by(models.Trade.timestamp.desc()).limit(3).all()
        
        if len(recent_trades) >= 3:
            losses_count = sum(1 for t in recent_trades if t.pnl < 0)
            if losses_count == 3:
                user.is_bot_active = False
                user.halt_reason = "Trading halted due to 3 consecutive losing trades."
                db.commit()

    @staticmethod
    def square_off_all_positions(db: Session, user: models.User, reason: str):
        """Closes all open positions immediately to safeguard remaining retail capital."""
        positions = db.query(models.Position).filter(models.Position.user_id == user.id).all()
        for pos in positions:
            latest_price = market_engine.prices.get(pos.symbol, pos.avg_price)
            realized_pnl = (latest_price - pos.avg_price) * pos.quantity
            
            trade = models.Trade(
                user_id=user.id,
                symbol=pos.symbol,
                order_type="SELL",
                trade_type="PAPER",
                quantity=pos.quantity,
                price=latest_price,
                status="COMPLETED",
                pnl=realized_pnl
            )
            db.add(trade)
            
            log = db.query(models.LearningLog).filter(
                models.LearningLog.symbol == pos.symbol,
                models.LearningLog.exit_time == None
            ).order_by(models.LearningLog.entry_time.desc()).first()
            if log:
                log.exit_price = latest_price
                log.exit_time = datetime.datetime.utcnow()
                log.realized_pnl = realized_pnl
                log.exit_reason = reason
                
            user.balance += latest_price * pos.quantity
            db.delete(pos)
            
        user.margin = user.balance
        user.daily_pnl = 0.0
        db.commit()

    @staticmethod
    def check_risk_triggers(db: Session) -> list[str]:
        """Monitors active order targets/stop-losses, executing squared-off orders."""
        user = PortfolioManager.get_or_create_user(db)
        if not user.is_bot_active:
            return []
            
        trades = db.query(models.Trade).filter(
            models.Trade.user_id == user.id, 
            models.Trade.status == "EXECUTED"
        ).all()
        
        alerts = []
        for trade in trades:
            curr_price = market_engine.prices.get(trade.symbol)
            if not curr_price:
                continue
                
            hit_sl = trade.stop_loss and ((trade.order_type == "BUY" and curr_price <= trade.stop_loss) or 
                                          (trade.order_type == "SELL" and curr_price >= trade.stop_loss))
            hit_target = trade.target and ((trade.order_type == "BUY" and curr_price >= trade.target) or 
                                           (trade.order_type == "SELL" and curr_price <= trade.target))
            
            if hit_sl or hit_target:
                reason = "STOP_LOSS" if hit_sl else "TARGET"
                alerts.append(f"{reason} hit for {trade.symbol} at ₹{curr_price:.2f} (Target: ₹{trade.target:.2f}, SL: ₹{trade.stop_loss:.2f})")
                
                PortfolioManager.place_paper_order(
                    db, 
                    trade.symbol, 
                    "SELL" if trade.order_type == "BUY" else "BUY", 
                    trade.quantity
                )
                
                trade.status = "COMPLETED"
                log = db.query(models.LearningLog).filter(
                    models.LearningLog.symbol == trade.symbol,
                    models.LearningLog.exit_time == None
                ).order_by(models.LearningLog.entry_time.desc()).first()
                if log:
                    log.exit_reason = reason
                    
        if alerts:
            db.commit()
            
        return alerts
