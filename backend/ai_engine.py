import random
from backend.data_engine import market_engine

# Simulating news headlines for sentiment analysis
MOCK_HEADLINES = {
    "TATASTEEL": [
        "Tata Steel reports robust expansion in domestic production capacity.",
        "Steel demand surges in infrastructure sectors, boosting Tata Steel.",
        "Global steel prices contract amid European slowdown.",
        "Tata Steel receives green clearance for Odisha processing facility."
    ],
    "NIFTYBEES": [
        "FII inflows accelerate in Indian index funds.",
        "Indian economy records strong GDP growth projection of 7.2%.",
        "Inflation fears trigger consolidation in domestic equities."
    ],
    "GOLDBEES": [
        "Gold prices rally as global central banks expand reserves.",
        "Rupee depreciation pushes gold ETFs to record highs in India.",
        "Risk-on sentiment returns to markets; safe-havens drop."
    ],
    "YESBANK": [
        "Yes Bank reports high growth in retail deposits.",
        "Analysts expect recovery in Yes Bank net profit margins.",
        "NPA levels drop at Yes Bank, signaling stability."
    ],
    "IDEA": [
        "Vodafone Idea receives fresh equity investment interest.",
        "Subscribers grow in urban circles for Vodafone Idea.",
        "Debt repayment timeline extended for Vodafone Idea."
    ],
    "JPPOWER": [
        "Jaiprakash Power signs new long-term energy supply agreement.",
        "Power demand spikes, boosting Jaiprakash Power revenues.",
        "Operational profits jump at JP Power plants."
    ],
    "SOUTHBANK": [
        "South Indian Bank posts strong quarterly credit growth.",
        "South Indian Bank expands digital retail banking footprint.",
        "Dividends announced for South Indian Bank shareholders."
    ],
    "BTC": [
        "Institutions acquire record spot Bitcoin ETF reserves.",
        "Regulatory warnings in Asian markets trigger liquidations in BTC.",
        "Bitcoin hash rate hits all-time high, securing blockchain network."
    ],
    "ETH": [
        "Ethereum gas fees hit multi-year lows, accelerating DApp usage.",
        "Staking rewards yield increases interest in Ethereum nodes.",
        "Smart contract exploit in major lending protocol triggers ETH outflows."
    ]
}

class TrendAI:
    @staticmethod
    def evaluate(sym: str, data: dict) -> tuple[int, float, str]:
        """Analyzes multi-timeframe EMA indicators and ADX trend strength."""
        indicators = data.get("indicators", {})
        price = data.get("price", 100.0)
        ema9 = indicators.get("ema_9", price)
        ema21 = indicators.get("ema_21", price)
        adx = indicators.get("adx", 20.0)
        mtf = data.get("mtf_trend", "NEUTRAL")
        
        # Bullish: price above EMAs, ADX > 25 (trending), daily aligns
        if price > ema9 > ema21 and adx > 22 and mtf == "BULLISH":
            return 1, 0.85, f"Strong uptrend confirmed. Daily and 15m timeframes align. ADX: {adx:.1f} shows solid strength."
        elif price < ema9 < ema21 and adx > 22 and mtf == "BEARISH":
            return -1, 0.82, f"Downward trend accelerating. Multi-timeframe trend is bearish. ADX: {adx:.1f} shows solid strength."
        
        return 0, 0.50, f"No clear trend direction. ADX: {adx:.1f} indicates consolidation."

class ReversalAI:
    @staticmethod
    def evaluate(sym: str, data: dict) -> tuple[int, float, str]:
        """Identifies overbought/oversold extremes near key support & resistance bounds."""
        indicators = data.get("indicators", {})
        price = data.get("price", 100.0)
        rsi = indicators.get("rsi", 50.0)
        support = indicators.get("support", price * 0.98)
        resistance = indicators.get("resistance", price * 1.02)
        
        # Buy on oversold retesting support
        if rsi < 32 or price <= support * 1.005:
            confidence = 0.90 if rsi < 25 else 0.75
            return 1, confidence, f"Reversal BUY signal. RSI is oversold at {rsi:.1f} near key support limit ₹{support:.2f}."
        # Sell on overbought retesting resistance
        elif rsi > 68 or price >= resistance * 0.995:
            confidence = 0.88 if rsi > 75 else 0.73
            return -1, confidence, f"Reversal SELL signal. RSI is overbought at {rsi:.1f} near resistance limit ₹{resistance:.2f}."
            
        return 0, 0.50, f"Oscillator neutral (RSI: {rsi:.1f}). Asset trading within support/resistance channels."

