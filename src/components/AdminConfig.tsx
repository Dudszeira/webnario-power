'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

const defaultConfig = {
  video_source: 'youtube', video_url: '', video_duration: 7200,
  sales_page_url: '', chat_enabled: true, chat_mode: 'general',
  cta_enabled: false, cta_url: '', cta_text: '',
  cta_start_seconds: 0, cta_end_seconds: 3600,
  viewer_min: 210, viewer_max: 220,
  test_mode: false, test_time: '',
};

function SectionCard({ title, description, accent, children }: {
  title: string; description?: string; accent: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: cyber.surface, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: `1px solid ${cyber.accentBorderDim}`, borderLeft: `3px solid ${accent}` }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: cyber.textPrimary, fontFamily: cyberFonts.body, margin: 0 }}>{title}</p>
        {description && <p style={{ fontSize: 11, color: cyber.textLabel, margin: '3px 0 0' }}>{description}</p>}
      </div>
      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column' as const, gap: 14, background: cyber.surface }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-admin">{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: cyber.textDecorative, marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' as const }} onClick={() => onChange(!checked)}>
      <div style={{ width: 36, height: 20, borderRadius: 10, background: checked ? cyber.accent : cyber.bg, border: `1px solid ${checked ? cyber.accentDim : cyber.accentBorderDim}`, position: 'relative', transition: 'all .18s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: checked ? 17 : 3, width: 12, height: 12, borderRadius: '50%', background: cyber.white, transition: 'left .18s', boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }} />
      </div>
      <span style={{ fontSize: 13, color: checked ? cyber.textPrimary : cyber.textLabel }}>{label}</span>
    </label>
  );
}

