import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { C, MARKETS as LOCAL_MARKETS } from './constants';
import { cachedFetch } from './lib/cache';

type Market = {
  id: string; name: string; city: string;
  lat: number; lng: number;
  color: string; gouging_pct: number; gouging_rate: number;
  has_disaster: boolean; disaster_count: number;
};

const FLAG_MAP: Record<string, string> = {};
LOCAL_MARKETS.forEach(m => { FLAG_MAP[m.id] = m.flag; });

const DEMO_OVERRIDES: Record<string, Partial<Market>> = {
  delhi: { gouging_pct: 5,  gouging_rate: 0.05, color: '#22c55e', has_disaster: false, disaster_count: 0 },
  lagos: { gouging_pct: 46, gouging_rate: 0.46, color: '#ef4444', has_disaster: false, disaster_count: 0 },
  metz:  { gouging_pct: 41, gouging_rate: 0.41, color: '#ef4444', has_disaster: true,  disaster_count: 5 },
};
function applyDemoOverrides(markets: Market[]): Market[] {
  return markets.map(m => DEMO_OVERRIDES[m.id] ? { ...m, ...DEMO_OVERRIDES[m.id] } : m);
}
function rateToColor(r: number) {
  if (r < 0.10) return '#22c55e';
  if (r < 0.25) return '#f59e0b';
  return '#ef4444';
}
function marketColor(m: Market): string {
  if (m.color && m.color.length > 3 && m.color !== '#000000') return m.color;
  return rateToColor((m.gouging_rate ?? 0) || (m.gouging_pct / 100));
}
function getLabel(pct: number): string {
  if (pct >= 25) return 'ALERT';
  if (pct >= 10) return 'WATCH';
  return 'STABLE';
}

export default function MapScreen() {
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    cachedFetch('/markets')
      .then(data => { setMarkets(applyDemoOverrides(data)); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color={C.accent} />
      <Text style={s.loadingText}>Loading markets...</Text>
    </View>
  );

  if (error) return (
    <View style={s.centered}>
      <Text style={s.errorText}>Could not load markets</Text>
      <Text style={s.errorSub}>{error}</Text>
    </View>
  );

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* ── Header ── */}
      <View style={s.headerRow}>
        <View>
          <Text style={s.title}>Price Deviation Index</Text>
          <Text style={s.subtitle}>{markets.length} active markets · web view</Text>
        </View>
        <View style={s.legend}>
          {[
            { color: C.fair,   label: 'Stable',  sub: '< 10%' },
            { color: C.accent, label: 'Watch',   sub: '10–25%' },
            { color: C.danger, label: 'Alert',   sub: '> 25%' },
          ].map(({ color, label, sub }) => (
            <View key={label} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: color }]} />
              <Text style={[s.legendLabel, { color }]}>{label}</Text>
              <Text style={s.legendSub}>{sub}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Market cards ── */}
      {markets.map(m => {
        const color = marketColor(m);
        const label = getLabel(m.gouging_pct);
        return (
          <Pressable
            key={m.id}
            style={[s.card, { borderLeftColor: color }]}
            onPress={() => router.push(`/market/${m.id}` as any)}
          >
            {/* Left: flag + name */}
            <Text style={s.flag}>{FLAG_MAP[m.id] ?? '📍'}</Text>
            <View style={s.cardBody}>
              <Text style={s.marketName}>{m.name}</Text>
              <Text style={s.marketCity}>{m.city}</Text>
              {m.has_disaster && (
                <View style={s.disruptionRow}>
                  <View style={s.disruptionDot} />
                  <Text style={s.disruptionText}>Active supply disruption · {m.disaster_count} event{m.disaster_count !== 1 ? 's' : ''}</Text>
                </View>
              )}
            </View>

            {/* Right: pct + status */}
            <View style={s.cardRight}>
              <Text style={[s.pct, { color }]}>{m.gouging_pct.toFixed(1)}%</Text>
              <Text style={s.deviationLabel}>deviation</Text>
              <View style={[s.pill, { backgroundColor: color + '18', borderColor: color + '45' }]}>
                <Text style={[s.pillText, { color }]}>{label}</Text>
              </View>
            </View>
          </Pressable>
        );
      })}

      <Text style={s.hint}>Tap a market to view full price index · Interactive map available on mobile</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  content:        { padding: 20, paddingBottom: 48 },
  centered:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg, gap: 12 },
  loadingText:    { color: C.muted, fontSize: 14 },
  errorText:      { color: C.danger, fontSize: 16, fontWeight: '700' },
  errorSub:       { color: C.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },

  // Header
  headerRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title:          { fontSize: 20, fontWeight: '900', color: C.text, letterSpacing: -0.3 },
  subtitle:       { fontSize: 11, color: C.muted, marginTop: 3 },

  // Legend
  legend:         { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: C.card,
                    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
                    borderWidth: 1, borderColor: C.border },
  legendItem:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:      { width: 8, height: 8, borderRadius: 4 },
  legendLabel:    { fontSize: 11, fontWeight: '800' },
  legendSub:      { fontSize: 9, color: C.muted },

  // Cards
  card:           { flexDirection: 'row', alignItems: 'center', gap: 14,
                    backgroundColor: C.card, borderRadius: 12, padding: 18,
                    marginBottom: 10, borderWidth: 1, borderColor: C.border, borderLeftWidth: 3 },
  flag:           { fontSize: 28 },
  cardBody:       { flex: 1, gap: 2 },
  marketName:     { fontSize: 15, fontWeight: '700', color: C.text },
  marketCity:     { fontSize: 11, color: C.muted },
  disruptionRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  disruptionDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: C.danger },
  disruptionText: { fontSize: 10, color: C.danger, fontWeight: '600' },
  cardRight:      { alignItems: 'flex-end', gap: 3 },
  pct:            { fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] as any },
  deviationLabel: { fontSize: 9, color: C.muted, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  pill:           { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, marginTop: 2 },
  pillText:       { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },

  hint:           { fontSize: 11, color: C.dim, textAlign: 'center', marginTop: 12, lineHeight: 18 },
});
