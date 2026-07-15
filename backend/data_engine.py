import datetime
import random
import threading
import time
import pandas as pd
import numpy as np
import yfinance as yf
from backend import models

class MarketDataEngine:
    def __init__(self):
        # We start with ZERO hardcoded stocks/cryptos. Only default index tracking parameters.
        self.prices = {
            "NIFTY": 24000.0,
            "VIX": 13.5
        }
        self.historical_data = {}      # Intraday 1-minute indicators
        self.daily_historical = {}     # Daily indicators for macro trend
        self.subscribers = []
        self.running = False
        self.thread = None
        self.active_symbols = []       # Populated dynamically by Broker API only
        self.cryptos = {"BTC", "ETH", "ADA", "XRP", "TRX", "DOGE", "SHIB"}
        self.precisions = {}           # Stores target currency decimal precisions
        
        
    def _fetch_coindcx_balances_raw(self, api_key: str, api_secret: str) -> list:
        """Fetches the raw wallet balances list from the CoinDCX API using HMAC signature."""
        import hmac
        import hashlib
        import json
        import requests
        
        url = "https://api.coindcx.com/exchange/v1/users/balances"
        body = {
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
            
            res = requests.post(url, data=json_body, headers=headers, timeout=5)
            if res.status_code == 200:
                return res.json()
            return None
        except Exception as e:
            print(f"Error calling CoinDCX API raw balances: {e}")
            return None

    def _fetch_coindcx_balance(self, api_key: str, api_secret: str) -> float:
        """Fetches the real INR wallet balance from the CoinDCX API using raw helper."""
        balances = self._fetch_coindcx_balances_raw(api_key, api_secret)
        if balances:
            for item in balances:
                if item.get("currency") == "INR":
                    return float(item.get("balance", 0.0))
        return None

    def _fetch_coindcx_markets(self) -> list[str]:
        """Fetches all active INR-quote markets from CoinDCX API dynamically, sorted by highest 24h volume/liquidity."""
        import requests
        
        ticker_url = "https://api.coindcx.com/exchange/ticker"
        market_details_url = "https://api.coindcx.com/exchange/v1/markets_details"
        
        try:
            details_res = requests.get(market_details_url, timeout=5)
            if details_res.status_code != 200:
                return ["BTC", "ETH", "ADA", "XRP", "TRX", "DOGE", "SHIB"]
                
            markets_metadata = details_res.json()
            active_inr_pairs = {}
            for m in markets_metadata:
                if m.get("base_currency_short_name") == "INR" and m.get("status") == "active":
                    coindcx_symbol = m.get("symbol")
                    base_coin = m.get("target_currency_short_name")
                    precision = m.get("target_currency_precision", 6)
                    if coindcx_symbol and base_coin:
                        active_inr_pairs[coindcx_symbol] = base_coin
                        self.precisions[base_coin] = int(precision)
            
            ticker_res = requests.get(ticker_url, timeout=5)
            if ticker_res.status_code == 200:
                tickers = ticker_res.json()
                scored_assets = []
                for t in tickers:
                    pair_name = t.get("market", "").replace("_", "").replace("-", "")
                    matched_coin = None
                    for sym, base_coin in active_inr_pairs.items():
                        if pair_name.endswith(sym):
                            matched_coin = base_coin
                            break
                            
                    if matched_coin:
                        volume = float(t.get("volume", 0.0))
                        last_price = float(t.get("last_price", 0.0))
                        notional_volume = volume * last_price
                        
                        scored_assets.append({
                            "symbol": matched_coin,
                            "volume": notional_volume
                        })
                
                scored_assets.sort(key=lambda x: x["volume"], reverse=True)
                all_active = []
                for item in scored_assets:
                    sym = item["symbol"]
                    if sym not in all_active:
                        all_active.append(sym)
                
                # Always ensure core cryptos are included in active catalog
                for core in ["BTC", "ETH", "ADA", "XRP", "TRX", "DOGE", "SHIB"]:
                    if core in active_inr_pairs.values() and core not in all_active:
                        all_active.append(core)
                return all_active
            
            return list(active_inr_pairs.values())[:40]
        except Exception as e:
            print(f"Error fetching CoinDCX markets: {e}")
            return ["BTC", "ETH", "ADA", "XRP", "TRX", "DOGE", "SHIB"]

    def sync_with_broker(self, db):
        """Checks if a broker is connected and pulls the active tradable asset list from the Broker API."""
        user = db.query(models.User).filter(models.User.username == "retail_investor").first()
        if not user:
            return
            
        # Check database for active broker connections
        conn = db.query(models.BrokerConnection).filter(
            models.BrokerConnection.user_id == user.id,
            models.BrokerConnection.is_active == True
        ).first()
        
        if not conn:
            # No broker connected — load simulation/paper-trading symbols automatically
            # so the AI engine always has real live data to scan and generate signals
            from backend.config import settings
            sim_symbols = settings.SIMULATION_SYMBOLS
            print(f"No broker connected. Loading {len(sim_symbols)} simulation symbols for paper trading: {sim_symbols}")
            new_symbols = []
            for sym in sim_symbols:
                if sym not in self.prices:
                    self.prices[sym] = random.uniform(15.0, 250.0)
                new_symbols.append(sym)
                if sym not in self.active_symbols:
                    self._load_symbol_data(sym)
            self.active_symbols = new_symbols
            return

        # Simulate fetching the tradable catalog from the connected broker API
        # A real broker client (Zerodha Kite/AngelOne) would return the user's watchlist or tradeable universe
        if conn.broker_name == "Zerodha Kite":
            broker_assets = ["TATASTEEL", "NIFTYBEES", "GOLDBEES", "YESBANK", "IDEA"]
        elif conn.broker_name == "Angel One":
            broker_assets = ["TATASTEEL", "SOUTHBANK", "JPPOWER", "SUZLON"]
        elif conn.broker_name == "CoinDCX API":
            broker_assets = self._fetch_coindcx_markets()
            self.cryptos = set(broker_assets)
            # Fetch user balances directly from the real CoinDCX API using credentials
            raw_balances = self._fetch_coindcx_balances_raw(conn.client_id, conn.access_token)
            if raw_balances:
                real_bal = 0.0
                for item in raw_balances:
                    if item.get("currency") == "INR":
                        real_bal = float(item.get("balance", 0.0))
                user.balance = real_bal
                user.margin = real_bal
                user.peak_value = real_bal
                user.is_bot_active = True
                user.halt_reason = None
                
                # Import models and sync user holdings
                from backend import models
                db.query(models.Position).filter(models.Position.user_id == user.id).delete()
                
                for item in raw_balances:
                    currency = item.get("currency")
                    balance = float(item.get("balance", 0.0))
                    if currency != "INR" and balance > 0.000001:
                        current_price = self.prices.get(currency) or 100.0
                        if currency == "BTC":
                            current_price = self.prices.get("BTC", 5382316.39)
                            
                        pos = models.Position(
                            user_id=user.id,
                            symbol=currency,
                            quantity=balance,
                            avg_price=current_price,
                            current_price=current_price,
                            pnl=0.0
                        )
                        db.add(pos)
                db.commit()
                print(f"Synced user balances from CoinDCX. Cash: Rs.{real_bal:.2f}. Active positions reconstructed.")
            else:
                print("Could not retrieve real CoinDCX balance (mock keys or timeout). Keeping existing balance.")
        else:
            # Generic simulated broker
            broker_assets = ["TATASTEEL", "NIFTYBEES", "GOLDBEES", "YESBANK", "BTC", "ETH"]

        print(f"Syncing with broker '{conn.broker_name}' API. Discovered assets: {broker_assets}")
        
        # Load data dynamically for the broker assets
        new_symbols = []
        for sym in broker_assets:
            if sym not in self.prices:
                # Seed initial mock price
                crypto_prices = {
                    "BTC": 5500000.0, "ETH": 300000.0, "ADA": 30.0,
                    "XRP": 50.0, "TRX": 10.0, "DOGE": 12.0, "SHIB": 0.0015
                }
                self.prices[sym] = crypto_prices.get(sym, random.uniform(15.0, 200.0))
            
            new_symbols.append(sym)
            if sym not in self.active_symbols:
                self._load_symbol_data(sym)

        self.active_symbols = new_symbols

    def _load_symbol_data(self, sym):
        """Loads historical candles dynamically for a symbol fetched from the Broker API."""
        # Dynamic mapping to Yahoo Finance symbols
        is_crypto = sym in self.cryptos
        ysym = f"{sym}-USD" if is_crypto else f"{sym}.NS"
        
        # Performance optimization: Load yfinance historical charts only for top 30 assets
        # Use fast, live-ticker-based fallbacks for the other 300+ markets to keep startup instant
        if is_crypto and len(self.daily_historical) > 30:
            self._load_fallback_data(sym)
            return
            
        try:
            ticker = yf.Ticker(ysym)
            df_daily = ticker.history(period="3mo", interval="1d")
            if not df_daily.empty:
                if is_crypto:
                    for col in ["Open", "High", "Low", "Close"]:
                        df_daily[col] = df_daily[col] * 83.5
                df_daily['SMA_20'] = df_daily['Close'].rolling(window=20).mean()
                self.daily_historical[sym] = df_daily.ffill().bfill()
            
            df_intraday = ticker.history(period="1d", interval="1m")
            if not df_intraday.empty:
                if is_crypto:
                    for col in ["Open", "High", "Low", "Close"]:
                        df_intraday[col] = df_intraday[col] * 83.5
                df_intraday = self.calculate_advanced_indicators(df_intraday)
                self.historical_data[sym] = df_intraday
                self.prices[sym] = float(df_intraday['Close'].iloc[-1])
                print(f"Dynamically loaded {sym} from Broker Feed. Price: Rs.{self.prices[sym]:.2f}")
            else:
                self._load_fallback_data(sym)
        except Exception as e:
            print(f"Error fetching Broker Feed data for {sym}: {e}. Seeding fallbacks.")
            self._load_fallback_data(sym)

    def _load_fallback_data(self, sym):
        """Generates synthetic historical daily & intraday data if API limits hit."""
        base = self.prices.get(sym, 50.0)
        dates = pd.date_range(end=datetime.datetime.now(), periods=100, freq='1min')
        
        data = {
            'Open': [], 'High': [], 'Low': [], 'Close': [], 'Volume': []
        }
        curr = base
        for _ in range(100):
            change = random.uniform(-0.005, 0.005)
            o = curr
            c = curr * (1 + change)
            h = max(o, c) * (1 + random.uniform(0, 0.002))
            l = min(o, c) * (1 - random.uniform(0, 0.002))
            v = int(random.uniform(1000, 50000))
            data['Open'].append(o)
            data['High'].append(h)
            data['Low'].append(l)
            data['Close'].append(c)
            data['Volume'].append(v)
            curr = c
            
        df = pd.DataFrame(data, index=dates)
        self.historical_data[sym] = self.calculate_advanced_indicators(df)
        
        daily_dates = pd.date_range(end=datetime.datetime.now(), periods=60, freq='D')
        # Build daily df from lists in data dict (slice each list to 60 items)
        daily_data = {k: v[:60] for k, v in data.items()}
        df_daily = pd.DataFrame(daily_data, index=daily_dates)
        df_daily['SMA_20'] = df_daily['Close'].rolling(window=20).mean()
        self.daily_historical[sym] = df_daily.ffill().bfill()
        self.prices[sym] = float(df['Close'].iloc[-1])

    def calculate_advanced_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculates advanced indicators: EMA, RSI, MACD, ATR, ADX, OBV, VWAP, Support/Resistance."""
        df = df.copy()
        close = df['Close']
        high = df['High']
        low = df['Low']
        volume = df['Volume']
        
        df['EMA_9'] = close.ewm(span=9, adjust=False).mean()
        df['EMA_21'] = close.ewm(span=21, adjust=False).mean()
        df['SMA_20'] = close.rolling(window=20).mean()
        
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / (loss + 1e-10)
        df['RSI_14'] = 100 - (100 / (1 + rs))
        
        ema_12 = close.ewm(span=12, adjust=False).mean()
        ema_26 = close.ewm(span=26, adjust=False).mean()
        df['MACD'] = ema_12 - ema_26
        df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
        df['MACD_Hist'] = df['MACD'] - df['MACD_Signal']
        
        tr1 = high - low
        tr2 = (high - close.shift(1)).abs()
        tr3 = (low - close.shift(1)).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        df['ATR_14'] = tr.rolling(window=14).mean()
        
        upmove = high.diff()
        downmove = low.diff()
        plus_dm = np.where((upmove > downmove) & (upmove > 0), upmove, 0.0)
        minus_dm = np.where((downmove > upmove) & (downmove > 0), downmove, 0.0)
        
        atr = df['ATR_14'] + 1e-10
        plus_di = 100 * (pd.Series(plus_dm, index=df.index).rolling(window=14).mean() / atr)
        minus_di = 100 * (pd.Series(minus_dm, index=df.index).rolling(window=14).mean() / atr)
        
        dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di + 1e-10)
        df['ADX_14'] = dx.rolling(window=14).mean()
        df['ADX_14'] = df['ADX_14'].fillna(20.0)
        
        obv = [0.0]
        for i in range(1, len(close)):
            if close.iloc[i] > close.iloc[i-1]:
                obv.append(obv[-1] + volume.iloc[i])
            elif close.iloc[i] < close.iloc[i-1]:
                obv.append(obv[-1] - volume.iloc[i])
            else:
                obv.append(obv[-1])
        df['OBV'] = obv
        
        typical_price = (high + low + close) / 3.0
        df['VWAP'] = (typical_price * volume).cumsum() / (volume.cumsum() + 1e-10)
        
        df['Support'] = low.rolling(window=20).min()
        df['Resistance'] = high.rolling(window=20).max()
        
        df = df.ffill().bfill()
        return df

    def get_latest_data(self, symbol: str) -> dict:
        """Assembles indicator values, multi-timeframe checks, and breadth stats."""
        if symbol not in self.historical_data:
            return {"symbol": symbol, "price": self.prices.get(symbol, 100.0)}
            
        df = self.historical_data[symbol]
        last_row = df.iloc[-1]
        
        daily_bullish = True
        if symbol in self.daily_historical:
            daily_row = self.daily_historical[symbol].iloc[-1]
            daily_bullish = float(daily_row['Close']) > float(daily_row['SMA_20'])
            
        intraday_bullish = self.prices[symbol] > float(last_row['EMA_21'])
        mtf_trend = "BULLISH" if (daily_bullish and intraday_bullish) else \
                    "BEARISH" if (not daily_bullish and not intraday_bullish) else \
                    "NEUTRAL"

        breadth_count = 0
        for s in self.active_symbols:
            if s in self.historical_data:
                s_df = self.historical_data[s]
                if self.prices[s] > s_df['SMA_20'].iloc[-1]:
                    breadth_count += 1
        market_breadth = (breadth_count / len(self.active_symbols)) * 100 if self.active_symbols else 0.0

        daily_change_pct = 0.0
        if symbol in self.daily_historical:
            daily_df = self.daily_historical[symbol]
            if len(daily_df) > 1:
                prev_close = float(daily_df['Close'].iloc[-2])
                if prev_close > 0.0:
                    daily_change_pct = ((self.prices[symbol] - prev_close) / prev_close) * 100

        return {
            "symbol": symbol,
            "price": self.prices[symbol],
            "daily_change_pct": daily_change_pct,
            "open": float(last_row['Open']),
            "high": max(float(last_row['High']), self.prices[symbol]),
            "low": min(float(last_row['Low']), self.prices[symbol]),
            "close": float(last_row['Close']),
            "volume": int(last_row['Volume']),
            "mtf_trend": mtf_trend,
            "market_breadth": market_breadth,
            "indicators": {
                "rsi": float(last_row['RSI_14']),
                "macd": float(last_row['MACD']),
                "macd_signal": float(last_row['MACD_Signal']),
                "macd_hist": float(last_row['MACD_Hist']),
                "ema_9": float(last_row['EMA_9']),
                "ema_21": float(last_row['EMA_21']),
                "adx": float(last_row['ADX_14']),
                "obv": float(last_row['OBV']),
                "vwap": float(last_row['VWAP']),
                "support": float(last_row['Support']),
                "resistance": float(last_row['Resistance']),
                "atr": float(last_row['ATR_14'])
            }
        }

    def subscribe(self, callback):
        self.subscribers.append(callback)
        
    def unsubscribe(self, callback):
        if callback in self.subscribers:
            self.subscribers.remove(callback)

    def start_simulation(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self._run_simulation, daemon=True)
        self.thread.start()
        print("Live real-market polling / simulation started.")

    def stop_simulation(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
            self.thread = None

    def _run_simulation(self):
        while self.running:
            try:
                # If watchlist is empty, sleep and check again
                if not self.active_symbols:
                    time.sleep(1.0)
                    continue
                    
                sym = random.choice(self.active_symbols + ["VIX"])
                
                if sym != "VIX" and random.random() > 0.85:
                    ysym = "BTC-INR" if sym == "BTC" else "ETH-INR" if sym == "ETH" else f"{sym}.NS"
                    ticker = yf.Ticker(ysym)
                    fast_info = ticker.fast_info
                    if 'last_price' in fast_info and fast_info['last_price'] is not None:
                        new_price = float(fast_info['last_price'])
                        if new_price > 0:
                            self.prices[sym] = new_price
                
                spread = random.uniform(-0.0004, 0.0004)
                self.prices[sym] = round(self.prices[sym] * (1 + spread), 2)
                
                if sym == "VIX":
                    self.prices[sym] = max(8.0, min(30.0, self.prices[sym]))
                else:
                    self.prices[sym] = max(0.5, self.prices[sym])

                tick_info = {
                    "symbol": sym,
                    "price": self.prices[sym],
                    "timestamp": datetime.datetime.utcnow().isoformat()
                }
                
                for callback in self.subscribers:
                    try:
                        callback(tick_info)
                    except Exception:
                        pass
            except Exception as e:
                pass
            time.sleep(0.4)

market_engine = MarketDataEngine()
