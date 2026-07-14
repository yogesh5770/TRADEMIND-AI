import React, { useState } from 'react';
import { X, Shield, Key, Link2, CheckCircle2 } from 'lucide-react';
import { API_BASE } from '../config';

interface BrokerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BrokerModal: React.FC<BrokerModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBroker || !clientId || !apiKey) {
      setError('Please fill in all credentials.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/v1/broker/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          broker_name: selectedBroker,
          client_id: clientId,
          access_token: apiKey,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
          // Reset states
          setSelectedBroker(null);
          setClientId('');
          setApiKey('');
          setSuccess(false);
        }, 1500);
      } else {
        setError(data.detail || 'Failed to connect broker.');
      }
    } catch (err) {
      setError('Could not reach backend API. Ensure FastAPI is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', position: 'relative' }}>
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>

        {!selectedBroker ? (
          <div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontFamily: 'var(--font-header)' }}>Connect Trading Account</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Integrate with official secure broker APIs. We never store password credentials.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { name: 'Zerodha Kite Connect', desc: 'India\'s largest retail broker', color: '#ec5b24' },
                { name: 'Angel One SmartAPI', desc: 'Advanced API integration engine', color: '#0f72e6' },
                { name: 'CoinDCX API', desc: 'Real-time crypto trading engine (100% Free API)', color: '#0052cc' },
              ].map((broker) => (
                <button
                  key={broker.name}
                  onClick={() => setSelectedBroker(broker.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(255,255,255,0.02)',
                    color: 'var(--text-main)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'var(--transition-smooth)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <div>
                    <h4 style={{ fontWeight: '600' }}>{broker.name}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{broker.desc}</p>
                  </div>
                  <span style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: '6px', backgroundColor: broker.color, color: 'white', fontWeight: 'bold' }}>
                    OAuth 2.0
                  </span>
                </button>
              ))}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', color: 'var(--text-dark)', fontSize: '0.75rem' }}>
              <Shield size={14} />
              <span>Compliant with algorithmic trading guidelines.</span>
            </div>
          </div>
        ) : (
          <div>
            {success ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <CheckCircle2 size={48} color="var(--color-success)" style={{ margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Connected Successfully</h3>
                <p style={{ color: 'var(--text-muted)' }}>Authenticated credentials with {selectedBroker}</p>
              </div>
            ) : (
              <form onSubmit={handleConnect}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <button 
                    type="button"
                    onClick={() => setSelectedBroker(null)} 
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    &larr; Back
                  </button>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>/</span>
                  <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>Connect {selectedBroker}</span>
                </div>

                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontFamily: 'var(--font-header)' }}>Authorization Credentials</h3>

                {error && (
                  <div style={{ padding: '0.75rem', borderRadius: '8px', backgroundColor: 'rgba(244,63,94,0.1)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    {error}
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    {selectedBroker === 'CoinDCX API' ? 'API Key' : 'Client ID / Username'}
                  </label>
                  <input
                    type="text"
                    required
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder={selectedBroker === 'CoinDCX API' ? 'Enter your CoinDCX API Key' : 'e.g. AB1234'}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'rgba(9,11,17,0.5)',
                      color: 'var(--text-main)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    {selectedBroker === 'CoinDCX API' ? 'API Secret Key' : 'API Key / App Token'}
                  </label>
                  <input
                    type="password"
                    required
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={selectedBroker === 'CoinDCX API' ? 'Enter your CoinDCX API Secret' : 'Enter API access key token'}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      background: 'rgba(9,11,17,0.5)',
                      color: 'var(--text-main)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
                  <button type="submit" disabled={loading} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {loading ? 'Authorizing...' : (
                      <>
                        <Link2 size={16} />
                        <span>Authenticate</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
