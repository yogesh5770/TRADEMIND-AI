import React, { useState, useEffect } from 'react';
import { Eye, TrendingUp, TrendingDown, RefreshCw, BarChart2 } from 'lucide-react';

interface MarketOverviewProps {
  marketData: Record<string, any>;
  onSelectSymbol: (symbol: string) => void;
  activeSymbol: string;
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({ marketData, onSelectSymbol, activeSymbol }) => {
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
  const [flashStates, setFlashStates] = useState<Record<string, 'up' | 'down' | null>>({});

  useEffect(() => {
    const newFlashes: Record<string, 'up' | 'down' | null> = {};
    let changed = false;

    Object.keys(marketData).forEach((sym) => {
      const currentPrice = marketData[sym]?.price;
      const previousPrice = prevPrices[sym];

      if (previousPrice && currentPrice !== previousPrice) {
        newFlashes[sym] = currentPrice > previousPrice ? 'up' : 'down';
        changed = true;
      }
    });

    if (changed) {
      setFlashStates((prev) => ({ ...prev, ...newFlashes }));
      
      const updatedPrices = { ...prevPrices };
      Object.keys(marketData).forEach((sym) => {
        updatedPrices[sym] = marketData[sym]?.price;
      });
      setPrevPrices(updatedPrices);

      const timer = setTimeout(() => {
        setFlashStates({});
      }, 800);
      return () => clearTimeout(timer);
    } else {
      const initialPrices: Record<string, number> = {};
      Object.keys(marketData).forEach((sym) => {
        if (!prevPrices[sym]) {
          initialPrices[sym] = marketData[sym]?.price;
        }
      });
      if (Object.keys(initialPrices).length > 0) {
        setPrevPrices((prev) => ({ ...prev, ...initialPrices }));
      }
    }
  }, [marketData]);

  // Dynamically pull watchable stocks (excluding indexes)
  const equities = Object.keys(marketData).filter(sym => sym !== 'NIFTY' && sym !== 'VIX');
  
  // Extract market breadth from first available symbol payload
  const firstSym = equities.find(sym => marketData[sym] !== undefined);
  const marketBreadth = firstSym ? (marketData[firstSym]?.market_breadth || 60.0) : 60.0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Upper Indices Bar: NIFTY, VIX, Market Breadth */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        
        {/* NIFTY Index */}
        <div 
          className="glass-panel metric-card"
          style={{ 
            cursor: 'pointer', 
            borderLeft: activeSymbol === 'NIFTY' ? '4px solid var(--color-primary)' : '1px solid var(--border-color)',
            padding: '1rem'
          }}
          onClick={() => onSelectSymbol('NIFTY')}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>NIFTY 50</span>
          <span className="metric-value" style={{ fontSize: '1.25rem' }}>
            {marketData['NIFTY']?.price?.toLocaleString('en-IN') || '24,000'}
          </span>
        </div>

        {/* India VIX */}
        <div 
          className="glass-panel metric-card"
          style={{ 
            cursor: 'pointer', 
            borderLeft: activeSymbol === 'VIX' ? '4px solid var(--color-warning)' : '1px solid var(--border-color)',
            padding: '1rem'
          }}
          onClick={() => onSelectSymbol('VIX')}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>INDIA VIX</span>
          <span className="metric-value" style={{ fontSize: '1.25rem', color: (marketData['VIX']?.price > 20) ? 'var(--color-danger)' : 'var(--color-success)' }}>
            {marketData['VIX']?.price?.toFixed(2) || '13.50'}
          </span>
        </div>

        {/* Market Breadth */}
        <div 
          className="glass-panel metric-card"
          style={{ 
            padding: '1rem',
            borderLeft: '1px solid var(--border-color)'
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>BREADTH</span>
          <span className="metric-value" style={{ fontSize: '1.25rem', color: 'var(--color-primary)' }}>
            {marketBreadth.toFixed(0)}%
          </span>
        </div>

      </div>

      {/* Main Watchlist */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-header)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Eye size={18} color="var(--color-primary)" />
            <span>Broker Watchlist</span>
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <RefreshCw size={12} className="animate-spin" />
            Broker Feed Live
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '0.75rem 0.5rem' }}>Symbol</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>LTP (₹)</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>ADX</th>
              <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>VWAP</th>
            </tr>
          </thead>
          <tbody>
            {equities.map((sym) => {
              const stock = marketData[sym];
              if (!stock) return null;
              
              const flash = flashStates[sym];
              const flashClass = flash === 'up' ? 'tick-up-flash' : flash === 'down' ? 'tick-down-flash' : '';
              
              const price = stock.price;
              const adx = stock.indicators?.adx || 20;
              const vwap = stock.indicators?.vwap || price;
              
              // Format LTP price (needs more decimals for low price assets/crypto fractions)
              const formattedPrice = price > 10000 
                ? price.toLocaleString('en-IN') 
                : price < 1.0 
                ? price.toFixed(4) 
                : price.toFixed(2);
                
              return (
                <tr 
                  key={sym} 
                  className={flashClass}
                  onClick={() => onSelectSymbol(sym)}
                  style={{ 
                    borderBottom: '1px solid rgba(255,255,255,0.03)', 
                    cursor: 'pointer',
                    backgroundColor: activeSymbol === sym ? 'rgba(99,102,241,0.05)' : 'transparent',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: '600' }}>{sym}</td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 'bold' }}>
                    ₹{formattedPrice}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: adx > 25 ? 'var(--color-success)' : 'var(--text-muted)' }}>
                    {adx.toFixed(0)}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: price > vwap ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    ₹{vwap > 10000 ? vwap.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : vwap.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sector Strength / Movers */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1rem', fontFamily: 'var(--font-header)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <BarChart2 size={16} color="var(--color-primary)" />
          <span>Top Watchlist Movers</span>
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {Object.keys(marketData).length === 0 ? (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading movers...</span>
          ) : (
            Object.keys(marketData)
              .map(sym => ({
                name: sym,
                pct: marketData[sym].daily_change_pct || 0.0
              }))
              .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
              .slice(0, 4)
              .map((sec) => {
                const up = sec.pct >= 0;
                return (
                  <div key={sec.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: '500' }}>{sec.name}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'bold', color: up ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {up ? '+' : ''}{sec.pct.toFixed(2)}%
                    </span>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
};