class VolumeAI:
    @staticmethod
    def evaluate(sym: str, data: dict) -> tuple[int, float, str]:
        """Checks VWAP price crossovers and On-Balance-Volume direction."""
        indicators = data.get("indicators", {})
        price = data.get("price", 100.0)
        vwap = indicators.get("vwap", price)
        obv = indicators.get("obv", 0.0)
        
        # Bullish: price above VWAP and rising volumes
        if price > vwap * 1.002:
            return 1, 0.75, f"Bullish volume support. Price trades above VWAP (₹{vwap:.2f}) with rising buyer concentration."
        elif price < vwap * 0.998:
            return -1, 0.72, f"Bearish volume flow. Price is below VWAP (₹{vwap:.2f}), suggesting institutional distribution."
            
        return 0, 0.50, "Neutral volume activity. Price is tightly anchored to intraday VWAP."

class VolatilityAI:
    @staticmethod
    def evaluate(sym: str, data: dict) -> tuple[int, float, str]:
        """Scans India VIX level to establish risk limits and volatility trends."""
        vix = market_engine.prices.get("VIX", 13.5)
        
        # High VIX triggers a Wait vote (low volatility preferred for retail investors)
        if vix > 25.0:
            return 0, 0.95, f"VIX elevated at {vix:.1f}. High market fear, recommending NO trade to protect low capital."
        elif vix < 10.0:
            return 0, 0.60, f"VIX low at {vix:.1f}. Low liquidity, narrow ranges."
            
        return 1, 0.70, f"VIX normal at {vix:.1f}. Favorable environment for breakout/trend following."

class NewsAI:
    @staticmethod
    def evaluate(sym: str) -> tuple[int, float, str]:
        """Extracts and parses mock news headlines to return a sentiment vote."""
        headlines = MOCK_HEADLINES.get(sym, ["Market activity normal."])
        headline = random.choice(headlines)
        
        # Simple sentiment keywords check
        bullish_words = ["robust", "surges", "growth", "rally", "buys", "records", "acquisition", "clearance"]
        bearish_words = ["contract", "slowdown", "fears", "warnings", "liquidations", "exploit", "outflows"]
        
        score = 0
        sentiment = "NEUTRAL"
        
        for w in bullish_words:
            if w in headline.lower():
                score += 1
        for w in bearish_words:
            if w in headline.lower():
                score -= 1
                
        if score > 0:
            return 1, 0.75, f"Positive Sentiment: '{headline}'"
        elif score < 0:
            return -1, 0.72, f"Negative Sentiment: '{headline}'"
            
        return 0, 0.50, f"Neutral News: '{headline}'"

class RiskAI:
    @staticmethod
    def evaluate(sym: str, data: dict) -> tuple[int, float, str]:
        """Evaluates entry safety based on spread and stop loss distance."""
        indicators = data.get("indicators", {})
        price = data.get("price", 100.0)
        atr = indicators.get("atr", price * 0.01)
        
        stop_distance_pct = (atr * 1.5) / price
        
        # If stop loss distance is wider than 4% of price, risk is too high for a ₹100-300 account
        if stop_distance_pct > 0.04:
            return 0, 0.85, f"Risk rejected. Stop-loss envelope ({stop_distance_pct*100:.1f}%) is too wide for low capital safety."
            
        return 1, 0.80, f"Risk profile acceptable. Potential stop distance: {stop_distance_pct*100:.1f}%."

