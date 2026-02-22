import { API_BASE, TUNNEL_HEADERS } from '../constants';

const _store: Record<string, { data: any; ts: number }> = {};
const TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Fetch with a 5-minute in-memory cache. Same URL = instant second call. */
export async function cachedFetch(path: string): Promise<any> {
  const now = Date.now();
  if (_store[path] && now - _store[path].ts < TTL_MS) {
    return _store[path].data;
  }
  const r = await fetch(`${API_BASE}${path}`, { headers: TUNNEL_HEADERS });
  const data = await r.json();
  _store[path] = { data, ts: now };
  return data;
}

/** Fire-and-forget prefetch — warms the cache silently in the background. */
export function prefetch(paths: string[]) {
  paths.forEach(p => cachedFetch(p).catch(() => {}));
}
