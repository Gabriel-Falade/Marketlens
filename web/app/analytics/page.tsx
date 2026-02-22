'use client';

import { useState, useEffect } from 'react';
import StatusPill from '@/components/StatusPill';
import TrendChart from '@/components/TrendChart';
import type { ChartSeries } from '@/components/TrendChart';
import { api } from '@/lib/api';
import type { GlobalIntel } from '@/lib/api';
import { getStatus, getSignalColor, fmtPct, fmtNum } from '@/lib/utils';

const MARKET_COLORS: Record<string, string> = {
  lagos: '#EF4444',
  delhi: '#22C55E',
  metz:  '#F59E0B',
};

const MARKET_NAMES: Record<string, string> = {
  lagos: 'Balogun Market',
  delhi: 'Chandni Chowk',
  metz:  'Marché de Metz',
};

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: '#64748B',
  textTransform: 'uppercase', letterSpacing: '0.12em',
};

export default function AnalyticsPage() {
  const [intel,   setIntel]   = useState<GlobalIntel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    api.globalIntel()
      .then(setIntel)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: '#64748B', fontSize: 14 }}>Retrieving index data...</p>
    </div>
  );

  if (error || !intel) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: '#EF4444', fontWeight: 700 }}>Index data unavailable. {error}</p>
    </div>
  );

  const series: ChartSeries[] = intel.markets
    .filter(m => m.history?.length > 0 && m.market_id)
    .map(m => ({
      id:    m.market_id!,
      name:  MARKET_NAMES[m.market_id!] ?? m.city ?? m.market_id!,
      color: MARKET_COLORS[m.market_id!] ?? '#94A3B8',
      data:  m.history,
    }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.3px', margin: 0 }}>
          Trend Analytics
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 5 }}>
          8-week price deviation history across all active markets
        </p>
      </div>

      {/* ── Multi-market chart ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={LABEL}>Composite Deviation Trend</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {series.map(s => (
              <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#CBD5E1', fontWeight: 600 }}>
                <span style={{ width: 16, height: 2, borderRadius: 2, backgroundColor: s.color, display: 'inline-block' }} />
                {s.name}
              </span>
            ))}
          </div>
        </div>
        <div style={{ backgroundColor: '#1E293B', borderRadius: 10, border: '1px solid #334155', padding: '24px 24px 16px' }}>
          <TrendChart series={series} height={320} />
        </div>
      </div>

      {/* ── Signals table ── */}
      <div>
        <p style={{ ...LABEL, marginBottom: 12 }}>Market Signals</p>
        <div style={{ backgroundColor: '#1E293B', borderRadius: 10, border: '1px solid #334155', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                {[
                  'Market',
                  'Inflation Index',
                  'Volatility',
                  'Trend Accel.',
                  'RID',
                  'Official CPI',
                  'Confidence',
                  'Observations',
                  'Status',
                ].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', fontSize: 10, fontWeight: 800,
                    color: '#64748B', textTransform: 'uppercase',
                    letterSpacing: '0.08em', padding: '12px 20px', whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {intel.markets.map((m, i) => {
                const status  = getStatus(m.iii);
                const color   = getSignalColor(m.iii);
                const ptaPos  = m.pta != null && m.pta >  0.5;
                const ptaNeg  = m.pta != null && m.pta < -0.5;
                const ptaColor = ptaPos ? '#EF4444' : ptaNeg ? '#22C55E' : '#64748B';
                return (
                  <tr
                    key={m.market_id ?? i}
                    style={{ borderBottom: '1px solid #1E2D3F' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#263348')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 10 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>
                          {MARKET_NAMES[m.market_id ?? ''] ?? m.market_id}
                        </p>
                        <p style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{m.city}</p>
                      </div>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 20, color }}>
                        {fmtPct(m.iii)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#F8FAFC' }}>
                        {fmtNum(m.volatility)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: ptaColor }}>
                        {m.pta != null ? `${m.pta > 0 ? '+' : ''}${m.pta.toFixed(1)}%` : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#F8FAFC' }}>
                        {m.rid != null ? `${m.rid > 0 ? '+' : ''}${m.rid.toFixed(1)}pp` : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#64748B' }}>
                        {m.official_inflation_pct != null ? fmtPct(m.official_inflation_pct) : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#22D3EE' }}>
                        {m.confidence != null ? `${Math.round(m.confidence * 100)}%` : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#F8FAFC' }}>
                        {m.report_count.toLocaleString()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <StatusPill status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
