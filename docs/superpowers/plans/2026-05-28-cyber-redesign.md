# Cyber Redesign — Admin Panel & Página de Espera — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar identidade visual cyberpunk (paleta #020810/cyan #00B4FF/verde #00ff9d, fontes Orbitron + Exo 2) ao painel admin completo e à página de espera, sem remover conteúdo ou alterar lógica de negócio.

**Architecture:** Abordagem B + tokens centralizados. Criar `src/lib/cybertheme.ts` com todos os tokens de cor e fontes. Cada componente importa os tokens e aplica via `style={{}}` inline. Nenhuma alteração em `tailwind.config.ts` ou `globals.css` — zero risco de afetar `/ao-vivo`.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS (mantido para layout/flex/grid), Google Fonts (Orbitron, Exo 2)

---

## Arquivos modificados / criados

| Arquivo | Ação |
|---|---|
| `src/lib/cybertheme.ts` | Criar — tokens de cor e fontes |
| `src/app/layout.tsx` | Modificar — adicionar Google Fonts `<link>` |
| `src/app/admin/layout.tsx` | Modificar — wrapper com fundo cyberpunk (scan lines + grid) |
| `src/components/AdminNav.tsx` | Modificar — sidebar cyberpunk completa |
| `src/components/AdminLogin.tsx` | Modificar — tela de login cyberpunk |
| `src/components/AdminDashboard.tsx` | Modificar — dashboard com paleta cyber |
| `src/components/AdminConfig.tsx` | Modificar — inputs/labels cyber |
| `src/components/AdminComments.tsx` | Modificar — tabela/cards cyber |
| `src/components/AdminImport.tsx` | Modificar — upload area cyber |
| `src/components/AdminLiveMonitor.tsx` | Modificar — métricas live cyber |
| `src/components/Countdown.tsx` | Modificar — blocos de countdown cyber |
| `src/components/RegisterModal.tsx` | Modificar — modal de cadastro cyber |
| `src/components/EsperaContent.tsx` | Modificar — página de espera completa cyber |

---

## Task 1: Criar arquivo de tokens centralizados

**Files:**
- Create: `src/lib/cybertheme.ts`

- [ ] **Step 1: Criar o arquivo de tokens**

```typescript
// src/lib/cybertheme.ts
export const cyber = {
  bg:               '#020810',
  surface:          '#040d1a',
  surfaceHover:     '#071428',
  accent:           '#00B4FF',
  accentDim:        '#0077aa',
  accentBorder:     'rgba(0,180,255,0.4)',
  accentBorderDim:  'rgba(0,180,255,0.2)',
  accentGlow:       'rgba(0,180,255,0.25)',
  accentGlowInset:  'rgba(0,180,255,0.05)',
  accentOverlay:    'rgba(0,180,255,0.06)',
  green:            '#00ff9d',
  greenGlow:        'rgba(0,255,157,0.4)',
  textPrimary:      '#c8e4f4',
  textSupport:      '#8cb8d4',
  textLabel:        '#6a9ab8',
  textDecorative:   '#3a6b8a',
  white:            '#ffffff',
} as const;

export const cyberFonts = {
  display: "'Orbitron', sans-serif",
  body:    "'Exo 2', sans-serif",
} as const;

export const cyberEffects = {
  scanLines: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.07) 0px, rgba(0,0,0,0.07) 1px, transparent 1px, transparent 3px)',
  grid40:    'linear-gradient(rgba(0,180,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,255,0.04) 1px, transparent 1px)',
  grid50:    'linear-gradient(rgba(0,180,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,255,0.03) 1px, transparent 1px)',
  radialGlow:'radial-gradient(ellipse 70% 40% at 50% 20%, rgba(0,180,255,0.07) 0%, transparent 70%)',
  cornerAccent: (color = 'rgba(0,180,255,0.3)') =>
    `linear-gradient(to bottom left, ${color} 0%, ${color} 50%, transparent 50%)`,
} as const;

export const cyberCard = {
  base: {
    border:        '1px solid rgba(0,180,255,0.2)',
    borderRadius:  4,
    background:    '#040d1a',
    position:      'relative' as const,
    overflow:      'hidden' as const,
    transition:    'all 0.2s ease',
  },
  hover: {
    border:        '1px solid #00B4FF',
    background:    '#071428',
    boxShadow:     '0 0 20px rgba(0,180,255,0.25), inset 0 0 20px rgba(0,180,255,0.05)',
    transform:     'translateY(-2px)',
  },
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cybertheme.ts
git commit -m "feat: add cybertheme tokens and design constants"
```

---

## Task 2: Adicionar Google Fonts ao layout raiz

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Adicionar o `<link>` do Google Fonts no `<head>`**

Substituir o arquivo inteiro por:

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_EVENT_NAME || 'Imersão Online',
  description: 'Imersão ao vivo exclusiva',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;600;700&family=Orbitron:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Verificar que as fontes carregam**

Rodar `npm run dev` e abrir `http://localhost:3000`. Inspecionar no devtools: Network → Fonts. Confirmar que `Orbitron` e `Exo+2` aparecem na lista de recursos carregados.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: load Orbitron and Exo 2 fonts from Google Fonts"
```

---

## Task 3: Admin layout — wrapper com fundo cyberpunk

**Files:**
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Substituir o layout admin pelo wrapper com efeitos de fundo**

```typescript
// src/app/admin/layout.tsx
import type { Metadata } from 'next';
import { cyberEffects } from '@/lib/cybertheme';

