'use client';

import { useEffect, useState } from 'react';
import AdminNav from './AdminNav';
import { cyber, cyberFonts } from '@/lib/cybertheme';

const adminStyles = `
  @keyframes adminSpin { to { transform: rotate(360deg); } }
  .admin-spin { animation: adminSpin 0.8s linear infinite; }
  .admin-table { width: 100%; border-collapse: collapse; }
  .admin-table th { padding: 9px 14px; text-align: left; font-size: 9px; font-family: 'Exo 2', sans-serif; color: #6a9ab8; text-transform: uppercase; letter-spacing: .1em; background: #020810; border-bottom: 1px solid rgba(0,180,255,0.2); font-weight: 700; }
  .admin-table td { padding: 9px 14px; font-size: 12px; border-bottom: 1px solid rgba(0,180,255,0.1); vertical-align: middle; }
  .admin-table tr:last-child td { border-bottom: none; }
  .label-admin { display: block; font-size: 10px; font-family: 'Exo 2', sans-serif; color: #6a9ab8; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 6px; font-weight: 600; }
  .input-admin { width: 100%; background: #020810; border: 1px solid rgba(0,180,255,0.2); border-radius: 4px; padding: 10px 12px; color: #c8e4f4; font-family: 'Exo 2', sans-serif; font-size: 13px; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
  .input-admin:focus { border-color: #00B4FF; box-shadow: 0 0 0 2px rgba(0,180,255,0.05); }
  select.input-admin option { background: #020810; color: #c8e4f4; }
`;

type Comment = {
  id: string; type: string; author_name: string; text: string;
  visible: number; is_pinned: number; created_at: string; video_timestamp: number | null;
};

const TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  real_user:          { bg: 'rgba(59,130,246,0.1)',  color: '#60a5fa', label: 'Usuário real' },
  real_staff:         { bg: 'rgba(139,92,246,0.1)',  color: '#a78bfa', label: 'Staff real' },
  simulated_user:     { bg: 'rgba(85,85,85,0.1)',    color: '#888888', label: 'Sim. plateia' },
  simulated_staff:    { bg: 'rgba(99,102,241,0.1)',  color: '#818cf8', label: 'Sim. staff' },
  simulated_purchase: { bg: 'rgba(16,185,129,0.1)',  color: '#34d399', label: 'Compra sim.' },
};

