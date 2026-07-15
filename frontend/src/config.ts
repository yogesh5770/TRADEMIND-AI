// Central API config — auto-detects localhost vs deployed server based on active domain
export const API_BASE = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:8000'
  : typeof window !== 'undefined' ? window.location.origin : 'https://trademind-ai-vptk.onrender.com';
export const WS_BASE = API_BASE.replace('https://', 'wss://').replace('http://', 'ws://');
