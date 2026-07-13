import os

class Settings:
    PROJECT_NAME: str = "TradeMind AI"
    API_V1_STR: str = "/api/v1"
    
    # SQLite Database config
    SQLITE_DB_FILE: str = "trademind.db"
    DATABASE_URL: str = "sqlite:///./trademind.db"
    
    # CORS Origins — allow all for deployed Vercel frontend + localhost dev
    CORS_ORIGINS: list[str] = ["*"]
    
    # Secret keys
    SECRET_KEY: str = "supersecret_trademind_key_change_in_prod"
    
    # Mock settings
    SIMULATE_LATENCY_MS: int = 150
    
    # Indexes to compute volatility
    INDEX_SYMBOLS: list[str] = ["NIFTY", "VIX"]

    # NSE stocks loaded in simulation mode (no broker connected)
    # These are highly liquid, affordable NSE stocks ideal for scalping
    SIMULATION_SYMBOLS: list[str] = [
        "TATASTEEL", "YESBANK", "IDEA", "SUZLON", "JPPOWER",
        "SOUTHBANK", "PNB", "BANKBARODA", "SAIL", "NHPC"
    ]

settings = Settings()
