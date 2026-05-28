// src/components/AdminNav.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cyber, cyberFonts } from '@/lib/cybertheme';

const NAV = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    href: '/admin/live',
    label: 'Monitor Live',
    icon: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
        <path d="M6.34 6.34a8 8 0 1 0 11.32 11.32A8 8 0 0 0 6.34 6.34"/>
      </svg>
    ),
  },
  {
    href: '/admin/configuracoes',
    label: 'Configurações',
    icon: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
  {
    href: '/admin/importar',
    label: 'Importar',
    icon: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
  },
  {
    href: '/admin/comentarios',
    label: 'Comentários',
    icon: (
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
];

const blinkStyle = `
  @keyframes cyberBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
  }
  .cyber-blink { animation: cyberBlink 1.8s ease-in-out infinite; }
  .nav-link-inactive { color: ${cyber.textDecorative}; transition: color 0.2s; }
  .nav-link-inactive:hover { color: ${cyber.textPrimary}; }
  .nav-link-inactive:hover .nav-icon { color: ${cyber.textPrimary}; }
`;

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/admin/auth-session', { method: 'DELETE' });
    router.push('/admin/login');
  }

  return (
    <>
      <style>{blinkStyle}</style>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0"
        style={{
          width: 220,
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          height: '100vh',
          background: cyber.surfaceNav,
          borderRight: `1px solid ${cyber.accentBorderDim}`,
          overflowY: 'auto',
          fontFamily: cyberFonts.body,
        }}
      >
        {/* Logo + prefix */}
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${cyber.accentBorderDim}` }}>
          <div style={{ fontFamily: cyberFonts.body, fontSize: 9, color: cyber.textDecorative, letterSpacing: 2, marginBottom: 4 }}>
            // SISTEMA
          </div>
          <div style={{ fontFamily: cyberFonts.display, fontSize: 15, fontWeight: 900, color: cyber.accent, letterSpacing: 2, textShadow: `0 0 20px ${cyber.accentGlow}` }}>
            WEBNARIO
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 0' }}>
          <p style={{ fontSize: 9, color: cyber.textLabel, letterSpacing: 4, textTransform: 'uppercase', padding: '0 20px 10px', fontFamily: cyberFonts.body }}>
            Navegação
          </p>
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? undefined : 'nav-link-inactive'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 20px',
                  textDecoration: 'none',
                  fontSize: 12,
                  letterSpacing: 1,
                  fontFamily: cyberFonts.body,
                  ...(active ? { color: cyber.accent } : {}),
                  borderLeft: active ? `2px solid ${cyber.accent}` : '2px solid transparent',
                  background: active ? cyber.accentOverlay : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <span className={active ? undefined : 'nav-icon'} style={{ color: active ? cyber.accent : undefined, flexShrink: 0 }}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${cyber.accentBorderDim}` }}>
          <a
            href="/ao-vivo"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 0', fontSize: 11, color: cyber.textDecorative, textDecoration: 'none', marginBottom: 4, fontFamily: cyberFonts.body }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            Ver ao vivo
          </a>
          <button
            onClick={logout}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 0', fontSize: 11, color: cyber.textDecorative, background: 'none', border: 'none', cursor: 'pointer', width: '100%', fontFamily: cyberFonts.body }}
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sair
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }}>
            <span
              className="cyber-blink"
              style={{ width: 7, height: 7, borderRadius: '50%', background: cyber.green, boxShadow: `0 0 8px ${cyber.green}`, display: 'inline-block', flexShrink: 0 }}
            />
            <span style={{ fontSize: 9, color: cyber.textLabel, letterSpacing: 2, fontFamily: cyberFonts.body }}>ONLINE</span>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div
        className="md:hidden sticky top-0 z-50"
        style={{ background: cyber.surfaceNavMobile, borderBottom: `1px solid ${cyber.accentBorderDim}`, width: '100%' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <div style={{ fontFamily: cyberFonts.display, fontSize: 13, fontWeight: 900, color: cyber.accent, letterSpacing: 2 }}>WEBNARIO</div>
          <button onClick={logout} style={{ fontSize: 11, color: cyber.textDecorative, background: 'none', border: 'none', cursor: 'pointer', fontFamily: cyberFonts.body }}>
            Sair
          </button>
        </div>
        <nav style={{ display: 'flex', overflowX: 'auto', gap: 4, padding: '0 12px 10px', scrollbarWidth: 'none' }}>
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? undefined : 'nav-link-inactive'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', whiteSpace: 'nowrap',
                  textDecoration: 'none', fontSize: 11,
                  fontFamily: cyberFonts.body,
                  ...(active ? { color: cyber.accent } : {}),
                  border: active ? `1px solid ${cyber.accentBorder}` : `1px solid transparent`,
                  borderRadius: 4, flexShrink: 0,
                  background: active ? cyber.accentOverlay : 'transparent',
                }}
              >
                <span className={active ? undefined : 'nav-icon'} style={{ color: active ? cyber.accent : undefined }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
