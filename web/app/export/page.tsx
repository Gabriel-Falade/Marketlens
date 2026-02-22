'use client';

import { useState } from 'react';
import { Download, Copy, Check, Terminal, Key, Database, Globe } from 'lucide-react';

const FLASK = process.env.NEXT_PUBLIC_FLASK_URL ?? 'http://localhost:5000';

const DATASETS = [
  {
    id:    'full',
    label: 'Full Intelligence Export',
    desc:  'All markets — III, volatility, PTA, RID, confidence, 8-week history',
    endpoint: '/intel/export',
    schema: `{
  "markets": [
    {
      "market_id":             "string",
      "city":                  "string",
      "iii":                   "number",
      "volatility":            "number",
      "pta":                   "number | null",
      "rid":                   "number | null",
      "confidence":            "number",
      "report_count":          "number",
      "official_inflation_pct":"number | null",
      "history": [
        { "week": "string", "iii": "number", "volatility": "number" }
      ]
    }
  ],
  "global": {
    "iii":          "number",
    "volatility":   "number",
    "confidence":   "number",
    "report_count": "number"
  },
  "generated_at": "ISO 8601 timestamp"
}`,
  },
  {
    id:    'global',
    label: 'Global Composite Index',
    desc:  'Aggregated index across all markets with historical trend',
    endpoint: '/intel/global',
    schema: `{
  "markets": [ { "market_id": "string", "iii": "number", ... } ],
  "global":  { "iii": "number", "volatility": "number", ... },
  "generated_at": "ISO 8601 timestamp"
}`,
  },
  {
    id:    'market_lagos',
    label: 'Balogun Market — Lagos',
    desc:  'Item-level price index and intelligence for Lagos',
    endpoint: '/intel/lagos',
    schema: `{
  "market_id":    "lagos",
  "city":         "Lagos, Nigeria",
  "iii":          "number",
  "volatility":   "number",
  "confidence":   "number",
  "report_count": "number",
  "history":      [ { "week": "string", "iii": "number" } ]
}`,
  },
  {
    id:    'market_delhi',
    label: 'Chandni Chowk — Delhi',
    desc:  'Item-level price index and intelligence for Delhi',
    endpoint: '/intel/delhi',
    schema: `{
  "market_id":    "delhi",
  "city":         "Delhi, India",
  "iii":          "number",
  "volatility":   "number",
  "confidence":   "number",
  "report_count": "number",
  "history":      [ { "week": "string", "iii": "number" } ]
}`,
  },
  {
    id:    'market_metz',
    label: 'Marché de Metz — France',
    desc:  'Item-level price index and intelligence for Metz',
    endpoint: '/intel/metz',
    schema: `{
  "market_id":    "metz",
  "city":         "Metz, France",
  "iii":          "number",
  "volatility":   "number",
  "confidence":   "number",
  "report_count": "number",
  "history":      [ { "week": "string", "iii": "number" } ]
}`,
  },
];

const ENDPOINTS = [
  { method: 'GET',  path: '/markets',          desc: 'All markets — deviation rates, disaster flags' },
  { method: 'GET',  path: '/intel/global',     desc: 'Global composite III, volatility, confidence' },
  { method: 'GET',  path: '/intel/:id',        desc: 'Single-market intelligence snapshot' },
  { method: 'GET',  path: '/intel/history/:id',desc: '8-week historical series for one market' },
  { method: 'GET',  path: '/intel/export',     desc: 'Full B2B export — all markets, all signals' },
  { method: 'GET',  path: '/market/:id',       desc: 'Market detail — items, prices, AI summary' },
  { method: 'GET',  path: '/heatmap',          desc: 'Simplified coordinates and deviation data' },
  { method: 'POST', path: '/price/submit',     desc: 'Submit price observation, receive AI analysis' },
  { method: 'POST', path: '/identify',         desc: 'Identify market item from base64 image' },
];

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: '#64748B',
  textTransform: 'uppercase', letterSpacing: '0.12em',
};

