from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
import datetime
from backend.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, default="retail_investor")
    balance = Column(Float, default=10000.0)    # Reduced initial capital to ₹10,000 for realistic low-budget testing
    margin = Column(Float, default=10000.0)
    daily_pnl = Column(Float, default=0.0)
    peak_value = Column(Float, default=10000.0)  # Used to calculate drawdown thresholds
    is_bot_active = Column(Boolean, default=True) # Set False if Risk rules halt bot
    halt_reason = Column(String, nullable=True)   # Reason for halt (e.g. Drawdown / Cons. losses)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    brokers = relationship("BrokerConnection", back_populates="user")
    trades = relationship("Trade", back_populates="user")
    positions = relationship("Position", back_populates="user")
    holdings = relationship("Holding", back_populates="user")

class BrokerConnection(Base):
    __tablename__ = "broker_connections"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    broker_name = Column(String)  # "Zerodha", "Angel One", "Upstox"
    client_id = Column(String)
    access_token = Column(String)
    connected_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    user = relationship("User", back_populates="brokers")

class Trade(Base):
    __tablename__ = "trades"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    symbol = Column(String, index=True)
    order_type = Column(String)  # "BUY" or "SELL"
    trade_type = Column(String)  # "PAPER" or "LIVE"
    quantity = Column(Integer)
    price = Column(Float)
    stop_loss = Column(Float, nullable=True)
    target = Column(Float, nullable=True)
    status = Column(String)  # "PENDING", "EXECUTED", "CANCELLED", "COMPLETED"
    pnl = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="trades")

class Position(Base):
    __tablename__ = "positions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    symbol = Column(String, index=True)
    quantity = Column(Integer)
    avg_price = Column(Float)
    current_price = Column(Float)
    pnl = Column(Float, default=0.0)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow)
    
    user = relationship("User", back_populates="positions")

class Holding(Base):
    __tablename__ = "holdings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    symbol = Column(String, index=True)
    quantity = Column(Integer)
    avg_price = Column(Float)
    current_price = Column(Float)
    pnl = Column(Float, default=0.0)
    
    user = relationship("User", back_populates="holdings")

class Recommendation(Base):
    __tablename__ = "recommendations"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True)
    confidence = Column(Float)
    action = Column(String)
    suggested_price = Column(Float)
    stop_loss = Column(Float)
    target = Column(Float)
    risk_reward = Column(Float)
    rationale = Column(String)
    models_signals = Column(String) # JSON payload mapping agent votes
    status = Column(String, default="ACTIVE")
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class LearningLog(Base):
    __tablename__ = "learning_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, index=True)
    entry_time = Column(DateTime, default=datetime.datetime.utcnow)
    exit_time = Column(DateTime, nullable=True)
    
    # Entry features
    entry_price = Column(Float)
    rsi_val = Column(Float)
    adx_val = Column(Float)
    obv_val = Column(Float)
    vwap_val = Column(Float)
    vix_val = Column(Float)
    news_sentiment = Column(String) # "BULLISH", "BEARISH", "NEUTRAL"
    trend_state = Column(String)
    
    # Model predictions
    action = Column(String)
    predicted_confidence = Column(Float)
    expected_move_pct = Column(Float)
    expected_hold_mins = Column(Integer)
    
    # Reality outcomes
    exit_price = Column(Float, nullable=True)
    realized_pnl = Column(Float, default=0.0)
    exit_reason = Column(String, nullable=True) # "STOP_LOSS", "TARGET", "SQUARE_OFF", "REGIME_CHANGE"
    slippage_pct = Column(Float, default=0.0)
