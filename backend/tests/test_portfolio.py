import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.database import Base
from backend.portfolio_manager import PortfolioManager
from backend import models

# Use an in-memory SQLite database for testing
DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function")
def db_session():
    # Create tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Pre-seed user and active broker connection so tests run live execution branches
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
        # Drop tables
        Base.metadata.drop_all(bind=engine)

def test_get_or_create_user(db_session):
    user = PortfolioManager.get_or_create_user(db_session)
    assert user.username == "retail_investor"
    assert user.balance == 2000.0

def test_place_paper_order_buy_success(db_session):
    user = PortfolioManager.get_or_create_user(db_session)
    
    # Place a buy order for 10 shares of TATASTEEL (approx. ₹165/share = ₹1650 total)
    result = PortfolioManager.place_paper_order(db_session, "TATASTEEL", "BUY", 10)
    assert result["success"] is True
    
    # Check that balance has decreased
    db_session.refresh(user)
    assert user.balance < 2000.0
    
    # Check that position is created
    pos = db_session.query(models.Position).filter(models.Position.symbol == "TATASTEEL").first()
    assert pos is not None
    assert pos.quantity == 10
    assert pos.avg_price > 0.0

def test_place_paper_order_buy_insufficient_funds(db_session):
    user = PortfolioManager.get_or_create_user(db_session)
    user.balance = 50.0  # Set very low balance
    db_session.commit()
    
    # Try buying 10 shares of TATASTEEL (requires ~₹1650)
    result = PortfolioManager.place_paper_order(db_session, "TATASTEEL", "BUY", 10)
    assert result["success"] is False
    assert "Insufficient funds" in result["error"]

def test_place_paper_order_sell_success(db_session):
    user = PortfolioManager.get_or_create_user(db_session)
    
    # Pre-buy some shares
    PortfolioManager.place_paper_order(db_session, "TATASTEEL", "BUY", 10)
    
    # Sell 5 of those shares
    result = PortfolioManager.place_paper_order(db_session, "TATASTEEL", "SELL", 5)
    assert result["success"] is True
    assert "Successfully placed live order: Sold" in result["message"]
    
    # Verify remaining position
    pos = db_session.query(models.Position).filter(models.Position.symbol == "TATASTEEL").first()
    assert pos is not None
    assert pos.quantity == 5
