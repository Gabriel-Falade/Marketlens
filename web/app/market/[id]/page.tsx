'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import StatusPill from '@/components/StatusPill';
import TrendChart from '@/components/TrendChart';
import { api } from '@/lib/api';
import type { MarketDetail, MarketIntel } from '@/lib/api';
import { getStatus, getSignalColor, fmtPct, fmtNum } from '@/lib/utils';

const FLASK = process.env.NEXT_PUBLIC_FLASK_URL ?? 'http://localhost:5000';

const CARD: React.CSSProperties = {
  backgroundColor: '#1E293B',
  borderRadius:    10,
  border:          '1px solid #334155',
  padding:         '24px',
};
const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: '#64748B',
  textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10,
};

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [market,  setMarket]  = useState<MarketDetail | null>(null);
  const [intel,   setIntel]   = useState<MarketIntel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.market(id), api.marketIntel(id)])
      .then(([m, i]) => { setMarket(m); setIntel(i); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: '#64748B', fontSize: 14 }}>Retrieving index data...</p>
    </div>
  );

  if (error || !market) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <p style={{ color: '#EF4444', fontWeight: 700 }}>Market data unavailable. {error}</p>
    </div>
  );

  const iii    = intel?.iii ?? market.gouging_pct;
  const status = getStatus(iii);
  const color  = getSignalColor(iii);

  const chartSeries = intel?.history?.length ? [{
    id:    id,
    name:  market.name,
    color,
    data:  intel.history,
  }] : [];

  const volColor = intel?.volatility != null
    ? (intel.volatility > 0.5 ? '#EF4444' : intel.volatility > 0.3 ? '#F59E0B' : '#22C55E')
    : '#475569';

  const ptaColor = intel?.pta != null
    ? (intel.pta > 1 ? '#EF4444' : intel.pta < -1 ? '#22C55E' : '#F59E0B')
    : '#475569';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            href="/"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#64748B', textDecoration: 'none' }}
          >
            <ArrowLeft size={14} /> Overview
          </Link>
          <span style={{ color: '#334155', fontSize: 18 }}>/</span>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.3px', margin: 0 }}>
              {market.name}
            </h1>
            <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>{market.city}</p>
          </div>
        </div>
        <a
          href={`${FLASK}/intel/export`}
          target="_blank"
          rel="noreferrer"
          style={{
            display:         'flex',
            alignItems:      'center',
            gap:             8,
            fontSize:        13,
            color:           '#64748B',
            border:          '1px solid #334155',
            borderRadius:    8,
            padding:         '8px 16px',
            textDecoration:  'none',
          }}
        >
          <Download size={13} /> Export Data
        </a>
      </div>

      {/* ── 4 Metric cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          {
            label: 'Inflation Index',
            value: fmtPct(iii),
            sub:   'price deviation',
            color,
            pill:  status,
          },
          {
            label: 'Volatility Score',
            value: fmtNum(intel?.volatility),
            sub:   'weighted CoV',
            color: volColor,
          },
          {
            label: 'Confidence',
            value: intel?.confidence != null ? `${Math.round(intel.confidence * 100)}%` : '—',
            sub:   'data density',
            color: '#22D3EE',
          },
          {
            label: 'Trend Acceleration',
            value: intel?.pta != null ? `${intel.pta > 0 ? '+' : ''}${intel.pta.toFixed(1)}%` : '—',
            sub:   'week-over-week',
            color: ptaColor,
          },
        ].map((card, i) => (
          <div key={i} style={{ ...CARD, borderLeftColor: card.color, borderLeftWidth: 3 }}>
            <p style={LABEL}>{card.label}</p>
            <p style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 32, color: card.color, lineHeight: 1.1, margin: 0 }}>
              {card.value}
            </p>
            <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginTop: 6, marginBottom: card.pill ? 10 : 0 }}>
              {card.sub}
            </p>
            {card.pill && <StatusPill status={card.pill} />}
          </div>
        ))}
      </div>

      {/* ── Disruption banner ── */}
      {market.has_disaster && market.disasters?.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '12px 16px', borderRadius: 8,
          border: '1px solid #EF444430', backgroundColor: '#EF444410',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#EF4444', flexShrink: 0, marginTop: 3 }} />
          <p style={{ fontSize: 13, fontWeight: 600, color: '#EF4444', margin: 0 }}>
            Active supply disruption: {market.disasters.join(', ')}
          </p>
        </div>
      )}

      {/* ── Trend chart ── */}
      {chartSeries.length > 0 && (
        <div>
          <p style={{ ...LABEL, marginBottom: 16 }}>Price Deviation Trend — 8-Week History</p>
          <div style={{ ...CARD, padding: '24px 24px 16px' }}>
            <TrendChart series={chartSeries} height={280} />
          </div>
        </div>
      )}

      {/* ── Price index table ── */}
      <div>
        <p style={{ ...LABEL, marginBottom: 12 }}>Price Index</p>
        <div style={{ backgroundColor: '#1E293B', borderRadius: 10, border: '1px solid #334155', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                {['Item', 'Min', 'Mean', 'Max', 'Std Dev', 'Observations'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', fontSize: 10, fontWeight: 800,
                    color: '#64748B', textTransform: 'uppercase',
                    letterSpacing: '0.08em', padding: '12px 20px',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {market.items.map((item, i) => (
                <tr
                  key={item.name}
                  style={{
                    borderBottom:    '1px solid #1E2D3F',
                    backgroundColor: i % 2 !== 0 ? '#1a2537' : 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#263348')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 !== 0 ? '#1a2537' : 'transparent')}
                >
                  <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600, color: '#F8FAFC' }}>{item.name}</td>
                  <td style={{ padding: '12px 20px', fontFamily: 'monospace', fontSize: 13, color: '#22C55E' }}>
                    {market.symbol}{item.min.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 20px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>
                    {market.symbol}{item.mean.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 20px', fontFamily: 'monospace', fontSize: 13, color: '#EF4444' }}>
                    {market.symbol}{item.max.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 20px', fontFamily: 'monospace', fontSize: 13, color: '#64748B' }}>
                    {item.std.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 20px', fontFamily: 'monospace', fontSize: 13, color: '#64748B' }}>
                    {item.sample_size}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Market context ── */}
      {market.market_summary && (
        <div style={CARD}>
          <p style={LABEL}>Market Context</p>
          <p style={{ fontSize: 13, color: '#CBD5E1', lineHeight: 1.7, margin: 0 }}>
            {market.market_summary}
          </p>
        </div>
      )}

    </div>
  );
}
