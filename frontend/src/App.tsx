import React, { useState, useEffect, useRef } from 'react';
import { Home, LineChart, ShieldCheck, Link2, LogOut, Radio, Cpu, BellRing, FlaskConical } from 'lucide-react';
import { DashboardHome } from './components/DashboardHome';
import { MarketOverview } from './components/MarketOverview';
import { TradingTerminal } from './components/TradingTerminal';
import { PriceChart } from './components/PriceChart';
import { BrokerModal } from './components/BrokerModal';
import { ResearchLab } from './components/ResearchLab';

// Auto-detects localhost vs deployed Render backend
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE = API_BASE.replace('https://', 'wss://').replace('http://', 'ws://');

export default function App() {
  const [view, setView] = useState<'home' | 'terminal' | 'lab'>('home');
  const [activeSymbol, setActiveSymbol] = useState('TATASTEEL');
  const [isBrokerModalOpen, setIsBrokerModalOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  // Core Data States
  const [marketData, setMarketData] = useState<Record<string, any>>({});
  const [portfolio, setPortfolio] = useState({
    balance: 2000.0,
    margin: 2000.0,
    daily_pnl: 0.0,
    total_value: 2000.0,
    positions: [],
    trades: [],
    connected_brokers: [] as any[]
  });
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [tradeLogs, setTradeLogs] = useState<string[]>([]);

  // Pre-fill parameters for terminal order
  const [terminalSymbol, setTerminalSymbol] = useState('TATASTEEL');

  const wsRef = useRef<WebSocket | null>(null);

  // Fetch initial REST summaries
  const fetchPortfolio = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/portfolio/summary`);
      if (res.ok) {
        const data = await res.json();
        setPortfolio(data);
        if (data.trades && data.trades.length > 0) {
          const recentLogs = data.trades.slice(0, 10).map((t: any) => {
            const timeStr = new Date(t.timestamp * 1000).toLocaleTimeString();
            return `[${timeStr}] Auto-traded ${t.quantity} ${t.symbol} @ Rs.${t.price.toFixed(2)} (${t.order_type})`;
          });
          setTradeLogs(recentLogs);
        }
      }
    } catch (err) {
      console.error('Error fetching portfolio:', err);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/recommendations`);
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data);
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err);
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

  // Auto-switch price chart to first active symbol if the current one is delisted/swapped
  useEffect(() => {
    const symbols = Object.keys(marketData);
    if (symbols.length > 0 && !symbols.includes(activeSymbol)) {
      setActiveSymbol(symbols[0]);
    }
  }, [marketData, activeSymbol]);

  // Setup live websocket price stream
  useEffect(() => {
    fetchMarketSummary();
    fetchPortfolio();
    fetchRecommendations();

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

    // Poll portfolio and recommendations periodically
    const pollInterval = setInterval(() => {
      fetchPortfolio();
      fetchMarketSummary();
    }, 2000);

    const recInterval = setInterval(() => {
      fetchRecommendations();
    }, 15000);

    return () => {
      if (wsRef.current) wsRef.current.close();
      clearInterval(pollInterval);
      clearInterval(recInterval);
    };
  }, []);

  // Action callback when clicking "Place Trade" on a recommendation card
  const handleExecuteRec = (rec: any) => {
    setTerminalSymbol(rec.symbol);
    setView('terminal');
  };

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

  return (
    <div className="app-container">
      
      {/* Sidebar Panel */}
      <aside className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2.5rem', paddingLeft: '0.5rem' }}>
          <Cpu size={28} color="var(--color-primary)" />
          <h2 style={{ fontFamily: 'var(--font-header)', fontSize: '1.25rem', fontWeight: '800' }}>
            TradeMind <span style={{ color: 'var(--color-primary)' }}>AI</span>
          </h2>
        </div>

        <nav style={{ flex: 1 }}>
          <button 
            onClick={() => setView('home')} 
            className={`nav-link ${view === 'home' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <Home size={18} />
            <span>Dashboard</span>
          </button>

          <button 
            onClick={() => setView('terminal')} 
            className={`nav-link ${view === 'terminal' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <LineChart size={18} />
            <span>Trading Terminal</span>
          </button>

          <button 
            onClick={() => setView('lab')} 
            className={`nav-link ${view === 'lab' ? 'active' : ''}`}
            style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }}
          >
            <FlaskConical size={18} />
            <span>Research Lab</span>
          </button>
        </nav>

        {/* Broker connector state display */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <button 
            onClick={() => setIsBrokerModalOpen(true)}
            className="btn-outline"
            style={{
              width: '100%',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.6rem 0.5rem',
              borderColor: isBrokerConnected ? 'var(--color-success)' : 'var(--border-color)',
              color: isBrokerConnected ? 'var(--color-success)' : 'var(--text-main)',
            }}
          >
            <Link2 size={14} />
            <span>{isBrokerConnected ? `Connected: ${portfolio.connected_brokers[0].broker_name}` : 'Connect Broker API'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--text-dark)' }}>
            <Radio size={12} color={wsConnected ? 'var(--color-success)' : 'var(--color-danger)'} className={wsConnected ? 'animate-pulse' : ''} />
            <span>Feed status: {wsConnected ? 'WebSocket Live' : 'Disconnected'}</span>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '600' }}>AI Auto Bot</span>
              <button 
                onClick={handleToggleBot}
                style={{
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.75rem',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: portfolio.is_bot_active ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                  color: portfolio.is_bot_active ? 'var(--color-success)' : 'var(--color-danger)',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: portfolio.is_bot_active ? 'var(--color-success)' : 'var(--color-danger)'
                }}></span>
                {portfolio.is_bot_active ? 'Active' : 'Stopped'}
              </button>
            </div>
            {portfolio.is_bot_active === false && portfolio.halt_reason && (
              <span style={{ fontSize: '0.65rem', color: 'var(--color-danger)', lineHeight: '1.2' }}>
                Halted: {portfolio.halt_reason}
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        
        {/* Header Bar */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-header)', fontWeight: 800 }}>
              {view === 'home' ? 'Research & Control Desk' : view === 'terminal' ? 'Paper Trading Room' : 'AI Laboratory'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {view === 'lab' 
                ? 'Backtest strategies and review Win Rates, Profit Factors, and Sharpe Ratios historically.' 
                : 'Evidence-based risk assistant for Indian retail investors. Feed Source: yfinance (Prototyping Feed).'}
            </p>
          </div>

          {/* Quick Info Alerts status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <ShieldCheck size={16} color="var(--color-success)" />
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Risk Safeguards Active</span>
            </div>
            {alerts.length > 0 && (
              <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => setView('home')}>
                <BellRing size={20} color="var(--color-danger)" className="animate-bounce" />
                <span style={{ position: 'absolute', top: '-6px', right: '-6px', backgroundColor: 'var(--color-danger)', color: '#fff', fontSize: '0.65rem', padding: '1px 5px', borderRadius: '50%', fontWeight: 'bold' }}>
                  {alerts.length}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Dashboard Grid Layout */}
        {view === 'lab' ? (
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <ResearchLab />
          </div>
        ) : (
          <div className="dash-grid">
            
            {/* Main Left Section: Charts or Order Terminal */}
            <div className="col-8" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Display TradingView Candlestick Chart */}
              <PriceChart symbol={activeSymbol} />
              
              {/* Display active view */}
              {view === 'home' ? (
                <DashboardHome 
                  portfolio={portfolio}
                  recommendations={recommendations}
                  alerts={alerts}
                  tradeLogs={tradeLogs}
                  onExecuteRecommendation={handleExecuteRec}
                />
              ) : (
                <TradingTerminal 
                  portfolio={portfolio}
                  selectedSymbol={terminalSymbol}
                  onOrderSuccess={fetchPortfolio}
                />
              )}
            </div>

            {/* Sidebar Right Section: Watchlist & Market overview */}
            <div className="col-4">
              <MarketOverview 
                marketData={marketData}
                activeSymbol={activeSymbol}
                onSelectSymbol={setActiveSymbol}
              />
            </div>

          </div>
        )}
      </main>

      {/* Broker connection OAuth dialog */}
      <BrokerModal 
        isOpen={isBrokerModalOpen}
        onClose={() => setIsBrokerModalOpen(false)}
        onSuccess={fetchPortfolio}
      />
      
    </div>
  );
}
