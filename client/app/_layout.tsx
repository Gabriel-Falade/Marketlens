import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { prefetch } from './lib/cache';

export default function RootLayout() {
  // Silently warm the frontend cache at startup — all screens load instantly on first visit
  useEffect(() => {
    prefetch(['/markets', '/market/lagos', '/market/delhi', '/market/metz', '/intel/global']);
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1e293b' },
        headerTintColor: '#f8fafc',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#0f172a' },
      }}
    >
      <Stack.Screen name="index"       options={{ title: 'MarketLens', headerTitleStyle: { color: '#f59e0b', fontWeight: '900' } }} />
      <Stack.Screen name="map"         options={{ title: 'Price Index Map' }} />
      <Stack.Screen name="market/[id]" options={{ title: 'Market Detail' }} />
      <Stack.Screen name="report"      options={{ title: 'Price Observation' }} />
      <Stack.Screen name="scan"        options={{ title: 'XR Scanner' }} />
      <Stack.Screen name="search"      options={{ title: 'Item Lookup' }} />
      <Stack.Screen name="item/[name]"    options={{ title: 'Item Detail' }} />
      <Stack.Screen name="intelligence"   options={{ title: 'Intelligence', headerTitleStyle: { color: '#f59e0b', fontWeight: '900' } }} />
    </Stack>
  );
}
