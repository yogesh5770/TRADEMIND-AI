import React, { useState } from 'react';
import { ShieldCheck, ShoppingBag } from 'lucide-react';
import { API_BASE } from '../config';

interface TradingTerminalProps {
  portfolio: {
    balance: number;
    margin: number;
    daily_pnl: number;
    total_value: number;
    positions: any[];
    trades: any[];
    is_bot_active?: boolean;
    halt_reason?: string;
  };
  selectedSymbol: string;
  onOrderSuccess: () => void;
}

export const TradingTerminal: React.FC<TradingTerminalProps> = ({ portfolio, selectedSymbol, onOrderSuccess }) => {
  const [symbol, setSymbol] = useState(selectedSymbol || 'TATASTEEL');
  const [orderType, setOrderType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState<number>(1);
  const [stopLoss, setStopLoss] = useState('');
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sync state if prop changes
  React.useEffect(() => {
    if (selectedSymbol) {
      setSymbol(selectedSymbol);
    }
  }, [selectedSymbol]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/portfolio/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbol,
          order_type: orderType,
          quantity: Number(quantity),
          stop_loss: stopLoss ? Number(stopLoss) : null,
          target: target ? Number(target) : null,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message);
        onOrderSuccess();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setError(data.detail || 'Order execution rejected.');
      }
    } catch (err) {
      setError('Could not reach backend API. Check server connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSquareOff = async (posSymbol: string, qty: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/v1/portfolio/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: posSymbol,
          order_type: 'SELL',
          quantity: qty,
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg(data.message);
        onOrderSuccess();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setError(data.detail);
      }
    } catch (err) {
      setError('Failed to square off position.');
    } finally {
      setLoading(false);
    }
  };

  const formatQty = (qty: number, sym: string) => {
    if (sym === 'BTC' || sym === 'ETH') {
      return qty.toFixed(6);
    }
    return qty.toString();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Risk warning notice if bot suspended */}
      {portfolio.is_bot_active === false && (
        <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(244,63,94,0.1)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', fontSize: '0.85rem' }}>
          <strong>Order executions halted:</strong> Risk management engine auto-suspended trading. Reason: {portfolio.halt_reason}
        </div>
      )}

      {/* Upper Grid: Order Entry & Portfolio Balances */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.5rem' }}>
        
        {/* Order execution form */}
        <div className="glass-panel col-7" style={{ padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-header)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingBag size={18} color="var(--color-primary)" />
            <span>Simulated Paper Trading Terminal</span>
          </h3>

          {error && (
            <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(244,63,94,0.1)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}
          {successMsg && (
            <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid var(--color-success)', color: 'var(--color-success)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmitOrder} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            {/* Symbol & Order Action */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Asset Symbol</label>
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
                    outline: 'none',
                  }}
                >
                  {['TATASTEEL', 'NIFTYBEES', 'GOLDBEES', 'BTC', 'ETH'].map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Action</label>
                <div style={{ display: 'flex', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setOrderType('BUY')}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      backgroundColor: orderType === 'BUY' ? 'var(--color-success)' : 'transparent',
                      color: orderType === 'BUY' ? '#fff' : 'var(--text-muted)',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType('SELL')}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      backgroundColor: orderType === 'SELL' ? 'var(--color-danger)' : 'transparent',
                      color: orderType === 'SELL' ? '#fff' : 'var(--text-muted)',
                      transition: 'var(--transition-smooth)'
                    }}
                  >
                    SELL
                  </button>
                </div>
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Shares / Units Quantity</label>
              <input
                type="number"
                step="any"
                min="0.000001"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
              />
            </div>

            {/* Target & Stop Loss */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Stop Loss (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  placeholder="Optional limit"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Target Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="Optional target"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-main)',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || portfolio.is_bot_active === false}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.8rem',
                backgroundColor: orderType === 'BUY' ? 'var(--color-success)' : 'var(--color-danger)',
                boxShadow: orderType === 'BUY' ? '0 4px 12px var(--color-success-glow)' : '0 4px 12px var(--color-danger-glow)',
                border: 'none',
                marginTop: '0.5rem',
                opacity: portfolio.is_bot_active === false ? 0.5 : 1
              }}
            >
              {loading ? 'Submitting...' : `EXECUTE SIMULATED ${orderType} ORDER`}
            </button>
          </form>
        </div>

        {/* Portfolio margins breakdown */}
        <div className="glass-panel col-5" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-header)', marginBottom: '1rem' }}>Margin & Value Summary</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Available Funds:</span>
                <span style={{ fontWeight: 'bold' }}>₹{portfolio.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Trading Margin:</span>
                <span style={{ fontWeight: 'bold' }}>₹{portfolio.margin.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Portfolio Holdings:</span>
                <span style={{ fontWeight: 'bold' }}>
                  ₹{(portfolio.total_value - portfolio.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Today's Floating P&L:</span>
                <span style={{ fontWeight: 'bold', color: portfolio.daily_pnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  ₹{portfolio.daily_pnl >= 0 ? '+' : ''}{portfolio.daily_pnl.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(99,102,241,0.05)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--color-primary-glow)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginTop: '1rem' }}>
            <ShieldCheck size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
              Paper trading simulations execute on top of real Yahoo Finance historical asset distributions. Risk engine actively validates SL/Targets every 1.5 seconds.
            </p>
          </div>
        </div>
      </div>

      {/* Lower Section: Open Positions Ledger */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-header)', marginBottom: '0.75rem' }}>Active Open Positions</h3>
        
        {portfolio.positions.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
            No active open positions. Select an asset and click BUY to open a position.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.5rem' }}>Asset</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Shares/Units</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Avg. Price (₹)</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>LTP (₹)</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Floating P&L (₹)</th>
                <th style={{ padding: '0.5rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.positions.map((pos) => (
                <tr key={pos.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '0.6rem 0.5rem', fontWeight: 'bold' }}>{pos.symbol}</td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>{formatQty(pos.quantity, pos.symbol)}</td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>₹{pos.avg_price.toFixed(2)}</td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right' }}>₹{pos.current_price.toFixed(2)}</td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 'bold', color: pos.pnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                    {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}
                  </td>
                  <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                    <button
                      onClick={() => handleSquareOff(pos.symbol, pos.quantity)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--color-danger)',
                        background: 'transparent',
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: 'var(--transition-smooth)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-danger)';
                        e.currentTarget.style.color = '#fff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--color-danger)';
                      }}
                    >
                      Square Off
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Trade History Log */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-header)', marginBottom: '0.75rem' }}>Completed Order Audit Trail</h3>
        
        {portfolio.trades.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
            No trades completed yet.
          </p>
        ) : (
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.5rem' }}>Time</th>
                  <th style={{ padding: '0.5rem' }}>Asset</th>
                  <th style={{ padding: '0.5rem' }}>Type</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Shares/Units</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>Price (₹)</th>
                  <th style={{ padding: '0.5rem', textAlign: 'right' }}>PnL realized</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.trades.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>
                      {new Date(t.timestamp).toLocaleTimeString()}
                    </td>
                    <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{t.symbol}</td>
                    <td style={{ padding: '0.5rem', fontWeight: 'bold', color: t.order_type === 'BUY' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {t.order_type}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatQty(t.quantity, t.symbol)}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>₹{t.price.toFixed(2)}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold', color: t.pnl > 0 ? 'var(--color-success)' : t.pnl < 0 ? 'var(--color-danger)' : 'var(--text-main)' }}>
                      {t.pnl !== 0 ? `₹${t.pnl.toFixed(2)}` : '-'}
                    </td>
                    <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        backgroundColor: t.status === 'COMPLETED' ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                        color: t.status === 'COMPLETED' ? 'var(--color-success)' : 'var(--color-primary)'
                      }}>
                        {t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