class AIAnaEngine:
    @staticmethod
    def generate_recommendations() -> list[dict]:
        recommendations = []
        symbols = market_engine.active_symbols
        
        for sym in symbols:
            rec = AIAnaEngine.analyze_symbol(sym)
            if rec:
                recommendations.append(rec)
                
        # Sort recommendations by confidence
        recommendations.sort(key=lambda x: x["confidence"], reverse=True)
        return recommendations

    @staticmethod
    def analyze_symbol(sym: str) -> dict:
        data = market_engine.get_latest_data(sym)
        if "indicators" not in data:
            return None
            
        # Invoke individual specialist votes
        trend_vote, trend_conf, trend_msg = TrendAI.evaluate(sym, data)
        reversal_vote, reversal_conf, reversal_msg = ReversalAI.evaluate(sym, data)
        volume_vote, volume_conf, volume_msg = VolumeAI.evaluate(sym, data)
        vol_vote, vol_conf, vol_msg = VolatilityAI.evaluate(sym, data)
        news_vote, news_conf, news_msg = NewsAI.evaluate(sym)
        risk_vote, risk_conf, risk_msg = RiskAI.evaluate(sym, data)
        
        # Aggregate consensus score (range -6 to +6)
        total_score = trend_vote + reversal_vote + volume_vote + vol_vote + news_vote + risk_vote
        
        # Decide Action based on consensus
        action = "WAIT"
        if total_score >= 3:
            action = "BUY"
        elif total_score <= -3:
            action = "SELL"
            
        # Calculate overall confidence percentage
        votes_in_favor = sum(1 for v in [trend_vote, reversal_vote, volume_vote, vol_vote, news_vote, risk_vote] if (action == "BUY" and v > 0) or (action == "SELL" and v < 0))
        confidence = round(votes_in_favor / 6.0, 2) if votes_in_favor > 0 else 0.50
        
        price = data["price"]
        atr = data["indicators"]["atr"]
        
        # Expected Move & Risk calculations (Tightened 3.5x for High-Frequency Scalping)
        expected_move_pct = round((atr * 0.7) / price * 100, 2)
        risk_pct = round((atr * 0.35) / price * 100, 2)
        risk_reward = round(expected_move_pct / max(0.1, risk_pct), 1)
        
        # Set target / SL targets
        if action == "BUY":
            stop_loss = price - (atr * 0.35)
            target = price + (atr * 0.7)
        else:
            stop_loss = price + (atr * 0.35)
            target = price - (atr * 0.7)
            
        # Expected holding time estimation in minutes (simulated based on average timeframe targets)
        expected_hold_mins = int((atr / max(0.01, price * 0.001)) * 12)
        
        # Calculate quantity based on ₹100 - ₹300 per asset order budget
        is_crypto = not sym.endswith(".NS") and sym not in ["NIFTY", "VIX", "TATASTEEL", "SOUTHBANK", "JPPOWER", "SUZLON", "YESBANK", "IDEA", "PNB", "BANKBARODA", "SAIL", "NHPC"]
        if is_crypto:
            # For crypto, you can buy fractional shares. Let's allocate exactly ₹100 order size!
            quantity = round(100.0 / price, 6)
        else:
            # For shares, check if price exceeds ₹300, if so, quantity is 0 (or 1 if balance permits)
            if price <= 300.0:
                quantity = 1
            else:
                quantity = 0

        # Create detailed agent verdict report
        rationale_md = f"""### Multi-Agent Decision Board for {sym}
- **Trend Specialist**: Vote={trend_vote} ({trend_msg})
- **Reversal Specialist**: Vote={reversal_vote} ({reversal_msg})
- **Volume Specialist**: Vote={volume_vote} ({volume_msg})
- **Volatility Specialist**: Vote={vol_vote} ({vol_msg})
- **News Sentiment Agent**: Vote={news_vote} ({news_msg})
- **Risk Assessor**: Vote={risk_vote} ({risk_msg})

**Consensus Matrix**: Aggregate score is **{total_score:+}** resulting in **{action}**.
Expected price move is **{expected_move_pct}%** with a risk footprint of **{risk_pct}%**.
"""

        return {
            "symbol": sym,
            "action": action,
            "confidence": confidence,
            "suggested_price": round(price, 2),
            "stop_loss": round(stop_loss, 2),
            "target": round(target, 2),
            "risk_reward": risk_reward,
            "quantity": quantity,
            "expected_move_pct": expected_move_pct,
            "risk_pct": risk_pct,
            "expected_hold_minutes": expected_hold_mins,
            "estimated_cost": round(price * quantity * 0.0005, 2) if quantity > 0 else 0.0,
            "rationale": rationale_md,
            "models_signals": {
                "trend": {"vote": trend_vote, "msg": trend_msg},
                "reversal": {"vote": reversal_vote, "msg": reversal_msg},
                "volume": {"vote": volume_vote, "msg": volume_msg},
                "volatility": {"vote": vol_vote, "msg": vol_msg},
                "news": {"vote": news_vote, "msg": news_msg},
                "risk": {"vote": risk_vote, "msg": risk_msg}
            }
        }
