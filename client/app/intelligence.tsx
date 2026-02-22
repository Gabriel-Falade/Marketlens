import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { cachedFetch } from './lib/cache';
import { C, MARKETS } from './constants';

// ── Types ──────────────────────────────────────────────────────────────────────
type WeekPoint  = { week: string; iii: number; volatility: number };
type MarketIntel = {
  market_id:              string;
  city:                   string;
  iii:                    number;
  volatility:             number;
  pta:                    number;
  rid:                    number;
  shock_score:            number;
  shock_label:            'stable' | 'watch' | 'shock';
  confidence:             number;
  report_count:           number;
  official_inflation_pct: number;
  history:                WeekPoint[];
};
type GlobalData = {
  iii:          number | null;
  volatility:   number | null;
  confidence:   number | null;
  report_count: number;
};
type IntelResponse = {
  markets:      MarketIntel[];
  global:       GlobalData;
  generated_at: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const FLAG_MAP: Record<string, string> = {};
MARKETS.forEach(m => { FLAG_MAP[m.id] = m.flag; });

function iiiColor(iii: number): string {
  if (iii < 10) return C.fair;
  if (iii < 25) return C.accent;
  return C.danger;
}

function volMeta(v: number): { label: string; color: string } {
  if (v < 0.30) return { label: 'LOW',      color: C.fair   };
  if (v < 0.60) return { label: 'MODERATE', color: C.accent };
  return               { label: 'HIGH',     color: C.danger  };
}

function shockColor(label: string) {
  return label === 'shock' ? C.danger : label === 'watch' ? C.accent : C.fair;
}

// ── Sparkline (bar chart using plain Views, no extra libraries) ────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max   = Math.max(...data, 1);
  const min   = Math.min(...data, 0);
  const range = max - min || 1;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 30, gap: 2 }}>
      {data.map((v, i) => (
        <View
          key={i}
          style={{
            width:           7,
            height:          Math.max(3, Math.round(((v - min) / range) * 30)),
            backgroundColor: color,
            borderRadius:    2,
            opacity:         0.35 + (i / Math.max(data.length - 1, 1)) * 0.65,
          }}
        />
      ))}
    </View>
  );
}

