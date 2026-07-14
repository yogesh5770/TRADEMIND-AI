import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend.portfolio_manager import PortfolioManager
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

def test_capital_aware_sizing_success(db_session):
    user = PortfolioManager.get_or_create_user(db_session)
    user.balance = 2000.0  # Set standard budget balance
    db_session.commit()
    
    # Mock TATASTEEL price for risk sizing calculations
    market_engine.prices["TATASTEEL"] = 165.0
    
    # Target: TATASTEEL (~₹165), stop-loss ₹150. Stop distance is ₹15.
    # Risk budget: 2% of ₹2000 = ₹40 max risk.
    # Max shares to buy = ₹40 / ₹15 = 2.6 -> 2 shares.
    # Buy cost: 2 * 165 = ₹330, which is below ₹2000 balance.
    
    result = PortfolioManager.place_paper_order(db_session, "TATASTEEL", "BUY", 2, stop_loss=150.0, target=185.0)
    assert result["success"] is True
    
    pos = db_session.query(models.Position).filter(models.Position.symbol == "TATASTEEL").first()
    assert pos is not None
    assert pos.quantity == 2

def test_capital_aware_sizing_insufficient_for_single_share(db_session):
    user = PortfolioManager.get_or_create_user(db_session)
    user.balance = 100.0  # Set very low balance.
    db_session.commit()
    
    # Mock TATASTEEL price for test compliance
    market_engine.prices["TATASTEEL"] = 165.0
    
    # Cost of 1 share of TATASTEEL is ~₹165.
    # Since ₹165 exceeds the available balance of ₹100, 
    # this order must be rejected because you can't buy fractional shares.
    
    result = PortfolioManager.place_paper_order(db_session, "TATASTEEL", "BUY", 1, stop_loss=150.0, target=185.0)
    assert result["success"] is False
    assert "Insufficient funds" in result["error"]
