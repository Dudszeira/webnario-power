import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { cyberEffects } from '@/lib/cybertheme';

export const metadata: Metadata = {
  title: 'Admin — Webnario Power',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={GeistSans.className} style={{ minHeight: '100vh', background: '#020810', position: 'relative' }}>
      {/* Scan lines */}
      <div
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: cyberEffects.scanLines,
        }}
      />
      {/* Grid */}
      <div
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: cyberEffects.grid40,
          backgroundSize: '40px 40px',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}
