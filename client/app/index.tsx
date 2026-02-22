import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from './constants';

// ── Feature navigation ────────────────────────────────────────────────────────
const PRIMARY_ITEMS = [
  { href: '/map',          label: 'PRICE MAP',    icon: 'map-outline',       color: C.fair,   desc: 'Live heatmap' },
  { href: '/intelligence', label: 'INTELLIGENCE', icon: 'bar-chart-outline', color: C.accent, desc: 'Signal dashboard' },
] as const;

const SECONDARY_ITEMS = [
  { href: '/report', label: 'SUBMIT OBSERVATION', icon: 'add-circle-outline', color: C.accent,   desc: 'Contribute price data to the index' },
  { href: '/scan',   label: 'FIELD SCANNER',       icon: 'camera-outline',     color: '#a78bfa', desc: 'Identify & price items on-site' },
  { href: '/search', label: 'ITEM LOOKUP',          icon: 'search-outline',     color: '#38bdf8', desc: 'Search historical price data' },
] as const;

// ── Active index data ─────────────────────────────────────────────────────────
const INDICES = [
  { id: 'lagos', flag: '🇳🇬', name: 'Balogun Market', city: 'Lagos, NG',  pct: 46, color: C.danger, label: 'ALERT'  },
  { id: 'delhi', flag: '🇮🇳', name: 'Chandni Chowk',  city: 'Delhi, IN',  pct: 5,  color: C.fair,   label: 'STABLE' },
  { id: 'metz',  flag: '🇫🇷', name: 'Marché de Metz', city: 'Metz, FR',   pct: 41, color: C.danger, label: 'ALERT'  },
];

// ── Screen ────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* ── Brand header ── */}
      <View style={s.headerRow}>
        <View>
          <Text style={s.brand}>MarketLens</Text>
          <Text style={s.tagline}>Informal economy intelligence</Text>
        </View>
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.liveLabel}>LIVE</Text>
        </View>
      </View>

      {/* ── Global stats strip ── */}
      <View style={s.statsStrip}>
        {[
          { value: '2B',   label: 'Informal workers' },
          { value: '$10T', label: 'Annual volume' },
          { value: '3',    label: 'Active indices' },
        ].map((stat, i, arr) => (
          <View key={stat.value} style={[s.statCell, i < arr.length - 1 && s.statCellBorder]}>
            <Text style={s.statValue}>{stat.value}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Primary 2-col tiles ── */}
      <View style={s.primaryRow}>
        {PRIMARY_ITEMS.map(item => (
          <Link key={item.href} href={item.href} asChild>
            <Pressable style={[s.primaryCard, { borderTopColor: item.color }]}>
              <Ionicons name={item.icon as any} size={28} color={item.color} />
              <Text style={[s.primaryLabel, { color: item.color }]}>{item.label}</Text>
              <Text style={s.primaryDesc}>{item.desc}</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      {/* ── Secondary rows ── */}
      {SECONDARY_ITEMS.map(item => (
        <Link key={item.href} href={item.href} asChild>
          <Pressable style={[s.secondaryCard, { borderLeftColor: item.color }]}>
            <Ionicons name={item.icon as any} size={20} color={item.color} />
            <View style={{ flex: 1 }}>
              <Text style={[s.secondaryLabel, { color: item.color }]}>{item.label}</Text>
              <Text style={s.secondaryDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={C.muted} />
          </Pressable>
        </Link>
      ))}

      {/* ── Active indices ── */}
      <Text style={s.sectionTitle}>ACTIVE INDICES</Text>
      {INDICES.map(m => (
        <Link key={m.id} href={`/market/${m.id}`} asChild>
          <Pressable style={[s.indexRow, { borderLeftColor: m.color }]}>
            <Text style={s.indexFlag}>{m.flag}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.indexName}>{m.name}</Text>
              <Text style={s.indexCity}>{m.city}</Text>
            </View>
            <View style={s.indexRight}>
              <Text style={[s.indexPct, { color: m.color }]}>{m.pct}%</Text>
              <View style={[s.statusPill, { backgroundColor: m.color + '18', borderColor: m.color + '45' }]}>
                <Text style={[s.statusText, { color: m.color }]}>{m.label}</Text>
              </View>
            </View>
          </Pressable>
        </Link>
      ))}

    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },
  content:        { padding: 20, paddingBottom: 52 },

  // Header
  headerRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 },
  brand:          { fontSize: 34, fontWeight: '900', color: C.accent, letterSpacing: -1 },
  tagline:        { fontSize: 12, color: C.muted, marginTop: 5, fontWeight: '500' },
  livePill:       { flexDirection: 'row', alignItems: 'center', gap: 5,
                    backgroundColor: C.fair + '18', borderRadius: 20,
                    paddingHorizontal: 10, paddingVertical: 5,
                    borderWidth: 1, borderColor: C.fair + '40' },
  liveDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: C.fair },
  liveLabel:      { fontSize: 9, fontWeight: '800', color: C.fair, letterSpacing: 1 },

  // Stats strip
  statsStrip:     { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14,
                    borderWidth: 1, borderColor: C.border, marginBottom: 16, overflow: 'hidden' },
  statCell:       { flex: 1, alignItems: 'center', paddingVertical: 18 },
  statCellBorder: { borderRightWidth: 1, borderRightColor: C.border },
  statValue:      { fontSize: 26, fontWeight: '900', color: C.text, fontVariant: ['tabular-nums'] as any },
  statLabel:      { fontSize: 10, color: C.muted, marginTop: 4, fontWeight: '600', letterSpacing: 0.3 },

  // Primary 2-col
  primaryRow:     { flexDirection: 'row', gap: 10, marginBottom: 10 },
  primaryCard:    { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 18,
                    borderWidth: 1, borderColor: C.border, borderTopWidth: 3, gap: 10 },
  primaryLabel:   { fontSize: 12, fontWeight: '900', letterSpacing: 0.8 },
  primaryDesc:    { fontSize: 11, color: C.muted, lineHeight: 16 },

  // Secondary rows
  secondaryCard:  { flexDirection: 'row', alignItems: 'center', gap: 14,
                    backgroundColor: C.card, borderRadius: 12, padding: 16,
                    borderWidth: 1, borderColor: C.border, borderLeftWidth: 3,
                    marginBottom: 8 },
  secondaryLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  secondaryDesc:  { fontSize: 11, color: C.muted, marginTop: 3 },

  // Active indices
  sectionTitle:   { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 2,
                    textTransform: 'uppercase', marginBottom: 12, marginTop: 10 },
  indexRow:       { flexDirection: 'row', alignItems: 'center', gap: 14,
                    backgroundColor: C.card, borderRadius: 12, padding: 16,
                    marginBottom: 8, borderWidth: 1, borderColor: C.border, borderLeftWidth: 3 },
  indexFlag:      { fontSize: 26 },
  indexName:      { fontSize: 14, fontWeight: '700', color: C.text },
  indexCity:      { fontSize: 11, color: C.muted, marginTop: 2 },
  indexRight:     { alignItems: 'flex-end', gap: 5 },
  indexPct:       { fontSize: 22, fontWeight: '900', fontVariant: ['tabular-nums'] as any },
  statusPill:     { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
  statusText:     { fontSize: 8, fontWeight: '800', letterSpacing: 0.5 },
});
