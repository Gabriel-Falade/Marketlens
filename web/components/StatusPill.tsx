import type { Status } from '@/lib/utils';

const STYLES: Record<Status, { bg: string; border: string; text: string }> = {
  STABLE:    { bg: '#22C55E18', border: '#22C55E50', text: '#22C55E' },
  WATCH:     { bg: '#F59E0B18', border: '#F59E0B50', text: '#F59E0B' },
  ALERT:     { bg: '#EF444418', border: '#EF444450', text: '#EF4444' },
  'NO DATA': { bg: '#47556918', border: '#47556950', text: '#475569' },
};

export default function StatusPill({
  status,
  size = 'sm',
}: {
  status: Status;
  size?:  'xs' | 'sm' | 'md';
}) {
  const c  = STYLES[status] ?? STYLES['NO DATA'];
  const px = size === 'xs' ? '6px' : size === 'md' ? '10px' : '8px';
  const py = size === 'xs' ? '1px' : size === 'md' ? '4px'  : '2px';
  const fs = size === 'xs' ? 8     : size === 'md' ? 10     : 9;

  return (
    <span
      style={{
        display:       'inline-block',
        fontSize:      fs,
        fontWeight:    800,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        paddingLeft:   px,
        paddingRight:  px,
        paddingTop:    py,
        paddingBottom: py,
        borderRadius:  4,
        border:        `1px solid ${c.border}`,
        backgroundColor: c.bg,
        color:         c.text,
        lineHeight:    1.4,
      }}
    >
      {status}
    </span>
  );
}
