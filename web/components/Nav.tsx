'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/',          label: 'Overview'  },
  { href: '/analytics', label: 'Analytics' },
  { href: '/export',    label: 'Export'    },
];

export default function Nav() {
  const path = usePathname();

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 h-14 flex items-center px-10"
      style={{ backgroundColor: '#0F172A', borderBottom: '1px solid #334155' }}
    >
      {/* Wordmark */}
      <Link
        href="/"
        className="font-mono text-xl font-black tracking-tight mr-12 shrink-0"
        style={{ color: '#F59E0B' }}
      >
        MarketLens
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {LINKS.map(l => {
          const active = path === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="px-4 py-1.5 rounded text-sm font-semibold transition-colors"
              style={{
                color:           active ? '#F8FAFC' : '#64748B',
                backgroundColor: active ? '#1E293B' : 'transparent',
                borderBottom:    active ? '2px solid #F59E0B' : '2px solid transparent',
              }}
            >
              {l.label}
            </Link>
          );
        })}
      </div>

      {/* Live indicator */}
      <div className="ml-auto flex items-center gap-2.5">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: '#22C55E', boxShadow: '0 0 0 3px #22C55E22' }}
        />
        <span
          className="text-[10px] font-black uppercase tracking-widest"
          style={{ color: '#64748B' }}
        >
          Live
        </span>
      </div>
    </nav>
  );
}
