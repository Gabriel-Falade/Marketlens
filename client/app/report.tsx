import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Circle, Text as SvgText } from 'react-native-svg';
import { API_BASE, C, MARKET_ITEMS, MARKETS, TUNNEL_HEADERS } from './constants';
// ── Types ─────────────────────────────────────────────────────────────────────

type SubmitResult = {
  item: string;
  submitted_price: number;
  currency: string;
  adjusted_mean: number;
  z_score: number;
  is_gouged: boolean;
  percent_above: number;
  severity: string;
  bell_curve: { x: number; y: number }[];
  fairness_score: { score: number; label: string };
  negotiation: { fair_price: number; counter_offer: number; walk_away: number; symbol: string };
  explanation: string;
  negotiation_script: string;
  summary_line: string;
  adjustments: { reason: string; combined: number };
  report_saved?: boolean;
  report_id?: number | null;
};

// ── Bell Curve (SVG area chart) ────────────────────────────────────────────────
const BELL_H = 130;
const BELL_PAD = { top: 20, bottom: 24, left: 4, right: 4 };

function BellCurve({ data, submittedPrice, symbol }: {
  data: { x: number; y: number }[];
  submittedPrice: number;
  symbol: string;
}) {
  const [w, setW] = useState(320);
  if (!data?.length) return null;

  // Downsample to ~80 points for a smooth curve without too many path segments
  const step = Math.max(1, Math.floor(data.length / 80));
  const pts  = data.filter((_, i) => i % step === 0);

  const maxY  = Math.max(...pts.map(d => d.y));
  const minX  = pts[0].x;
  const maxX  = pts[pts.length - 1].x;
  const rangeX = maxX - minX || 1;

  const innerW = w - BELL_PAD.left - BELL_PAD.right;
  const innerH = BELL_H - BELL_PAD.top - BELL_PAD.bottom;

  const toX = (x: number) => BELL_PAD.left + ((x - minX) / rangeX) * innerW;
  const toY = (y: number) => BELL_PAD.top + innerH - (y / maxY) * innerH;
  const baseY = BELL_PAD.top + innerH;

  // SVG path along the curve
  const coords = pts.map(pt => ({ x: toX(pt.x), y: toY(pt.y) }));
  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${baseY} L${coords[0].x.toFixed(1)},${baseY} Z`;

  // Submitted price vertical line
  const subX = toX(submittedPrice);
  const isGouged = submittedPrice > (minX + maxX) / 2;
  const priceColor = isGouged ? C.danger : C.fair;

  return (
    <View style={bell.wrap}>
      <View style={bell.header}>
        <Text style={bell.title}>Price Distribution</Text>
        <Text style={[bell.yourPrice, { color: priceColor }]}>
          Yours: {symbol}{submittedPrice.toLocaleString()}
        </Text>
      </View>

      <View onLayout={e => setW(e.nativeEvent.layout.width)}>
        <Svg width={w} height={BELL_H}>
          <Defs>
            {/* Green gradient for left (fair) side */}
            <LinearGradient id="bellGradFair" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%"   stopColor={C.accent} stopOpacity="0.5" />
              <Stop offset="100%" stopColor={C.accent} stopOpacity="0.05" />
            </LinearGradient>
            {/* Red gradient for right (expensive) side */}
            <LinearGradient id="bellGradDanger" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%"   stopColor={C.danger} stopOpacity="0.5" />
              <Stop offset="100%" stopColor={C.danger} stopOpacity="0.05" />
            </LinearGradient>
          </Defs>

          {/* Full area in accent, then overlay danger zone to the right of submitted price */}
          <Path d={areaPath} fill="url(#bellGradFair)" />

          {/* Danger zone: clip area to the right of submitted price */}
          {subX < w - BELL_PAD.right && (() => {
            const rightPts = coords.filter(c => c.x >= subX);
            if (rightPts.length < 2) return null;
            const rLinePath = rightPts.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
            const rAreaPath = `${rLinePath} L${rightPts[rightPts.length - 1].x.toFixed(1)},${baseY} L${subX.toFixed(1)},${baseY} Z`;
            return <Path d={rAreaPath} fill="url(#bellGradDanger)" />;
          })()}

          {/* Curve line */}
          <Path d={linePath} stroke={C.accent} strokeWidth="2" fill="none" strokeLinejoin="round" />

          {/* Submitted price vertical line */}
          <Line
            x1={subX} y1={BELL_PAD.top - 4}
            x2={subX} y2={baseY}
            stroke={priceColor} strokeWidth="2"
          />
          {/* Dot at the curve peak of submitted price */}
          <Circle cx={subX} cy={BELL_PAD.top - 4} r="4" fill={priceColor} />

          {/* Min / Max price labels */}
          <SvgText x={BELL_PAD.left + 2} y={BELL_H - 6} fontSize="9" fill={C.muted}>
            {symbol}{Math.round(minX).toLocaleString()}
          </SvgText>
          <SvgText x={w - BELL_PAD.right - 2} y={BELL_H - 6} fontSize="9" fill={C.muted} textAnchor="end">
            {symbol}{Math.round(maxX).toLocaleString()}
          </SvgText>
        </Svg>
      </View>

      {/* Legend */}
      <View style={bell.legend}>
        <View style={bell.legendItem}>
          <View style={[bell.legendDot, { backgroundColor: C.accent }]} />
          <Text style={bell.legendText}>Fair range</Text>
        </View>
        <View style={bell.legendItem}>
          <View style={[bell.legendDot, { backgroundColor: C.danger }]} />
          <Text style={bell.legendText}>Above market</Text>
        </View>
        <View style={bell.legendItem}>
          <View style={[bell.legendLine, { backgroundColor: priceColor }]} />
          <Text style={[bell.legendText, { color: priceColor }]}>Your price</Text>
        </View>
      </View>
    </View>
  );
}
const bell = StyleSheet.create({
  wrap:       { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  title:      { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1, textTransform: 'uppercase' },
  yourPrice:  { fontSize: 14, fontWeight: '800' },
  legend:     { flexDirection: 'row', gap: 14, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendLine: { width: 12, height: 2, borderRadius: 1 },
  legendText: { fontSize: 10, color: C.muted },
});

// ── Quality Picker (1–10) ──────────────────────────────────────────────────────
function QualityPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const color = (n: number) => n <= 3 ? C.danger : n <= 6 ? C.accent : C.fair;
  return (
    <View style={qp.wrap}>
      <View style={qp.row}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
          const c   = color(n);
          const sel = value === n;
          return (
            <TouchableOpacity
              key={n}
              style={[qp.btn, { borderColor: sel ? c : C.border, backgroundColor: sel ? c + '30' : C.card }]}
              onPress={() => onChange(sel ? null : n)}
              activeOpacity={0.7}
            >
              <Text style={[qp.num, { color: sel ? c : C.muted }]}>{n}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={qp.hints}>
        <Text style={[qp.hint, { color: C.danger }]}>Poor</Text>
        {value !== null && <Text style={[qp.hint, { color: color(value) }]}>{value}/10 selected</Text>}
        <Text style={[qp.hint, { color: C.fair }]}>Excellent</Text>
      </View>
    </View>
  );
}
const qp = StyleSheet.create({
  wrap:  { gap: 6 },
  row:   { flexDirection: 'row', gap: 4 },
  btn:   { flex: 1, paddingVertical: 11, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  num:   { fontSize: 13, fontWeight: '800' },
  hints: { flexDirection: 'row', justifyContent: 'space-between' },
  hint:  { fontSize: 10, fontWeight: '600' },
});

// ── Picker Modal ──────────────────────────────────────────────────────────────
function PickerModal({ visible, title, items, selected, onSelect, onClose }: {
  visible: boolean; title: string; items: string[];
  selected: string; onSelect: (v: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Outer wrapper pushes sheet to bottom; absoluteFill backdrop sits behind it */}
      <View style={modal.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={modal.sheet}>
          <Text style={modal.title}>{title}</Text>
          <ScrollView style={modal.list} bounces={false}>
            {items.map(item => (
              <TouchableOpacity
                key={item}
                style={[modal.row, item === selected && modal.rowSelected]}
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={[modal.rowText, item === selected && modal.rowTextSelected]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const modal = StyleSheet.create({
  overlay:         { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:           { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '65%' },
  list:            { flexShrink: 1 },
  title:           { fontSize: 14, fontWeight: '800', color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  row:             { paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: C.border },
  rowSelected:     { backgroundColor: C.accent + '15' },
  rowText:         { color: C.text, fontSize: 15 },
  rowTextSelected: { color: C.accent, fontWeight: '700' },
});

// ── Reporter type options ──────────────────────────────────────────────────────
const REPORTER_TYPES = [
  { id: 'tourist', label: 'Visitor', icon: '🗺️' },
  { id: 'local',   label: 'Local',   icon: '🏠' },
  { id: 'student', label: 'Student', icon: '🎓' },
] as const;
type ReporterType = 'tourist' | 'local' | 'student';

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ReportScreen() {
  const params = useLocalSearchParams<{ market_id?: string }>();

  const [marketId,        setMarketId]        = useState(params.market_id ?? 'lagos');
  const [itemName,        setItemName]        = useState(() => MARKET_ITEMS['lagos']?.[0] ?? '');
  const [price,           setPrice]           = useState('');
  const [quality,         setQuality]         = useState<number | null>(null);
  const [amount,          setAmount]          = useState('');
  const [reporterType,    setReporterType]    = useState<ReporterType>('tourist');
  const [neighborhood,    setNeighborhood]    = useState('');
  const [submitting,      setSubmitting]      = useState(false);
  const [checking,        setChecking]        = useState(false);
  const [fetchError,      setFetchError]      = useState<string | null>(null);
  const [result,          setResult]          = useState<SubmitResult | null>(null);
  const [marketPickerOpen,setMarketPickerOpen]= useState(false);
  const [itemPickerOpen,  setItemPickerOpen]  = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const resultsY  = useRef<number>(0);
  const busy = submitting || checking;

  // Reset selected item and results when the market changes
  useEffect(() => {
    setItemName(MARKET_ITEMS[marketId]?.[0] ?? '');
    setResult(null);
    setFetchError(null);
  }, [marketId]);

  const handleSubmit = async (dryRun = false) => {
    if (!itemName || !price) return;
    if (dryRun) setChecking(true); else setSubmitting(true);
    setResult(null);
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/price/submit`, {
        method: 'POST',
        headers: TUNNEL_HEADERS,
        body: JSON.stringify({
          market_id:       marketId,
          item_name:       itemName,
          submitted_price: parseFloat(price),
          quality,
          amount:          amount.trim() || null,
          reporter_type:   reporterType,
          neighborhood:    neighborhood.trim() || null,
          dry_run:         dryRun,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setFetchError(data.error);
      } else {
        setResult(data);
        // Scroll to results after a short delay so layout has settled
        setTimeout(() => scrollRef.current?.scrollTo({ y: resultsY.current, animated: true }), 120);
      }
    } catch (e: any) {
      setFetchError(e?.message ?? 'Network error — check your connection');
    } finally {
      setSubmitting(false);
      setChecking(false);
    }
  };

  const selectedMarket = MARKETS.find(m => m.id === marketId);
  const scoreColor = result
    ? result.fairness_score.score < 30 ? C.danger
    : result.fairness_score.score < 70 ? C.accent
    : C.fair
    : C.muted;

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* ── Market ── */}
      <Text style={styles.label}>Market</Text>
      <TouchableOpacity style={styles.selector} onPress={() => setMarketPickerOpen(true)}>
        <Text style={styles.selectorText}>{selectedMarket?.flag} {selectedMarket?.name}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      {/* ── Item ── */}
      <Text style={styles.label}>Item</Text>
      <TouchableOpacity style={styles.selector} onPress={() => setItemPickerOpen(true)}>
        <Text style={styles.selectorText}>{itemName || 'Select item...'}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      {/* ── Price ── */}
      <Text style={styles.label}>Observed Price {selectedMarket?.symbol ? `(${selectedMarket.symbol})` : ''}</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="Enter price..."
        placeholderTextColor={C.muted}
        value={price}
        onChangeText={setPrice}
      />

      {/* ── Amount ── */}
      <Text style={styles.label}>Amount / Quantity</Text>
      <TextInput
        style={styles.inputSm}
        placeholder="e.g. 1kg, 500g, 1 plate, 6 yards..."
        placeholderTextColor={C.muted}
        value={amount}
        onChangeText={setAmount}
      />

      {/* ── Quality ── */}
      <Text style={styles.label}>Quality Rating (optional)</Text>
      <QualityPicker value={quality} onChange={setQuality} />

      {/* ── Reporter type ── */}
      <Text style={styles.label}>Observer Type</Text>
      <View style={styles.pillRow}>
        {REPORTER_TYPES.map(rt => {
          const active = reporterType === rt.id;
          return (
            <TouchableOpacity
              key={rt.id}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => setReporterType(rt.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.pillIcon}>{rt.icon}</Text>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{rt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Neighborhood (optional) ── */}
      <Text style={styles.label}>Neighborhood / Section  <Text style={styles.optional}>(optional)</Text></Text>
      <TextInput
        style={styles.inputSm}
        placeholder="e.g. North gate, Main entrance..."
        placeholderTextColor={C.muted}
        value={neighborhood}
        onChangeText={setNeighborhood}
      />

      {/* ── Submit ── */}
      <TouchableOpacity
        style={[styles.submitBtn, (!itemName || !price || busy) && styles.submitDisabled]}
        onPress={() => handleSubmit(false)}
        disabled={!itemName || !price || busy}
        activeOpacity={0.8}
      >
        {submitting
          ? <ActivityIndicator color="#0f172a" />
          : <Text style={styles.submitText}>Contribute to Index</Text>
        }
      </TouchableOpacity>

      {/* ── Check Price Only (no DB save) ── */}
      <TouchableOpacity
        style={[styles.checkBtn, (!itemName || !price || busy) && styles.checkBtnDisabled]}
        onPress={() => handleSubmit(true)}
        disabled={!itemName || !price || busy}
        activeOpacity={0.8}
      >
        {checking
          ? <ActivityIndicator color={C.muted} size="small" />
          : <Text style={styles.checkBtnText}>Analyse (no save)</Text>
        }
      </TouchableOpacity>

      {/* ── Error banner ── */}
      {fetchError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{fetchError}</Text>
          <TouchableOpacity onPress={() => setFetchError(null)}>
            <Text style={styles.errorBannerDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Results ── */}
      {result && (
        <View
          style={styles.results}
          onLayout={e => { resultsY.current = e.nativeEvent.layout.y; }}
        >

          {/* Contribution confirmation banner */}
          {result.report_saved && (
            <View style={styles.contributedBanner}>
              <Text style={styles.contributedIcon}>✓</Text>
              <Text style={styles.contributedText}>
                Observation {result.report_id ? `#${result.report_id}` : ''} recorded
              </Text>
            </View>
          )}

          {/* Fairness score */}
          <View style={[styles.scoreCard, { borderColor: scoreColor }]}>
            <View style={[styles.scoreCircle, { borderColor: scoreColor, backgroundColor: scoreColor + '15' }]}>
              <Text style={[styles.scoreNum, { color: scoreColor }]}>{result.fairness_score.score}</Text>
              <Text style={styles.scoreOf}>/ 100</Text>
            </View>
            <View style={styles.scoreInfo}>
              <Text style={[styles.scoreLabel, { color: scoreColor }]}>{result.fairness_score.label}</Text>
              <Text style={styles.summaryLine}>{result.summary_line}</Text>
              {result.is_gouged && (
                <View style={styles.gougeBanner}>
                  <Text style={styles.gougeText}>
                    {result.percent_above.toFixed(1)}% above baseline · {result.severity} deviation
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Bell curve */}
          <BellCurve data={result.bell_curve} submittedPrice={result.submitted_price} symbol={result.negotiation?.symbol ?? ''} />

          {/* Negotiation targets */}
          {result.negotiation && (
            <View style={styles.negCard}>
              <Text style={styles.negTitle}>Price Targets</Text>
              <View style={styles.negRow}>
                {[
                  { label: 'Open With', value: result.negotiation.counter_offer, color: C.fair },
                  { label: 'Fair Price', value: result.negotiation.fair_price,   color: C.accent },
                  { label: 'Walk Away', value: result.negotiation.walk_away,     color: C.danger },
                ].map(n => (
                  <View key={n.label} style={[styles.negBox, { borderColor: n.color + '40', backgroundColor: n.color + '10' }]}>
                    <Text style={[styles.negBoxLabel, { color: C.muted }]}>{n.label}</Text>
                    <Text
                      style={[styles.negBoxValue, { color: n.color }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.5}
                    >
                      {result.negotiation.symbol}{n.value.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Claude explanation */}
          {result.explanation ? (
            <View style={styles.aiCard}>
              <Text style={styles.aiTag}>Price Analysis</Text>
              <Text style={styles.aiText}>{result.explanation}</Text>
            </View>
          ) : null}

          {/* Negotiation script */}
          {result.negotiation_script ? (
            <View style={[styles.aiCard, styles.scriptCard]}>
              <Text style={styles.aiTag}>Market Approach</Text>
              <Text style={styles.aiText}>{result.negotiation_script}</Text>
            </View>
          ) : null}

          {result.adjustments && (
            <Text style={styles.footnote}>
              Adjusted: {result.adjustments.reason} (×{result.adjustments.combined.toFixed(3)})
            </Text>
          )}
        </View>
      )}

      {/* Modals */}
      <PickerModal
        visible={marketPickerOpen}
        title="Select Market"
        items={MARKETS.map(m => `${m.flag} ${m.name}`)}
        selected={`${selectedMarket?.flag} ${selectedMarket?.name}`}
        onSelect={v => { const m = MARKETS.find(m => `${m.flag} ${m.name}` === v); if (m) setMarketId(m.id); }}
        onClose={() => setMarketPickerOpen(false)}
      />
      <PickerModal
        visible={itemPickerOpen}
        title="Select Item"
        items={MARKET_ITEMS[marketId] ?? []}
        selected={itemName}
        onSelect={setItemName}
        onClose={() => setItemPickerOpen(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  content:         { padding: 20, paddingBottom: 40 },
  label:           { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  optional:        { fontSize: 10, fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  selector:        { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectorText:    { color: C.text, fontSize: 15, fontWeight: '600', flex: 1 },
  chevron:         { color: C.muted, fontSize: 16 },
  input:           { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, color: C.text, fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] as any },
  inputSm:         { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, color: C.text, fontSize: 15 },
  // Reporter type pills
  pillRow:         { flexDirection: 'row', gap: 10 },
  pill:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.card, borderRadius: 10, paddingVertical: 12, borderWidth: 1.5, borderColor: C.border },
  pillActive:      { borderColor: C.accent, backgroundColor: C.accent + '15' },
  pillIcon:        { fontSize: 18 },
  pillText:        { fontSize: 13, fontWeight: '700', color: C.muted },
  pillTextActive:  { color: C.accent },
  // Submit
  submitBtn:       { backgroundColor: C.accent, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 24 },
  submitDisabled:  { backgroundColor: C.muted, opacity: 0.5 },
  submitText:      { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  results:         { marginTop: 28 },
  // Score card
  scoreCard:       { backgroundColor: C.card, borderRadius: 14, padding: 20, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 2 },
  scoreCircle:     { width: 80, height: 80, borderRadius: 40, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  scoreNum:        { fontSize: 28, fontWeight: '900', fontVariant: ['tabular-nums'] as any },
  scoreOf:         { fontSize: 10, color: C.muted },
  scoreInfo:       { flex: 1, gap: 6 },
  scoreLabel:      { fontSize: 18, fontWeight: '800' },
  summaryLine:     { fontSize: 13, color: C.muted, lineHeight: 18 },
  gougeBanner:     { backgroundColor: C.danger + '15', borderRadius: 6, padding: 8, borderWidth: 1, borderColor: C.danger + '40' },
  gougeText:       { color: C.danger, fontSize: 12, fontWeight: '600' },
  // Negotiation
  negCard:         { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  negTitle:        { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  negRow:          { flexDirection: 'row', gap: 8 },
  negBox:          { flex: 1, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1 },
  negBoxLabel:     { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, textAlign: 'center' },
  negBoxValue:     { fontSize: 16, fontWeight: '900', textAlign: 'center', width: '100%', fontVariant: ['tabular-nums'] as any },
  // AI cards
  aiCard:          { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  scriptCard:      { borderColor: C.accent + '40', backgroundColor: C.accent + '08' },
  aiTag:           { fontSize: 10, fontWeight: '700', color: C.accent, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  aiText:          { color: C.text, fontSize: 14, lineHeight: 22 },
  footnote:        { fontSize: 11, color: C.muted, textAlign: 'center', marginTop: 4 },
  // Contribution banner
  contributedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.fair + '18', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: C.fair + '40' },
  contributedIcon:   { fontSize: 16, color: C.fair },
  contributedText:   { fontSize: 13, fontWeight: '700', color: C.fair },
  // Check-only button
  checkBtn:          { borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10, borderWidth: 1.5, borderColor: C.border },
  checkBtnDisabled:  { opacity: 0.4 },
  checkBtnText:      { fontSize: 14, fontWeight: '700', color: C.muted },
  // Error banner
  errorBanner:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.danger + '18', borderRadius: 10, padding: 12, marginTop: 14, borderWidth: 1, borderColor: C.danger + '40' },
  errorBannerText:   { color: C.danger, fontSize: 13, fontWeight: '600', flex: 1 },
  errorBannerDismiss:{ color: C.danger, fontSize: 16, fontWeight: '700', paddingLeft: 12 },
});
