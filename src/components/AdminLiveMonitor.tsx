'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminNav from './AdminNav';

type UserRow = {
  id: string;
  name: string;
  email: string;
  enteredAt: string | null;
  watchSeconds: number;
  ctaClicked: boolean;
  commented: boolean;
  commentCount: number;
  lastSeenAt: string | null;
  online: boolean;
};

type Summary = { online: number; totalEntered: number; ctaClicks: number; avgWatchSeconds: number };
type Bucket = { bucket: string; count: number };
type SortKey = keyof UserRow;

function fmtDuration(secs: number): string {
  if (secs <= 0) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function downloadCSV(users: UserRow[]) {
  const header = 'Nome,Email,Entrou,Tempo assistido,Clicou CTA,Comentou,Comentários,Visto por último';
  const rows = users.map(u => [
    `"${u.name.replace(/"/g, '""')}"`,
    `"${u.email.replace(/"/g, '""')}"`,
    u.enteredAt ? new Date(u.enteredAt).toLocaleString('pt-BR') : '',
    fmtDuration(u.watchSeconds),
    u.ctaClicked ? 'Sim' : 'Não',
    u.commented ? 'Sim' : 'Não',
    u.commentCount,
    u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleString('pt-BR') : '',
  ].join(','));
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `live-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

function LineChart({ data }: { data: Bucket[] }) {
  if (data.length < 2) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100 }}>
      <span style={{ fontSize: 12, color: '#444' }}>Aguardando entradas...</span>
    </div>
  );
  const W = 600, H = 110;
  const PAD = { t: 8, r: 16, b: 22, l: 28 };
  const maxY = Math.max(...data.map(d => d.count), 1);
  const pts = data.map((d, i) => ({
    x: PAD.l + (i / (data.length - 1)) * (W - PAD.l - PAD.r),
    y: H - PAD.b - (d.count / maxY) * (H - PAD.t - PAD.b),
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].x},${H - PAD.b} L${pts[0].x},${H - PAD.b} Z`;
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        {[0, 0.5, 1].map((v, i) => {
          const y = PAD.t + (1 - v) * (H - PAD.t - PAD.b);
          return (
            <g key={i}>
              <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#1c1c1c" strokeWidth={1} />
              <text x={PAD.l - 4} y={y + 4} fontSize={8} fill="#3a3a3a" textAnchor="end">{Math.round(v * maxY)}</text>
            </g>
          );
        })}
        <path d={areaPath} fill="rgba(37,99,235,0.07)" />
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill="#3b82f6" />)}
        {data.map((d, i) => {
          if (data.length > 10 && i % Math.ceil(data.length / 8) !== 0) return null;
          return <text key={i} x={pts[i].x} y={H - PAD.b + 14} fontSize={8} fill="#3a3a3a" textAnchor="middle">{d.bucket}</text>;
        })}
      </svg>
    </div>
  );
}

