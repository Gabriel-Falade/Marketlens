import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import './globals.css';

export const metadata: Metadata = {
  title:       'MarketLens — Pricing Intelligence',
  description: 'Institutional pricing intelligence for informal economies.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: '#0F172A', color: '#F8FAFC' }}>
        <Nav />
        <main
          style={{
            paddingTop:  56,
            maxWidth:    1440,
            margin:      '0 auto',
            padding:     '56px 48px 64px',
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
