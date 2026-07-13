class TrendFollowingStrategy:
    @staticmethod
    def generate_signal(symbol: str, data: dict, regime: str) -> dict:
        """Runs trend confirmation logic when the market exhibits strong directional regimes."""
        if regime not in ["STRONG_UPTREND", "STRONG_DOWNTREND"]:
            return {"action": "NO_TRADE", "reason": "Trend Following inactive in sideways/choppy regimes."}
            
        indicators = data.get("indicators", {})
        price = data.get("price", 100.0)
        ema_9 = indicators.get("ema_9", price)
        atr = indicators.get("atr", price * 0.01)
        
        # Bullish Entry: price retesting EMA 9 from above
        if regime == "STRONG_UPTREND" and price >= ema_9:
            stop_loss = price - (atr * 1.5)
            target = price + (atr * 3.0)
            return {
                "action": "BUY",
                "suggested_price": price,
                "stop_loss": stop_loss,
                "target": target,
                "risk_reward": 2.0,
                "reason": "Uptrend pull-back. Price holds above EMA 9. Multi-timeframe trend aligns."
            }
        
        # Bearish Entry: price retesting EMA 9 from below
        if regime == "STRONG_DOWNTREND" and price <= ema_9:
            stop_loss = price + (atr * 1.5)
            target = price - (atr * 3.0)
            return {
                "action": "SELL",
                "suggested_price": price,
                "stop_loss": stop_loss,
                "target": target,
                "risk_reward": 2.0,
                "reason": "Downtrend sell-off. Price remains capped by EMA 9. Multi-timeframe trend aligns."
            }
            
        return {"action": "NO_TRADE", "reason": "Asset did not present a pullback entry trigger."}

class MeanReversionStrategy:
    @staticmethod
    def generate_signal(symbol: str, data: dict, regime: str) -> dict:
        """Runs oscillator oversold/overbought logic near support and resistance pivots."""
        if regime not in ["MEAN_REVERTING", "SIDEWAYS_LOW_VOL"]:
            return {"action": "NO_TRADE", "reason": "Mean Reversion inactive during strong trending regimes."}
            
        indicators = data.get("indicators", {})
        price = data.get("price", 100.0)
        rsi = indicators.get("rsi", 50.0)
        support = indicators.get("support", price * 0.98)
        resistance = indicators.get("resistance", price * 1.02)
        atr = indicators.get("atr", price * 0.01)
        
        # Oversold buy at support
        if rsi < 32 or price <= support * 1.005:
            stop_loss = price - (atr * 1.2)
            target = price + (atr * 2.4)
            return {
                "action": "BUY",
                "suggested_price": price,
                "stop_loss": stop_loss,
                "target": target,
                "risk_reward": 2.0,
                "reason": f"Mean reversion BUY setup. RSI is oversold ({rsi:.1f}) near support level ₹{support:.2f}."
            }
            
        # Overbought sell at resistance
        if rsi > 68 or price >= resistance * 0.995:
            stop_loss = price + (atr * 1.2)
            target = price - (atr * 2.4)
            return {
                "action": "SELL",
                "suggested_price": price,
                "stop_loss": stop_loss,
                "target": target,
                "risk_reward": 2.0,
                "reason": f"Mean reversion SELL setup. RSI is overbought ({rsi:.1f}) near resistance level ₹{resistance:.2f}."
            }
            
        return {"action": "NO_TRADE", "reason": "Oscillators did not reach extreme overbought/oversold boundaries."}

class BreakoutStrategy:
    @staticmethod
    def generate_signal(symbol: str, data: dict, regime: str) -> dict:
        """Identifies price breakouts above resistance or below support on expanded range bars."""
        indicators = data.get("indicators", {})
        price = data.get("price", 100.0)
        support = indicators.get("support", price * 0.98)
        resistance = indicators.get("resistance", price * 1.02)
        atr = indicators.get("atr", price * 0.01)
        
        # Bullish breakout above resistance range
        if price > resistance:
            stop_loss = price - (atr * 1.5)
            target = price + (atr * 3.5)
            return {
                "action": "BUY",
                "suggested_price": price,
                "stop_loss": stop_loss,
                "target": target,
                "risk_reward": 2.3,
                "reason": f"Resistance breakout. Price pierced key resistance line ₹{resistance:.2f} with trend expansion."
            }
            
        # Bearish breakout below support range
        if price < support:
            stop_loss = price + (atr * 1.5)
            target = price - (atr * 3.5)
            return {
                "action": "SELL",
                "suggested_price": price,
                "stop_loss": stop_loss,
                "target": target,
                "risk_reward": 2.3,
                "reason": f"Support breakdown. Price pierced key support line ₹{support:.2f} with trend expansion."
            }
            
        return {"action": "NO_TRADE", "reason": "Price remains bound within historical support/resistance channel."}

class IntradayScalpingStrategy:
    @staticmethod
    def generate_signal(symbol: str, data: dict, regime: str) -> dict:
        """Executes rapid momentum scalp trades on short-term EMA/RSI crossovers."""
        indicators = data.get("indicators", {})
        price = data.get("price", 100.0)
        rsi = indicators.get("rsi", 50.0)
        ema_9 = indicators.get("ema_9", price)
        ema_21 = indicators.get("ema_21", price)
        atr = indicators.get("atr", price * 0.008) # use tighter scalping multiplier
        
        # Bullish scalp crossover
        if price > ema_9 > ema_21 and rsi > 52.0:
            stop_loss = price - (atr * 1.0)
            target = price + (atr * 1.2)
            return {
                "action": "BUY",
                "suggested_price": price,
                "stop_loss": stop_loss,
                "target": target,
                "risk_reward": 1.2,
                "reason": f"Intraday Scalp BUY setup. Crossover confirmed (EMA9: {ema_9:.2f} > EMA21: {ema_21:.2f}) with RSI momentum ({rsi:.1f})."
            }
            
        # Bearish scalp crossover
        if price < ema_9 < ema_21 and rsi < 48.0:
            stop_loss = price + (atr * 1.0)
            target = price - (atr * 1.2)
            return {
                "action": "SELL",
                "suggested_price": price,
                "stop_loss": stop_loss,
                "target": target,
                "risk_reward": 1.2,
                "reason": f"Intraday Scalp SELL setup. Crossover confirmed (EMA9: {ema_9:.2f} < EMA21: {ema_21:.2f}) with RSI deceleration ({rsi:.1f})."
            }
            
        return {"action": "NO_TRADE", "reason": "No micro-momentum crossovers detected on 1m chart."}
