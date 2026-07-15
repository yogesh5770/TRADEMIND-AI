# Load environment variables manually from .env file if it exists
if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                key, val = line.strip().split("=", 1)
                os.environ[key] = val

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
    
    # CoinDCX API Keys configuration (Hardcoded as default broker credentials)
    COINDCX_API_KEY: str = os.getenv("COINDCX_API_KEY", "01ede1c43c0a2fa1457a1b0b18cb8cbf5a8529ff5580737b")
    COINDCX_API_SECRET: str = os.getenv("COINDCX_API_SECRET", "e12a1a098d71981df6146a7cf4c144509dc9ee78a4aca3eeac0a9374a743cdd0")

settings = Settings()
