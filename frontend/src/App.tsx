import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Link2, Radio, Cpu, BellRing, Terminal, Activity, TrendingUp, Play, Square, List } from 'lucide-react';
import { MarketOverview } from './components/MarketOverview';
import { PriceChart } from './components/PriceChart';
import { BrokerModal } from './components/BrokerModal';

// Auto-detects localhost vs deployed Render backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE = API_BASE.replace('https://', 'wss://').replace('http://', 'ws://');

export default function App() {
  const [isBrokerModalOpen, setIsBrokerModalOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState('BTC');

  // Core Data States
  const [marketData, setMarketData] = useState<Record<string, any>>({});
  const [portfolio, setPortfolio] = useState({
    balance: 0.0,
    margin: 0.0,
    daily_pnl: 0.0,
    total_value: 0.0,
    positions: [] as any[],
    trades: [] as any[],
    connected_brokers: [] as any[],
    is_bot_active: true,
    halt_reason: ''
  });
  const [alerts, setAlerts] = useState<string[]>([]);
  const [tradeLogs, setTradeLogs] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);

  // Fetch initial REST summaries
  const fetchPortfolio = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolio/summary`);
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
        if (data.trades && data.trades.length > 0) {
          const recentLogs = data.trades.slice(0, 15).map((t: any) => {
            const timeStr = new Date(t.timestamp * 1000).toLocaleTimeString();
            return `[${timeStr}] Auto-traded ${t.quantity.toFixed(4)} ${t.symbol} @ Rs.${t.price.toFixed(2)} (${t.order_type})`;
          });
          setTradeLogs(recentLogs);
        }
      }
    } catch (err) {
      console.error('Error fetching portfolio:', err);
    }
  };

  const fetchMarketSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/market/summary`);
      if (res.ok) {
        const data = await res.json();
        setMarketData(data);
      }
    } catch (err) {
      console.error('Error fetching market summary:', err);
    }
  };

  // Setup WebSocket price streams and periodic polling
  useEffect(() => {
    fetchPortfolio();
    fetchMarketSummary();

    const connectWebSocket = () => {
      const socket = new WebSocket(`${WS_BASE}/api/v1/ws`);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsConnected(true);
        console.log('WebSocket channel connected.');
      };

      socket.onmessage = (event) => {
        if (event.data === 'pong') return;
        try {
          const msg = JSON.parse(event.data);
          
          if (msg.type === 'TICK') {
            const { symbol, price } = msg.data;
            setMarketData((prev) => {
              const current = prev[symbol] || {};
              return {
                ...prev,
                [symbol]: {
                  ...current,
                  price: price,
                },
              };
            });
          } else if (msg.type === 'RISK_ALERT') {
            setAlerts((prev) => [msg.message, ...prev.slice(0, 19)]);
            fetchPortfolio();
          } else if (msg.type === 'AUTO_ORDER') {
            setTradeLogs((prev) => [msg.message, ...prev.slice(0, 29)]);
            fetchPortfolio();
          }
        } catch (e) {
          // parse error
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
        console.log('WebSocket disconnected. Reconnecting in 3s...');
        setTimeout(connectWebSocket, 3000);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connectWebSocket();

    // Poll portfolio and market data
    const pollInterval = setInterval(() => {
      fetchPortfolio();
      fetchMarketSummary();
    }, 2000);

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearInterval(pollInterval);
    };
  }, []);

  // Auto-switch price chart to first active symbol
  useEffect(() => {
    const symbols = Object.keys(marketData);
    if (symbols.length > 0 && !symbols.includes(activeSymbol)) {
      setActiveSymbol(symbols[0]);
    }
  }, [marketData]);

  const handleToggleBot = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolio/bot/toggle`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setPortfolio(prev => ({
          ...prev,
          is_bot_active: data.is_bot_active,
          halt_reason: data.halt_reason
        }));
      }
    } catch (err) {
      console.error('Error toggling bot:', err);
    }
  };

  const isBrokerConnected = portfolio.connected_brokers.length > 0;
  const connectedBrokerName = isBrokerConnected ? portfolio.connected_brokers[0].broker_name : 'No Broker';

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column' }}>
      
      {/* Top Header Navigation */}
      <header className="glass-panel" style={{
        margin: '1rem',
        padding: '0.85rem 1.25rem',
        borderRadius: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu size={24} color="var(--color-primary)" className="animate-pulse" />
          <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '1.2rem', fontWeight: '800' }}>
            TradeMind <span style={{ color: 'var(--color-primary)' }}>AI</span> <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 'bold', marginLeft: '0.5rem', border: '1px solid var(--color-success-glow)', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--color-success-glow)' }}>24/7 Scalper</span>
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Feed Socket Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <Radio size={14} color={wsConnected ? 'var(--color-success)' : 'var(--color-danger)'} className={wsConnected ? 'animate-pulse' : ''} />
            <span style={{ fontWeight: '500' }}>{wsConnected ? 'Feed Live' : 'Offline'}</span>
          </div>

          {/* Broker Status */}
          {/* Broker Status Badge */}
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.8rem',
              borderRadius: '12px',
              border: '1px solid var(--color-success)',
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              color: 'var(--color-success)',
            }}
          >
            <Link2 size={12} />
            <span>Connected: CoinDCX API</span>
          </div>
        </div>
      </header>

      {/* Main Single-Screen Grid */}
      <main style={{ padding: '0 1rem 1rem 1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Drawdown Risk Suspend Banner */}
        {portfolio.is_bot_active === false && (
          <div 
            className="glass-panel" 
            style={{ 
              borderColor: 'var(--color-danger)', 
              background: 'rgba(239, 68, 68, 0.05)', 
              marginBottom: '1rem',
              padding: '1rem' 
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '0.9rem' }}>
              <span>AUTOMATED RISK HALT ACTIVATED</span>
            </div>
            <p style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>
              Reason: {portfolio.halt_reason || "Drawdown thresholds exceeded."}
            </p>
          </div>
        )}

        <div className="dash-grid" style={{ marginTop: 0, flex: 1 }}>
          
          {/* Left Column (col-8) */}
          <div className="col-8" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Giant Balance and Core Metrics Card */}
            <div className="glass-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', padding: '1.5rem' }}>
              <div className="metric-card" style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500' }}>Live Wallet Balance</span>
                <span className="metric-value" style={{ color: 'var(--text-main)' }}>
                  ₹{portfolio.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--color-success)', fontWeight: 'bold' }}>CoinDCX Live Cash</span>
              </div>

              <div className="metric-card" style={{ borderRight: '1px solid var(--border-color)', paddingRight: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500' }}>Today's Scalping P&L</span>
                <span className="metric-value" style={{ color: portfolio.daily_pnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  ₹{portfolio.daily_pnl >= 0 ? '+' : ''}{portfolio.daily_pnl.toFixed(2)}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Real-time floating gains</span>
              </div>

              <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', justifySelf: 'center', alignSelf: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '500', marginBottom: '0.35rem' }}>24/7 AI Scalper Bot</span>
                <button 
                  onClick={handleToggleBot}
                  className="btn-primary"
                  style={{
                    backgroundColor: portfolio.is_bot_active ? 'var(--color-success)' : 'var(--color-danger)',
                    padding: '0.4rem 1.25rem',
                    fontSize: '0.8rem',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  {portfolio.is_bot_active ? <Activity size={14} /> : <Square size={14} />}
                  <span>{portfolio.is_bot_active ? 'ACTIVE & SCALPING' : 'BOT STOPPED'}</span>
                </button>
              </div>
            </div>

            {/* Price Chart */}
            <PriceChart symbol={activeSymbol} />

            {/* Live Trade Execution Console */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Terminal size={18} color="var(--color-primary)" />
                  <h3 style={{ fontSize: '0.95rem', fontFamily: 'var(--font-header)' }}>Live Trade Execution Console</h3>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Second-by-Second Updates</span>
              </div>

              <div 
                style={{
                  backgroundColor: '#05070a',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  padding: '0.85rem',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: 'var(--color-success)',
                  height: '140px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}
              >
                {tradeLogs.length === 0 ? (
                  <span style={{ color: 'var(--text-dark)', fontStyle: 'italic' }}>
                    Scanning all 340+ active markets on CoinDCX... Waiting to execute high-frequency trade entries.
                  </span>
                ) : (
                  tradeLogs.map((log, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                      <span style={{ color: 'var(--text-dark)' }}>&gt;</span>
                      <span>{log}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Right Column (col-4) */}
          <div className="col-4" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Active Scalping Holdings */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontFamily: 'var(--font-header)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <TrendingUp size={16} color="var(--color-primary)" />
                <span>Active Scalp Positions ({portfolio.positions.length})</span>
              </h3>
              
              {portfolio.positions.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '1rem 0' }}>
                  No active holdings. Bot is scanning for entry setups.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '180px', overflowY: 'auto' }}>
                  {portfolio.positions.map((pos) => {
                    const profitLoss = pos.pnl;
                    return (
                      <div key={pos.symbol} style={{
                        padding: '0.6rem',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <span style={{ fontWeight: 'bold', fontSize: '0.8rem', display: 'block' }}>{pos.symbol}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Qty: {pos.quantity.toFixed(4)}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.8rem', display: 'block', fontWeight: '500' }}>₹{pos.avg_price.toFixed(2)}</span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: profitLoss >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {profitLoss >= 0 ? '+' : ''}₹{profitLoss.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Watchlist */}
            <MarketOverview 
              marketData={marketData}
              activeSymbol={activeSymbol}
              onSelectSymbol={setActiveSymbol}
            />

          </div>

        </div>
      </main>
      
    </div>
  );
}
