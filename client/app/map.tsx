import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, Region, Circle } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { C, MARKETS as LOCAL_MARKETS } from './constants';
import { cachedFetch } from './lib/cache';

// ── Types ─────────────────────────────────────────────────────────────────────
type Market = {
  id: string; name: string; city: string;
  lat: number; lng: number;
  color: string; gouging_pct: number; gouging_rate: number;
  has_disaster: boolean; disaster_count: number;
};
type Item = { name: string; wb_multiplier: number; dis_multiplier: number };
type MarketDetail = Market & { items: Item[] };

// Session-level detail cache
const _detailCache: Record<string, MarketDetail> = {};

// Flag lookup
const FLAG_MAP: Record<string, string> = {};
LOCAL_MARKETS.forEach(m => { FLAG_MAP[m.id] = m.flag; });

// ── Static market info (summaries + sub-pins) ─────────────────────────────────
const MARKET_INFO: Record<string, {
  tagline: string;
  knownFor: string[];
  weatherNote?: string;
  subPins: { emoji: string; label: string; dlat: number; dlng: number }[];
}> = {
  lagos: {
    tagline: "West Africa's largest open-air market",
    knownFor: ['Ankara fabrics', 'Fresh tomatoes & peppers', 'Grilled suya skewers', 'Frozen fish'],
    subPins: [
      { emoji: '🧵', label: 'Fabric District', dlat:  0.0032, dlng:  0.0030 },
      { emoji: '🌶️', label: 'Spice & Food Row', dlat: -0.0028, dlng: -0.0025 },
    ],
  },
  delhi: {
    tagline: "Asia's oldest & most vibrant bazaar",
    knownFor: ['Chole bhature street food', 'Wholesale spices', 'Masala chai', 'Handwoven scarves'],
    subPins: [
      { emoji: '🍛', label: 'Food Street',   dlat:  0.0030, dlng: -0.0028 },
      { emoji: '🌶️', label: 'Spice Bazaar', dlat: -0.0025, dlng:  0.0032 },
    ],
  },
  metz: {
    tagline: "Traditional French marché since the Middle Ages",
    knownFor: ['Mirabelle plum products', 'Artisan cheeses', 'Quiche lorraine', 'Fresh baguettes'],
    weatherNote: '🌨️ Late frost destroyed 65% of the Mirabelle harvest — stone fruit & jam prices up 3×',
    subPins: [
      { emoji: '🥐', label: 'Boulangerie Row', dlat:  0.0022, dlng:  0.0028 },
      { emoji: '🍑', label: 'Fruit & Jam',     dlat: -0.0026, dlng: -0.0020 },
    ],
  },
};

// ── Demo overrides (force specific gouging levels for presentation) ────────────
const DEMO_OVERRIDES: Record<string, Partial<Market>> = {
  delhi: { gouging_pct: 5,  gouging_rate: 0.05, color: '#22c55e', has_disaster: false, disaster_count: 0 },
  lagos: { gouging_pct: 46, gouging_rate: 0.46, color: '#ef4444', has_disaster: false, disaster_count: 0 },
  metz:  { gouging_pct: 41, gouging_rate: 0.41, color: '#ef4444', has_disaster: true,  disaster_count: 5 },
};
function applyDemoOverrides(markets: Market[]): Market[] {
  return markets.map(m => DEMO_OVERRIDES[m.id] ? { ...m, ...DEMO_OVERRIDES[m.id] } : m);
}

// ── Zone-circle helpers ───────────────────────────────────────────────────────
const OFFSETS: [number, number][] = [
  [ 0.000,  0.000], [ 0.005,  0.003], [-0.005,  0.004],
  [ 0.004, -0.006], [-0.004, -0.004], [ 0.007,  0.000],
  [-0.006,  0.000], [ 0.000,  0.007], [ 0.000, -0.006],
];
function zoneRate(baseRate: number, itemName: string): number {
  const hash = itemName.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return Math.max(0, Math.min(0.99, baseRate + ((hash % 41) - 20) / 100));
}
function rateToColor(r: number) {
  if (r < 0.10) return '#22c55e';
  if (r < 0.25) return '#f59e0b';
  return '#ef4444';
}
/** Derive color client-side if the API omits or returns a bad value. */
function marketColor(m: Market): string {
  if (m.color && m.color.length > 3 && m.color !== '#000000') return m.color;
  return rateToColor((m.gouging_rate ?? 0) || (m.gouging_pct / 100));
}

