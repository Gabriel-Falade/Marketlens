import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, Text as SvgText } from 'react-native-svg';
import { C } from '../constants';
import { cachedFetch } from '../lib/cache';

type ItemData = {
  name: string;
  mean: number;
  std: number;
  min: number;
  max: number;
  raw_mean: number;
  sample_size: number;
  wb_multiplier: number;
  dis_multiplier: number;
};

// ── Seeded deterministic random (LCG) ─────────────────────────────────────────
function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ── 30-day simulated price series ─────────────────────────────────────────────
function build30DayTrend(item: ItemData): { dayIndex: number; price: number }[] {
  const seed = item.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = seededRand(seed);
  const pts: { dayIndex: number; price: number }[] = [];
  for (let i = 0; i < 30; i++) {
    // Trend gradually from raw_mean (30 days ago) toward adjusted mean (today)
    const progress = i / 29;
    const baseline = item.raw_mean + (item.mean - item.raw_mean) * progress;
    const noise = (rand() - 0.5) * item.std * 0.85;
    const price = Math.max(item.min * 0.85, Math.min(item.max * 1.1, baseline + noise));
    pts.push({ dayIndex: i, price: Math.round(price) });
  }
  return pts;
}

// ── 30-Day SVG Line Chart (stock style) ───────────────────────────────────────
const CHART_H = 150;
const PAD = { top: 16, bottom: 28, left: 4, right: 4 };

