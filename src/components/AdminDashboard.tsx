'use client';

import { useEffect, useState } from 'react';
import AdminNav from './AdminNav';

type Metrics = {
  registrations: number; consumed: number; enterLive: number;
  realComments: number; ctaClicks: number; simulatedComments: number;
};

type LiveStatus = 'waiting' | 'live' | 'over';

const STATUS_CFG: Record<LiveStatus, { label: string; dot: string; color: string; bg: string }> = {
  waiting: { label: 'Aguardando', dot: '#f59e0b', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  live:    { label: 'Ao Vivo',    dot: '#ef4444', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  over:    { label: 'Encerrada',  dot: '#555555', color: '#777777', bg: 'rgba(85,85,85,0.08)'  },
};

const BADGE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  ok:         { bg: 'rgba(16,185,129,0.07)',  color: '#10b981', border: 'rgba(16,185,129,0.18)', label: 'Público' },
  restricted: { bg: 'rgba(245,158,11,0.07)',  color: '#f59e0b', border: 'rgba(245,158,11,0.18)', label: 'Restrito' },
  admin:      { bg: 'rgba(139,92,246,0.07)',  color: '#8b5cf6', border: 'rgba(139,92,246,0.18)', label: 'Admin' },
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
    <div style={{ background: '#161616', border: '1px solid #222222', borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 8, background: `${accent}12`, border: `1px solid ${accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
        {icon}
      </div>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#555555', textTransform: 'uppercase' as const, letterSpacing: '.1em', marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: '#f0f0f0', letterSpacing: '-.02em', lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#444444', marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function RouteCard({ route }: { route: typeof ROUTES[0] }) {
  const badge = BADGE[route.status];
  return (
    <div style={{ background: '#161616', border: '1px solid #222222', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{route.icon}</span>
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: '#e0e0e0', margin: 0, lineHeight: 1.2 }}>{route.label}</p>
            <code style={{ fontSize: 10.5, color: '#3b82f6' }}>{route.path}</code>
          </div>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, textTransform: 'uppercase' as const, letterSpacing: '.07em', flexShrink: 0 }}>
          {badge.label}
        </span>
      </div>
      <p style={{ fontSize: 11.5, color: '#555555', lineHeight: 1.5, margin: 0 }}>{route.description}</p>
      {route.note && <p style={{ fontSize: 10.5, color: '#333333', fontStyle: 'italic', borderTop: '1px solid #1e1e1e', paddingTop: 8, margin: 0 }}>{route.note}</p>}
      <a href={route.path} target="_blank" rel="noopener noreferrer"
        style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: '#2563eb', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
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
      body: JSON.stringify({
        test_mode: testMode,
        test_time: (testMode && testTime) ? new Date(testTime).toISOString() : null,
      }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const accent = testMode ? '#ec4899' : '#444444';

  return (
    <div style={{ background: '#161616', border: `1px solid ${testMode ? '#ec489930' : '#222222'}`, borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' as const }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: testMode ? '#ec4899' : '#333333', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Modo Teste</p>
            <p style={{ fontSize: 10.5, color: '#555555', margin: 0 }}>Simula um horário fictício para testar a plataforma</p>
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setTestMode(v => !v)}>
          <div style={{ width: 36, height: 20, borderRadius: 10, background: testMode ? '#ec4899' : '#2a2a2a', border: `1px solid ${testMode ? '#db2777' : '#333'}`, position: 'relative', transition: 'all .18s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, left: testMode ? 17 : 3, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left .18s' }} />
          </div>
          <span style={{ fontSize: 12, color: testMode ? '#ec4899' : '#666666', fontWeight: 600 }}>{testMode ? 'Ativo' : 'Inativo'}</span>
        </label>
      </div>

      {testMode && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' as const }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ display: 'block', fontSize: 9.5, fontWeight: 700, color: '#555555', textTransform: 'uppercase' as const, letterSpacing: '.1em', marginBottom: 5 }}>
              Início da live simulada — a sala de espera conta até este momento
            </label>
            <input
              type="datetime-local"
              value={testTime}
              onChange={e => setTestTime(e.target.value)}
              style={{ width: '100%', background: '#1e1e1e', border: '1px solid #333', borderRadius: 7, padding: '7px 10px', color: '#e0e0e0', fontSize: 13, outline: 'none' }}
            />
          </div>
          <button
            onClick={save}
            disabled={saving}
            style={{ padding: '8px 16px', borderRadius: 7, background: saved ? '#065f46' : '#ec4899', border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: saving ? 0.6 : 1 }}>
            {saved ? '✓ Salvo' : saving ? '...' : 'Salvar'}
          </button>
        </div>
      )}

      {!testMode && saved && (
        <p style={{ fontSize: 11, color: '#10b981', marginTop: 8 }}>Modo teste desativado.</p>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/metrics').then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex flex-col md:flex-row" style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <AdminNav />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 12 }}>
          <div className="admin-spin" style={{ width: 30, height: 30, border: '3px solid #222222', borderTopColor: '#2563eb', borderRadius: '50%' }} />
          <span style={{ color: '#555555', fontSize: 13 }}>Carregando...</span>
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
    <div className="flex flex-col md:flex-row" style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <AdminNav />

      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 40px' }}>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4" style={{ marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f0f0f0', margin: 0 }}>Dashboard</h1>
              <p style={{ color: '#555555', fontSize: 12.5, marginTop: 4 }}>
                Edição{' '}
                <code style={{ color: '#3b82f6', background: 'rgba(59,130,246,0.08)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
                  {data?.currentEdition}
                </code>
                <span style={{ margin: '0 6px', color: '#2a2a2a' }}>·</span>
                <span style={{ color: '#444444' }}>{liveDate}</span>
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: sc.bg, border: `1px solid ${sc.dot}22`, borderRadius: 8, padding: '6px 11px' }}>
                {liveStatus === 'live'
                  ? <span className="pulse-live" style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'block', flexShrink: 0 }} />
                  : <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'block', flexShrink: 0 }} />}
                <span style={{ fontSize: 11, fontWeight: 700, color: sc.color }}>{sc.label}</span>
              </div>
              <a href={`/api/admin/export?edition=${data?.currentEdition}`}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#161616', border: '1px solid #2a2a2a', color: '#aaaaaa', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                CSV
              </a>
            </div>
          </div>

          {/* Config summary */}
          <div style={{ background: '#161616', border: '1px solid #222222', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: '#444444', textTransform: 'uppercase' as const, letterSpacing: '.1em', marginBottom: 12 }}>
              Configuração da edição
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 16 }}>
              {[
                { label: 'Vídeo', value: cfg.video_source === 'youtube' ? 'YouTube' : 'Upload', sub: cfg.video_url || '—' },
                { label: 'Duração', value: cfg.video_duration ? `${Math.floor(cfg.video_duration/3600)}h ${Math.floor((cfg.video_duration%3600)/60)}min` : '—', sub: '' },
                { label: 'Chat', value: cfg.chat_enabled ? 'Habilitado' : 'Desabilitado', accent: cfg.chat_enabled ? '#10b981' : '#555555', sub: cfg.chat_mode === 'isolated' ? 'Isolado' : 'Geral' },
                { label: 'CTA', value: cfg.cta_enabled ? 'Ativo' : 'Inativo', accent: cfg.cta_enabled ? '#10b981' : '#555555', sub: cfg.cta_url || '—' },
              ].map((item) => (
                <div key={item.label}>
                  <p style={{ fontSize: 9.5, fontWeight: 700, color: '#333333', textTransform: 'uppercase' as const, letterSpacing: '.1em', marginBottom: 3 }}>{item.label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: (item as any).accent || '#e0e0e0', marginBottom: 1 }}>{item.value}</p>
                  {item.sub && <p style={{ fontSize: 10.5, color: '#3a3a3a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{item.sub}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Test mode panel */}
          <TestModePanel currentEdition={data?.currentEdition} />

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5" style={{ gap: 10, marginBottom: 24 }}>
            <StatCard label="Cadastros" value={m.registrations||0} accent="#2563eb"
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}/>
            <StatCard label="Ao vivo" value={m.enterLive||0} sub={`${m.consumed||0} consumidos`} accent="#8b5cf6"
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>}/>
            <StatCard label="Cliques CTA" value={m.ctaClicks||0} sub="conversões" accent="#f59e0b"
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>}/>
            <StatCard label="Comentários" value={m.realComments||0} sub="reais" accent="#10b981"
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}/>
            <StatCard label="Simulados" value={m.simulatedComments||0} sub="importados" accent="#555555"
              icon={<svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}/>
          </div>

          {/* Páginas da plataforma */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', marginBottom: 12 }}>Páginas da plataforma</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 10 }}>
              {ROUTES.map((r) => <RouteCard key={r.path} route={r} />)}
            </div>
          </div>

          {/* Recent registrations */}
          <div style={{ background: '#161616', border: '1px solid #222222', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Registros recentes</h2>
              {data?.recentRegs?.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 7px', borderRadius: 20 }}>{data.recentRegs.length}</span>
              )}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Nome</th><th>E-mail</th><th>IP</th><th>Consumido</th><th>Data</th></tr></thead>
                <tbody>
                  {(data?.recentRegs || []).map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500, color: '#e0e0e0' }}>{r.name}</td>
                      <td><code style={{ fontSize: 11.5, color: '#666666' }}>{r.email}</code></td>
                      <td><code style={{ fontSize: 11.5, color: '#666666' }}>{r.ip}</code></td>
                      <td>{r.consumed
                        ? <span style={{ fontSize: 10.5, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.08)', padding: '2px 7px', borderRadius: 4 }}>Sim</span>
                        : <span style={{ fontSize: 10.5, color: '#333333' }}>Não</span>}
                      </td>
                      <td style={{ color: '#555555', fontSize: 11.5 }}>{new Date(r.created_at).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                  {!data?.recentRegs?.length && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: '#333333', padding: '24px 0', fontStyle: 'italic', fontSize: 12 }}>Nenhum registro ainda</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* All editions */}
          <div style={{ background: '#161616', border: '1px solid #222222', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #1e1e1e' }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Histórico perpétuo</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Edição</th><th>Cadastros</th><th>Ao vivo</th><th>Consumidos</th><th>Cliques CTA</th><th>Downloads</th></tr></thead>
                <tbody>
                  {(data?.allEditions || []).map((e: any) => (
                    <tr key={e.editionId}>
                      <td><code style={{ fontSize: 12, color: '#3b82f6' }}>{e.editionId}</code></td>
                      <td style={{ color: '#e0e0e0' }}>{e.registrations}</td>
                      <td style={{ color: '#e0e0e0' }}>{e.enterLive}</td>
                      <td style={{ color: '#e0e0e0' }}>{e.consumed}</td>
                      <td style={{ color: '#e0e0e0' }}>{e.ctaClicks}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <a href={`/api/admin/export-comments?edition=${e.editionId}`}
                            style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)', color: '#34d399', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Chat
                          </a>
                          <a href={`/api/admin/export?edition=${e.editionId}`}
                            style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5, background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.18)', color: '#60a5fa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Dados
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!data?.allEditions?.length && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: '#333333', padding: '24px 0', fontStyle: 'italic', fontSize: 12 }}>Sem histórico</td></tr>
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
