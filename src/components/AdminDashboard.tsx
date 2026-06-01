'use client';

import { useEffect, useState } from 'react';
import AdminNav from './AdminNav';
import { cyber, cyberFonts } from '@/lib/cybertheme';

type Metrics = {
  registrations: number; consumed: number; enterLive: number;
  realComments: number; ctaClicks: number; simulatedComments: number;
};

type LiveStatus = 'waiting' | 'live' | 'over' | 'test';

const STATUS_CFG: Record<LiveStatus, { label: string; dot: string; color: string; bg: string }> = {
  waiting: { label: 'Aguardando', dot: '#f59e0b',             color: '#f59e0b',             bg: 'rgba(245,158,11,0.08)'  },
  live:    { label: 'Ao Vivo',    dot: cyber.green,           color: cyber.green,           bg: `rgba(0,255,157,0.06)`   },
  over:    { label: 'Encerrada',  dot: cyber.textDecorative,  color: cyber.textDecorative,  bg: `rgba(58,107,138,0.08)`  },
  test:    { label: 'Teste',      dot: '#a78bfa',             color: '#a78bfa',             bg: 'rgba(167,139,250,0.08)' },
};

const BADGE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  ok:         { bg: cyber.accentOverlay,          color: cyber.green,  border: cyber.accentBorderDim,       label: 'Público'  },
  restricted: { bg: 'rgba(245,158,11,0.07)',       color: '#f59e0b',    border: 'rgba(245,158,11,0.18)',      label: 'Restrito' },
  admin:      { bg: 'rgba(139,92,246,0.07)',       color: '#8b5cf6',    border: 'rgba(139,92,246,0.18)',      label: 'Admin'    },
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
    <div style={{ background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      {/* Corner accent triangle */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderWidth: '0 8px 8px 0', borderStyle: 'solid', borderColor: `transparent ${cyber.accentBorderDim} transparent transparent` }} />
      <div style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 8, background: cyber.accentOverlay, border: `1px solid ${cyber.accentBorderDim}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
        {icon}
      </div>
      <p style={{ fontSize: 10, fontWeight: 700, color: cyber.textLabel, textTransform: 'uppercase' as const, letterSpacing: '.1em', marginBottom: 8, fontFamily: cyberFonts.body }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: cyber.accent, letterSpacing: '-.02em', lineHeight: 1, fontFamily: cyberFonts.display }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: cyber.textDecorative, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function RouteCard({ route }: { route: typeof ROUTES[0] }) {
  const badge = BADGE[route.status];
  return (
    <div style={{ background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: cyber.textPrimary, margin: 0, lineHeight: 1.2, fontFamily: cyberFonts.body }}>{route.label}</p>
            <code style={{ fontSize: 10.5, color: cyber.accent }}>{route.path}</code>
          </div>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, textTransform: 'uppercase' as const, letterSpacing: '.07em', flexShrink: 0 }}>
          {badge.label}
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: cyber.textLabel, lineHeight: 1.5, margin: 0 }}>{route.description}</p>
      {route.note && <p style={{ fontSize: 10.5, color: cyber.textDecorative, fontStyle: 'italic', borderTop: `1px solid ${cyber.accentBorderDim}`, paddingTop: 8, margin: 0 }}>{route.note}</p>}
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


const adminStyles = `
  @keyframes adminSpin { to { transform: rotate(360deg) } }
  .admin-spin { animation: adminSpin 0.8s linear infinite; }
  .admin-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .admin-table th { padding: 9px 14px; text-align: left; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; background: #020810; color: #6a9ab8; border-bottom: 1px solid rgba(0,180,255,0.2); }
  .admin-table td { padding: 9px 14px; border-bottom: 1px solid rgba(0,180,255,0.1); vertical-align: middle; }
  .admin-table tbody tr:last-child td { border-bottom: none; }
`;

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentRegs, setRecentRegs] = useState<any[]>([]);
  const [allEditions, setAllEditions] = useState<any[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/metrics')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        setData(d);
        setRecentRegs(d.recentRegs || []);
        setAllEditions(d.allEditions || []);
      })
      .catch(() => {/* errors: loading stops, data stays null */})
      .finally(() => setLoading(false));
  }, []);

  async function deleteReg(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/registrations?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) setRecentRegs(prev => prev.filter(r => r.id !== id));
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  async function deleteEdition(editionId: string) {
    setDeletingId(editionId);
    try {
      const res = await fetch(`/api/admin/editions?id=${encodeURIComponent(editionId)}`, { method: 'DELETE' });
      if (res.ok) setAllEditions(prev => prev.filter(e => e.editionId !== editionId));
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  if (loading) return (
    <div className="flex flex-col md:flex-row" style={{ minHeight: '100vh', background: cyber.bg }}>
      <style>{adminStyles}</style>
      <AdminNav />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 12 }}>
          <div className="admin-spin" style={{ width: 30, height: 30, border: `3px solid ${cyber.accentBorderDim}`, borderTopColor: cyber.accent, borderRadius: '50%' }} />
          <span style={{ color: cyber.textLabel, fontSize: 13, fontFamily: cyberFonts.body }}>Carregando...</span>
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

  return (
    <div className="flex flex-col md:flex-row" style={{ minHeight: '100vh', background: cyber.bg }}>
      <style>{adminStyles}</style>
      <AdminNav />

      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 40px' }}>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4" style={{ marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: cyber.accent, margin: 0, fontFamily: cyberFonts.display, textShadow: `0 0 20px ${cyber.accentGlow}` }}>Dashboard</h1>
              <p style={{ color: cyber.textLabel, fontSize: 12.5, marginTop: 4, fontFamily: cyberFonts.body }}>
                Edição{' '}
                <code style={{ color: cyber.accent, background: cyber.accentOverlay, padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
                  {data?.currentEdition ?? '—'}
                </code>
                <span style={{ margin: '0 6px', color: cyber.textDecorative }}>·</span>
                <span style={{ color: cyber.textLabel }}>{liveDate}</span>
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: sc.bg, border: `1px solid ${sc.dot}22`, borderRadius: 8, padding: '6px 11px' }}>
                {liveStatus === 'live'
                  ? <span className="pulse-live" style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'block', flexShrink: 0 }} />
                  : <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'block', flexShrink: 0 }} />}
                <span style={{ fontSize: 11, fontWeight: 700, color: sc.color }}>{sc.label}</span>
              </div>
              <a href={data?.currentEdition ? `/api/admin/export?edition=${data.currentEdition}` : '#'}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, color: cyber.textLabel, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                CSV
              </a>
            </div>
          </div>

          {/* Config summary */}
          <div style={{ background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: cyber.textLabel, textTransform: 'uppercase' as const, letterSpacing: '.1em', marginBottom: 12, fontFamily: cyberFonts.body }}>
              Configuração da edição
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 16 }}>
              {[
                { label: 'Vídeo', value: cfg.video_source === 'youtube' ? 'YouTube' : 'Upload', sub: cfg.video_url || '—' },
                { label: 'Duração', value: cfg.video_duration ? `${Math.floor(cfg.video_duration/3600)}h ${Math.floor((cfg.video_duration%3600)/60)}min` : '—', sub: '' },
                { label: 'Chat', value: cfg.chat_enabled ? 'Habilitado' : 'Desabilitado', accent: cfg.chat_enabled ? cyber.green : cyber.textDecorative, sub: cfg.chat_mode === 'isolated' ? 'Isolado' : 'Geral' },
                { label: 'CTA', value: cfg.cta_enabled ? 'Ativo' : 'Inativo', accent: cfg.cta_enabled ? cyber.green : cyber.textDecorative, sub: cfg.cta_url || '—' },
              ].map((item) => (
                <div key={item.label}>
                  <p style={{ fontSize: 9.5, fontWeight: 700, color: cyber.textDecorative, textTransform: 'uppercase' as const, letterSpacing: '.1em', marginBottom: 3, fontFamily: cyberFonts.body }}>{item.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: (item as any).accent || cyber.textPrimary, marginBottom: 1 }}>{item.value}</p>
                  {item.sub && <p style={{ fontSize: 10.5, color: cyber.textDecorative, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.sub}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5" style={{ gap: 10, marginBottom: 24 }}>
            <StatCard label="Cadastros" value={m.registrations||0} accent={cyber.accent}
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}/>
            <StatCard label="Ao vivo" value={m.enterLive||0} sub={`${m.consumed||0} consumidos`} accent="#8b5cf6"
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>}/>
            <StatCard label="Cliques CTA" value={m.ctaClicks||0} sub="conversões" accent="#f59e0b"
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>}/>
            <StatCard label="Comentários" value={m.realComments||0} sub="reais" accent={cyber.green}
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}/>
            <StatCard label="Simulados" value={m.simulatedComments||0} sub="importados" accent={cyber.textDecorative}
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}/>
          </div>

          {/* Páginas da plataforma */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, color: cyber.textLabel, marginBottom: 12, fontFamily: cyberFonts.display, textTransform: 'uppercase' as const, letterSpacing: '3px' }}>Páginas da plataforma</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 10 }}>
              {ROUTES.map(r => <RouteCard key={r.path} route={r} />)}
            </div>
          </div>

          {/* Recent registrations */}
          <div style={{ background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 18px', borderBottom: `1px solid ${cyber.accentBorderDim}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 11, fontWeight: 700, color: cyber.textLabel, margin: 0, fontFamily: cyberFonts.display, textTransform: 'uppercase' as const, letterSpacing: '3px' }}>Registros recentes</h2>
              {recentRegs.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: cyber.accent, background: cyber.accentOverlay, padding: '2px 7px', borderRadius: 20 }}>{recentRegs.length}</span>
              )}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Nome</th><th>E-mail</th><th>IP</th><th>Consumido</th><th>Data</th><th></th></tr></thead>
                <tbody>
                  {recentRegs.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500, color: cyber.textPrimary }}>{r.name}</td>
                      <td><code style={{ fontSize: 11.5, color: cyber.textLabel }}>{r.email}</code></td>
                      <td><code style={{ fontSize: 11.5, color: cyber.textLabel }}>{r.ip}</code></td>
                      <td>{r.consumed
                        ? <span style={{ fontSize: 10.5, fontWeight: 700, color: cyber.green, background: cyber.accentOverlay, padding: '2px 7px', borderRadius: 4 }}>Sim</span>
                        : <span style={{ fontSize: 10.5, color: cyber.textDecorative }}>Não</span>}
                      </td>
                      <td style={{ color: cyber.textLabel, fontSize: 11.5 }}>{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                      <td>
                        {confirmId === r.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 10.5, color: '#ef4444', fontWeight: 600 }}>Apagar?</span>
                            <button
                              onClick={() => deleteReg(r.id)}
                              disabled={deletingId === r.id}
                              aria-label={`Confirmar exclusão de ${r.name}`}
                              style={{ all: 'unset', fontSize: 10.5, fontWeight: 700, color: '#fff', background: '#ef4444', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', opacity: deletingId === r.id ? 0.5 : 1 }}>
                              {deletingId === r.id ? '...' : 'Sim'}
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              aria-label="Cancelar exclusão"
                              style={{ all: 'unset', fontSize: 10.5, fontWeight: 600, color: cyber.textLabel, background: cyber.bg, padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}>
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmId(r.id)}
                            title="Excluir registro"
                            style={{ all: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 5, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer' }}>
                            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
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

          {/* All editions */}
          <div style={{ background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: `1px solid ${cyber.accentBorderDim}` }}>
              <h2 style={{ fontSize: 11, fontWeight: 700, color: cyber.textLabel, margin: 0, fontFamily: cyberFonts.display, textTransform: 'uppercase' as const, letterSpacing: '3px' }}>Histórico perpétuo</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Edição</th><th>Cadastros</th><th>Ao vivo</th><th>Consumidos</th><th>Cliques CTA</th><th>Downloads</th><th></th></tr></thead>
                <tbody>
                  {allEditions.map((e: any) => (
                    <tr key={e.editionId}>
                      <td><code style={{ fontSize: 12, color: cyber.accent }}>{e.editionId}</code></td>
                      <td style={{ color: cyber.textPrimary }}>{e.registrations}</td>
                      <td style={{ color: cyber.textPrimary }}>{e.enterLive}</td>
                      <td style={{ color: cyber.textPrimary }}>{e.consumed}</td>
                      <td style={{ color: cyber.textPrimary }}>{e.ctaClicks}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          {/* Chat export — green status indicator, kept as-is */}
                          <a href={`/api/admin/export-comments?edition=${e.editionId}`}
                            style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5, background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.18)', color: '#34d399', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Chat
                          </a>
                          {/* Data export — blue status indicator, kept as-is */}
                          <a href={`/api/admin/export?edition=${e.editionId}`}
                            style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5, background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.18)', color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Dados
                          </a>
                        </div>
                      </td>
                      <td>
                        {confirmId === e.editionId ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 10.5, color: '#ef4444', fontWeight: 600, whiteSpace: 'nowrap' as const }}>Apagar tudo?</span>
                            <button
                              onClick={() => deleteEdition(e.editionId)}
                              disabled={deletingId === e.editionId}
                              aria-label={`Confirmar exclusão da edição ${e.editionId}`}
                              style={{ all: 'unset', fontSize: 10.5, fontWeight: 700, color: '#fff', background: '#ef4444', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', opacity: deletingId === e.editionId ? 0.5 : 1 }}>
                              {deletingId === e.editionId ? '...' : 'Sim'}
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              aria-label="Cancelar exclusão"
                              style={{ all: 'unset', fontSize: 10.5, fontWeight: 600, color: cyber.textLabel, background: cyber.bg, padding: '2px 8px', borderRadius: 4, cursor: 'pointer' }}>
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmId(e.editionId)}
                            title="Excluir edição completa"
                            style={{ all: 'unset', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 5, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', cursor: 'pointer' }}>
                            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
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
