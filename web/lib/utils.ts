export type Status = 'STABLE' | 'WATCH' | 'ALERT' | 'NO DATA';

export function getStatus(iii: number | null | undefined): Status {
  if (iii == null) return 'NO DATA';
  if (iii >= 25)   return 'ALERT';
  if (iii >= 10)   return 'WATCH';
  return 'STABLE';
}

export function getSignalColor(iii: number | null | undefined): string {
  const s = getStatus(iii);
  if (s === 'ALERT')  return '#EF4444';
  if (s === 'WATCH')  return '#F59E0B';
  if (s === 'STABLE') return '#22C55E';
  return '#475569';
}

export function statusColor(s: Status): string {
  if (s === 'ALERT')  return '#EF4444';
  if (s === 'WATCH')  return '#F59E0B';
  if (s === 'STABLE') return '#22C55E';
  return '#475569';
}

export function fmtPct(n: number | null | undefined, dec = 1): string {
  if (n == null) return '—';
  return `${n.toFixed(dec)}%`;
}

export function fmtNum(n: number | null | undefined, dec = 2): string {
  if (n == null) return '—';
  return n.toFixed(dec);
}

export function fmtK(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function fmtWeek(week: string): string {
  return week.split('-')[1] ?? week;
}
