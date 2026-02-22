import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C } from '../constants';
import { cachedFetch } from '../lib/cache';

// ── Types ─────────────────────────────────────────────────────────────────────
type MarketItem = {
  name: string;
  mean: number;
  std: number;
  min: number;
  max: number;
  raw_mean: number;
  sample_size: number;
};

type MarketData = {
  id: string;
  name: string;
  city: string;
  symbol: string;
  currency: string;
  gouging_pct: number;
  gouging_rate: number;
  color: string;
  market_summary: string;
  has_disaster: boolean;
  disasters: string[];
  items: MarketItem[];
};

// ── Price range bar ───────────────────────────────────────────────────────────
function PriceBar({ item, symbol }: { item: MarketItem; symbol: string }) {
  const range    = item.max - item.min || 1;
  const meanFrac = (item.mean - item.min) / range;

  return (
    <View style={bar.container}>
      <View style={bar.track}>
        <View style={bar.fill} />
        <View style={[bar.meanDot, { left: `${meanFrac * 100}%` as any }]} />
      </View>
      <View style={bar.labels}>
        <Text style={bar.labelMuted}>{symbol}{item.min.toLocaleString()}</Text>
        <Text style={[bar.labelAccent, { fontVariant: ['tabular-nums'] as any }]}>
          avg {symbol}{item.mean.toLocaleString()}
        </Text>
        <Text style={bar.labelMuted}>{symbol}{item.max.toLocaleString()}</Text>
      </View>
    </View>
  );
}

const bar = StyleSheet.create({
  container:  { marginTop: 10 },
  track:      { height: 4, backgroundColor: C.border, borderRadius: 2, position: 'relative', marginBottom: 6 },
  fill:       { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 2, backgroundColor: C.border },
  meanDot:    { position: 'absolute', top: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: C.accent, marginLeft: -6, borderWidth: 2, borderColor: C.bg },
  labels:     { flexDirection: 'row', justifyContent: 'space-between' },
  labelMuted: { fontSize: 10, color: C.muted, fontWeight: '600', fontVariant: ['tabular-nums'] as any },
  labelAccent:{ fontSize: 10, color: C.accent, fontWeight: '700' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function MarketDetail() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const router    = useRouter();
  const [market,  setMarket]  = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    cachedFetch(`/market/${id}`)
      .then(data => { setMarket(data); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, [id]);

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={C.accent} />
      <Text style={styles.loadingText}>Loading index data…</Text>
    </View>
  );

  if (error || !market) return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>Failed to load market</Text>
      <Text style={styles.errorSub}>{error}</Text>
    </View>
  );

  const devColor = market.gouging_pct > 25 ? C.danger : market.gouging_pct > 10 ? C.accent : C.fair;
  const devLabel = market.gouging_pct > 25 ? 'ALERT' : market.gouging_pct > 10 ? 'WATCH' : 'STABLE';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.marketName}>{market.name}</Text>
          <Text style={styles.city}>{market.city}</Text>
        </View>
        <View style={styles.deviationBlock}>
          <Text style={[styles.deviationPct, { color: devColor }]}>
            {market.gouging_pct.toFixed(1)}%
          </Text>
          <Text style={styles.deviationLabel}>deviation</Text>
          <View style={[styles.statusPill, { backgroundColor: devColor + '18', borderColor: devColor + '45' }]}>
            <Text style={[styles.statusText, { color: devColor }]}>{devLabel}</Text>
          </View>
        </View>
      </View>

      {/* ── Disruption alert ── */}
      {market.has_disaster && market.disasters?.length > 0 && (
        <View style={styles.disruptionBanner}>
          <View style={styles.disruptionDot} />
          <Text style={styles.disruptionText}>
            Active supply disruption: {market.disasters.join(', ')}
          </Text>
        </View>
      )}

      {/* ── Market summary ── */}
      {market.market_summary ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTag}>MARKET CONTEXT</Text>
          <Text style={styles.summaryText}>{market.market_summary}</Text>
        </View>
      ) : null}

      {/* ── Price index table ── */}
      <Text style={styles.sectionTitle}>PRICE INDEX</Text>
      {market.items.map(item => (
        <TouchableOpacity
          key={item.name}
          style={styles.itemCard}
          onPress={() =>
            router.push({
              pathname: '/item/[name]',
              params: { name: item.name, market_id: market.id, symbol: market.symbol },
            })
          }
          activeOpacity={0.7}
        >
          <View style={styles.itemHeader}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemObs}>{item.sample_size} obs.</Text>
          </View>
          <PriceBar item={item} symbol={market.symbol} />
        </TouchableOpacity>
      ))}

      {/* ── CTA ── */}
      <TouchableOpacity
        style={styles.submitBtn}
        onPress={() => router.push({ pathname: '/report', params: { market_id: market.id } })}
        activeOpacity={0.8}
      >
        <Text style={styles.submitBtnText}>Submit Observation</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  content:         { padding: 20, paddingBottom: 48 },
  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg, gap: 12 },
  loadingText:     { color: C.muted, fontSize: 14 },
  errorText:       { color: C.danger, fontSize: 16, fontWeight: '700' },
  errorSub:        { color: C.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },

  // Header
  header:          { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  marketName:      { fontSize: 24, fontWeight: '900', color: C.text, letterSpacing: -0.3 },
  city:            { fontSize: 13, color: C.muted, marginTop: 3 },
  deviationBlock:  { alignItems: 'flex-end', gap: 3 },
  deviationPct:    { fontSize: 32, fontWeight: '900', lineHeight: 36, fontVariant: ['tabular-nums'] as any },
  deviationLabel:  { fontSize: 9, color: C.muted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  statusPill:      { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1 },
  statusText:      { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  // Disruption
  disruptionBanner:{ flexDirection: 'row', alignItems: 'flex-start', gap: 10,
                     backgroundColor: C.danger + '12', borderRadius: 10, padding: 12,
                     marginBottom: 16, borderWidth: 1, borderColor: C.danger + '35' },
  disruptionDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.danger, marginTop: 3, flexShrink: 0 },
  disruptionText:  { color: C.danger, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 20 },

  // Summary
  summaryCard:     { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 18,
                     borderWidth: 1, borderColor: C.border },
  summaryTag:      { fontSize: 9, fontWeight: '800', color: C.muted, letterSpacing: 2,
                     textTransform: 'uppercase', marginBottom: 8 },
  summaryText:     { color: C.muted, fontSize: 13, lineHeight: 21 },

  // Section
  sectionTitle:    { fontSize: 9, fontWeight: '800', color: C.muted, letterSpacing: 2,
                     textTransform: 'uppercase', marginBottom: 10 },

  // Item cards
  itemCard:        { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 8,
                     borderWidth: 1, borderColor: C.border },
  itemHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName:        { fontSize: 14, fontWeight: '700', color: C.text, flex: 1 },
  itemObs:         { fontSize: 10, color: C.muted, fontWeight: '600' },

  // CTA
  submitBtn:       { backgroundColor: C.accent, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 14 },
  submitBtnText:   { fontSize: 15, fontWeight: '800', color: '#0f172a', letterSpacing: 0.3 },
});
