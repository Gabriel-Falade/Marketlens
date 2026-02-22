const BASE = process.env.NEXT_PUBLIC_FLASK_URL ?? 'http://localhost:5000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

// ── Shared types ──────────────────────────────────────────────────────────────

export interface HistoryPoint {
  week:       string;
  iii:        number;
  volatility: number;
}

export interface MarketIntel {
  market_id?:            string;
  city?:                 string;
  name?:                 string;
  iii:                   number | null;
  volatility:            number | null;
  pta:                   number | null;
  rid:                   number | null;
  shock_score:           number | null;
  shock_label:           string;
  confidence:            number | null;
  report_count:          number;
  official_inflation_pct:number | null;
  history:               HistoryPoint[];
}

export interface GlobalIntel {
  markets:      MarketIntel[];
  global: {
    iii:          number | null;
    volatility:   number | null;
    confidence:   number | null;
    report_count: number;
  };
  generated_at: string;
}

export interface MarketItem {
  name:        string;
  mean:        number;
  std:         number;
  min:         number;
  max:         number;
  raw_mean:    number;
  sample_size: number;
}

export interface MarketDetail {
  id:             string;
  name:           string;
  city:           string;
  symbol:         string;
  currency:       string;
  gouging_pct:    number;
  gouging_rate:   number;
  color:          string;
  market_summary: string;
  has_disaster:   boolean;
  disasters:      string[];
  items:          MarketItem[];
}

export interface MarketSummary {
  id:            string;
  name:          string;
  city:          string;
  symbol:        string;
  lat:           number;
  lng:           number;
  gouging_pct:   number;
  gouging_rate:  number;
  color:         string;
  has_disaster:  boolean;
  disaster_count:number;
}

// ── API client ────────────────────────────────────────────────────────────────

export const api = {
  markets:     ()         => get<MarketSummary[]>('/markets'),
  market:      (id:string)=> get<MarketDetail>(`/market/${id}`),
  globalIntel: ()         => get<GlobalIntel>('/intel/global'),
  marketIntel: (id:string)=> get<MarketIntel>(`/intel/${id}`),
  export:      ()         => get<unknown>('/intel/export'),
};