function TrendChart({ item, symbol }: { item: ItemData; symbol: string }) {
  const [w, setW] = useState(320);
  const pts    = build30DayTrend(item);
  const prices = pts.map(p => p.price);
  const maxP   = Math.max(...prices);
  const minP   = Math.min(...prices);
  const rangeP = maxP - minP || 1;

  const innerW = w - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  const toX = (i: number) => PAD.left + (i / (pts.length - 1)) * innerW;
  const toY = (price: number) =>
    PAD.top + innerH - ((price - minP) / rangeP) * innerH;

  // Build SVG path strings
  const coords = pts.map((pt, i) => ({ x: toX(i), y: toY(pt.price) }));
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${(CHART_H - PAD.bottom).toFixed(1)} L${coords[0].x.toFixed(1)},${(CHART_H - PAD.bottom).toFixed(1)} Z`;

  // Reference y-positions
  const fairY = toY(item.mean);
  const rawY  = toY(item.raw_mean);

  // Trend color: up = danger (prices rising bad for buyer), down = fair (good), flat = accent
  const first = pts[0].price, last = pts[29].price;
  const lineColor = last > first * 1.02 ? C.danger : last < first * 0.98 ? C.fair : C.accent;

  const today = pts[29].price;
  const todayX = coords[29].x;
  const todayY = coords[29].y;

  return (
    <View style={tr.container}>
      {/* Header */}
      <View style={tr.header}>
        <View>
          <Text style={tr.title}>30-Day Price Trend</Text>
          <Text style={tr.sub}>Market baseline model</Text>
        </View>
        <View style={tr.todayBadge}>
          <Text style={[tr.todayPrice, { color: lineColor }]}>
            {symbol}{today.toLocaleString()}
          </Text>
          <Text style={tr.todayLabel}>TODAY</Text>
        </View>
      </View>

      {/* SVG chart */}
      <View onLayout={e => setW(e.nativeEvent.layout.width)}>
        <Svg width={w} height={CHART_H}>
          <Defs>
            <LinearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%"   stopColor={lineColor} stopOpacity="0.35" />
              <Stop offset="100%" stopColor={lineColor} stopOpacity="0"    />
            </LinearGradient>
          </Defs>

          {/* Reference line: historical avg */}
          {Math.abs(rawY - fairY) > 4 && (
            <Line
              x1={PAD.left} y1={rawY} x2={w - PAD.right} y2={rawY}
              stroke={C.muted} strokeWidth="1" strokeDasharray="4 4" opacity="0.5"
            />
          )}
          {/* Reference line: current fair price */}
          <Line
            x1={PAD.left} y1={fairY} x2={w - PAD.right} y2={fairY}
            stroke={C.accent} strokeWidth="1" strokeDasharray="4 4" opacity="0.6"
          />

          {/* Area fill */}
          <Path d={areaPath} fill="url(#trendGrad)" />

          {/* Price line */}
          <Path d={linePath} stroke={lineColor} strokeWidth="2" fill="none" strokeLinejoin="round" />

          {/* Today dot */}
          <Circle cx={todayX} cy={todayY} r="5" fill={lineColor} />
          <Circle cx={todayX} cy={todayY} r="9" fill={lineColor} opacity="0.2" />

          {/* Fair price label */}
          <SvgText x={PAD.left + 4} y={fairY - 4} fontSize="9" fill={C.accent} opacity="0.9">
            Fair {symbol}{Math.round(item.mean).toLocaleString()}
          </SvgText>

          {/* Historical avg label (only if far enough from fair) */}
          {Math.abs(rawY - fairY) > 14 && (
            <SvgText x={PAD.left + 4} y={rawY - 4} fontSize="9" fill={C.muted} opacity="0.8">
              Hist. {symbol}{Math.round(item.raw_mean).toLocaleString()}
            </SvgText>
          )}
        </Svg>
      </View>

      {/* X-axis labels */}
      <View style={tr.xRow}>
        <Text style={tr.xLabel}>30 days ago</Text>
        <Text style={tr.xLabel}>15 days ago</Text>
        <Text style={[tr.xLabel, { color: lineColor, fontWeight: '700' }]}>Today</Text>
      </View>
    </View>
  );
}

const tr = StyleSheet.create({
  container:  { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title:      { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1, textTransform: 'uppercase' },
  sub:        { fontSize: 10, color: C.border, marginTop: 2 },
  todayBadge: { alignItems: 'flex-end' },
  todayPrice: { fontSize: 18, fontWeight: '900' },
  todayLabel: { fontSize: 9, color: C.muted, fontWeight: '700', letterSpacing: 1 },
  xRow:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  xLabel:     { fontSize: 10, color: C.muted },
});


// ── Market Climate Score ───────────────────────────────────────────────────────
function MarketClimate({ item, symbol, hasDisaster, disasters }: {
  item: ItemData; symbol: string; hasDisaster: boolean; disasters: string[];
}) {
  const wb       = item.wb_multiplier  ?? 1;
  const dis      = item.dis_multiplier ?? 1;
  const combined = wb * dis;
  const wbPct    = Math.round((wb  - 1) * 100);
  const disPct   = Math.round((dis - 1) * 100);
  const totalPct = Math.round((combined - 1) * 100);

  // Score: 95 = stable market, drops as economic pressure increases
  const score = Math.max(5, Math.min(95, Math.round(100 - (combined - 1) * 150)));

  let label: string, color: string;
  if      (score >= 80) { label = 'Stable';        color = C.fair;   }
  else if (score >= 65) { label = 'Mild Pressure';  color = C.fair;   }
  else if (score >= 50) { label = 'Elevated';       color = C.accent; }
  else if (score >= 30) { label = 'High Pressure';  color = C.accent; }
  else                  { label = 'Crisis Pricing'; color = C.danger; }

  const gougingCeiling = Math.round(item.mean * 1.15);

  return (
    <View style={[mc.card, { borderColor: color + '50' }]}>
      <Text style={mc.title}>Market Climate</Text>

      <View style={mc.scoreRow}>
        {/* Score circle */}
        <View style={[mc.circle, { borderColor: color, backgroundColor: color + '15' }]}>
          <Text style={[mc.scoreNum, { color }]}>{score}</Text>
          <Text style={mc.scoreOf}>/100</Text>
        </View>

        <View style={mc.right}>
          <Text style={[mc.label, { color }]}>{label}</Text>

          {/* Historical vs current fair price */}
          <View style={mc.priceCompare}>
            <View style={mc.priceCol}>
              <Text style={mc.priceSmLabel}>Historical</Text>
              <Text
                style={[mc.priceVal, { color: C.muted }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              >
                {symbol}{Math.round(item.raw_mean).toLocaleString()}
              </Text>
            </View>
            <Text style={mc.arrow}>→</Text>
            <View style={mc.priceCol}>
              <Text style={mc.priceSmLabel}>Fair now</Text>
              <Text
                style={[mc.priceVal, { color }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              >
                {symbol}{Math.round(item.mean).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Economic context breakdown */}
      {totalPct > 2 ? (
        <View style={mc.breakdown}>
          <Text style={mc.breakdownTitle}>
            Why prices are {totalPct}% above historical average:
          </Text>
          {wbPct > 0 && (
            <View style={mc.breakdownRow}>
              <Text style={mc.breakdownIcon}>📈</Text>
              <Text style={mc.breakdownText}>
                World Bank inflation / GDP data: +{wbPct}%
              </Text>
            </View>
          )}
          {disPct > 0 && (
            <View style={mc.breakdownRow}>
              <Text style={mc.breakdownIcon}>{hasDisaster ? '⚠️' : '📦'}</Text>
              <Text style={mc.breakdownText}>
                {hasDisaster
                  ? `Active disruption (${disasters.slice(0, 2).join(', ')}): +${disPct}%`
                  : `Supply / seasonal pressure: +${disPct}%`}
              </Text>
            </View>
          )}
          <Text style={mc.breakdownNote}>
            These are legitimate economic factors — higher prices are expected.
          </Text>
        </View>
      ) : (
        <Text style={mc.stableNote}>
          Prices are at their normal historical level for this item.
        </Text>
      )}

      {/* Gouging tip */}
      <View style={mc.tip}>
        <Text style={mc.tipText}>
          If quoted above {symbol}{gougingCeiling.toLocaleString()}, that exceeds the fair range —
          use the Report screen to get a full analysis and negotiation script.
        </Text>
      </View>
    </View>
  );
}

const mc = StyleSheet.create({
  card:          { borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1.5, backgroundColor: C.card },
  title:         { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  scoreRow:      { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 14 },
  circle:        { width: 72, height: 72, borderRadius: 36, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  scoreNum:      { fontSize: 24, fontWeight: '900' },
  scoreOf:       { fontSize: 9, color: C.muted },
  right:         { flex: 1, gap: 8 },
  label:         { fontSize: 18, fontWeight: '800' },
  priceCompare:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceCol:      { alignItems: 'center' },
  priceSmLabel:  { fontSize: 9, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2, textAlign: 'center' },
  priceVal:      { fontSize: 14, fontWeight: '700', textAlign: 'center', minWidth: 60, maxWidth: 90 },
  arrow:         { color: C.muted, fontSize: 14 },
  breakdown:     { backgroundColor: C.bg, borderRadius: 8, padding: 12, gap: 6, marginBottom: 10 },
  breakdownTitle:{ fontSize: 11, color: C.muted, marginBottom: 4 },
  breakdownRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  breakdownIcon: { fontSize: 14 },
  breakdownText: { color: C.text, fontSize: 13, flex: 1, lineHeight: 18 },
  breakdownNote: { fontSize: 11, color: C.fair, marginTop: 4, fontStyle: 'italic' },
  stableNote:    { color: C.muted, fontSize: 13, textAlign: 'center', marginBottom: 10, fontStyle: 'italic' },
  tip:           { backgroundColor: C.accent + '10', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.accent + '30' },
  tipText:       { color: C.accent, fontSize: 12, lineHeight: 18 },
});


// ── Main Screen ────────────────────────────────────────────────────────────────
export default function ItemDetail() {
  const { name, market_id, symbol: symParam, fromScan } = useLocalSearchParams<{
    name: string; market_id?: string; symbol?: string; fromScan?: string;
  }>();
  const router = useRouter();

  const [item,        setItem]        = useState<ItemData | null>(null);
  const [marketName,  setMarketName]  = useState('');
  const [symbol,      setSymbol]      = useState(symParam ?? '');
  const [hasDisaster, setHasDisaster] = useState(false);
  const [disasters,   setDisasters]   = useState<string[]>([]);
  const [loading,     setLoading]     = useState(!!market_id);

  useEffect(() => {
    if (!market_id) return;
    cachedFetch(`/market/${market_id}`)
      .then(data => {
        setMarketName(data.name);
        setSymbol(data.symbol);
        setHasDisaster(data.has_disaster ?? false);
        setDisasters(data.disasters ?? []);
        const found = data.items?.find((i: ItemData) => i.name === name);
        if (found) setItem(found);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [market_id, name]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {fromScan === 'true' && (
        <View style={styles.scanBadge}>
          <Text style={styles.scanBadgeText}>✓ Scanned Successfully</Text>
        </View>
      )}

      <Text style={styles.title}>{name}</Text>
      {marketName ? <Text style={styles.subtitle}>{marketName}</Text> : null}

      {loading && <ActivityIndicator color={C.accent} style={{ marginVertical: 20 }} />}

      {item && !loading && (
        <>
          {/* Min / Avg / Max cards */}
          <View style={styles.priceRow}>
            {([
              { label: 'Min',     value: item.min,  color: C.fair   },
              { label: 'Average', value: item.mean, color: C.accent },
              { label: 'Max',     value: item.max,  color: C.danger },
            ] as const).map(p => (
              <View key={p.label} style={[styles.priceCard, { borderColor: p.color + '40', backgroundColor: p.color + '10' }]}>
                <Text style={styles.priceCardLabel}>{p.label}</Text>
                <Text
                  style={[styles.priceCardValue, { color: p.color }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.5}
                >
                  {symbol}{p.value.toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.samples}>{item.sample_size} community price reports</Text>

          {/* Market Climate (fairness score) */}
          <MarketClimate
            item={item}
            symbol={symbol}
            hasDisaster={hasDisaster}
            disasters={disasters}
          />

          {/* 30-day trend chart */}
          <TrendChart item={item} symbol={symbol} />
        </>
      )}

      {!item && !loading && (
        <View style={styles.noData}>
          <Text style={styles.noDataText}>Price data not available for this item.</Text>
        </View>
      )}

      {/* CTA: report a price */}
      <TouchableOpacity
        style={styles.reportBtn}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: '/report',
            params: market_id ? { market_id } : {},
          })
        }
      >
        <Text style={styles.reportBtnText}>Check a Quoted Price</Text>
      </TouchableOpacity>

      {market_id && (
        <TouchableOpacity
          style={styles.mapBtn}
          activeOpacity={0.8}
          onPress={() => router.push(`/market/${market_id}` as any)}
        >
          <Text style={styles.mapBtnText}>Back to Market</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  content:         { padding: 20, paddingBottom: 40 },
  scanBadge:       { backgroundColor: C.fair + '20', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 14, alignSelf: 'flex-start', marginBottom: 12, borderWidth: 1, borderColor: C.fair + '50' },
  scanBadgeText:   { color: C.fair, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  title:           { fontSize: 26, fontWeight: '900', color: C.text, marginBottom: 4 },
  subtitle:        { fontSize: 13, color: C.muted, marginBottom: 20 },
  priceRow:        { flexDirection: 'row', gap: 10, marginBottom: 10 },
  priceCard:       { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1 },
  priceCardLabel:  { fontSize: 10, color: C.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, textAlign: 'center' },
  priceCardValue:  { fontSize: 16, fontWeight: '900', textAlign: 'center', width: '100%' },
  samples:         { fontSize: 11, color: C.muted, marginBottom: 16, textAlign: 'center' },
  noData:          { backgroundColor: C.card, borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: C.border, marginBottom: 16 },
  noDataText:      { color: C.muted, fontSize: 14 },
  reportBtn:       { backgroundColor: C.accent, borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  reportBtnText:   { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  mapBtn:          { backgroundColor: C.card, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.border },
  mapBtnText:      { color: C.text, fontSize: 14, fontWeight: '600' },
});
