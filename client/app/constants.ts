// ── API Base URL ─────────────────────────────────────────────────────────────
// iOS Simulator  → http://localhost:5000
// Android Emulator → http://10.0.2.2:5000
// Physical device  → http://<YOUR_MACHINE_IP>:5000
export const API_BASE = 'https://tasty-places-clean.loca.lt';

// Required to bypass localtunnel's browser warning page
export const TUNNEL_HEADERS: Record<string, string> = {
  'bypass-tunnel-reminder': '1',
  'Content-Type': 'application/json',
};

// ── Color palette ─────────────────────────────────────────────────────────────
export const C = {
  bg:       '#0f172a',
  card:     '#1e293b',
  accent:   '#f59e0b',
  fair:     '#22c55e',
  danger:   '#ef4444',
  text:     '#f8fafc',
  muted:    '#94a3b8',
  border:   '#334155',
  // Signal-semantic aliases
  stable:   '#22c55e',
  watch:    '#f59e0b',
  alert:    '#ef4444',
  textDim:  '#64748b',
};

// ── Markets ───────────────────────────────────────────────────────────────────
export const MARKETS = [
  { id: 'lagos', name: 'Balogun Market',   city: 'Lagos, Nigeria', symbol: '₦', flag: '🇳🇬' },
  { id: 'delhi', name: 'Chandni Chowk',    city: 'Delhi, India',   symbol: '₹', flag: '🇮🇳' },
  { id: 'metz',  name: 'Marché de Metz',   city: 'Metz, France',   symbol: '€', flag: '🇫🇷' },
];

// ── Items per market (mirrored from backend MARKET_ITEMS) ─────────────────────
export const MARKET_ITEMS: Record<string, string[]> = {
  lagos: [
    'Imported Rice (50kg bag)',
    'Beef (1kg)',
    'Titus Fish (frozen, 1kg)',
    'Fresh Tomatoes (Basket)',
    'Eggs (crate of 30)',
    'Suya (100g skewer)',
    'Jollof Rice (plate)',
    'Ankara Fabric (6 yards)',
  ],
  delhi: [
    'Basmati Rice (1kg)',
    'Chicken (1kg)',
    'Eggs (dozen)',
    'Dal/Lentils (1kg)',
    'Paneer (200g)',
    'Chole Bhature (plate)',
    'Masala Chai (cup)',
    'Hand-painted Scarf',
  ],
  metz: [
    'Whole Chicken',
    'Mirabelle Jam',
    'Eggs (dozen)',
    'Rice (1kg)',
    'Quiche Lorraine (slice)',
    'Baguette',
    'GT Hoodie',
    'Wool Scarf',
  ],
};
