import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { C, MARKETS } from './constants';
import { cachedFetch } from './lib/cache';

type Item = {
  name: string;
  mean: number;
  min: number;
  max: number;
  sample_size: number;
};

export default function Search() {
  const router = useRouter();
  const [marketId, setMarketId] = useState('lagos');
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [query,    setQuery]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [symbol,   setSymbol]   = useState('₦');

  const fetchItems = useCallback((id: string) => {
    setLoading(true);
    cachedFetch(`/market/${id}`)
      .then(data => {
        setAllItems(data.items ?? []);
        setSymbol(data.symbol ?? '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchItems(marketId); }, [marketId]);

  const filtered = query.trim()
    ? allItems.filter(i => i.name.toLowerCase().includes(query.toLowerCase()))
    : allItems;

  return (
    <View style={styles.container}>

      {/* ── Market tabs ── */}
      <View style={styles.tabs}>
        {MARKETS.map(m => {
          const active = marketId === m.id;
          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => { setMarketId(m.id); setQuery(''); }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {m.city.split(',')[1]?.trim() ?? m.id.toUpperCase()}
              </Text>
              <Text style={[styles.tabName, active && styles.tabNameActive]}>
                {m.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Search input ── */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={C.muted} />
        <TextInput
          style={styles.input}
          placeholder="Search items…"
          placeholderTextColor={C.muted}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="always"
          autoCorrect={false}
        />
      </View>

      {/* ── Results ── */}
      {loading
        ? <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />
        : (
          <FlatList
            data={filtered}
            keyExtractor={item => item.name}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.empty}>No items found.</Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: '/item/[name]',
                    params: { name: item.name, market_id: marketId, symbol },
                  })
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>{item.sample_size} observations</Text>
                </View>
                <View style={styles.priceRange}>
                  <Text style={[styles.priceVal, { color: C.fair, fontVariant: ['tabular-nums'] as any }]}>
                    {symbol}{item.min.toLocaleString()}
                  </Text>
                  <Text style={styles.priceSep}>–</Text>
                  <Text style={[styles.priceVal, { color: C.danger, fontVariant: ['tabular-nums'] as any }]}>
                    {symbol}{item.max.toLocaleString()}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )
      }
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },

  // Market tabs
  tabs:           { flexDirection: 'row', backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  tab:            { flex: 1, alignItems: 'center', paddingVertical: 12, gap: 2 },
  tabActive:      { borderBottomWidth: 2, borderBottomColor: C.accent },
  tabText:        { fontSize: 10, color: C.muted, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  tabTextActive:  { color: C.accent },
  tabName:        { fontSize: 9, color: C.muted, fontWeight: '500' },
  tabNameActive:  { color: C.muted },

  // Search
  searchBox:      { flexDirection: 'row', alignItems: 'center', gap: 10,
                    backgroundColor: C.card, margin: 12, borderRadius: 10,
                    paddingHorizontal: 14, borderWidth: 1, borderColor: C.border },
  input:          { flex: 1, paddingVertical: 12, color: C.text, fontSize: 15 },

  // List
  listContent:    { padding: 12, paddingTop: 4, paddingBottom: 40 },
  empty:          { textAlign: 'center', color: C.muted, marginTop: 40, fontSize: 14 },
  row:            { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card,
                    borderRadius: 10, padding: 14, marginBottom: 8,
                    borderWidth: 1, borderColor: C.border },
  itemName:       { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 2 },
  itemMeta:       { fontSize: 10, color: C.muted },
  priceRange:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceVal:       { fontSize: 12, fontWeight: '700' },
  priceSep:       { color: C.muted, fontSize: 11 },
});