export default function ExportPage() {
  const [selected, setSelected] = useState('full');
  const [format,   setFormat]   = useState<'json' | 'csv'>('json');
  const [copied,   setCopied]   = useState(false);

  const dataset = DATASETS.find(d => d.id === selected) ?? DATASETS[0];
  const url     = `${FLASK}${dataset.endpoint}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const download = () => {
    window.open(url, '_blank');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

      {/* ── Header ── */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#F8FAFC', letterSpacing: '-0.3px', margin: 0 }}>
          Data Export
        </h1>
        <p style={{ fontSize: 13, color: '#64748B', marginTop: 5 }}>
          Download institutional datasets or integrate directly via the REST API
        </p>
      </div>

      {/* ── Two-column grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT: config panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Dataset selector */}
          <div style={{ backgroundColor: '#1E293B', borderRadius: 10, border: '1px solid #334155', padding: 24 }}>
            <p style={{ ...LABEL, marginBottom: 16 }}>Select Dataset</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DATASETS.map(d => (
                <label
                  key={d.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${selected === d.id ? '#F59E0B44' : '#334155'}`,
                    backgroundColor: selected === d.id ? '#F59E0B0D' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="radio"
                    name="dataset"
                    value={d.id}
                    checked={selected === d.id}
                    onChange={() => setSelected(d.id)}
                    style={{ accentColor: '#F59E0B', marginTop: 2, flexShrink: 0 }}
                  />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>{d.label}</p>
                    <p style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>{d.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Format selector */}
          <div style={{ backgroundColor: '#1E293B', borderRadius: 10, border: '1px solid #334155', padding: 24 }}>
            <p style={{ ...LABEL, marginBottom: 14 }}>Format</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['json', 'csv'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                    fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
                    border: `1px solid ${format === f ? '#F59E0B' : '#334155'}`,
                    backgroundColor: format === f ? '#F59E0B' : 'transparent',
                    color: format === f ? '#0F172A' : '#64748B',
                    transition: 'all 0.15s',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            {format === 'csv' && (
              <p style={{ fontSize: 11, color: '#64748B', marginTop: 10 }}>
                Note: CSV flattens nested history arrays. JSON is recommended for full fidelity.
              </p>
            )}
          </div>

          {/* Download button */}
          <button
            onClick={download}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              padding: '16px 24px', borderRadius: 10, border: 'none',
              backgroundColor: '#F59E0B', color: '#0F172A',
              fontSize: 13, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            <Download size={16} strokeWidth={2.5} />
            Download {dataset.label}
          </button>

          {/* Rate limit info */}
          <div style={{
            display: 'flex', gap: 16, padding: '14px 18px',
            backgroundColor: '#22D3EE0D', borderRadius: 8, border: '1px solid #22D3EE22',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#22D3EE', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Access Tier</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Development</p>
            </div>
            <div style={{ width: 1, backgroundColor: '#334155' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#22D3EE', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Rate Limit</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>100 req / hour</p>
            </div>
            <div style={{ width: 1, backgroundColor: '#334155' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontSize: 10, fontWeight: 800, color: '#22D3EE', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Refresh</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#F8FAFC', margin: 0 }}>Live</p>
            </div>
          </div>
        </div>

        {/* ── RIGHT: endpoint + API key panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Endpoint preview */}
          <div style={{ backgroundColor: '#1E293B', borderRadius: 10, border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Terminal size={14} color="#64748B" />
              <p style={{ ...LABEL, margin: 0 }}>Endpoint Preview</p>
            </div>

            {/* URL bar */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, backgroundColor: '#0F172A', borderRadius: 8, padding: '10px 14px' }}>
                <span style={{
                  fontSize: 10, fontWeight: 900, fontFamily: 'monospace',
                  color: '#22C55E', backgroundColor: '#22C55E1A',
                  padding: '2px 7px', borderRadius: 4, letterSpacing: '0.05em',
                }}>
                  GET
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#F8FAFC', flex: 1, overflowX: 'auto', whiteSpace: 'nowrap' }}>
                  {url}
                </span>
                <button
                  onClick={copyUrl}
                  title="Copy URL"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                    color: copied ? '#22C55E' : '#64748B', padding: 0,
                  }}
                >
                  {copied
                    ? <Check size={14} strokeWidth={2.5} />
                    : <Copy size={14} strokeWidth={2} />
                  }
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Schema preview */}
            <div style={{ padding: '16px 20px' }}>
              <p style={{ ...LABEL, marginBottom: 10 }}>Response Schema</p>
              <pre style={{
                fontFamily: 'monospace', fontSize: 11, color: '#94A3B8',
                backgroundColor: '#0F172A', borderRadius: 8, padding: '16px',
                overflowX: 'auto', margin: 0, lineHeight: 1.7,
              }}>
                {dataset.schema}
              </pre>
            </div>
          </div>

          {/* API key panel */}
          <div style={{ backgroundColor: '#1E293B', borderRadius: 10, border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Key size={14} color="#64748B" />
              <p style={{ ...LABEL, margin: 0 }}>API Access</p>
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 16px' }}>
                The MarketLens API is open during the development phase. No API key is required. Authentication will be enforced on the production deployment.
              </p>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                backgroundColor: '#0F172A', borderRadius: 8, padding: '10px 14px',
              }}>
                <Globe size={14} color="#64748B" />
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748B', flex: 1 }}>
                  {FLASK}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 800, color: '#22C55E',
                  backgroundColor: '#22C55E1A', padding: '2px 8px', borderRadius: 4,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>
                  Live
                </span>
              </div>
            </div>
          </div>

          {/* Available endpoints */}
          <div style={{ backgroundColor: '#1E293B', borderRadius: 10, border: '1px solid #334155', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Database size={14} color="#64748B" />
              <p style={{ ...LABEL, margin: 0 }}>Available Endpoints</p>
            </div>
            <div>
              {ENDPOINTS.map((ep, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 20px',
                    borderBottom: i < ENDPOINTS.length - 1 ? '1px solid #1E2D3F' : 'none',
                  }}
                >
                  <span style={{
                    fontSize: 9, fontWeight: 900, fontFamily: 'monospace',
                    color: ep.method === 'POST' ? '#F59E0B' : '#22C55E',
                    backgroundColor: ep.method === 'POST' ? '#F59E0B1A' : '#22C55E1A',
                    padding: '2px 6px', borderRadius: 4, letterSpacing: '0.05em',
                    minWidth: 36, textAlign: 'center' as const,
                  }}>
                    {ep.method}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#CBD5E1', minWidth: 180 }}>
                    {ep.path}
                  </span>
                  <span style={{ fontSize: 11, color: '#64748B' }}>
                    {ep.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
