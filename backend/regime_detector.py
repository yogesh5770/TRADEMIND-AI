class MarketRegimeDetector:
    @staticmethod
    def detect_regime(symbol: str, data: dict, vix_price: float) -> str:
        """Classifies the asset's active market regime based on indicators and volatility indices."""
        indicators = data.get("indicators", {})
        price = data.get("price", 100.0)
        
        # Extract indicators
        rsi = indicators.get("rsi", 50.0)
        adx = indicators.get("adx", 20.0)
        atr = indicators.get("atr", price * 0.01)
        ema_9 = indicators.get("ema_9", price)
        ema_21 = indicators.get("ema_21", price)
        
        # 1. High Volatility Regime
        # If VIX exceeds 22.0 or ATR is wider than 3% of the asset price
        if vix_price > 22.0 or (atr / price) > 0.03:
            return "HIGH_VOLATILITY"
            
        # 2. Strong Trend Regimes (ADX > 25 indicating strong directional momentum)
        if adx > 25.0:
            if price > ema_9 > ema_21:
                return "STRONG_UPTREND"
            elif price < ema_9 < ema_21:
                return "STRONG_DOWNTREND"
                
        # 3. Sideways Low Volatility Regime
        # (ADX < 18 and low market volatility)
        if adx < 18.0 and vix_price < 12.0:
            return "SIDEWAYS_LOW_VOL"
            
        # 4. Mean Reverting Regime
        # (ADX < 20 with price oscillating within standard bounds)
        if adx < 20.0:
            return "MEAN_REVERTING"
            
        # Fallback default
        return "MEAN_REVERTING"