export const metadata: Metadata = {
  title: 'Admin — Webnario Power',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#020810', position: 'relative' }}>
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
```

- [ ] **Step 2: Confirmar visualmente**

Abrir `http://localhost:3000/admin`. O fundo deve ser `#020810` escuro com linhas de scan e grid sutil em cyan. O conteúdo anterior ainda renderiza normalmente acima do fundo.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat: add cyberpunk scan lines and grid background to admin layout"
```

---

## Task 4: AdminNav — sidebar cyberpunk

**Files:**
- Modify: `src/components/AdminNav.tsx`

- [ ] **Step 1: Reescrever o componente mantendo toda lógica e links existentes**

```typescript
// src/components/AdminNav.tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
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
    label: 'Moderação',
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
          background: 'rgba(4,13,26,0.9)',
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
          <p style={{ fontSize: 9, color: cyber.textDecorative, letterSpacing: 4, textTransform: 'uppercase', padding: '0 20px 10px', fontFamily: cyberFonts.body }}>
            Navegação
          </p>
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 20px',
                  textDecoration: 'none',
                  fontSize: 12,
                  letterSpacing: 1,
                  fontFamily: cyberFonts.body,
                  color: active ? cyber.accent : cyber.textDecorative,
                  borderLeft: active ? `2px solid ${cyber.accent}` : '2px solid transparent',
                  background: active ? cyber.accentOverlay : 'transparent',
                  transition: 'all 0.2s',
                }}
              >
                <span style={{ color: active ? cyber.accent : cyber.textDecorative, flexShrink: 0 }}>
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
        style={{ background: 'rgba(4,13,26,0.95)', borderBottom: `1px solid ${cyber.accentBorderDim}`, width: '100%' }}
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
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', whiteSpace: 'nowrap',
                  textDecoration: 'none', fontSize: 11,
                  fontFamily: cyberFonts.body,
                  color: active ? cyber.accent : cyber.textDecorative,
                  border: active ? `1px solid ${cyber.accentBorder}` : `1px solid transparent`,
                  borderRadius: 4, flexShrink: 0,
                  background: active ? cyber.accentOverlay : 'transparent',
                }}
              >
                <span style={{ color: active ? cyber.accent : cyber.textDecorative }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verificar sidebar no browser**

Abrir `http://localhost:3000/admin`. Confirmar: sidebar escura com borda cyan, logo "WEBNARIO" em Orbitron cyan, links em Exo 2, item ativo com `border-left` cyan, dot verde piscando no rodapé.

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminNav.tsx
git commit -m "feat: restyle AdminNav with cyberpunk sidebar design"
```

---

## Task 5: AdminLogin — tela de login cyberpunk

**Files:**
- Modify: `src/components/AdminLogin.tsx`

- [ ] **Step 1: Substituir o visual mantendo toda lógica (handleSubmit, estados)**

```typescript
// src/components/AdminLogin.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cyber, cyberFonts } from '@/lib/cybertheme';

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/admin/auth-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push('/admin');
    } else {
      setError('Senha incorreta.');
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: cyberFonts.body }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        {/* Logo + prefix */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Image src="/logo.webp" alt="Logo" width={140} height={52} className="mx-auto object-contain" style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 9, color: cyber.textDecorative, letterSpacing: 4, fontFamily: cyberFonts.body, marginBottom: 4 }}>// ACESSO RESTRITO</div>
          <div style={{ fontFamily: cyberFonts.display, fontSize: 16, fontWeight: 900, color: cyber.accent, letterSpacing: 3, textShadow: `0 0 20px ${cyber.accentGlow}` }}>
            PAINEL ADMIN
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: cyber.surface,
          border: `1px solid ${cyber.accentBorder}`,
          borderRadius: 8,
          padding: 32,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: `0 0 40px ${cyber.accentGlow}`,
        }}>
          {/* Corner accent */}
          <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderWidth: '0 20px 20px 0', borderStyle: 'solid', borderColor: `transparent ${cyber.accentBorder} transparent transparent` }} />

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: cyber.textLabel, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6, fontFamily: cyberFonts.body }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', background: cyber.bg,
                  border: `1px solid ${cyber.accentBorderDim}`,
                  borderRadius: 4, padding: '10px 14px',
                  color: cyber.textPrimary, fontSize: 14,
                  fontFamily: cyberFonts.body, outline: 'none',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = cyber.accent; e.currentTarget.style.boxShadow = `0 0 12px ${cyber.accentGlow}`; }}
                onBlur={e => { e.currentTarget.style.borderColor = cyber.accentBorderDim; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>

            {error && (
              <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', fontFamily: cyberFonts.body }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: `linear-gradient(135deg, ${cyber.accent}, ${cyber.accentDim})`,
                border: 'none', borderRadius: 4, padding: '12px',
                color: '#000', fontFamily: cyberFonts.display,
                fontWeight: 700, fontSize: 12, letterSpacing: 2,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: `0 0 20px ${cyber.accentGlow}`,
                textTransform: 'uppercase',
              }}
            >
              {loading ? 'Verificando...' : 'Entrar ›'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar no browser**

Abrir `http://localhost:3000/admin/login`. Confirmar: fundo escuro, card com borda cyan, corner accent, input com focus cyan, botão gradiente.

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminLogin.tsx
git commit -m "feat: restyle AdminLogin with cyberpunk design"
```

---

## Task 6: AdminDashboard — dashboard com paleta cyber

**Files:**
- Modify: `src/components/AdminDashboard.tsx`

- [ ] **Step 1: Atualizar os helper components StatCard, RouteCard, TestModePanel e o layout principal**

As mudanças são cirúrgicas — apenas valores de cor/fonte são alterados. Toda a lógica (fetch, deleteReg, deleteEdition, TestModePanel) fica intacta.

Substituir o arquivo inteiro:

```typescript
// src/components/AdminDashboard.tsx
'use client';

import { useEffect, useState } from 'react';
import AdminNav from './AdminNav';
import { cyber, cyberFonts } from '@/lib/cybertheme';

type Metrics = {
  registrations: number; consumed: number; enterLive: number;
  realComments: number; ctaClicks: number; simulatedComments: number;
};

type LiveStatus = 'waiting' | 'live' | 'over';

const STATUS_CFG: Record<LiveStatus, { label: string; dot: string; color: string; bg: string }> = {
  waiting: { label: 'Aguardando', dot: '#f59e0b', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  live:    { label: 'Ao Vivo',    dot: cyber.green, color: cyber.green, bg: 'rgba(0,255,157,0.08)' },
  over:    { label: 'Encerrada',  dot: cyber.textDecorative, color: cyber.textLabel, bg: 'rgba(58,107,138,0.08)' },
};

const BADGE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  ok:         { bg: cyber.accentOverlay,              color: cyber.accent,    border: cyber.accentBorderDim, label: 'Público'  },
  restricted: { bg: 'rgba(245,158,11,0.07)',          color: '#f59e0b',       border: 'rgba(245,158,11,0.18)', label: 'Restrito' },
  admin:      { bg: 'rgba(139,92,246,0.07)',          color: '#8b5cf6',       border: 'rgba(139,92,246,0.18)', label: 'Admin'    },
};

const ROUTES = [
  { path:'/espera',              label:'Sala de Espera',   icon:'⏳', status:'ok'         as const, description:'Cadastro, countdown e redirect automático.', note:'Acessível a qualquer hora.' },
  { path:'/ao-vivo',             label:'Sala Ao Vivo',     icon:'🎥', status:'restricted' as const, description:'Player + chat ao vivo + contador simulado.',  note:'Acessível só na terça 20h.' },
  { path:'/bloqueado',           label:'Acesso Bloqueado', icon:'🔒', status:'ok'         as const, description:'IP ou e-mail já usados nesta edição.',          note:'Aceita ?sales=URL.' },
  { path:'/',                    label:'Raiz (/)',          icon:'↩️', status:'ok'         as const, description:'Redireciona para /espera.',                     note:'Também: /imersao → /espera.' },
  { path:'/admin',               label:'Dashboard',        icon:'📊', status:'admin'      as const, description:'Métricas, registros e exportação CSV.',         note:'Exige cookie admin_session.' },
  { path:'/admin/configuracoes', label:'Configurações',    icon:'⚙️', status:'admin'      as const, description:'Vídeo, CTA, chat e viewer count.',             note:'Mudanças imediatas.' },
  { path:'/admin/importar',      label:'Importar Roteiro', icon:'📋', status:'admin'      as const, description:'Upload .xlsx/.csv com comentários simulados.',  note:'Template disponível.' },
  { path:'/admin/comentarios',   label:'Moderação',        icon:'💬', status:'admin'      as const, description:'Comentários reais, ocultar, fixar e staff.',    note:'Só comentários reais.' },
];

function StatCard({ label, value, sub, accent, icon }: { label: string; value: number | string; sub?: string; accent: string; icon: React.ReactNode }) {
  return (
    <div style={{
      background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`,
      borderRadius: 6, padding: '16px 18px', position: 'relative', overflow: 'hidden',
      fontFamily: cyberFonts.body,
    }}>
      {/* Corner accent */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderWidth: '0 10px 10px 0', borderStyle: 'solid', borderColor: `transparent ${cyber.accentBorderDim} transparent transparent` }} />
      <div style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 4, background: `${accent}15`, border: `1px solid ${accent}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
        {icon}
      </div>
      <p style={{ fontSize: 9, color: cyber.textDecorative, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>{label}</p>
      <p style={{ fontFamily: cyberFonts.display, fontSize: 24, fontWeight: 700, color: cyber.accent, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: cyber.textLabel, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function RouteCard({ route }: { route: typeof ROUTES[0] }) {
  const badge = BADGE[route.status];
  return (
    <div style={{
      background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`,
      borderRadius: 6, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8,
      fontFamily: cyberFonts.body, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderWidth: '0 8px 8px 0', borderStyle: 'solid', borderColor: `transparent ${cyber.accentBorderDim} transparent transparent` }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15 }}>{route.icon}</span>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: cyber.textPrimary, margin: 0, lineHeight: 1.2 }}>{route.label}</p>
            <code style={{ fontSize: 10, color: cyber.accent }}>{route.path}</code>
          </div>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, textTransform: 'uppercase', letterSpacing: 1, flexShrink: 0 }}>
          {badge.label}
        </span>
      </div>
      <p style={{ fontSize: 11, color: cyber.textSupport, lineHeight: 1.5, margin: 0 }}>{route.description}</p>
      {route.note && <p style={{ fontSize: 10, color: cyber.textLabel, fontStyle: 'italic', borderTop: `1px solid ${cyber.accentBorderDim}`, paddingTop: 8, margin: 0 }}>{route.note}</p>}
      <a href={route.path} target="_blank" rel="noopener noreferrer"
        style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: cyber.accent, fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
        Abrir
        <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}>
          <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
        </svg>
      </a>
    </div>
  );
}

function TestModePanel({ currentEdition }: { currentEdition?: string }) {
  const [testMode, setTestMode] = useState(false);
  const [testTime, setTestTime] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/config').then(r => r.json()).then(d => {
      if (d.edition) {
        setTestMode(!!d.edition.test_mode);
        if (d.edition.test_time) {
          try {
            const dt = new Date(d.edition.test_time);
            const offset = dt.getTimezoneOffset() * 60000;
            setTestTime(new Date(dt.getTime() - offset).toISOString().slice(0, 16));
          } catch {}
        }
      }
    });
  }, []);

  async function save() {
    setSaving(true);
    await fetch('/api/admin/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test_mode: testMode, test_time: (testMode && testTime) ? new Date(testTime).toISOString() : null }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const borderColor = testMode ? 'rgba(236,72,153,0.3)' : cyber.accentBorderDim;

  return (
    <div style={{ background: cyber.surface, border: `1px solid ${borderColor}`, borderRadius: 6, padding: '14px 18px', marginBottom: 16, fontFamily: cyberFonts.body }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: testMode ? '#ec4899' : cyber.textDecorative, flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: cyber.textPrimary, margin: 0 }}>Modo Teste</p>
            <p style={{ fontSize: 10, color: cyber.textLabel, margin: 0 }}>Simula um horário fictício para testar a plataforma</p>
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setTestMode(v => !v)}>
          <div style={{ width: 36, height: 20, borderRadius: 10, background: testMode ? '#ec4899' : cyber.surface, border: `1px solid ${testMode ? '#db2777' : cyber.accentBorderDim}`, position: 'relative', transition: 'all .18s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, left: testMode ? 17 : 3, width: 12, height: 12, borderRadius: '50%', background: cyber.white, transition: 'left .18s' }} />
          </div>
          <span style={{ fontSize: 11, color: testMode ? '#ec4899' : cyber.textLabel, fontWeight: 600 }}>{testMode ? 'Ativo' : 'Inativo'}</span>
        </label>
      </div>
      {testMode && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: cyber.textLabel, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 5 }}>
              Início da live simulada
            </label>
            <input
              type="datetime-local"
              value={testTime}
              onChange={e => setTestTime(e.target.value)}
              style={{ width: '100%', background: cyber.bg, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 4, padding: '7px 10px', color: cyber.textPrimary, fontSize: 13, outline: 'none', fontFamily: cyberFonts.body }}
            />
          </div>
          <button
            onClick={save}
            disabled={saving}
            style={{ padding: '8px 16px', borderRadius: 4, background: saved ? '#065f46' : '#ec4899', border: 'none', color: '#fff', fontFamily: cyberFonts.display, fontWeight: 700, fontSize: 11, cursor: saving ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: saving ? 0.6 : 1 }}>
            {saved ? '✓ Salvo' : saving ? '...' : 'Salvar'}
          </button>
        </div>
      )}
      {!testMode && saved && <p style={{ fontSize: 11, color: cyber.green, marginTop: 8 }}>Modo teste desativado.</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentRegs, setRecentRegs] = useState<any[]>([]);
  const [allEditions, setAllEditions] = useState<any[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/metrics').then(r => r.json()).then(d => {
      setData(d);
      setRecentRegs(d.recentRegs || []);
      setAllEditions(d.allEditions || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function deleteReg(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/admin/registrations?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setRecentRegs(prev => prev.filter(r => r.id !== id));
    } finally { setDeletingId(null); setConfirmId(null); }
  }

  async function deleteEdition(editionId: string) {
    setDeletingId(editionId);
    try {
      await fetch(`/api/admin/editions?id=${encodeURIComponent(editionId)}`, { method: 'DELETE' });
      setAllEditions(prev => prev.filter(e => e.editionId !== editionId));
    } finally { setDeletingId(null); setConfirmId(null); }
  }

  if (loading) return (
    <div className="flex flex-col md:flex-row" style={{ minHeight: '100vh' }}>
      <AdminNav />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="admin-spin" style={{ width: 30, height: 30, border: `3px solid ${cyber.accentBorderDim}`, borderTopColor: cyber.accent, borderRadius: '50%' }} />
          <span style={{ color: cyber.textLabel, fontSize: 12, fontFamily: cyberFonts.body }}>Carregando...</span>
        </div>
      </main>
    </div>
  );

  const m: Metrics = data?.currentMetrics || {};
  const liveStatus: LiveStatus = data?.liveStatus || 'waiting';
  const sc = STATUS_CFG[liveStatus];
  const cfg = data?.editionConfig || {};
  const liveDate = data?.liveStartMs
    ? new Date(data.liveStartMs).toLocaleString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

  const sectionLabel = (text: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <h2 style={{ fontSize: 9, fontWeight: 700, color: cyber.textDecorative, letterSpacing: 4, textTransform: 'uppercase', fontFamily: cyberFonts.body, margin: 0 }}>{text}</h2>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${cyber.accentBorderDim}, transparent)` }} />
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row" style={{ minHeight: '100vh', fontFamily: cyberFonts.body }}>
      <AdminNav />
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px 48px' }}>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4" style={{ paddingBottom: 20, borderBottom: `1px solid ${cyber.accentBorderDim}`, marginBottom: 24 }}>
            <div>
              <h1 style={{ fontFamily: cyberFonts.display, fontSize: 20, fontWeight: 900, color: cyber.accent, margin: 0, letterSpacing: 3, textShadow: `0 0 20px ${cyber.accentGlow}` }}>DASHBOARD</h1>
              <p style={{ color: cyber.textLabel, fontSize: 11, marginTop: 4, letterSpacing: 2 }}>
                // Edição{' '}
                <code style={{ color: cyber.accent }}>{data?.currentEdition}</code>
                {' · '}
                <span style={{ color: cyber.textDecorative }}>{liveDate}</span>
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: sc.bg, border: `1px solid ${sc.dot}33`, borderRadius: 4, padding: '5px 10px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'block', flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: sc.color, letterSpacing: 1, fontFamily: cyberFonts.body }}>{sc.label}</span>
              </div>
              <a href={`/api/admin/export?edition=${data?.currentEdition}`}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, color: cyber.textLabel, padding: '5px 12px', borderRadius: 4, fontSize: 11, textDecoration: 'none', fontFamily: cyberFonts.body }}>
                <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                CSV
              </a>
            </div>
          </div>

          {/* Config summary */}
          <div style={{ background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 6, padding: '14px 18px', marginBottom: 16 }}>
            <p style={{ fontSize: 9, color: cyber.textDecorative, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 12 }}>Configuração da edição</p>
            <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 16 }}>
              {[
                { label: 'Vídeo',    value: cfg.video_source === 'youtube' ? 'YouTube' : 'Upload', sub: cfg.video_url || '—' },
                { label: 'Duração',  value: cfg.video_duration ? `${Math.floor(cfg.video_duration/3600)}h ${Math.floor((cfg.video_duration%3600)/60)}min` : '—', sub: '' },
                { label: 'Chat',     value: cfg.chat_enabled ? 'Habilitado' : 'Desabilitado', accent: cfg.chat_enabled ? cyber.green : cyber.textDecorative, sub: cfg.chat_mode === 'isolated' ? 'Isolado' : 'Geral' },
                { label: 'CTA',      value: cfg.cta_enabled ? 'Ativo' : 'Inativo', accent: cfg.cta_enabled ? cyber.green : cyber.textDecorative, sub: cfg.cta_url || '—' },
              ].map((item) => (
                <div key={item.label}>
                  <p style={{ fontSize: 9, color: cyber.textDecorative, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 3 }}>{item.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: (item as any).accent || cyber.textPrimary, marginBottom: 1 }}>{item.value}</p>
                  {item.sub && <p style={{ fontSize: 10, color: cyber.textLabel, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</p>}
                </div>
              ))}
            </div>
          </div>

          <TestModePanel currentEdition={data?.currentEdition} />

          {/* Stats */}
          {sectionLabel('MÉTRICAS')}
          <div className="grid grid-cols-2 lg:grid-cols-5" style={{ gap: 10, marginBottom: 24 }}>
            <StatCard label="Cadastros"   value={m.registrations||0}      accent={cyber.accent}
              icon={<svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}/>
            <StatCard label="Ao vivo"     value={m.enterLive||0}          sub={`${m.consumed||0} consumidos`} accent="#8b5cf6"
              icon={<svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>}/>
            <StatCard label="Cliques CTA" value={m.ctaClicks||0}          sub="conversões"   accent="#f59e0b"
              icon={<svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>}/>
            <StatCard label="Comentários" value={m.realComments||0}       sub="reais"        accent={cyber.green}
              icon={<svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}/>
            <StatCard label="Simulados"   value={m.simulatedComments||0}  sub="importados"   accent={cyber.textLabel}
              icon={<svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}/>
          </div>

          {/* Rotas */}
          <div style={{ marginBottom: 24 }}>
            {sectionLabel('PÁGINAS DA PLATAFORMA')}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 10 }}>
              {ROUTES.map((r) => <RouteCard key={r.path} route={r} />)}
            </div>
          </div>

          {/* Registros recentes */}
          {sectionLabel('REGISTROS RECENTES')}
          <div style={{ background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Nome</th><th>E-mail</th><th>IP</th><th>Consumido</th><th>Data</th><th></th></tr></thead>
                <tbody>
                  {recentRegs.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500, color: cyber.textPrimary }}>{r.name}</td>
                      <td><code style={{ fontSize: 11, color: cyber.textLabel }}>{r.email}</code></td>
                      <td><code style={{ fontSize: 11, color: cyber.textLabel }}>{r.ip}</code></td>
                      <td>{r.consumed
                        ? <span style={{ fontSize: 10, fontWeight: 700, color: cyber.green, background: 'rgba(0,255,157,0.08)', padding: '2px 7px', borderRadius: 3 }}>Sim</span>
                        : <span style={{ fontSize: 10, color: cyber.textDecorative }}>Não</span>}
                      </td>
                      <td style={{ color: cyber.textLabel, fontSize: 11 }}>{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                      <td>
                        {confirmId === r.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Apagar?</span>
                            <button onClick={() => deleteReg(r.id)} disabled={deletingId === r.id}
                              style={{ all: 'unset', fontSize: 10, fontWeight: 700, color: '#fff', background: '#ef4444', padding: '2px 8px', borderRadius: 3, cursor: 'pointer', opacity: deletingId === r.id ? 0.5 : 1 }}>
                              {deletingId === r.id ? '...' : 'Sim'}
                            </button>
                            <button onClick={() => setConfirmId(null)}
                              style={{ all: 'unset', fontSize: 10, fontWeight: 600, color: cyber.textLabel, background: cyber.bg, padding: '2px 8px', borderRadius: 3, cursor: 'pointer' }}>
                              Não
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmId(r.id)} title="Excluir"
                            style={{ all: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 4, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer' }}>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!recentRegs.length && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: cyber.textDecorative, padding: '24px 0', fontStyle: 'italic', fontSize: 12 }}>Nenhum registro ainda</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Histórico */}
          {sectionLabel('HISTÓRICO PERPÉTUO')}
          <div style={{ background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Edição</th><th>Cadastros</th><th>Ao vivo</th><th>Consumidos</th><th>Cliques CTA</th><th>Downloads</th><th></th></tr></thead>
                <tbody>
                  {allEditions.map((e: any) => (
                    <tr key={e.editionId}>
                      <td><code style={{ fontSize: 11, color: cyber.accent }}>{e.editionId}</code></td>
                      <td style={{ color: cyber.textPrimary }}>{e.registrations}</td>
                      <td style={{ color: cyber.textPrimary }}>{e.enterLive}</td>
                      <td style={{ color: cyber.textPrimary }}>{e.consumed}</td>
                      <td style={{ color: cyber.textPrimary }}>{e.ctaClicks}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <a href={`/api/admin/export-comments?edition=${e.editionId}`}
                            style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 3, background: 'rgba(0,255,157,0.07)', border: `1px solid ${cyber.greenGlow}`, color: cyber.green, textDecoration: 'none' }}>Chat</a>
                          <a href={`/api/admin/export?edition=${e.editionId}`}
                            style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 3, background: cyber.accentOverlay, border: `1px solid ${cyber.accentBorderDim}`, color: cyber.accent, textDecoration: 'none' }}>Dados</a>
                        </div>
                      </td>
                      <td>
                        {confirmId === e.editionId ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap' }}>Apagar tudo?</span>
                            <button onClick={() => deleteEdition(e.editionId)} disabled={deletingId === e.editionId}
                              style={{ all: 'unset', fontSize: 10, fontWeight: 700, color: '#fff', background: '#ef4444', padding: '2px 8px', borderRadius: 3, cursor: 'pointer', opacity: deletingId === e.editionId ? 0.5 : 1 }}>
                              {deletingId === e.editionId ? '...' : 'Sim'}
                            </button>
                            <button onClick={() => setConfirmId(null)}
                              style={{ all: 'unset', fontSize: 10, fontWeight: 600, color: cyber.textLabel, background: cyber.bg, padding: '2px 8px', borderRadius: 3, cursor: 'pointer' }}>
                              Não
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmId(e.editionId)} title="Excluir edição"
                            style={{ all: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 4, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer' }}>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!allEditions.length && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: cyber.textDecorative, padding: '24px 0', fontStyle: 'italic', fontSize: 12 }}>Sem histórico</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verificar no browser**

Abrir `http://localhost:3000/admin`. Confirmar: métricas em Orbitron cyan, tabelas com borda cyan, badges verdes, section labels com linha gradiente, todas as funcionalidades (CSV, delete, test mode) funcionando.

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminDashboard.tsx
git commit -m "feat: restyle AdminDashboard with cyberpunk design"
```

---

## Task 7: Admin secondary pages — Config, Comments, Import, LiveMonitor

**Files:**
- Modify: `src/components/AdminConfig.tsx`
- Modify: `src/components/AdminComments.tsx`
- Modify: `src/components/AdminImport.tsx`
- Modify: `src/components/AdminLiveMonitor.tsx`

Cada um desses componentes recebe o mesmo tratamento: importar `cyber` e `cyberFonts`, substituir cores hard-coded pelos tokens, manter toda lógica intacta.

- [ ] **Step 1: Padrão de estilo compartilhado para os 4 componentes**

Cada componente deve:
1. Adicionar `import { cyber, cyberFonts } from '@/lib/cybertheme';` no topo
2. Substituir `background: '#0a0a0a'` ou similares por `cyber.bg`
3. Substituir `background: '#161616'` por `cyber.surface`
4. Substituir `border: '1px solid #222222'` por `border: \`1px solid ${cyber.accentBorderDim}\``
5. Substituir `color: '#e0e0e0'` por `cyber.textPrimary`
6. Substituir `color: '#555555'` por `cyber.textLabel`
7. Substituir `color: '#333333'` por `cyber.textDecorative`
8. Substituir `color: '#3b82f6'` (azul) por `cyber.accent`
9. Substituir `color: '#10b981'` (verde antigo) por `cyber.green`
10. Substituir `background: '#2563eb'` (botão azul) por `\`linear-gradient(135deg, ${cyber.accent}, ${cyber.accentDim})\``
11. Adicionar `fontFamily: cyberFonts.body` nos wrappers principais
12. Adicionar `fontFamily: cyberFonts.display` nos títulos de página `<h1>`

Títulos de página: mudar para Orbitron uppercase com `cyber.accent` e text-shadow glow, seguindo o mesmo padrão de `AdminDashboard`.

Inputs e selects: aplicar `background: cyber.bg`, `border: \`1px solid ${cyber.accentBorderDim}\``, `color: cyber.textPrimary`, com `onFocus`/`onBlur` para alternar para `cyber.accent`.

- [ ] **Step 2: Aplicar em AdminConfig.tsx**

Abrir `src/components/AdminConfig.tsx` e aplicar o padrão de estilo do Step 1. Verificar `http://localhost:3000/admin/configuracoes` — fundo escuro, inputs cyber, botão gradiente.

- [ ] **Step 3: Aplicar em AdminComments.tsx**

Abrir `src/components/AdminComments.tsx` e aplicar o padrão. Verificar `http://localhost:3000/admin/comentarios` — tabela de comentários com borda cyan, badges verdes.

- [ ] **Step 4: Aplicar em AdminImport.tsx**

Abrir `src/components/AdminImport.tsx` e aplicar o padrão. Verificar `http://localhost:3000/admin/importar` — área de upload cyber.

- [ ] **Step 5: Aplicar em AdminLiveMonitor.tsx**

Abrir `src/components/AdminLiveMonitor.tsx` e aplicar o padrão. Verificar `http://localhost:3000/admin/live` — métricas em Orbitron, dots verdes.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminConfig.tsx src/components/AdminComments.tsx src/components/AdminImport.tsx src/components/AdminLiveMonitor.tsx
git commit -m "feat: apply cyberpunk styles to admin secondary pages"
```

---

## Task 8: Countdown — blocos de countdown com visual cyber

**Files:**
- Modify: `src/components/Countdown.tsx`

- [ ] **Step 1: Substituir apenas o JSX de renderização, mantendo toda lógica de cálculo**

```typescript
// src/components/Countdown.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { cyber, cyberFonts } from '@/lib/cybertheme';

type Props = {
  targetMs: number;
  onReached?: () => void;
};

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, '0');
}

export default function Countdown({ targetMs, onReached }: Props) {
  const calc = useCallback(() => {
    const diff = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
    return {
      days:    Math.floor(diff / 86400),
      hours:   Math.floor((diff % 86400) / 3600),
      minutes: Math.floor((diff % 3600) / 60),
      seconds: diff % 60,
      done:    diff === 0,
    };
  }, [targetMs]);

  const [time, setTime] = useState(calc);

  useEffect(() => {
    const t = setInterval(() => {
      const next = calc();
      setTime(next);
      if (next.done) { clearInterval(t); onReached?.(); }
    }, 1000);
    return () => clearInterval(t);
  }, [calc, onReached]);

  const units = [
    { label: 'Dias', value: pad(time.days)    },
    { label: 'Hrs',  value: pad(time.hours)   },
    { label: 'Min',  value: pad(time.minutes) },
    { label: 'Seg',  value: pad(time.seconds) },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
      {units.map((u, i) => (
        <div key={u.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            border: `1px solid ${cyber.accentBorderDim}`,
            borderRadius: 8,
            padding: '14px 20px',
            background: 'rgba(0,180,255,0.05)',
            minWidth: 72,
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Corner accent */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderWidth: '0 8px 8px 0', borderStyle: 'solid', borderColor: `transparent ${cyber.accentBorderDim} transparent transparent` }} />
            <span style={{
              display: 'block',
              fontFamily: cyberFonts.display,
              fontSize: 32,
              fontWeight: 700,
              color: cyber.accent,
              lineHeight: 1,
              textShadow: `0 0 16px ${cyber.accentGlow}`,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {u.value}
            </span>
            <span style={{
              display: 'block',
              fontFamily: cyberFonts.body,
              fontSize: 9,
              color: cyber.textLabel,
              letterSpacing: 3,
              marginTop: 5,
              textTransform: 'uppercase',
            }}>
              {u.label}
            </span>
          </div>
          {i < units.length - 1 && (
            <span style={{
              fontFamily: cyberFonts.display,
              fontSize: 24,
              color: `${cyber.accentBorderDim}`,
              paddingBottom: 8,
            }}>:</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificar no browser**

Abrir `http://localhost:3000/espera`. O countdown deve mostrar `DD : HH : MM : SS` com os números em Orbitron cyan e os separadores em cyan dimmed.

- [ ] **Step 3: Commit**

```bash
git add src/components/Countdown.tsx
git commit -m "feat: restyle Countdown blocks with cyberpunk design"
```

---

## Task 9: RegisterModal — modal de cadastro com visual cyber

**Files:**
- Modify: `src/components/RegisterModal.tsx`

- [ ] **Step 1: Substituir o visual mantendo handleSubmit, estados e campos (name + email) intactos**

```typescript
// src/components/RegisterModal.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cyber, cyberFonts } from '@/lib/cybertheme';

type Props = {
  onSuccess: () => void;
  onBlocked: (salesUrl: string) => void;
};

export default function RegisterModal({ onSuccess, onBlocked }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !email.trim()) { setError('Preencha todos os campos.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (res.status === 409) { onBlocked(data.sales_page_url || ''); return; }
      if (!res.ok) { setError(data.error || 'Erro. Tente novamente.'); return; }
      onSuccess();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      background: 'rgba(2,8,16,0.88)',
      backdropFilter: 'blur(6px)',
      fontFamily: cyberFonts.body,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: cyber.surface,
        border: `1px solid ${cyber.accentBorder}`,
        borderRadius: 10,
        padding: 32,
        position: 'relative',
        boxShadow: `0 0 60px ${cyber.accentGlow}`,
      }}>
        {/* Corner accent */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderWidth: '0 16px 16px 0', borderStyle: 'solid', borderColor: `transparent ${cyber.accentBorder} transparent transparent` }} />

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Image src="/logo.webp" alt="Logo" width={150} height={56} className="object-contain" />
        </div>

        {/* Heading */}
        <h2 style={{ fontFamily: cyberFonts.display, fontSize: 17, fontWeight: 700, color: cyber.white, textAlign: 'center', marginBottom: 16, letterSpacing: 1, lineHeight: 1.3 }}>
          Você está a um passo!
        </h2>
        <p style={{ fontSize: 14, color: cyber.textSupport, textAlign: 'center', marginBottom: 28, lineHeight: 1.65 }}>
          Você está a um passo de descobrir os 3 pilares para faturar mais de{' '}
          <strong style={{ color: cyber.white, fontWeight: 700 }}>10 mil reais por mês!</strong>{' '}
          Para acessar a imersão, adicione seus dados abaixo:
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, color: cyber.textLabel, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>
              Primeiro Nome
            </label>
            <input
              type="text"
              placeholder="Seu primeiro nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              required
              style={{ width: '100%', background: cyber.bg, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 4, padding: '11px 14px', color: cyber.textPrimary, fontSize: 14, fontFamily: cyberFonts.body, outline: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = cyber.accent; e.currentTarget.style.boxShadow = `0 0 12px ${cyber.accentGlowInset}`; }}
              onBlur={e => { e.currentTarget.style.borderColor = cyber.accentBorderDim; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 10, color: cyber.textLabel, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6, fontWeight: 600 }}>
              Seu E-mail
            </label>
            <input
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              style={{ width: '100%', background: cyber.bg, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 4, padding: '11px 14px', color: cyber.textPrimary, fontSize: 14, fontFamily: cyberFonts.body, outline: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = cyber.accent; e.currentTarget.style.boxShadow = `0 0 12px ${cyber.accentGlowInset}`; }}
              onBlur={e => { e.currentTarget.style.borderColor = cyber.accentBorderDim; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: `linear-gradient(135deg, ${cyber.accent}, ${cyber.accentDim})`,
              border: 'none', borderRadius: 4, padding: '14px',
              color: '#000', fontFamily: cyberFonts.display, fontWeight: 700,
              fontSize: 12, letterSpacing: 2, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: `0 0 20px ${cyber.accentGlow}`,
              textTransform: 'uppercase', marginTop: 4,
            }}
          >
            {loading ? 'Aguarde...' : 'Quero Entrar na Imersão ›'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar modal no browser**

Abrir `http://localhost:3000/espera` sem sessão ativa (ou limpar cookies). O modal deve aparecer automaticamente com: fundo blur escuro, card com borda cyan, corner accent, logo, campos com focus cyan, botão gradiente. Preencher e submeter — verificar que o cadastro funciona e redireciona.

- [ ] **Step 3: Commit**

```bash
git add src/components/RegisterModal.tsx
git commit -m "feat: restyle RegisterModal with cyberpunk design"
```

---

## Task 10: EsperaContent — página de espera completa

**Files:**
- Modify: `src/components/EsperaContent.tsx`

- [ ] **Step 1: Substituir o visual mantendo toda lógica e conteúdo**

Todo o fluxo (handleRegistered, handleBlocked, handleCountdownReached, redirect automático, showLiveOver, showSuccess) fica inalterado. Apenas os estilos mudam.

```typescript
// src/components/EsperaContent.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Countdown from './Countdown';
import RegisterModal from './RegisterModal';
import { cyber, cyberFonts, cyberEffects } from '@/lib/cybertheme';

type Props = {
  editionId: string;
  session: { name: string; email: string } | null;
  liveStartMs: number;
  liveOver: boolean;
  salesUrl: string;
  registered: boolean;
};

const BULLETS = [
  'O erro que fez meu pai quebrar o negócio de fotografia dele e o que fizemos depois para faturar R$ 1 milhão em um ano.',
  'Os 3 pilares de um negócio de fotografia que fatura mais de R$ 10 mil por mês.',
  'Jeito certo vs. jeito errado de fazer marketing — Com exemplos reais de fotógrafos que acertaram e erraram na prática.',
  'Análise ao vivo dos 3 pilares do SEU negócio — Descubra qual dos 3 pilares está travando o seu crescimento e o que fazer para resolver ainda hoje.',
];

const blinkKeyframes = `
  @keyframes cyberBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.2; }
  }
  .cyber-blink { animation: cyberBlink 1.8s ease-in-out infinite; }
`;

export default function EsperaContent({ session, liveStartMs, liveOver, salesUrl, registered }: Props) {
  const router = useRouter();
  const [showRegister, setShowRegister] = useState(!registered && !liveOver);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLiveOver, setShowLiveOver] = useState(liveOver);
  const [isRegistered, setIsRegistered] = useState(registered);

  function handleRegistered() {
    setShowRegister(false);
    setShowSuccess(true);
    setIsRegistered(true);
    setTimeout(() => setShowSuccess(false), 3500);
  }

  function handleBlocked(url: string) {
    if (url) window.location.href = url;
    else router.push('/bloqueado');
  }

  const handleCountdownReached = useCallback(() => {
    if (isRegistered) router.push('/ao-vivo');
  }, [isRegistered, router]);

  useEffect(() => {
    if (!isRegistered) return;
    const t = setInterval(() => {
      if (Date.now() >= liveStartMs) router.push('/ao-vivo');
    }, 5000);
    return () => clearInterval(t);
  }, [isRegistered, liveStartMs, router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: cyber.bg,
        fontFamily: cyberFonts.body,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <style>{blinkKeyframes}</style>

      {/* Subtle grid background */}
      <div style={{ position: 'fixed', inset: 0, background: cyberEffects.grid50, backgroundSize: '50px 50px', pointerEvents: 'none', zIndex: 0 }} />
      {/* Radial glow */}
      <div style={{ position: 'fixed', inset: 0, background: cyberEffects.radialGlow, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 620, padding: '0 16px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Logo */}
        <div style={{ padding: '28px 0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <Image src="/logo.webp" alt="Negócio de Fotografia 10K" width={200} height={74} className="object-contain" priority />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, letterSpacing: 3, color: cyber.textLabel, textTransform: 'uppercase' }}>
            <span className="cyber-blink" style={{ width: 6, height: 6, borderRadius: '50%', background: cyber.green, boxShadow: `0 0 8px ${cyber.green}`, display: 'inline-block', flexShrink: 0 }} />
            Evento ao Vivo
          </div>
        </div>

        {/* Countdown */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 28px' }}>
          <p style={{ fontSize: 10, letterSpacing: 4, color: cyber.textLabel, textTransform: 'uppercase', marginBottom: 16 }}>O evento começa em</p>
          <Countdown targetMs={liveStartMs} onReached={handleCountdownReached} />
        </div>

        {/* Content card */}
        <div style={{
          width: '100%',
          border: `1px solid ${cyber.accentBorderDim}`,
          borderRadius: 10,
          padding: '28px',
          background: 'rgba(4,13,26,0.7)',
          backdropFilter: 'blur(4px)',
          marginBottom: 20,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderWidth: '0 14px 14px 0', borderStyle: 'solid', borderColor: `transparent ${cyber.accentBorderDim} transparent transparent` }} />
          <h2 style={{ fontFamily: cyberFonts.display, fontSize: 13, fontWeight: 700, color: cyber.accent, letterSpacing: 1, textAlign: 'center', marginBottom: 20, lineHeight: 1.4 }}>
            Enquanto você aguarda, veja o que vai descobrir hoje:
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {BULLETS.map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ color: cyber.accent, fontSize: 14, flexShrink: 0, marginTop: 2, lineHeight: 1.5 }}>›</span>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: cyber.textPrimary }}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Redirect notice */}
        <div style={{
          width: '100%',
          textAlign: 'center',
          padding: '16px 20px',
          marginBottom: 20,
          border: `1px solid ${cyber.accentBorderDim}`,
          borderRadius: 8,
          background: 'rgba(0,180,255,0.03)',
        }}>
          <p style={{ fontSize: 13, color: cyber.textSupport, lineHeight: 1.7 }}>
            Quando chegar às 20h,{' '}
            <strong style={{ color: '#d8eef8', fontWeight: 600 }}>
              você será redirecionado automaticamente para a Imersão ao vivo.
            </strong>{' '}
            Não precisa fazer nada, é só aguardar!
          </p>
        </div>

        {/* Footer */}
        <p style={{ fontSize: 11, color: cyber.textLabel, letterSpacing: 1, textAlign: 'center', marginTop: 'auto' }}>
          Robison Kunz © {new Date().getFullYear()} · Todos os direitos reservados
        </p>
      </div>

      {/* Register Modal */}
      {showRegister && !liveOver && (
        <RegisterModal onSuccess={handleRegistered} onBlocked={handleBlocked} />
      )}

      {/* Success overlay */}
      {showSuccess && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2,8,16,0.92)', backdropFilter: 'blur(6px)' }}>
          <div style={{
            background: cyber.surface,
            border: `1px solid ${cyber.accentBorder}`,
            borderRadius: 10,
            padding: 40,
            textAlign: 'center',
            maxWidth: 360,
            width: '100%',
            margin: '0 16px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: `0 0 60px ${cyber.accentGlow}`,
          }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderWidth: '0 16px 16px 0', borderStyle: 'solid', borderColor: `transparent ${cyber.accentBorder} transparent transparent` }} />
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: `2px solid ${cyber.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: `0 0 20px ${cyber.accentGlow}` }}>
              <svg className="w-8 h-8" style={{ color: cyber.accent, width: 28, height: 28 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 style={{ fontFamily: cyberFonts.display, fontSize: 18, fontWeight: 700, color: cyber.white, marginBottom: 8, letterSpacing: 1 }}>Cadastro realizado!</h2>
            <p style={{ color: cyber.textSupport, fontSize: 13 }}>Redirecionando para o webinário em instantes...</p>
          </div>
        </div>
      )}

      {/* Live Over Modal */}
      {showLiveOver && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(2,8,16,0.92)', backdropFilter: 'blur(6px)' }}>
          <div style={{
            background: cyber.surface,
            border: `1px solid ${cyber.accentBorder}`,
            borderRadius: 10,
            padding: 32,
            textAlign: 'center',
            maxWidth: 440,
            width: '100%',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderWidth: '0 16px 16px 0', borderStyle: 'solid', borderColor: `transparent ${cyber.accentBorder} transparent transparent` }} />
            <div style={{ fontSize: 40, marginBottom: 16 }}>📺</div>
            <h2 style={{ fontFamily: cyberFonts.display, fontSize: 18, fontWeight: 700, color: cyber.white, marginBottom: 12, letterSpacing: 1 }}>
              A transmissão ao vivo encerrou
            </h2>
            <p style={{ fontSize: 13, color: cyber.textSupport, lineHeight: 1.6, marginBottom: 24 }}>
              Você perdeu a transmissão ao vivo desta edição. Fique atento aos nossos
              canais — e-mail e grupo — onde avisaremos sobre o replay e as próximas edições.
            </p>
            {salesUrl && (
              <a
                href={salesUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', width: '100%', fontFamily: cyberFonts.display, fontWeight: 700, padding: '12px', borderRadius: 4, background: `linear-gradient(135deg, ${cyber.accent}, ${cyber.accentDim})`, color: '#000', fontSize: 12, letterSpacing: 2, textDecoration: 'none', textTransform: 'uppercase', boxShadow: `0 0 20px ${cyber.accentGlow}`, marginBottom: 8 }}
              >
                Acessar canais oficiais ›
              </a>
            )}
            <button
              onClick={() => setShowLiveOver(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: cyber.textLabel, fontFamily: cyberFonts.body, marginTop: 4 }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar página de espera completa**

Abrir `http://localhost:3000/espera`. Verificar:
- Fundo escuro com grid sutil e glow radial
- Logo no topo com badge "Evento ao Vivo" + dot verde piscando
- Countdown com blocos cyber (Dias/Hrs/Min/Seg)
- Card de bullets com conteúdo original intacto
- Aviso de redirecionamento com texto legível
- Modal de cadastro aparece automaticamente (se não cadastrado)
- Após cadastro, success overlay aparece e some em 3.5s

- [ ] **Step 3: Commit**

```bash
git add src/components/EsperaContent.tsx
git commit -m "feat: restyle EsperaContent with cyberpunk design, preserve all content and logic"
```

---

## Task 11: Revisão final e smoke test

- [ ] **Step 1: Smoke test admin**

Acessar cada rota do admin em sequência:
- `/admin/login` — card de login cyber
- `/admin` — dashboard com métricas Orbitron, tabelas, test mode
- `/admin/configuracoes` — formulário de configurações
- `/admin/importar` — área de upload
- `/admin/comentarios` — lista de comentários
- `/admin/live` — monitor live

Confirmar que em todas as páginas: fundo `#020810`, scan lines, sidebar lateral, nenhum texto ilegível por baixo contraste.

- [ ] **Step 2: Smoke test espera**

Acessar `/espera`:
- Countdown funcionando
- Modal de cadastro abre e funciona (preencher e submeter)
- Success overlay aparece após cadastro
- Após 3.5s some e a página aparece com o conteúdo original
- Nenhum `{' '}` ou artefato JSX visível no texto

- [ ] **Step 3: Confirmar que `/ao-vivo` não foi afetado**

Acessar `/ao-vivo` (ou inspecionar o código). Confirmar que nenhum componente da rota ao-vivo foi modificado.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "chore: cyber redesign complete — admin panel and waiting page"
```
