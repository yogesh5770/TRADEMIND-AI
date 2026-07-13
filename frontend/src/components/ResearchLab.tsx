import React, { useState, useEffect, useRef } from 'react';
import { createChart, ColorType, LineSeries } from 'lightweight-charts';
import { FlaskConical, Play, Award, HelpCircle } from 'lucide-react';
import { API_BASE } from '../config';

export const ResearchLab: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [symbol, setSymbol] = useState('TATASTEEL');
  const [strategy, setStrategy] = useState('Trend Following');
  const [days, setDays] = useState(60);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<any | null>(null);

  const chartRef = useRef<any>(null);

  const runBacktest = async () => {
    setLoading(true);
    setError('');
    setResults(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/backtest?symbol=${symbol}&strategy=${encodeURIComponent(strategy)}&days=${days}`);
      if (!res.ok) throw new Error('Backtest failed');
      const data = await res.json();
      setResults(data);
    } catch (err) {
      setError('Could not complete backtest. Verify backend server is active.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current || !results || !results.equity_curve) return;

    // Initialize equity curve chart canvas
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#121824' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      width: chartContainerRef.current.clientWidth,
      height: 250,
    });
    chartRef.current = chart;

    const lineSeries = chart.addSeries(LineSeries, {
      color: '#6366f1',
      lineWidth: 2,
      title: 'Equity Growth (%)',
    });

    // Map time strings to index format for simple timeline plotting
    const chartData = results.equity_curve.map((item: any, idx: number) => ({
      time: `2026-01-${String(idx + 1).padStart(2, '0')}`, // Mock date values formatted for TV timeline
      value: item.value
    }));

    lineSeries.setData(chartData);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [results]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Parameter Settings Selector */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-header)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FlaskConical size={18} color="var(--color-primary)" />
          <span>Walk-Forward Strategy Backtest Lab</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Asset Target</label>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-main)',
                outline: 'none'
              }}
            >
              <option value="TATASTEEL">TATASTEEL (Equity)</option>
              <option value="NIFTYBEES">NIFTYBEES (ETF)</option>
              <option value="GOLDBEES">GOLDBEES (ETF)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Strategy Blueprint</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-main)',
                outline: 'none'
              }}
            >
              <option value="Trend Following">Trend Following (Multi-Timeframe)</option>
              <option value="Mean Reversion">Mean Reversion (RSI / Support)</option>
              <option value="Breakout">Breakout (S/R Range Breakouts)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Historical Window</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '0.6rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-main)',
                outline: 'none'
              }}
            >
              <option value={30}>30 Days (High-frequency 15m candles)</option>
              <option value={60}>60 Days (Standard 15m candles)</option>
              <option value={90}>90 Days (Long-term 1h candles)</option>
            </select>
          </div>

          <button
            onClick={runBacktest}
            disabled={loading}
            className="btn-primary"
            style={{
              padding: '0.75rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              height: '38px',
              boxShadow: '0 4px 12px var(--color-primary-glow)'
            }}
          >
            <Play size={14} fill="white" />
            <span>{loading ? 'Simulating...' : 'Run Backtest'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(244,63,94,0.1)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* Simulation Results Display */}
      {results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Key Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
            <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Win Rate</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-success)', fontFamily: 'var(--font-header)' }}>
                {results.win_rate}%
              </span>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Sharpe Ratio</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#c084fc', fontFamily: 'var(--font-header)' }}>
                {results.sharpe_ratio}
              </span>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Max Drawdown</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-danger)', fontFamily: 'var(--font-header)' }}>
                {results.max_drawdown}%
              </span>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Profit Factor</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-success)', fontFamily: 'var(--font-header)' }}>
                {results.profit_factor}
              </span>
            </div>
            <div className="glass-panel" style={{ padding: '1rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Total Trades</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)', fontFamily: 'var(--font-header)' }}>
                {results.total_trades}
              </span>
            </div>
          </div>

          {/* Equity Chart & Trades Ledger */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>
            
            {/* Chart Area */}
            <div className="glass-panel col-8" style={{ padding: '1rem' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem', color: 'var(--text-muted)' }}>Cumulative Returns Curve</h4>
              <div ref={chartContainerRef} style={{ width: '100%' }} />
            </div>

            {/* Trades Ledger */}
            <div className="glass-panel col-4" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', height: '302px' }}>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Historical Setup Log</h4>
              
              {results.trades.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', margin: 'auto' }}>
                  No trade executions generated in this backtest window.
                </p>
              ) : (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-dark)' }}>
                        <th style={{ padding: '0.25rem' }}>Type</th>
                        <th style={{ padding: '0.25rem', textAlign: 'right' }}>PnL</th>
                        <th style={{ padding: '0.25rem', textAlign: 'center' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.trades.map((t: any, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '0.4rem 0.25rem', fontWeight: 'bold', color: t.type === 'BUY' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {t.type}
                          </td>
                          <td style={{ padding: '0.4rem 0.25rem', textAlign: 'right', fontWeight: 'bold', color: t.pnl_pct >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {(t.pnl_pct * 100).toFixed(1)}%
                          </td>
                          <td style={{ padding: '0.4rem 0.25rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {t.exit_reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {!results && !loading && (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
          <FlaskConical size={36} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
          <h4 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>No Backtest Simulated</h4>
          <p style={{ fontSize: '0.8rem' }}>Select an asset and strategy parameters, then click Run Backtest to test performance.</p>
        </div>
      )}

    </div>
  );
};