export default function AdminConfig() {
  const router = useRouter();
  const [config, setConfig] = useState(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/config');
        if (r.status === 401) { router.replace('/admin/login'); return; }
        const d = await r.json();
        if (d.edition) {
          let testTimeLocal = '';
          if (d.edition.test_time) {
            try {
              testTimeLocal = new Date(d.edition.test_time).toLocaleString('sv-SE', { hour12: false }).slice(0, 16);
            } catch { /* malformed date — leave empty */ }
          }
          setConfig({
            ...defaultConfig,
            ...d.edition,
            chat_enabled: !!d.edition.chat_enabled,
            cta_enabled: !!d.edition.cta_enabled,
            test_mode: !!d.edition.test_mode,
            test_time: testTimeLocal,
          });
        }
      } catch { /* network error — spinner clears, config stays at defaults */ }
      finally { setLoading(false); }
    })();
  }, [router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaveError('');

    const payload = {
      ...config,
      test_time: (config.test_mode && config.test_time)
        ? new Date(config.test_time).toISOString()
        : null
    };

    try {
      const r = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.status === 401) { router.replace('/admin/login'); return; }
      if (!r.ok) { setSaveError('Erro ao salvar. Tente novamente.'); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaveError('Erro de conexão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  const set = (key: string, val: any) => setConfig(c => ({ ...c, [key]: val }));

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
        <div style={{ maxWidth: 660, margin: '0 auto', padding: '24px 20px 40px' }}>

          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: cyber.accent, fontFamily: cyberFonts.display, margin: 0, textShadow: `0 0 20px ${cyber.accentGlow}` }}>Configurações</h1>
            <p style={{ color: cyber.textLabel, fontFamily: cyberFonts.body, fontSize: 12.5, marginTop: 4 }}>Alterações entram em vigor na próxima requisição.</p>
          </div>

          <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>

            <SectionCard title="Vídeo" description="Fonte e duração do player de vídeo da live." accent={cyber.accent}>
              <Field label="Fonte">
                <select className="input-admin" value={config.video_source} onChange={e => set('video_source', e.target.value)}>
                  <option value="youtube">YouTube</option>
                  <option value="upload">Upload local</option>
                </select>
              </Field>
              <Field label={config.video_source === 'youtube' ? 'URL ou ID do YouTube' : 'Caminho do arquivo'}>
                <input className="input-admin" type="text" value={config.video_url} onChange={e => set('video_url', e.target.value)}
                  placeholder={config.video_source === 'youtube' ? 'https://youtube.com/watch?v=...' : '/uploads/video.mp4'} />
              </Field>
              <Field label="Duração (segundos)" hint={`${Math.floor(Number(config.video_duration)/3600)}h ${Math.floor((Number(config.video_duration)%3600)/60)}min`}>
                <input className="input-admin" type="number" value={config.video_duration} onChange={e => set('video_duration', Number(e.target.value))} min={60} />
              </Field>
            </SectionCard>

            <SectionCard title="Chat" description="Modo de visibilidade do chat. Habilitar/desabilitar é controlado pelo painel staff no chat." accent={cyber.green}>
              <Field label="Modo de visibilidade">
                <select className="input-admin" value={config.chat_mode} onChange={e => set('chat_mode', e.target.value)}>
                  <option value="general">Geral — todos veem todos os comentários</option>
                  <option value="isolated">Isolado — cada usuário vê apenas os próprios</option>
                </select>
              </Field>
            </SectionCard>

            <SectionCard title="CTA / Oferta" description="Banner de oferta no chat. Ativar/desativar é controlado pelo painel staff no chat." accent="#f59e0b">
              <Field label="URL do CTA">
                <input className="input-admin" type="url" value={config.cta_url} onChange={e => set('cta_url', e.target.value)} placeholder="https://..." />
              </Field>
              <Field label="Texto do botão">
                <input className="input-admin" type="text" value={config.cta_text} onChange={e => set('cta_text', e.target.value)} placeholder="Garantir acesso →" />
              </Field>
              <div className="grid grid-cols-2" style={{ gap: 12 }}>
                <Field label="Início (segundos)">
                  <input className="input-admin" type="number" value={config.cta_start_seconds} onChange={e => set('cta_start_seconds', Number(e.target.value))} />
                </Field>
                <Field label="Fim (segundos)">
                  <input className="input-admin" type="number" value={config.cta_end_seconds} onChange={e => set('cta_end_seconds', Number(e.target.value))} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Contador simulado" description="Faixa de oscilação do contador exibido ao público." accent="#8b5cf6">
              <div className="grid grid-cols-2" style={{ gap: 12 }}>
                <Field label="Mínimo">
                  <input className="input-admin" type="number" value={config.viewer_min} onChange={e => set('viewer_min', Number(e.target.value))} />
                </Field>
                <Field label="Máximo">
                  <input className="input-admin" type="number" value={config.viewer_max} onChange={e => set('viewer_max', Number(e.target.value))} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Modo Teste / Live Simulada" description="Força um horário fictício na plataforma para testar o comportamento da live simulada." accent={cyber.pink}>
              <Toggle checked={config.test_mode} onChange={v => set('test_mode', v)} label="Habilitar Modo Teste" />
              {config.test_mode && (
                <Field label="Data e hora fictícia do teste" hint="Defina o dia e horário que a plataforma deve assumir (ex: terça às 20:05 para testar 5 minutos de live).">
                  <input className="input-admin" type="datetime-local" value={config.test_time} onChange={e => set('test_time', e.target.value)} required />
                </Field>
              )}
            </SectionCard>

            <SectionCard title="Página de vendas" description="Redirect para usuários bloqueados após a live." accent="#ef4444">
              <Field label="URL da página de vendas">
                <input className="input-admin" type="url" value={config.sales_page_url} onChange={e => set('sales_page_url', e.target.value)} placeholder="https://..." />
              </Field>
            </SectionCard>

            {saveError && (
              <p style={{ fontSize: 12, color: cyber.error, background: cyber.accentOverlay, border: `1px solid ${cyber.accentBorderDim}`, borderRadius: 8, padding: '8px 12px', margin: 0 }}>
                {saveError}
              </p>
            )}

            <button type="submit" disabled={saving} style={{
              width: '100%',
              background: saved ? cyber.green : saving ? `rgba(0,180,255,0.4)` : `linear-gradient(135deg, ${cyber.accent}, ${cyber.accentDim})`,
              border: 'none',
              color: cyber.black, fontWeight: 700, fontSize: 14,
              fontFamily: cyberFonts.display,
              padding: '12px 0', borderRadius: 10,
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all .2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              {saved
                ? <><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Salvo!</>
                : saving ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
