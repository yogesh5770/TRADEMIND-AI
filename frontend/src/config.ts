// Central API config — reads from env var on Vercel, falls back to localhost for dev
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const WS_BASE = API_BASE.replace('https://', 'wss://').replace('http://', 'ws://');
