'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import StatusPill from '@/components/StatusPill';
import Sparkline  from '@/components/Sparkline';
import { api } from '@/lib/api';
import type { GlobalIntel, MarketSummary } from '@/lib/api';
import { getStatus, getSignalColor, fmtPct, fmtNum } from '@/lib/utils';

const MARKET_NAMES: Record<string, string> = {
  lagos: 'Balogun Market',
  delhi: 'Chandni Chowk',
  metz:  'Marché de Metz',
};

function PtaCell({ pta }: { pta: number | null }) {
  if (pta == null) return <span style={{ color: '#475569', fontFamily: 'monospace', fontSize: 13 }}>—</span>;
  const up    = pta >  0.5;
  const dn    = pta < -0.5;
  const color = up ? '#EF4444' : dn ? '#22C55E' : '#64748B';
  const Icon  = up ? TrendingUp : dn ? TrendingDown : Minus;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color, fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>
      <Icon size={13} />
      {pta > 0 ? '+' : ''}{pta.toFixed(1)}%
    </span>
  );
}

const CARD_STYLES: React.CSSProperties = {
  backgroundColor: '#1E293B',
  borderRadius:    10,
  border:          '1px solid #334155',
  padding:         '24px',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize:      10,
  fontWeight:    800,
  color:         '#64748B',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  marginBottom:  12,
};

export default function OverviewPage() {
  const [intel,   setIntel]   = useState<GlobalIntel | null>(null);
  const [markets, setMarkets] = useState<MarketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.globalIntel(), api.markets()])
      .then(([g, m]) => { setIntel(g); setMarkets(m); })
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
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#EF4444', fontWeight: 700, fontSize: 18 }}>Index data unavailable</p>
        <p style={{ color: '#64748B', fontSize: 14, marginTop: 6 }}>{error ?? 'Retry or contact support.'}</p>
      </div>
    </div>
  );

  const { global: g, markets: intelMarkets, generated_at } = intel;
  const globalStatus = getStatus(g.iii);
  const globalColor  = getSignalColor(g.iii);
  const marketMap    = Object.fromEntries(markets.map(m => [m.id, m]));

  // Merge intel + summary market data
  const merged = intelMarkets.map(im => ({
    ...im,
    ...(marketMap[im.market_id ?? ''] ?? {}),
    name: marketMap[im.market_id ?? '']?.name ?? MARKET_NAMES[im.market_id ?? ''] ?? im.market_id ?? 'Unknown',
  }));

  const disruptions = markets.filter(m => m.has_disaster);
  const updatedAt   = generated_at
    ? new Date(generated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── Page heading ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.3px', margin: 0 }}>
            Market Overview
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 5 }}>
            Informal pricing index · {intelMarkets.length} active markets
            {updatedAt && <span> · Updated {updatedAt}</span>}
          </p>
        </div>
      </div>

      {/* ── Hero stats strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          {
            label: 'Global Inflation Index',
            value: fmtPct(g.iii),
            sub:   'composite deviation',
            color: globalColor,
            pill:  globalStatus,
          },
          {
            label: 'Avg Volatility',
            value: fmtNum(g.volatility),
            sub:   'weighted CoV',
            color: '#F8FAFC',
          },
          {
            label: 'Avg Confidence',
            value: g.confidence != null ? `${Math.round(g.confidence * 100)}%` : '—',
            sub:   'data density',
            color: '#22D3EE',
          },
          {
            label: 'Total Observations',
            value: g.report_count.toLocaleString(),
            sub:   'community submissions',
            color: '#F8FAFC',
          },
        ].map((card, i) => (
          <div key={i} style={{ ...CARD_STYLES, borderLeftColor: card.color, borderLeftWidth: 3 }}>
            <p style={LABEL_STYLE}>{card.label}</p>
            <p style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 36, color: card.color, lineHeight: 1, margin: 0 }}>
              {card.value}
            </p>
            <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginTop: 6, marginBottom: card.pill ? 10 : 0 }}>
              {card.sub}
            </p>
            {card.pill && <StatusPill status={card.pill} />}
          </div>
        ))}
      </div>

      {/* ── Disruption alerts ── */}
      {disruptions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={LABEL_STYLE}>Supply Disruptions</p>
          {disruptions.map(m => (
            <div
              key={m.id}
              style={{
                display:         'flex',
                alignItems:      'center',
                gap:             12,
                padding:         '12px 16px',
                borderRadius:    8,
                border:          '1px solid #EF444430',
                backgroundColor: '#EF444410',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#EF4444', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#EF4444' }}>
                {m.name} · {m.city} — Active supply disruption · {m.disaster_count} event{m.disaster_count !== 1 ? 's' : ''} detected
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Markets table ── */}
      <div>
        <p style={{ ...LABEL_STYLE, marginBottom: 12 }}>Active Indices</p>
        <div style={{ backgroundColor: '#1E293B', borderRadius: 10, border: '1px solid #334155', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155' }}>
                {[
                  { label: 'Market',           width: 200 },
                  { label: 'Inflation Index',   width: 140 },
                  { label: '8W Trend',          width: 110 },
                  { label: 'Volatility',        width: 110 },
                  { label: 'Trend Accel.',      width: 120 },
                  { label: 'Confidence',        width: 110 },
                  { label: 'Status',            width: 100 },
                  { label: '',                  width: 60  },
                ].map(h => (
                  <th
                    key={h.label}
                    style={{
                      textAlign:     'left',
                      fontSize:      10,
                      fontWeight:    800,
                      color:         '#64748B',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      padding:       '12px 20px',
                      width:         h.width,
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {merged.map(m => {
                const status = getStatus(m.iii);
                const color  = getSignalColor(m.iii);
                return (
                  <tr
                    key={m.market_id}
                    style={{ borderBottom: '1px solid #1E2D3F' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#263348')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Market name */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 10 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>{m.name}</p>
                        <p style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{m.city}</p>
                      </div>
                    </td>

                    {/* III */}
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 24, color }}>
                        {fmtPct(m.iii)}
                      </span>
                    </td>

                    {/* Sparkline */}
                    <td style={{ padding: '16px 20px' }}>
                      {m.history?.length
                        ? <Sparkline data={m.history} color={color} />
                        : <span style={{ color: '#475569', fontSize: 12 }}>—</span>
                      }
                    </td>

                    {/* Volatility */}
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#F8FAFC' }}>
                        {fmtNum(m.volatility)}
                      </span>
                    </td>

                    {/* PTA */}
                    <td style={{ padding: '16px 20px' }}>
                      <PtaCell pta={m.pta} />
                    </td>

                    {/* Confidence */}
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#22D3EE' }}>
                        {m.confidence != null ? `${Math.round(m.confidence * 100)}%` : '—'}
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '16px 20px' }}>
                      <StatusPill status={status} />
                    </td>

                    {/* Action */}
                    <td style={{ padding: '16px 20px' }}>
                      <Link
                        href={`/market/${m.market_id}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#F59E0B', textDecoration: 'none' }}
                      >
                        View <ArrowRight size={11} />
                      </Link>
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
