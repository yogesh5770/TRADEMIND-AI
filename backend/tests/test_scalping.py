import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend.portfolio_manager import PortfolioManager
from backend.strategies import IntradayScalpingStrategy
from backend.data_engine import market_engine
from backend import models

DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Pre-seed user and active broker connection
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
        
        conn = models.BrokerConnection(
            user_id=user.id,
            broker_name="Angel One",
            client_id="mock_client",
            access_token="mock_token",
            is_active=True
        )
        db.add(conn)
        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_scalping_strategy_buy_signal():
    # Mock data setup: price above EMA 9 and EMA 21, and RSI > 52 (Bullish momentum)
    mock_data = {
        "price": 165.0,
        "indicators": {
            "rsi": 58.0,
            "ema_9": 164.5,
            "ema_21": 163.0,
            "atr": 2.0
        }
    }
    
    signal = IntradayScalpingStrategy.generate_signal("TATASTEEL", mock_data, "STRONG_UPTREND")
    assert signal["action"] == "BUY"
    assert signal["stop_loss"] < 165.0
    assert signal["target"] > 165.0
    assert "Intraday Scalp BUY setup" in signal["reason"]

def test_scalping_strategy_no_trade():
    # Mock data setup: EMA 9 below EMA 21 but RSI neutral (No crossover momentum)
    mock_data = {
        "price": 165.0,
        "indicators": {
            "rsi": 50.0,
            "ema_9": 164.0,
            "ema_21": 164.5,
            "atr": 2.0
        }
    }
    
    signal = IntradayScalpingStrategy.generate_signal("TATASTEEL", mock_data, "MEAN_REVERTING")
    assert signal["action"] == "NO_TRADE"

def test_transaction_cost_rejection(db_session):
    user = PortfolioManager.get_or_create_user(db_session)
    user.balance = 2000.0
    db_session.commit()
    
    # Mock price for test compliance
    market_engine.prices["TATASTEEL"] = 160.0
    
    # Try placing an order where profit target is extremely narrow (expected gain = ₹0.10 per share)
    # Price = ₹160, Target = ₹160.10, Stop Loss = ₹159.00, Qty = 1
    # Cost = ₹160. Fee = 160 * 0.001 = ₹0.16. 3x Fee = ₹0.48.
    # Since profit (₹0.10) < 3x Fee (₹0.48), this scalp must be rejected.
    
    result = PortfolioManager.place_paper_order(
        db_session, "TATASTEEL", "BUY", 1, stop_loss=159.00, target=160.10
    )
    
    assert result["success"] is False
    assert "too small compared to transaction costs" in result["error"]

def test_transaction_cost_pass(db_session):
    user = PortfolioManager.get_or_create_user(db_session)
    user.balance = 2000.0
    db_session.commit()
    
    # Mock price for test compliance
    market_engine.prices["TATASTEEL"] = 160.0
    
    # Target = ₹170 (expected profit ₹10). Cost = 160. Fee = 0.16. 3x Fee = 0.48.
    # Since ₹10 > ₹0.48, this order should pass and be executed.
    
    result = PortfolioManager.place_paper_order(
        db_session, "TATASTEEL", "BUY", 1, stop_loss=155.00, target=170.00
    )
    
    assert result["success"] is True
    assert "Successfully placed live order: Bought" in result["message"]
