import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, LineSeries, ColorType } from 'lightweight-charts';
import { TrendingUp } from 'lucide-react';
import { API_BASE } from '../config';

interface PriceChartProps {
  symbol: string;
}

interface CandleFeedItem {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  rsi: number;
  macd: number;
  macd_signal: number;
}

export const PriceChart: React.FC<PriceChartProps> = ({ symbol }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [candles, setCandles] = useState<CandleFeedItem[]>([]);
  const [error, setError] = useState('');
  const [showEma, setShowEma] = useState(true);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/api/v1/market/candles/${symbol}`);
        if (!res.ok) throw new Error('Symbol not found');
        const data = await res.json();
        setCandles(data.candles);
      } catch (err) {
        setError('Failed to fetch stock history data.');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [symbol]);

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    // Cleanup previous chart instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#121824' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)', barSpacing: 12 },
      width: chartContainerRef.current.clientWidth,
      height: 380,
    });
    chartRef.current = chart;

    // --- Lightweight Charts v5 API: use addSeries() ---
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#f43f5e',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#f43f5e',
    });

    const chartData = candles.map(c => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candlestickSeries.setData(chartData as any);

    if (showEma) {
      const ema9Data: { time: string; value: number }[] = [];
      const ema21Data: { time: string; value: number }[] = [];
      let prevEma9 = candles[0].close;
      let prevEma21 = candles[0].close;
      const k9 = 2 / 10;
      const k21 = 2 / 22;

      candles.forEach((c, idx) => {
        if (idx === 0) {
          ema9Data.push({ time: c.time, value: prevEma9 });
          ema21Data.push({ time: c.time, value: prevEma21 });
        } else {
          const e9 = c.close * k9 + prevEma9 * (1 - k9);
          const e21 = c.close * k21 + prevEma21 * (1 - k21);
          ema9Data.push({ time: c.time, value: e9 });
          ema21Data.push({ time: c.time, value: e21 });
          prevEma9 = e9;
          prevEma21 = e21;
        }
      });

      const ema9Series = chart.addSeries(LineSeries, {
        color: '#6366f1',
        lineWidth: 1,
        title: 'EMA 9',
      });
      ema9Series.setData(ema9Data as any);

      const ema21Series = chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1,
        title: 'EMA 21',
      });
      ema21Series.setData(ema21Data as any);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candles, showEma]);

  return (
    <div className="glass-panel" style={{ padding: '1rem', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={20} color="var(--color-primary)" />
          <h3 style={{ fontSize: '1.15rem' }}>{symbol} Interactive Candlesticks</h3>
        </div>
        <button
          onClick={() => setShowEma(!showEma)}
          className="btn-outline"
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', borderRadius: '8px' }}
        >
          {showEma ? 'Hide EMAs' : 'Show EMAs (9/21)'}
        </button>
      </div>

      {loading && <div style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading historical data...</div>}
      {error && <div style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-danger)' }}>{error}</div>}

      <div ref={chartContainerRef} style={{ width: '100%', position: 'relative' }} />
    </div>
  );
};