export default function AdminComments() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [newName, setNewName] = useState('Staff');
  const [isPinned, setIsPinned] = useState(false);
  const [pinStart, setPinStart] = useState('');
  const [pinEnd, setPinEnd] = useState('');
  const [sending, setSending] = useState(false);

  async function load() {
    const r = await fetch('/api/admin/comments');
    const d = await r.json();
    setComments(d.comments || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleVisible(id: string, visible: number) {
    await fetch('/api/admin/comments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, visible: visible ? 0 : 1 }) });
    load();
  }

  async function togglePin(id: string, pinned: number) {
    await fetch('/api/admin/comments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, is_pinned: pinned ? 0 : 1 }) });
    load();
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    setSending(true);
    await fetch('/api/admin/comments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'real_staff', author_name: newName, text: newText, is_pinned: isPinned, pin_start_seconds: pinStart ? parseInt(pinStart) : null, pin_end_seconds: pinEnd ? parseInt(pinEnd) : null }),
    });
    setNewText(''); setIsPinned(false); setPinStart(''); setPinEnd('');
    setSending(false); load();
  }

  if (loading) return (
    <div className="flex flex-col md:flex-row" style={{ minHeight: '100vh', background: cyber.bg }}>
      <style>{adminStyles}</style>
      <AdminNav />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="admin-spin" style={{ width: 30, height: 30, border: `3px solid ${cyber.accentBorderDim}`, borderTopColor: cyber.accent, borderRadius: '50%' }} />
      </main>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row" style={{ minHeight: '100vh', background: cyber.bg }}>
      <style>{adminStyles}</style>
      <AdminNav />

      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: 940, margin: '0 auto', padding: '24px 20px 40px' }}>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3" style={{ marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: cyber.accent, fontFamily: cyberFonts.display, margin: 0, textShadow: `0 0 20px ${cyber.accentGlow}` }}>Moderação</h1>
              <p style={{ color: cyber.textLabel, fontSize: 12.5, marginTop: 4 }}>Envie comentários, fixe pins e modere mensagens da live.</p>
            </div>
            <a href="/api/admin/export-comments"
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, color: cyber.textLabel, padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 500, textDecoration: 'none', flexShrink: 0, alignSelf: 'flex-start' }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Baixar comentários
            </a>
          </div>

          {/* Send form */}
          <div style={{ background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 18px', borderBottom: `1px solid ${cyber.accentBorderDim}`, borderLeft: '3px solid #8b5cf6' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: cyber.textPrimary, margin: 0 }}>Enviar comentário / pin</p>
              <p style={{ fontSize: 11, color: cyber.textLabel, margin: '2px 0 0' }}>Mensagem enviada como staff em tempo real.</p>
            </div>
            <form onSubmit={sendComment} style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                <div>
                  <label className="label-admin">Tipo</label>
                  <select className="input-admin" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                    <option>Staff real</option>
                  </select>
                </div>
                <div>
                  <label className="label-admin">Nome exibido</label>
                  <input className="input-admin" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label-admin">Mensagem</label>
                <input className="input-admin" value={newText} onChange={e => setNewText(e.target.value)} placeholder="Texto do comentário..." required />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' as const }} onClick={() => setIsPinned(!isPinned)}>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: isPinned ? cyber.accent : cyber.bg, border: `1px solid ${isPinned ? cyber.accentDim : cyber.accentBorderDim}`, position: 'relative', transition: 'all .18s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 3, left: isPinned ? 17 : 3, width: 12, height: 12, borderRadius: '50%', background: cyber.white, transition: 'left .18s', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
                </div>
                <span style={{ fontSize: 13, color: isPinned ? cyber.textPrimary : cyber.textLabel }}>Fixar como pin (CTA)</span>
              </label>

              {isPinned && (
                <div className="grid grid-cols-2" style={{ gap: 12, background: cyber.accentOverlay, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 8, padding: '12px' }}>
                  <div>
                    <label className="label-admin">Pin início (seg)</label>
                    <input className="input-admin" type="number" value={pinStart} onChange={e => setPinStart(e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <label className="label-admin">Pin fim (seg)</label>
                    <input className="input-admin" type="number" value={pinEnd} onChange={e => setPinEnd(e.target.value)} placeholder="3600" />
                  </div>
                </div>
              )}

              <div>
                <button type="submit" disabled={sending || !newText.trim()} style={{
                  background: sending || !newText.trim() ? 'rgba(139,92,246,0.25)' : '#7c3aed',
                  border: `1px solid ${sending || !newText.trim() ? 'rgba(139,92,246,0.15)' : '#6d28d9'}`,
                  color: cyber.white, fontWeight: 700, fontSize: 13,
                  padding: '8px 20px', borderRadius: 8,
                  cursor: sending || !newText.trim() ? 'not-allowed' : 'pointer',
                }}>
                  {sending ? 'Enviando...' : '↑ Enviar agora'}
                </button>
              </div>
            </form>
          </div>

          {/* Comments table */}
          <div style={{ background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: `1px solid ${cyber.accentBorderDim}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: cyber.textPrimary, margin: 0 }}>Todos os comentários</p>
              <span style={{ fontSize: 10, fontWeight: 700, color: cyber.accent, background: cyber.accentOverlay, padding: '2px 7px', borderRadius: 20 }}>{comments.length}</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Tipo</th><th>Autor</th><th>Texto</th><th>Data</th><th>Ações</th></tr></thead>
                <tbody>
                  {comments.map(c => {
                    const ts = TYPE_STYLES[c.type] || { bg: 'rgba(85,85,85,0.1)', color: cyber.textDecorative, label: c.type };
                    return (
                      <tr key={c.id} style={{ opacity: c.visible ? 1 : 0.35 }}>
                        <td><span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: ts.bg, color: ts.color }}>{ts.label}</span></td>
                        <td style={{ fontWeight: 500, color: cyber.textPrimary }}>{c.author_name}</td>
                        <td><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260, color: cyber.textLabel, fontSize: 12 }}>{c.text}</span></td>
                        <td style={{ color: cyber.textDecorative, fontSize: 11 }}>{new Date(c.created_at).toLocaleString('pt-BR')}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => toggleVisible(c.id, c.visible)} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5, cursor: 'pointer', background: c.visible ? 'rgba(239,68,68,0.07)' : 'rgba(16,185,129,0.07)', border: `1px solid ${c.visible ? 'rgba(239,68,68,0.18)' : 'rgba(16,185,129,0.18)'}`, color: c.visible ? '#f87171' : '#34d399' }}>
                              {c.visible ? 'Ocultar' : 'Mostrar'}
                            </button>
                            <button onClick={() => togglePin(c.id, c.is_pinned)} style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5, cursor: 'pointer', background: c.is_pinned ? 'rgba(37,99,235,0.1)' : 'rgba(85,85,85,0.07)', border: `1px solid ${c.is_pinned ? 'rgba(37,99,235,0.25)' : 'rgba(85,85,85,0.18)'}`, color: c.is_pinned ? '#60a5fa' : cyber.textDecorative }}>
                              {c.is_pinned ? '📌 Fixado' : 'Fixar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {comments.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: cyber.textDecorative, padding: '24px 0', fontStyle: 'italic', fontSize: 12 }}>Nenhum comentário ainda</td></tr>
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
