import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_BASE, C, MARKETS, TUNNEL_HEADERS } from './constants';

export default function ScanScreen() {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [marketId, setMarketId] = useState('lagos');
  const [scanning, setScanning] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res  = await fetch(`${API_BASE}/identify`, {
        method: 'POST',
        headers: TUNNEL_HEADERS,
        body: JSON.stringify({ image_base64: base64, market_id: marketId }),
      });
      const data = await res.json();
      router.push({
        pathname: '/item/[name]',
        params: { name: data.identified_item, market_id: marketId, symbol: data.symbol, fromScan: 'true' },
      });
    } catch (e: any) {
      setError(e.message ?? 'Scan failed — try again');
    } finally {
      setScanning(false);
    }
  };

  return (
    <View style={styles.container}>

      {/* ── Market selector ── */}
      <View style={styles.topBar}>
        <Text style={styles.topBarLabel}>INDEX</Text>
        <View style={styles.marketChips}>
          {MARKETS.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[styles.chip, marketId === m.id && styles.chipActive]}
              onPress={() => { setMarketId(m.id); setError(null); }}
            >
              <Text style={[styles.chipText, marketId === m.id && styles.chipTextActive]}>
                {m.city.split(',')[1]?.trim() ?? m.id.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Upload area ── */}
      <View style={styles.uploadArea}>
        <View style={styles.uploadBox}>
          <Ionicons name="image-outline" size={48} color={C.muted} />
          <Text style={styles.uploadTitle}>Upload Item Photo</Text>
          <Text style={styles.uploadSub}>Camera scanner is available on the mobile app</Text>

          {/* Hidden file input */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <Text style={styles.errorDismiss}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.uploadBtn, scanning && styles.uploadBtnDisabled]}
            onPress={() => inputRef.current?.click()}
            disabled={scanning}
            activeOpacity={0.8}
          >
            {scanning
              ? <ActivityIndicator color="#0f172a" />
              : (
                <View style={styles.uploadBtnInner}>
                  <Ionicons name="cloud-upload-outline" size={18} color="#0f172a" />
                  <Text style={styles.uploadBtnText}>SELECT IMAGE</Text>
                </View>
              )
            }
          </TouchableOpacity>
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: C.bg },

  // Top bar
  topBar:           { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
                      backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  topBarLabel:      { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 2 },
  marketChips:      { flexDirection: 'row', gap: 8 },
  chip:             { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                      backgroundColor: C.border + '44', borderWidth: 1, borderColor: C.border },
  chipActive:       { backgroundColor: C.accent + 'dd', borderColor: C.accent },
  chipText:         { fontSize: 11, fontWeight: '700', color: C.text, letterSpacing: 0.3 },
  chipTextActive:   { color: '#0f172a' },

  // Upload
  uploadArea:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  uploadBox:        { alignItems: 'center', gap: 12, backgroundColor: C.card,
                      borderRadius: 16, padding: 40, borderWidth: 1,
                      borderColor: C.border, maxWidth: 400, width: '100%' },
  uploadTitle:      { fontSize: 18, fontWeight: '800', color: C.text, marginTop: 8 },
  uploadSub:        { fontSize: 12, color: C.muted, textAlign: 'center', lineHeight: 18 },

  errorCard:        { backgroundColor: C.danger + '20', borderRadius: 8, padding: 12,
                      borderWidth: 1, borderColor: C.danger + '40',
                      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, width: '100%' },
  errorText:        { color: C.danger, fontSize: 13, flex: 1 },
  errorDismiss:     { color: C.danger, fontWeight: '700', fontSize: 13 },

  uploadBtn:        { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  uploadBtnDisabled:{ backgroundColor: C.muted },
  uploadBtnInner:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uploadBtnText:    { color: '#0f172a', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
});