export default function AdminLiveMonitor() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [timeline, setTimeline] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('online');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/live-metrics');
      if (res.status === 401) { window.location.replace('/admin/login'); return; }
      if (!res.ok) return;
      const d = await res.json();
      setSummary(d.summary);
      setUsers(d.users);
      setTimeline(d.timeline);
      setUpdatedAt(new Date());
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [fetchData]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const sorted = [...users].sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey];
    const mul = sortDir === 'asc' ? 1 : -1;
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === 'boolean') return (va === vb ? 0 : va ? -1 : 1) * mul;
    if (typeof va === 'number') return ((va as number) - (vb as number)) * mul;
    return (String(va) > String(vb) ? 1 : -1) * mul;
  });

  const S = summary;

  if (loading) return (
    <div className="flex flex-col md:flex-row" style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <AdminNav />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="admin-spin" style={{ width: 30, height: 30, border: '3px solid #222222', borderTopColor: '#2563eb', borderRadius: '50%' }} />
          <span style={{ color: '#555555', fontSize: 13 }}>Carregando...</span>
        </div>
      </main>
    </div>
  );

  const thStyle = (key: SortKey): React.CSSProperties => ({
    cursor: 'pointer',
    userSelect: 'none',
    color: sortKey === key ? '#e0e0e0' : undefined,
    whiteSpace: 'nowrap',
  });

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  return (
    <div className="flex flex-col md:flex-row" style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <AdminNav />
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 40px' }}>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f0f0f0', margin: 0 }}>Monitor Ao Vivo</h1>
              <p style={{ color: '#555', fontSize: 12, marginTop: 4 }}>
                {updatedAt ? `Atualizado às ${updatedAt.toLocaleTimeString('pt-BR')} · ` : ''}
                Auto-refresh a cada 30s
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button onClick={fetchData}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#161616', border: '1px solid #2a2a2a', color: '#aaa', padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Atualizar
              </button>
              <button onClick={() => downloadCSV(users)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#161616', border: '1px solid #2a2a2a', color: '#aaa', padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Exportar CSV
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 10, marginBottom: 20 }}>
            {[
              { label: 'Online agora', value: S?.online ?? 0, accent: '#10b981', sub: 'últimos 3 min', emoji: '🟢' },
              { label: 'Entraram ao vivo', value: S?.totalEntered ?? 0, accent: '#3b82f6', sub: 'total', emoji: '🎥' },
              { label: 'Clicaram no CTA', value: S?.ctaClicks ?? 0, accent: '#f59e0b', sub: 'conversões', emoji: '🛒' },
              { label: 'Tempo médio', value: fmtDuration(S?.avgWatchSeconds ?? 0), accent: '#8b5cf6', sub: 'por usuário', emoji: '⏱' },
            ].map(c => (
              <div key={c.label} style={{ background: '#161616', border: '1px solid #222', borderRadius: 12, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 16 }}>{c.emoji}</div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>{c.label}</p>
                <p style={{ fontSize: 26, fontWeight: 700, color: c.accent, lineHeight: 1 }}>{c.value}</p>
                <p style={{ fontSize: 11, color: '#444', marginTop: 4 }}>{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div style={{ background: '#161616', border: '1px solid #222', borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', marginBottom: 12 }}>Entradas ao longo do tempo</p>
            <LineChart data={timeline} />
          </div>

          {/* Per-user table */}
          <div style={{ background: '#161616', border: '1px solid #222', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Usuários na live</h2>
              {users.length > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 7px', borderRadius: 20 }}>{users.length}</span>
              )}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th style={thStyle('watchSeconds')} onClick={() => toggleSort('watchSeconds')}>Tempo{arrow('watchSeconds')}</th>
                    <th style={thStyle('ctaClicked')} onClick={() => toggleSort('ctaClicked')}>CTA{arrow('ctaClicked')}</th>
                    <th style={thStyle('commentCount')} onClick={() => toggleSort('commentCount')}>Chat{arrow('commentCount')}</th>
                    <th style={thStyle('online')} onClick={() => toggleSort('online')}>Status{arrow('online')}</th>
                    <th style={thStyle('lastSeenAt')} onClick={() => toggleSort('lastSeenAt')}>Último acesso{arrow('lastSeenAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500, color: '#e0e0e0', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</td>
                      <td><code style={{ fontSize: 11, color: '#555' }}>{u.email}</code></td>
                      <td style={{ color: '#aaa' }}>{fmtDuration(u.watchSeconds)}</td>
                      <td>
                        {u.ctaClicked
                          ? <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 7px', borderRadius: 4 }}>Sim</span>
                          : <span style={{ fontSize: 10, color: '#333' }}>—</span>}
                      </td>
                      <td style={{ color: u.commentCount > 0 ? '#10b981' : '#333', fontWeight: u.commentCount > 0 ? 600 : 400 }}>
                        {u.commentCount > 0 ? u.commentCount : '—'}
                      </td>
                      <td>
                        {u.online
                          ? <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
                              Online
                            </span>
                          : <span style={{ fontSize: 10, color: '#444' }}>Offline</span>}
                      </td>
                      <td style={{ color: '#444', fontSize: 11 }}>{fmtTime(u.lastSeenAt)}</td>
                    </tr>
                  ))}
                  {!sorted.length && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: '#333', padding: '24px 0', fontStyle: 'italic', fontSize: 12 }}>Nenhum usuário na live ainda</td></tr>
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
