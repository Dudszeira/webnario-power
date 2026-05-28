'use client';

import { useState, useEffect } from 'react';
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

type SimComment = { id: string; type: string; author_name: string; text: string; video_timestamp: number };

function formatTs(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
}

const TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  simulated_user:     { bg: 'rgba(59,130,246,0.1)',  color: '#60a5fa', label: 'Plateia' },
  simulated_staff:    { bg: 'rgba(139,92,246,0.1)',  color: '#a78bfa', label: 'Staff sim.' },
  simulated_purchase: { bg: 'rgba(16,185,129,0.1)',  color: '#34d399', label: 'Compra sim.' },
};

export default function AdminImport() {
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; errors: string[] } | null>(null);
  const [comments, setComments] = useState<SimComment[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  async function loadComments() {
    setLoadingList(true);
    const r = await fetch('/api/admin/import');
    const d = await r.json();
    setComments(d.comments || []);
    setLoadingList(false);
  }

  useEffect(() => { loadComments(); }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('replace', replace ? 'true' : 'false');
    const res = await fetch('/api/admin/import', { method: 'POST', body: fd });
    const data = await res.json();
    setResult(data); setUploading(false);
    if (data.ok) loadComments();
  }

  async function clearAll() {
    if (!confirm('Excluir todos os comentários simulados desta edição?')) return;
    await fetch('/api/admin/import', { method: 'DELETE' });
    loadComments();
  }

  const templateUrl = 'data:text/csv;charset=utf-8,' + encodeURIComponent(
    'tipo;nome_exibido;texto;timestamp\n' +
    'usuario_simulado;João Silva;Que conteúdo incrível!;00:05:00\n' +
    'staff_simulado;Staff;Obrigado pela pergunta!;00:05:30\n' +
    'compra_simulada;Maria Santos;Acabei de garantir minha vaga!;00:45:00\n'
  );

  return (
    <div className="flex flex-col md:flex-row" style={{ minHeight: '100vh', background: cyber.bg }}>
      <style>{adminStyles}</style>
      <AdminNav />

      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 20px 40px' }}>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3" style={{ marginBottom: 24 }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: cyber.accent, fontFamily: cyberFonts.display, margin: 0, textShadow: `0 0 20px ${cyber.accentGlow}` }}>Importar Roteiro</h1>
              <p style={{ color: cyber.textLabel, fontSize: 12.5, marginTop: 4 }}>Upload de .xlsx ou .csv com comentários simulados da live.</p>
            </div>
            <a href={templateUrl} download="template-roteiro.csv"
              style={{ display: 'flex', alignItems: 'center', gap: 5, background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, color: cyber.textLabel, padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 500, textDecoration: 'none', flexShrink: 0 }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Template CSV
            </a>
          </div>

          {/* Upload card */}
          <div style={{ background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 12, padding: '18px', marginBottom: 12 }}>
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>

              {/* Drop zone */}
              <div
                style={{ border: `2px dashed ${dragOver ? cyber.accent : cyber.accentBorderDim}`, borderRadius: 10, padding: '24px 16px', textAlign: 'center' as const, background: dragOver ? cyber.accentOverlay : cyber.bg, transition: 'all .15s', cursor: 'pointer' }}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <svg width="24" height="24" fill="none" stroke={file ? cyber.accent : cyber.textDecorative} strokeWidth={1.5} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px', display: 'block' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {file
                  ? <p style={{ fontSize: 13, fontWeight: 600, color: cyber.accent, margin: 0 }}>{file.name}</p>
                  : <>
                    <p style={{ fontSize: 13, color: cyber.textLabel, margin: '0 0 2px' }}>Arraste ou clique para selecionar</p>
                    <p style={{ fontSize: 11, color: cyber.textDecorative, margin: 0 }}>.xlsx ou .csv</p>
                  </>}
                <input id="file-input" type="file" accept=".xlsx,.csv" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] || null)} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' as const }} onClick={() => setReplace(!replace)}>
                <div style={{ width: 36, height: 20, borderRadius: 10, background: replace ? cyber.accent : cyber.bg, border: `1px solid ${replace ? cyber.accentDim : cyber.accentBorderDim}`, position: 'relative', transition: 'all .18s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 3, left: replace ? 17 : 3, width: 12, height: 12, borderRadius: '50%', background: cyber.white, transition: 'left .18s', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
                </div>
                <span style={{ fontSize: 13, color: replace ? cyber.textPrimary : cyber.textLabel }}>Substituir simulados existentes desta edição</span>
              </label>

              <div>
                <button type="submit" disabled={!file || uploading} style={{
                  background: !file || uploading ? 'rgba(0,180,255,0.3)' : `linear-gradient(135deg, ${cyber.accent}, ${cyber.accentDim})`,
                  border: `1px solid ${!file || uploading ? 'rgba(0,180,255,0.15)' : 'transparent'}`,
                  color: cyber.black, fontWeight: 700, fontSize: 13,
                  padding: '9px 22px', borderRadius: 8,
                  cursor: !file || uploading ? 'not-allowed' : 'pointer',
                }}>
                  {uploading ? 'Importando...' : 'Importar arquivo'}
                </button>
              </div>
            </form>

            {result && (
              <div style={{ marginTop: 14, borderRadius: 8, padding: '11px 14px', background: result.errors?.length ? 'rgba(245,158,11,0.06)' : 'rgba(0,255,157,0.06)', border: `1px solid ${result.errors?.length ? 'rgba(245,158,11,0.2)' : 'rgba(0,255,157,0.2)'}` }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: result.errors?.length ? '#f59e0b' : cyber.green, margin: '0 0 2px' }}>
                  {result.inserted} linhas importadas com sucesso.
                </p>
                {result.errors?.map((err, i) => <p key={i} style={{ fontSize: 12, color: '#f59e0b', margin: '2px 0 0' }}>{err}</p>)}
              </div>
            )}
          </div>

          {/* Columns legend */}
          <div style={{ background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 12, padding: '14px 18px', marginBottom: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: cyber.textPrimary, fontFamily: cyberFonts.body, marginBottom: 10 }}>Colunas do CSV/XLSX</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Coluna</th><th>Obrigatória</th><th>Descrição</th></tr></thead>
                <tbody>
                  {[
                    { col: 'tipo', desc: 'usuario_simulado | staff_simulado | compra_simulada' },
                    { col: 'nome_exibido', desc: 'Nome que aparece no chat' },
                    { col: 'texto', desc: 'Mensagem do comentário' },
                    { col: 'timestamp', desc: 'HH:MM:SS, MM:SS ou segundos (ex: 300)' },
                  ].map(({ col, desc }) => (
                    <tr key={col}>
                      <td><code style={{ fontSize: 12, color: cyber.accent }}>{col}</code></td>
                      <td><span style={{ fontSize: 10.5, fontWeight: 700, color: cyber.green, background: 'rgba(0,255,157,0.08)', padding: '2px 6px', borderRadius: 4 }}>Sim</span></td>
                      <td style={{ color: cyber.textLabel, fontSize: 12 }}>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Imported comments */}
          <div style={{ background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: `1px solid ${cyber.accentBorderDim}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: cyber.textPrimary, margin: 0 }}>Roteiro carregado</p>
                <span style={{ fontSize: 10, fontWeight: 700, color: cyber.accent, background: cyber.accentOverlay, padding: '2px 7px', borderRadius: 20 }}>{comments.length} linhas</span>
              </div>
              {comments.length > 0 && (
                <button onClick={clearAll} style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#f87171', fontSize: 12, fontWeight: 600, padding: '4px 11px', borderRadius: 6, cursor: 'pointer' }}>
                  Limpar tudo
                </button>
              )}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>Timestamp</th><th>Tipo</th><th>Nome</th><th>Texto</th></tr></thead>
                <tbody>
                  {loadingList
                    ? <tr><td colSpan={4} style={{ textAlign: 'center', color: cyber.textDecorative, padding: '24px 0', fontSize: 12 }}>Carregando...</td></tr>
                    : comments.length === 0
                    ? <tr><td colSpan={4} style={{ textAlign: 'center', color: cyber.textDecorative, padding: '24px 0', fontStyle: 'italic', fontSize: 12 }}>Nenhum comentário simulado importado</td></tr>
                    : comments.map(c => {
                      const ts = TYPE_STYLES[c.type] || { bg: 'rgba(85,85,85,0.1)', color: cyber.textDecorative, label: c.type };
                      return (
                        <tr key={c.id}>
                          <td><code style={{ fontSize: 12, color: cyber.accent }}>{formatTs(c.video_timestamp)}</code></td>
                          <td><span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: ts.bg, color: ts.color }}>{ts.label}</span></td>
                          <td style={{ fontWeight: 500, color: cyber.textPrimary }}>{c.author_name}</td>
                          <td><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300, color: cyber.textLabel, fontSize: 12 }}>{c.text}</span></td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
