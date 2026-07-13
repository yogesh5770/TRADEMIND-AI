import React, { useState } from 'react';
import { ShieldAlert, Compass, ChevronDown, ChevronUp, Play, Cpu, Activity, ThumbsUp, ThumbsDown, CircleSlash } from 'lucide-react';

interface DashboardHomeProps {
  portfolio: {
    balance: number;
    margin: number;
    daily_pnl: number;
    total_value: number;
    is_bot_active?: boolean;
    halt_reason?: string;
  };
  recommendations: any[];
  alerts: string[];
  onExecuteRecommendation: (rec: any) => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  portfolio,
  recommendations,
  alerts,
  onExecuteRecommendation,
}) => {
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);

  // Compute average AI confidence
  const avgConfidence = recommendations.length > 0 
    ? (recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length) * 100
    : 81;

  const renderVoteIcon = (vote: number) => {
    if (vote > 0) return <ThumbsUp size={12} color="var(--color-success)" />;
    if (vote < 0) return <ThumbsDown size={12} color="var(--color-danger)" />;
    return <CircleSlash size={12} color="var(--text-dark)" />;
  };

  const getVoteText = (vote: number) => {
    if (vote > 0) return 'BUY';
    if (vote < 0) return 'SELL';
    return 'WAIT';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Risk Engine Automated Trading Suspend Banner */}
      {portfolio.is_bot_active === false && (
        <div 
          className="glass-panel" 
          style={{ 
            borderColor: 'var(--color-danger)', 
            background: 'rgba(244,63,94,0.05)', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.4rem',
            padding: '1.25rem' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '1rem' }}>
            <ShieldAlert size={20} />
            <span>AUTOMATED RISK HALT ACTIVATED</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500' }}>
            Reason: {portfolio.halt_reason || "Drawdown or loss thresholds exceeded."}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Trading operations have been automatically squared off and suspended to protect your capital. Resolve market issues or reset rules to resume.
          </p>
        </div>
      )}

      {/* Portfolio Quick Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
        
        <div className="glass-panel metric-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>Portfolio Net Asset Value</span>
          <span className="metric-value">₹{portfolio.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Assets + Cash Reserves</span>
        </div>

        <div className="glass-panel metric-card" style={{ borderLeft: '4px solid ' + (portfolio.daily_pnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)') }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>Today's Total P&L</span>
          <span className="metric-value" style={{ color: portfolio.daily_pnl >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            ₹{portfolio.daily_pnl >= 0 ? '+' : ''}{portfolio.daily_pnl.toFixed(2)}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Real-time floating P&L</span>
        </div>

        <div className="glass-panel metric-card" style={{ borderLeft: '4px solid var(--color-warning)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>Available Margin</span>
          <span className="metric-value">₹{portfolio.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>Micro-Investment Power</span>
        </div>

        <div className="glass-panel metric-card" style={{ borderLeft: '4px solid #a855f7' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>AI Voting Consensus</span>
          <span className="metric-value" style={{ color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={22} />
            <span>{avgConfidence.toFixed(0)}%</span>
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>6 specialist agents consensus</span>
        </div>

      </div>

      {/* Live System Alerts (Risk / Triggers) */}
      {alerts.length > 0 && (
        <div className="glass-panel" style={{ borderColor: 'rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.03)', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--color-danger)', fontWeight: 'bold', fontSize: '0.9rem' }}>
            <ShieldAlert size={16} />
            <span>Risk Management Engine Alerts</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: '100px', overflowY: 'auto' }}>
            {alerts.map((alert, idx) => (
              <p key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                • {alert}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* AI Trading Opportunities Feed */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Compass size={20} color="var(--color-primary)" />
            <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-header)' }}>Advanced AI Agent Signal Feed</h3>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '20px', backgroundColor: 'rgba(16,185,129,0.1)', color: 'var(--color-success)', fontWeight: 'bold' }}>
            <Activity size={12} className="animate-pulse" />
            24/7 Scanning
          </span>
        </div>

        {recommendations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
            No recommendations generated. The AI models are waiting for strong conviction setups.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recommendations.map((rec) => {
              const isExpanded = expandedRecId === rec.symbol;
              const isBuy = rec.action === 'BUY';
              
              return (
                <div 
                  key={rec.symbol}
                  style={{
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255,255,255,0.01)',
                    overflow: 'hidden',
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  {/* Summary Bar */}
                  <div 
                    style={{
                      padding: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                    }}
                    onClick={() => setExpandedRecId(isExpanded ? null : rec.symbol)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                      <div style={{ width: '120px' }}>
                        <h4 style={{ fontWeight: '700', fontSize: '1.05rem' }}>{rec.symbol}</h4>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {rec.symbol === 'BTC' || rec.symbol === 'ETH' ? 'Crypto 24/7' : 'NSE Equity'}
                        </span>
                      </div>
                      
                      <span style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        backgroundColor: isBuy ? 'var(--color-success)' : rec.action === 'SELL' ? 'var(--color-danger)' : 'rgba(255,255,255,0.05)',
                        color: isBuy || rec.action === 'SELL' ? '#fff' : 'var(--text-muted)'
                      }}>
                        {rec.action}
                      </span>
                      
                      <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Confidence</span>
                        <span style={{ fontWeight: 'bold', color: rec.confidence >= 0.8 ? '#c084fc' : 'var(--text-main)' }}>
                          {(rec.confidence * 100).toFixed(0)}%
                        </span>
                      </div>

                      <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Expected Move</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>
                          +{rec.expected_move_pct}%
                        </span>
                      </div>

                      <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>Risk footprint</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--color-danger)' }}>
                          -{rec.risk_pct}%
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onExecuteRecommendation(rec);
                        }}
                        className="btn-primary"
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.75rem',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          backgroundColor: isBuy ? 'var(--color-success)' : 'var(--color-danger)',
                          boxShadow: 'none'
                        }}
                      >
                        <Play size={12} fill="white" />
                        <span>Place Trade</span>
                      </button>

                      {isExpanded ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', backgroundColor: 'rgba(9,11,17,0.4)', fontSize: '0.85rem' }}>
                      
                      {/* Detailed stats grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div>
                          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Suggested Entry</span>
                          <span style={{ fontWeight: 'bold' }}>₹{rec.suggested_price.toFixed(2)}</span>
                        </div>
                        <div>
                          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Stop Loss Limit</span>
                          <span style={{ fontWeight: 'bold', color: 'var(--color-danger)' }}>₹{rec.stop_loss.toFixed(2)}</span>
                        </div>
                        <div>
                          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Suggested Target</span>
                          <span style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>₹{rec.target.toFixed(2)}</span>
                        </div>
                        <div>
                          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Risk Reward</span>
                          <span style={{ fontWeight: 'bold' }}>{rec.risk_reward}:1</span>
                        </div>
                        <div>
                          <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Expected Hold</span>
                          <span style={{ fontWeight: 'bold' }}>{rec.expected_hold_minutes} mins</span>
                        </div>
                      </div>

                      {/* Specialist Agent Voting matrix */}
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '1rem', marginBottom: '1rem' }}>
                        <h5 style={{ fontWeight: '600', marginBottom: '0.75rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Cpu size={14} />
                          <span>Specialist AI Consensus Votes (Score: {rec.confidence * 6}/6)</span>
                        </h5>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem' }}>
                          {Object.entries(rec.models_signals).map(([agent, info]: [string, any]) => (
                            <div 
                              key={agent} 
                              style={{ 
                                padding: '0.5rem', 
                                borderRadius: '8px', 
                                background: 'rgba(255,255,255,0.02)', 
                                border: '1px solid var(--border-color)', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                gap: '0.25rem' 
                              }}
                            >
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{agent} AI</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                {renderVoteIcon(info.vote)}
                                <span>{getVoteText(info.vote)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Raw Rationale Text Render */}
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '1rem' }}>
                        <h5 style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--color-primary)' }}>Consensus Verdict Detail:</h5>
                        <div 
                          style={{
                            backgroundColor: 'rgba(0,0,0,0.15)',
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.02)',
                            fontSize: '0.75rem',
                            color: 'var(--text-main)',
                            lineHeight: '1.4',
                            whiteSpace: 'pre-line'
                          }}
                        >
                          {rec.rationale.replace(/### Multi-Agent Decision Board for .*\n/, '')}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