// ── Confidence bar ─────────────────────────────────────────────────────────────
function ConfBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={s.confRow}>
      <Text style={s.confLabel}>Confidence</Text>
      <View style={s.confTrack}>
        <View style={[s.confFill, { width: `${Math.round(value * 100)}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={s.confPct}>{Math.round(value * 100)}%</Text>
    </View>
  );
}

// ── Per-market card ────────────────────────────────────────────────────────────
function MarketCard({ m, onPress }: { m: MarketIntel; onPress: () => void }) {
  const color   = iiiColor(m.iii ?? 0);
  const vol     = volMeta(m.volatility ?? 0);
  const iiis    = m.history.map(h => h.iii);
  const ptaSign = (m.pta ?? 0) >= 0 ? '+' : '';
  const ridSign = (m.rid ?? 0) >= 0 ? '+' : '';
  const sc      = shockColor(m.shock_label);

  return (
    <Pressable style={[s.card, { borderTopWidth: 3, borderTopColor: sc }]} onPress={onPress}>
      {/* Header row */}
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardCity}>{m.city}</Text>
          <Text style={s.cardSub}>{(m.report_count ?? 0).toLocaleString()} obs. · 30d window</Text>
        </View>
        <View style={[s.shockPill, { borderColor: sc + '55', backgroundColor: sc + '15' }]}>
          <Text style={[s.shockText, { color: sc }]}>
            {m.shock_label.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Four-metric row */}
      <View style={s.metricsRow}>
        <View style={s.metric}>
          <Text style={s.metricKey}>III</Text>
          <Text style={[s.metricVal, { color }]}>
            {(m.iii ?? 0) > 0 ? '+' : ''}{(m.iii ?? 0).toFixed(1)}%
          </Text>
          <Text style={s.metricSub}>inf. index</Text>
        </View>
        <View style={s.divider} />
        <View style={s.metric}>
          <Text style={s.metricKey}>VOL</Text>
          <Text style={[s.metricVal, { color: vol.color }]}>{vol.label}</Text>
          <Text style={s.metricSub}>{((m.volatility ?? 0) * 100).toFixed(0)}% CoV</Text>
        </View>
        <View style={s.divider} />
        <View style={s.metric}>
          <Text style={s.metricKey}>PTA</Text>
          <Text style={[s.metricVal, { color: (m.pta ?? 0) >= 0 ? C.danger : C.fair }]}>
            {ptaSign}{(m.pta ?? 0).toFixed(1)}%
          </Text>
          <Text style={s.metricSub}>7d accel</Text>
        </View>
        <View style={s.divider} />
        <View style={s.metric}>
          <Text style={s.metricKey}>RID</Text>
          <Text style={[s.metricVal, {
            color: (m.rid ?? 0) > 5 ? C.danger : (m.rid ?? 0) < -5 ? C.fair : C.accent,
          }]}>
            {ridSign}{(m.rid ?? 0).toFixed(1)}pp
          </Text>
          <Text style={s.metricSub}>drift</Text>
        </View>
      </View>

      <ConfBar value={m.confidence ?? 0} color={color} />

      <Text style={s.ridNote}>
        Official food CPI: {(m.official_inflation_pct ?? 0).toFixed(1)}%
        {'  ·  '}Informal gap: {ridSign}{(m.rid ?? 0).toFixed(1)}pp
      </Text>

      {iiis.length > 0 && (
        <View style={s.sparkWrap}>
          <Text style={s.sparkLabel}>III — 8-WEEK TREND</Text>
          <Sparkline data={iiis} color={color} />
        </View>
      )}

    </Pressable>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
export default function IntelligenceScreen() {
  const router = useRouter();
  const [data,    setData]    = useState<IntelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    cachedFetch('/intel/global')
      .then(d  => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color={C.accent} />
      <Text style={s.loadingText}>Loading intelligence data…</Text>
    </View>
  );

  if (error || !data) return (
    <View style={s.centered}>
      <Text style={s.errorText}>Could not load intelligence data</Text>
      <Text style={s.errorSub}>{error}</Text>
    </View>
  );

  const g          = data.global;
  const globalIII  = g.iii ?? 0;
  const globalColor = iiiColor(globalIII);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.title}>INTELLIGENCE</Text>
        <Text style={s.subtitle}>Informal Economy Price Index · Live Signal</Text>
      </View>

      {/* ── Global composite card ── */}
      <View style={s.globalCard}>
        <Text style={s.sectionLabel}>GLOBAL COMPOSITE INDEX</Text>
        <View style={s.globalRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.globalIII, { color: globalColor }]}>
              {globalIII > 0 ? '+' : ''}{globalIII.toFixed(1)}%
            </Text>
            <Text style={s.globalSub}>
              above adjusted baseline · {data.markets.length} markets
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.globalCount}>{(g.report_count ?? 0).toLocaleString()}</Text>
            <Text style={s.globalCountSub}>reports (30d)</Text>
          </View>
        </View>
        <ConfBar value={g.confidence ?? 0} color={globalColor} />
      </View>

      {/* ── Market cards ── */}
      <Text style={s.sectionLabel}>MARKETS</Text>
      {data.markets.map(m => (
        <MarketCard
          key={m.market_id}
          m={m}
          onPress={() => router.push(`/market/${m.market_id}` as any)}
        />
      ))}

      {/* ── Methodology footer ── */}
      <View style={s.footer}>
        <Text style={s.sectionLabel}>METRIC DEFINITIONS</Text>
        {[
          ['III', 'Informal Inflation Index — mean % deviation of submitted prices from WB + disaster adjusted baseline (30d)'],
          ['VOL', 'Volatility — normalized coefficient of variation across items (14d); 0 = stable, 1 = extreme'],
          ['PTA', 'Price Trend Acceleration — % change in 7-day avg price vs prior 7-day avg'],
          ['RID', 'Regional Inflation Drift — III minus official food CPI, in percentage points'],
        ].map(([k, v]) => (
          <View key={k} style={s.footerRow}>
            <Text style={s.footerKey}>{k}</Text>
            <Text style={s.footerVal}>{v}</Text>
          </View>
        ))}
        <Text style={s.apiNote}>Enterprise data export: /intel/export</Text>
      </View>

    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.bg },
  content:      { padding: 16, paddingBottom: 48 },
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg, gap: 12 },
  loadingText:  { color: C.muted, fontSize: 14 },
  errorText:    { color: C.danger, fontSize: 16, fontWeight: '700' },
  errorSub:     { color: C.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },

  // Header
  header:       { alignItems: 'center', marginBottom: 22, paddingTop: 10 },
  eyebrow:      { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 3, textTransform: 'uppercase' },
  title:        { fontSize: 30, fontWeight: '900', color: C.accent, letterSpacing: 5, marginTop: 3 },
  subtitle:     { fontSize: 11, color: C.muted, marginTop: 5 },

  // Section label (reused throughout)
  sectionLabel: { fontSize: 9, fontWeight: '800', color: C.muted, letterSpacing: 2,
                  textTransform: 'uppercase', marginBottom: 10 },

  // Global card
  globalCard:   { backgroundColor: C.card, borderRadius: 16, padding: 18,
                  borderWidth: 1, borderColor: C.border, marginBottom: 22 },
  globalRow:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  globalIII:    { fontSize: 42, fontWeight: '900', lineHeight: 46, fontVariant: ['tabular-nums'] as any },
  globalSub:    { fontSize: 11, color: C.muted, marginTop: 5 },
  globalCount:  { fontSize: 24, fontWeight: '800', color: C.text },
  globalCountSub:{ fontSize: 10, color: C.muted },

  // Market card
  card:         { backgroundColor: C.card, borderRadius: 16, padding: 16,
                  borderWidth: 1, borderColor: C.border, marginBottom: 12 },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardFlag:     { fontSize: 26 },
  cardCity:     { fontSize: 13, fontWeight: '800', color: C.text },
  cardSub:      { fontSize: 10, color: C.muted, marginTop: 2 },
  shockPill:    { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1 },
  shockText:    { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  // Metrics row
  metricsRow:   { flexDirection: 'row', marginBottom: 14 },
  metric:       { flex: 1, alignItems: 'center' },
  metricKey:    { fontSize: 8, fontWeight: '800', color: C.muted,
                  letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  metricVal:    { fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] as any },
  metricSub:    { fontSize: 8, color: C.muted, marginTop: 3 },
  divider:      { width: 1, backgroundColor: C.border, marginVertical: 2 },

  // Confidence
  confRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  confLabel:    { fontSize: 9, color: C.muted, fontWeight: '700', width: 70 },
  confTrack:    { flex: 1, height: 4, backgroundColor: C.border, borderRadius: 2, overflow: 'hidden' },
  confFill:     { height: '100%', borderRadius: 2 },
  confPct:      { fontSize: 10, color: C.muted, fontWeight: '700', width: 30, textAlign: 'right' },

  // RID note + sparkline
  ridNote:      { fontSize: 9, color: C.muted, marginBottom: 12 },
  sparkWrap:    { gap: 6 },
  sparkLabel:   { fontSize: 8, fontWeight: '700', color: C.muted, letterSpacing: 1 },
  tapHint:      { fontSize: 9, color: C.accent, textAlign: 'right', marginTop: 10, fontWeight: '600' },

  // Footer
  footer:       { backgroundColor: C.card, borderRadius: 16, padding: 16,
                  borderWidth: 1, borderColor: C.border, marginTop: 8 },
  footerRow:    { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  footerKey:    { fontSize: 11, fontWeight: '900', color: C.accent, width: 32, marginTop: 1 },
  footerVal:    { fontSize: 10, color: C.muted, flex: 1, lineHeight: 16 },
  apiNote:      { fontSize: 9, color: C.border, marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
});
