'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';
import type { HistoryPoint } from '@/lib/api';

export default function Sparkline({
  data,
  color,
  width  = 80,
  height = 28,
}: {
  data:    HistoryPoint[];
  color:   string;
  width?:  number;
  height?: number;
}) {
  if (!data?.length) {
    return <span style={{ color: '#475569', fontSize: 12, fontFamily: 'monospace' }}>—</span>;
  }

  const chartData = data.map(d => ({ v: d.iii }));

  return (
    <ResponsiveContainer width={width} height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
