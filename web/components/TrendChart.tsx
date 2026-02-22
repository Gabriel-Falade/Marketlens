'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { HistoryPoint } from '@/lib/api';

export interface ChartSeries {
  id:    string;
  name:  string;
  color: string;
  data:  HistoryPoint[];
}

function buildChartData(series: ChartSeries[]) {
  const allWeeks = [...new Set(series.flatMap(s => s.data.map(d => d.week)))].sort();
  return allWeeks.map(week => {
    const point: Record<string, string | number> = {
      label: week.split('-')[1] ?? week,
    };
    series.forEach(s => {
      const dp = s.data.find(d => d.week === week);
      if (dp) point[s.id] = dp.iii;
    });
    return point;
  });
}

function CustomTooltip({ active, payload, label }: {
  active?:  boolean;
  payload?: { dataKey: string; name: string; value: number; color: string }[];
  label?:   string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      backgroundColor: '#1E293B',
      border:          '1px solid #334155',
      borderRadius:    8,
      padding:         '10px 14px',
      fontSize:        12,
      minWidth:        140,
    }}>
      <p style={{ color: '#64748B', marginBottom: 6, fontWeight: 700, letterSpacing: '0.05em' }}>
        {label}
      </p>
      {payload.map(p => (
        <div
          key={p.dataKey}
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
        >
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: p.color, display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{ color: '#CBD5E1', flex: 1 }}>{p.name}</span>
          <span style={{
            color: '#F8FAFC', fontFamily: 'monospace', fontWeight: 700, paddingLeft: 12,
          }}>
            {p.value != null ? `${Number(p.value).toFixed(1)}%` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function TrendChart({
  series,
  height      = 280,
  showLegend  = false,
}: {
  series:      ChartSeries[];
  height?:     number;
  showLegend?: boolean;
}) {
  const data = buildChartData(series);

  if (!data.length) return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#64748B', fontSize: 13 }}>No historical data available</p>
    </div>
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 24, bottom: 4, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E2D3F" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={v => `${v}%`}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        {showLegend && (
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#64748B', paddingTop: 12 }}
          />
        )}
        {series.map(s => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: s.color }}
            name={s.name}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
