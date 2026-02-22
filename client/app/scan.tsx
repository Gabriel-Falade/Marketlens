import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { API_BASE, C, MARKETS, TUNNEL_HEADERS } from './constants';

type ScanResult = {
  identified_item: string;
  market_name:     string;
  currency:        string;
  symbol:          string;
  price_range:     { min: number; max: number; mean: number };
};

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [marketId, setMarketId] = useState('lagos');
  const [scanning, setScanning] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permContainer}>
        <Ionicons name="camera-outline" size={48} color={C.muted} />
        <Text style={styles.permMsg}>Camera access required to scan items</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleScan = async () => {
    if (scanning || !cameraRef.current) return;
    setScanning(true);
    setError(null);
    try {
      const photo = await (cameraRef.current as any).takePictureAsync({
        base64: true, quality: 0.5, skipProcessing: true,
      });
      const res  = await fetch(`${API_BASE}/identify`, {
        method: 'POST',
        headers: TUNNEL_HEADERS,
        body: JSON.stringify({ image_base64: photo.base64, market_id: marketId }),
      });
      const data: ScanResult = await res.json();
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
      <CameraView style={styles.camera} ref={cameraRef} facing="back">

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

        {/* ── Scan target ── */}
        <View style={styles.overlay}>
          <View style={styles.scanTarget}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.hint}>Position item within frame</Text>
        </View>

        {/* ── Error ── */}
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <Text style={styles.errorDismiss}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Scan button ── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.scanBtn, scanning && styles.scanBtnDisabled]}
            onPress={handleScan}
            disabled={scanning}
            activeOpacity={0.8}
          >
            {scanning
              ? <ActivityIndicator color="#0f172a" />
              : <Text style={styles.scanBtnText}>IDENTIFY ITEM</Text>
            }
          </TouchableOpacity>
        </View>

      </CameraView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const CORNER_SIZE = 22;

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#000' },
  camera:          { flex: 1 },

  // Permission screen
  permContainer:   { flex: 1, justifyContent: 'center', alignItems: 'center',
                     backgroundColor: C.bg, gap: 16, padding: 32 },
  permMsg:         { color: C.muted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  permBtn:         { backgroundColor: C.accent, borderRadius: 10, padding: 14, paddingHorizontal: 28, marginTop: 8 },
  permBtnText:     { color: '#0f172a', fontWeight: '800', fontSize: 15 },

  // Top bar
  topBar:          { position: 'absolute', top: 0, left: 0, right: 0,
                     flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
                     backgroundColor: 'rgba(15,23,42,0.80)' },
  topBarLabel:     { fontSize: 10, fontWeight: '800', color: C.muted, letterSpacing: 2 },
  marketChips:     { flexDirection: 'row', gap: 8 },
  chip:            { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                     backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  chipActive:      { backgroundColor: C.accent + 'dd', borderColor: C.accent },
  chipText:        { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  chipTextActive:  { color: '#0f172a' },

  // Scan target
  overlay:         { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18 },
  scanTarget:      { width: 220, height: 220, position: 'relative' },
  hint:            { color: 'rgba(255,255,255,0.55)', fontSize: 12, letterSpacing: 0.5 },
  corner:          { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE,
                     borderColor: C.accent, borderWidth: 2.5 },
  tl:              { top: 0, left: 0,  borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  tr:              { top: 0, right: 0, borderLeftWidth: 0,  borderBottomWidth: 0, borderTopRightRadius: 4 },
  bl:              { bottom: 0, left: 0,  borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  br:              { bottom: 0, right: 0, borderLeftWidth: 0,  borderTopWidth: 0, borderBottomRightRadius: 4 },

  // Error
  errorCard:       { position: 'absolute', bottom: 110, left: 16, right: 16,
                     backgroundColor: C.danger + '20', borderRadius: 10, padding: 14,
                     borderWidth: 1, borderColor: C.danger + '40',
                     flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  errorText:       { color: C.danger, fontSize: 13, flex: 1 },
  errorDismiss:    { color: C.danger, fontWeight: '700', fontSize: 13, paddingLeft: 12 },

  // Bottom bar
  bottomBar:       { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' },
  scanBtn:         { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 44, paddingVertical: 16,
                     shadowColor: C.accent, shadowOffset: { width: 0, height: 4 },
                     shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  scanBtnDisabled: { backgroundColor: C.muted },
  scanBtnText:     { color: '#0f172a', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
});
