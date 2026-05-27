'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';

const NAV = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    href: '/admin/configuracoes',
    label: 'Configurações',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
  {
    href: '/admin/importar',
    label: 'Importar',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
  },
  {
    href: '/admin/comentarios',
    label: 'Moderação',
    icon: (
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/admin/auth-session', { method: 'DELETE' });
    router.push('/admin/login');
  }

  return (
    <>
      {/* ── Desktop sidebar (md+) ───────────────────────────── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0"
        style={{
          width: 220,
          alignSelf: 'flex-start',
          position: 'sticky',
          top: 0,
          height: '100vh',
          background: '#111111',
          borderRight: '1px solid #222222',
          overflowY: 'auto',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #222222' }}>
          <Image src="/logo.webp" alt="Logo" width={100} height={38} className="object-contain" />
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#444444', textTransform: 'uppercase' as const, letterSpacing: '.14em' }}>
              Admin Panel
            </span>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: '#333333', textTransform: 'uppercase' as const, letterSpacing: '.12em', padding: '10px 10px 6px' }}>
            Navegação
          </p>
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 10px', borderRadius: 7,
                  textDecoration: 'none', fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? '#ffffff' : '#555555',
                  background: active ? 'rgba(37,99,235,0.12)' : 'transparent',
                  borderLeft: active ? '2px solid #2563eb' : '2px solid transparent',
                  transition: 'color 0.12s, background 0.12s',
                }}
              >
                <span style={{ color: active ? '#3b82f6' : '#3a3a3a', flexShrink: 0 }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '8px', borderTop: '1px solid #222222' }}>
          <a href="/ao-vivo" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 6, fontSize: 12, color: '#444444', textDecoration: 'none', marginBottom: 1 }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Ver ao vivo
          </a>
          <button onClick={logout}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 6, fontSize: 12, color: '#444444', background: 'none', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' as const }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar (< md) ──────────────────────────── */}
      <div
        className="md:hidden sticky top-0 z-50"
        style={{ background: '#111111', borderBottom: '1px solid #222222', width: '100%' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <Image src="/logo.webp" alt="Logo" width={80} height={30} className="object-contain" />
          <button onClick={logout}
            style={{ fontSize: 11, color: '#555555', background: 'none', border: 'none', cursor: 'pointer' }}>
            Sair
          </button>
        </div>
        <nav style={{ display: 'flex', overflowX: 'auto', gap: 2, padding: '0 12px 10px', scrollbarWidth: 'none' as const }}>
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 6, whiteSpace: 'nowrap' as const,
                  textDecoration: 'none', fontSize: 12, fontWeight: active ? 600 : 400,
                  color: active ? '#ffffff' : '#555555',
                  background: active ? 'rgba(37,99,235,0.15)' : 'transparent',
                  border: active ? '1px solid rgba(37,99,235,0.3)' : '1px solid transparent',
                  flexShrink: 0,
                }}
              >
                <span style={{ color: active ? '#3b82f6' : '#3a3a3a' }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