// ── Main pin component ────────────────────────────────────────────────────────
function MainPin({ market }: { market: Market }) {
  const color = marketColor(market);
  return (
    <View style={pin.wrapper}>
      <View style={[pin.head, { borderColor: color }]}>
        {market.has_disaster && <View style={[pin.disasterDot, { backgroundColor: C.danger }]} />}
        <Text style={[pin.pct, { color }]}>{market.gouging_pct.toFixed(0)}%</Text>
        <Text style={pin.label}>deviation</Text>
      </View>
      <View style={[pin.tail, { borderTopColor: color }]} />
    </View>
  );
}

// ── Sub-pin (smaller, for sections/zones) ────────────────────────────────────
function SubPin({ emoji, label, color }: { emoji: string; label: string; color: string }) {
  return (
    <View style={sub.wrapper}>
      <View style={[sub.head, { backgroundColor: color + 'ee', borderColor: '#fff' }]}>
        <Text style={sub.emoji}>{emoji}</Text>
      </View>
      <View style={[sub.nameTag, { backgroundColor: color + 'dd' }]}>
        <Text style={sub.nameText}>{label}</Text>
      </View>
      <View style={[sub.tail, { borderTopColor: color + 'ee' }]} />
    </View>
  );
}

// ── Callout card (shown on tap) ───────────────────────────────────────────────
function MarketCallout({ market }: { market: Market }) {
  const info = MARKET_INFO[market.id];
  const flag = FLAG_MAP[market.id] ?? '📍';
  if (!info) return null;
  return (
    <Callout tooltip>
      <View style={callout.card}>
        {/* Header */}
        <View style={callout.header}>
          <Text style={callout.flag}>{flag}</Text>
          <View style={{ flex: 1 }}>
            <Text style={callout.name}>{market.name}</Text>
            <Text style={callout.tagline}>{info.tagline}</Text>
          </View>
        </View>

        {/* Deviation badge */}
        <View style={[callout.badge, { backgroundColor: marketColor(market) + '25', borderColor: marketColor(market) + '60' }]}>
          <Text style={[callout.badgeText, { color: marketColor(market) }]}>
            {market.gouging_pct.toFixed(1)}% price deviation
          </Text>
          {market.has_disaster && info.weatherNote
            ? <Text style={callout.disasterText}>{info.weatherNote}</Text>
            : market.has_disaster
              ? <Text style={callout.disasterText}>⚠️ Active supply disruption</Text>
              : null
          }
        </View>

        {/* Known for */}
        <Text style={callout.sectionTitle}>Known for</Text>
        {info.knownFor.map(k => (
          <View key={k} style={callout.knownRow}>
            <Text style={callout.bullet}>•</Text>
            <Text style={callout.knownText}>{k}</Text>
          </View>
        ))}

        <Text style={callout.tapHint}>Open market detail →</Text>
      </View>
    </Callout>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function MapScreen() {
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [details, setDetails] = useState<Record<string, MarketDetail>>({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [zoomedId,setZoomedId]= useState<string | null>(null);

  useEffect(() => {
    cachedFetch('/markets')
      .then(data => { setMarkets(applyDemoOverrides(data)); setLoading(false); })
      .catch(e  => { setError(e.message); setLoading(false); });
  }, []);

  const handleRegionChange = (region: Region) => {
    if (region.latitudeDelta > 5) { setZoomedId(null); return; }
    const nearest = markets.reduce<Market | null>((best, m) => {
      const d  = Math.abs(m.lat - region.latitude) + Math.abs(m.lng - region.longitude);
      const bd = best
        ? Math.abs(best.lat - region.latitude) + Math.abs(best.lng - region.longitude)
        : Infinity;
      return d < bd ? m : best;
    }, null);
    if (!nearest) return;
    if (Math.abs(nearest.lat - region.latitude) + Math.abs(nearest.lng - region.longitude) > 3) {
      setZoomedId(null); return;
    }
    setZoomedId(nearest.id);
    if (_detailCache[nearest.id]) {
      setDetails(prev => ({ ...prev, [nearest.id]: _detailCache[nearest.id] }));
    } else {
      cachedFetch(`/market/${nearest.id}`)
        .then(data => { _detailCache[nearest.id] = data; setDetails(prev => ({ ...prev, [nearest.id]: data })); })
        .catch(() => {});
    }
  };

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={C.accent} />
      <Text style={styles.loadingText}>Loading markets...</Text>
    </View>
  );

  if (error) return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>Could not load markets</Text>
      <Text style={styles.errorSub}>{error}</Text>
    </View>
  );

  const zoomedMarket = zoomedId ? markets.find(m => m.id === zoomedId) : null;

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{ latitude: 20, longitude: 30, latitudeDelta: 100, longitudeDelta: 120 }}
        onRegionChangeComplete={handleRegionChange}
      >
        {markets.map(market => {
          const detail   = details[market.id];
          const isZoomed = zoomedId === market.id;
          const info     = MARKET_INFO[market.id];

          return (
            <React.Fragment key={market.id}>
              {/* Heatmap glow — tight circle, subtle fill */}
              <Circle
                center={{ latitude: market.lat, longitude: market.lng }}
                radius={isZoomed ? 2500 : 42000}
                strokeColor={marketColor(market) + '80'}
                fillColor={marketColor(market) + '18'}
                strokeWidth={isZoomed ? 1.5 : 1.5}
              />

              {/* Item-level zones (zoomed only) */}
              {isZoomed && detail?.items?.map((item, i) => {
                if (i >= OFFSETS.length) return null;
                const [dlat, dlng] = OFFSETS[i];
                const r     = zoneRate(market.gouging_rate, item.name);
                const color = rateToColor(r);
                return (
                  <Circle
                    key={item.name}
                    center={{ latitude: market.lat + dlat * 1.6, longitude: market.lng + dlng * 1.6 }}
                    radius={700}
                    strokeColor={color + '90'}
                    fillColor={color + '28'}
                    strokeWidth={1}
                  />
                );
              })}

              {/* ── Sub-pins — only visible when zoomed into this market ── */}
              {isZoomed && info?.subPins.map(sp => (
                <Marker
                  key={sp.label}
                  coordinate={{ latitude: market.lat + sp.dlat, longitude: market.lng + sp.dlng }}
                  anchor={{ x: 0.5, y: 1 }}
                  tracksViewChanges={false}
                  onPress={() => router.push(`/market/${market.id}` as any)}
                >
                  <SubPin emoji={sp.emoji} label={sp.label} color={marketColor(market)} />
                </Marker>
              ))}

              {/* ── Main pin with callout ── */}
              <Marker
                coordinate={{ latitude: market.lat, longitude: market.lng }}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={false}
                onPress={() => {}}
              >
                <MainPin market={market} />
                <MarketCallout market={market} />
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      {/* ── Legend ── */}
      <View style={styles.legend}>
        <Text style={styles.legendHeader}>
          {zoomedMarket
            ? `${FLAG_MAP[zoomedMarket.id] ?? ''} ${zoomedMarket.name}`
            : 'Price Deviation Index'}
        </Text>
        {zoomedMarket && (
          <Text style={styles.legendSub}>Zone view active · zoom out for global</Text>
        )}

        <View style={styles.colorScale}>
          {[
            { color: C.fair,   label: 'Stable',  sub: '< 10%' },
            { color: C.accent, label: 'Watch',   sub: '10–25%' },
            { color: C.danger, label: 'Alert',   sub: '> 25%' },
          ].map(({ color, label, sub }) => (
            <View key={label} style={styles.scaleItem}>
              <View style={[styles.scaleDot, { backgroundColor: color }]} />
              <View>
                <Text style={[styles.scaleLabel, { color }]}>{label}</Text>
                <Text style={styles.scaleSub}>{sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {markets.map(m => (
          <View key={m.id} style={styles.marketRow}>
            <Text style={styles.marketFlag}>{FLAG_MAP[m.id] ?? '📍'}</Text>
            <View style={styles.marketInfo}>
              <Text style={styles.marketName}>{m.name}</Text>
              <Text style={styles.marketCity}>{m.city}</Text>
            </View>
            <View style={styles.marketRight}>
              <Text style={[styles.marketPct, { color: marketColor(m) }]}>{m.gouging_pct.toFixed(1)}%</Text>
              {m.has_disaster && <Text style={styles.disasterBadge}>● disruption</Text>}
            </View>
          </View>
        ))}

        <Text style={styles.hint}>Tap pin for details</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const pin = StyleSheet.create({
  wrapper:     { alignItems: 'center' },
  head: {
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
    alignItems: 'center', borderWidth: 2, borderColor: '#fff',
    backgroundColor: C.card,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.45, shadowRadius: 5, elevation: 9,
    minWidth: 60,
  },
  disasterDot: {
    position: 'absolute', top: -4, right: -4,
    width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: C.card,
  },
  pct:   { fontSize: 20, fontWeight: '900', lineHeight: 24, fontVariant: ['tabular-nums'] as any },
  label: { fontSize: 8, color: C.muted, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  tail: {
    width: 0, height: 0,
    borderLeftWidth: 8, borderLeftColor: 'transparent',
    borderRightWidth: 8, borderRightColor: 'transparent',
    borderTopWidth: 12,
  },
});

const sub = StyleSheet.create({
  wrapper:  { alignItems: 'center' },
  head: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 3, elevation: 6,
  },
  emoji:    { fontSize: 18 },
  nameTag: {
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    marginTop: 2,
  },
  nameText: { fontSize: 9, color: '#fff', fontWeight: '800', textAlign: 'center' },
  tail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderLeftColor: 'transparent',
    borderRightWidth: 5, borderRightColor: 'transparent',
    borderTopWidth: 7,
  },
});

const callout = StyleSheet.create({
  card: {
    width: 240, backgroundColor: C.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 12,
  },
  header:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  flag:        { fontSize: 28 },
  name:        { fontSize: 14, fontWeight: '800', color: C.text },
  tagline:     { fontSize: 11, color: C.muted, lineHeight: 16, marginTop: 2 },
  badge:       { borderRadius: 8, padding: 8, marginBottom: 10, borderWidth: 1 },
  badgeText:   { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  disasterText:{ fontSize: 10, color: C.danger, textAlign: 'center', marginTop: 4, fontWeight: '600' },
  sectionTitle:{ fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  knownRow:    { flexDirection: 'row', gap: 6, marginBottom: 4 },
  bullet:      { color: C.accent, fontWeight: '900', fontSize: 12 },
  knownText:   { color: C.text, fontSize: 12, flex: 1, lineHeight: 18 },
  tapHint:     { fontSize: 10, color: C.accent, textAlign: 'center', marginTop: 10, fontWeight: '600' },
});

const styles = StyleSheet.create({
  container:    { flex: 1 },
  map:          { flex: 1 },
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg, gap: 12 },
  loadingText:  { color: C.muted, fontSize: 14 },
  errorText:    { color: C.danger, fontSize: 16, fontWeight: '700' },
  errorSub:     { color: C.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },
  legend: {
    position: 'absolute', bottom: 24, left: 14, right: 14,
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 10,
  },
  legendHeader: { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 2 },
  legendSub:    { fontSize: 11, color: C.muted, marginBottom: 10 },
  colorScale:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, marginTop: 8 },
  scaleItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scaleDot:     { width: 10, height: 10, borderRadius: 5 },
  scaleLabel:   { fontSize: 11, fontWeight: '800' },
  scaleSub:     { fontSize: 9, color: C.muted },
  divider:      { height: 1, backgroundColor: C.border, marginBottom: 10 },
  marketRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  marketFlag:   { fontSize: 22 },
  marketInfo:   { flex: 1 },
  marketName:   { fontSize: 12, fontWeight: '700', color: C.text },
  marketCity:   { fontSize: 10, color: C.muted },
  marketRight:  { alignItems: 'flex-end', gap: 2 },
  marketPct:    { fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] as any },
  disasterBadge:{ fontSize: 9, color: C.danger, fontWeight: '700' },
  hint:         { fontSize: 10, color: C.muted, textAlign: 'center', marginTop: 4 },
});
