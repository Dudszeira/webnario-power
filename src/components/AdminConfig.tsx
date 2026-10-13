'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from './AdminSidebar';
import CyberDateTimePicker from './CyberDateTimePicker';
import IntegrationsCard from './marketing/IntegrationsCard';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, Loader2 } from 'lucide-react';

const defaultConfig = {
  video_source: 'youtube', video_url: '', video_duration: 7200,
  sales_page_url: '', chat_enabled: true, chat_mode: 'isolated',
  cta_enabled: false, cta_url: '', cta_text: '',
  cta_start_seconds: 0, cta_end_seconds: 3600, cta_auto_enabled: false,
  notifications_enabled: true,
  viewer_min: 210, viewer_max: 220,
  test_mode: false, test_time: '',
};

function SectionCard({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function AdminConfig() {
  const router = useRouter();
  const [config, setConfig] = useState(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [detectedVideo, setDetectedVideo] = useState<{ filename: string; url: string; sizeMB: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/config');
        if (r.status === 401) { router.replace('/admin/login'); return; }
        const d = await r.json();
        if (d.detectedVideo) setDetectedVideo(d.detectedVideo);
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
            chat_enabled: true, // always default to enabled; toggle off only if admin explicitly disables
            cta_enabled: !!d.edition.cta_enabled,
            cta_auto_enabled: !!d.edition.cta_auto_enabled,
            notifications_enabled: d.edition.notifications_enabled === 0 ? false : true,
            test_mode: !!d.edition.test_mode,
            test_time: testTimeLocal,
          });
        }
      } catch { /* network error — spinner clears, config stays at defaults */ }
      finally { setLoading(false); }
    })();
  }, [router]);

  // Re-detect video when user switches to upload mode
  useEffect(() => {
    if (config.video_source !== 'upload' || detectedVideo) return;
    fetch('/api/admin/video-status')
      .then(r => r.json())
      .then(d => { if (d.exists) setDetectedVideo(d); })
      .catch(() => {});
  }, [config.video_source, detectedVideo]);

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

  async function useExistingVideo(url: string) {
    set('video_url', url);
    try {
      const dur = await new Promise<number>(resolve => {
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.onloadedmetadata = () => resolve(Math.round(v.duration));
        v.onerror = () => resolve(0);
        v.src = url;
      });
      if (dur > 0) set('video_duration', dur);
    } catch { /* skip duration detection */ }
  }

  function getVideoDuration(file: File): Promise<number> {
    return new Promise(resolve => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const url = URL.createObjectURL(file);
      video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(video.duration)); };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
      video.src = url;
    });
  }

  async function handleVideoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setUploadMsg('');
    try {
      const duration = await getVideoDuration(file);
      const newDuration = duration > 0 ? duration : Number(config.video_duration);
      if (duration > 0) set('video_duration', duration);
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload-video', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        set('video_url', data.url);
        setUploadMsg(`✓ ${file.name} enviado`);
        // Auto-save so ao vivo picks up the new video immediately
        await fetch('/api/admin/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...config, video_url: data.url, video_duration: newDuration }),
        });
      } else {
        setUploadMsg(data.error || 'Erro no upload.');
      }
    } catch {
      setUploadMsg('Erro de conexão.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-7 animate-spin text-primary" />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
            <h1 className="text-base font-medium">Configurações</h1>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 lg:p-6">
          <p className="-mt-2 text-[12.5px] text-muted-foreground">Alterações entram em vigor na próxima requisição.</p>

          <form onSubmit={save} className="flex flex-col gap-3">
            <SectionCard title="Vídeo" description="Fonte e duração do player de vídeo da live.">
              <Field label="Fonte">
                <Select value={config.video_source} onValueChange={(v) => set('video_source', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="upload">Upload local</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {config.video_source === 'youtube' ? (
                <Field label="URL ou ID do YouTube">
                  <Input type="text" value={config.video_url} onChange={e => set('video_url', e.target.value)}
                    placeholder="https://youtube.com/watch?v=..." />
                </Field>
              ) : (
                <Field label="Arquivo de vídeo">
                  {config.video_url ? (
                    // File already configured — show it and allow replacing
                    <div className="rounded-lg border border-emerald-500/20 bg-muted/50 p-3">
                      <p className="mb-1.5 text-xs font-semibold text-emerald-400">
                        Arquivo em uso: <span className="font-normal text-foreground">{config.video_url.split('/').pop()}</span>
                      </p>
                      <label className="cursor-pointer">
                        <span className="text-[11px] text-muted-foreground underline">
                          {uploading ? 'Enviando...' : uploadMsg ? uploadMsg : 'Trocar arquivo (upload)'}
                        </span>
                        <input type="file" accept="video/*" className="hidden" disabled={uploading} onChange={handleVideoFile} />
                      </label>
                    </div>
                  ) : detectedVideo ? (
                    // File found on disk — offer to use it without re-uploading
                    <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-muted/50 p-3">
                      <p className="text-xs font-semibold text-primary">Arquivo detectado na pasta do projeto:</p>
                      <p className="text-xs text-foreground">
                        {detectedVideo.filename} <span className="text-muted-foreground">({detectedVideo.sizeMB >= 1024 ? `${(detectedVideo.sizeMB / 1024).toFixed(1)} GB` : `${detectedVideo.sizeMB} MB`})</span>
                      </p>
                      <Button type="button" size="sm" className="self-start" onClick={() => useExistingVideo(detectedVideo.url)}>
                        Usar este arquivo
                      </Button>
                      <label className="cursor-pointer">
                        <span className="text-[11px] text-muted-foreground underline">
                          {uploading ? 'Enviando...' : uploadMsg ? uploadMsg : 'Ou fazer upload de outro arquivo'}
                        </span>
                        <input type="file" accept="video/*" className="hidden" disabled={uploading} onChange={handleVideoFile} />
                      </label>
                    </div>
                  ) : (
                    // No file found — show upload UI
                    <label className="flex cursor-pointer flex-col gap-2">
                      <div className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${uploading ? 'border-primary' : 'border-border'}`}>
                        {uploading
                          ? <p className="text-xs text-primary">Enviando...</p>
                          : uploadMsg
                          ? <p className={`text-xs ${uploadMsg.startsWith('✓') ? 'text-emerald-400' : 'text-destructive'}`}>{uploadMsg}</p>
                          : <p className="text-xs text-muted-foreground">Clique para selecionar o vídeo <span className="text-muted-foreground/70">(mp4, webm, mov)</span></p>
                        }
                      </div>
                      <input type="file" accept="video/*" className="hidden" disabled={uploading} onChange={handleVideoFile} />
                    </label>
                  )}
                </Field>
              )}

              <Field label="Duração" hint={`${Math.floor(Number(config.video_duration)/3600)}h ${Math.floor((Number(config.video_duration)%3600)/60)}min — ${config.video_source === 'upload' ? 'detectada automaticamente ao enviar' : 'preencha manualmente'}`}>
                <Input type="number" value={config.video_duration} onChange={e => set('video_duration', Number(e.target.value))} min={60} readOnly={config.video_source === 'upload' && uploading} />
              </Field>
            </SectionCard>

            <SectionCard title="Chat" description="Habilitar ou desabilitar o chat e definir o modo de visibilidade.">
              <div className="flex items-center gap-2.5">
                <Switch id="chat_enabled" checked={config.chat_enabled as unknown as boolean} onCheckedChange={(v) => set('chat_enabled', v)} />
                <Label htmlFor="chat_enabled">Chat habilitado</Label>
              </div>
              <Field label="Modo de visibilidade">
                <Select value={config.chat_mode} onValueChange={(v) => set('chat_mode', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Geral — todos veem todos os comentários</SelectItem>
                    <SelectItem value="isolated">Isolado — cada usuário vê apenas os próprios</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </SectionCard>

            <SectionCard title="CTA / Oferta" description="Banner de oferta no chat e notificações de compra. Pode ativar sozinho na janela abaixo, e a equipe pode forçar manualmente (ligar ou desligar) no painel do chat.">
              <Field label="URL do CTA">
                <Input type="url" value={config.cta_url} onChange={e => set('cta_url', e.target.value)} placeholder="https://..." />
              </Field>
              <Field label="Texto do botão">
                <Input type="text" value={config.cta_text} onChange={e => set('cta_text', e.target.value)} placeholder="Garantir acesso →" />
              </Field>
              <div className="flex items-center gap-2.5">
                <Switch id="notifications_enabled" checked={config.notifications_enabled as unknown as boolean} onCheckedChange={(v) => set('notifications_enabled', v)} />
                <Label htmlFor="notifications_enabled">Notificações de compra habilitadas</Label>
              </div>
              <div className="flex items-center gap-2.5">
                <Switch id="cta_auto_enabled" checked={config.cta_auto_enabled as unknown as boolean} onCheckedChange={(v) => set('cta_auto_enabled', v)} />
                <Label htmlFor="cta_auto_enabled">Ativação automática habilitada</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Início (segundos)">
                  <Input type="number" value={config.cta_start_seconds} onChange={e => set('cta_start_seconds', Number(e.target.value))} disabled={!config.cta_auto_enabled} />
                </Field>
                <Field label="Fim (segundos)" hint="0 = sem limite de fim.">
                  <Input type="number" value={config.cta_end_seconds} onChange={e => set('cta_end_seconds', Number(e.target.value))} disabled={!config.cta_auto_enabled} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Contador simulado" description="Faixa de oscilação do contador exibido ao público.">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mínimo">
                  <Input type="number" value={config.viewer_min} onChange={e => set('viewer_min', Number(e.target.value))} />
                </Field>
                <Field label="Máximo">
                  <Input type="number" value={config.viewer_max} onChange={e => set('viewer_max', Number(e.target.value))} />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Modo Teste / Live Simulada" description="Força um horário fictício na plataforma para testar o comportamento da live simulada.">
              <div className="flex items-center gap-2.5">
                <Switch id="test_mode" checked={config.test_mode} onCheckedChange={(v) => set('test_mode', v)} />
                <Label htmlFor="test_mode">Habilitar Modo Teste</Label>
              </div>
              {config.test_mode && (
                <Field label="Data e hora fictícia do teste" hint="Defina o dia e horário que a plataforma deve assumir (ex: terça às 20:05 para testar 5 minutos de live).">
                  <CyberDateTimePicker value={config.test_time} onChange={v => set('test_time', v)} />
                </Field>
              )}
            </SectionCard>

            <SectionCard title="Página de vendas" description="Redirect para usuários bloqueados após a live.">
              <Field label="URL da página de vendas">
                <Input type="url" value={config.sales_page_url} onChange={e => set('sales_page_url', e.target.value)} placeholder="https://..." />
              </Field>
            </SectionCard>

            {saveError && (
              <p className="rounded-lg border border-border bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {saveError}
              </p>
            )}

            <Button type="submit" disabled={saving} className="w-full">
              {saved ? <><Check className="size-4" /> Salvo!</> : saving ? <><Loader2 className="size-4 animate-spin" /> Salvando...</> : 'Salvar configurações'}
            </Button>
          </form>

          <IntegrationsCard />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
