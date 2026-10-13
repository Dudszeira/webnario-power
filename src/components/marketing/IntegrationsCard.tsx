'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, ChevronRight, ExternalLink, Loader2, X } from 'lucide-react';

type Tab = 'capture' | 'overview' | 'sales' | 'schedule';
type Source = 'plataforma' | 'vercel' | null;
type Settings = {
  sheetId: string;
  gids: Record<Tab, string>;
  metaAdAccount: string;
  metaApiVersion: string;
  metaToken: { configured: boolean; last4: string | null; source: Source };
  source: { sheetId: Source; metaAdAccount: Source };
};
type TestResult = { source: string; ok: boolean; message: string };

const TABS: [Tab, string][] = [
  ['capture', 'Captação'], ['overview', 'Visão Geral'],
  ['sales', 'Detalhamento Vendas'], ['schedule', 'Detalhamento Agendamentos'],
];
const sourceLabel = (s: Source) => (s === 'vercel' ? 'Vercel' : s ?? '');

// Mesmo visual de Field em AdminConfig, com label ligado ao input.
function Field({ id, label, hint, children }: { id: string; label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function IntegrationsCard() {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [form, setForm] = useState({ sheetId: '', metaAdAccount: '', metaApiVersion: '', gids: {} as Record<Tab, string> });
  const [token, setToken] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);

  function apply(s: Settings) {
    setSaved(s);
    setForm({ sheetId: s.sheetId, metaAdAccount: s.metaAdAccount, metaApiVersion: s.metaApiVersion, gids: { ...s.gids } });
    setToken(''); setReplacing(false);
  }

  useEffect(() => {
    fetch('/api/marketing/settings')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(apply)
      .catch(() => setLoadError('Não foi possível carregar as integrações.'));
  }, []);

  async function save() {
    if (!saved) return;
    const body: Record<string, unknown> = {};
    if (form.sheetId.trim() !== saved.sheetId) body.sheetId = form.sheetId;
    if (form.metaAdAccount.trim() !== saved.metaAdAccount) body.metaAdAccount = form.metaAdAccount;
    if (form.metaApiVersion.trim() !== saved.metaApiVersion) body.metaApiVersion = form.metaApiVersion;
    if (token.trim()) body.metaToken = token;
    const gids: Partial<Record<Tab, string>> = {};
    TABS.forEach(([t]) => { if ((form.gids[t] ?? '').trim() !== saved.gids[t]) gids[t] = form.gids[t]; });
    if (Object.keys(gids).length) body.gids = gids;
    if (!Object.keys(body).length) { setMsg({ ok: true, text: 'Nenhuma alteração para salvar.' }); return; }

    setSaving(true); setMsg(null);
    try {
      const r = await fetch('/api/marketing/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ ok: false, text: d.error || 'Erro ao salvar. Tente novamente.' }); return; }
      apply(d);
      setMsg({ ok: true, text: 'Integrações salvas.' });
    } catch {
      setMsg({ ok: false, text: 'Erro de conexão. Tente novamente.' });
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true); setResults(null);
    try {
      const r = await fetch('/api/marketing/settings?test=1', { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      setResults(r.ok ? d.results : [{ source: 'Teste', ok: false, message: d.error || `HTTP ${r.status}` }]);
    } catch {
      setResults([{ source: 'Teste', ok: false, message: 'Erro de conexão.' }]);
    } finally {
      setTesting(false);
    }
  }

  const set = (k: 'sheetId' | 'metaAdAccount' | 'metaApiVersion', v: string) => setForm(f => ({ ...f, [k]: v }));
  const setGid = (t: Tab, v: string) => setForm(f => ({ ...f, gids: { ...f.gids, [t]: v } }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Integrações de marketing</CardTitle>
        <CardDescription>Planilha e Meta Ads usados pelo painel de marketing. Valores salvos aqui têm prioridade sobre os da Vercel.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!saved ? (
          loadError
            ? <p role="alert" className="rounded-lg border border-border bg-destructive/10 px-3 py-2 text-xs text-destructive">{loadError}</p>
            : <Loader2 className="size-5 animate-spin text-primary" aria-label="Carregando" />
        ) : (
          <>
            <Field id="mkt-sheet-id" label="ID da planilha" hint={form.sheetId && (<>
              {saved.source.sheetId && `origem: ${sourceLabel(saved.source.sheetId)} · `}
              <a href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(form.sheetId.trim())}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline">
                Abrir planilha <ExternalLink className="size-3" />
              </a>
            </>)}>
              <Input id="mkt-sheet-id" value={form.sheetId} onChange={e => set('sheetId', e.target.value)} placeholder="1AbC…" autoComplete="off" spellCheck={false} />
            </Field>

            <Separator />

            <Field id="mkt-meta-token" label="Token de acesso do Meta">
              <div className="flex flex-wrap items-center gap-2">
                {saved.metaToken.configured ? (
                  <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                    Configurado · termina em ••••{saved.metaToken.last4} · origem: {sourceLabel(saved.metaToken.source)}
                  </Badge>
                ) : (
                  <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-500">Não configurado</Badge>
                )}
                {!replacing && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setReplacing(true)}>
                    {saved.metaToken.configured ? 'Substituir' : 'Adicionar'}
                  </Button>
                )}
              </div>
              {replacing && (
                <Input id="mkt-meta-token" type="password" value={token} onChange={e => setToken(e.target.value)}
                  placeholder="Cole o novo token (vazio = manter o atual)" autoComplete="new-password" spellCheck={false} />
              )}
            </Field>

            <Field id="mkt-ad-account" label="ID da conta de anúncios" hint={saved.source.metaAdAccount ? `origem: ${sourceLabel(saved.source.metaAdAccount)}` : undefined}>
              <Input id="mkt-ad-account" value={form.metaAdAccount} onChange={e => set('metaAdAccount', e.target.value)} placeholder="act_123456789" autoComplete="off" />
            </Field>

            <button type="button" onClick={() => setAdvanced(a => !a)} aria-expanded={advanced} aria-controls="mkt-advanced"
              className="flex items-center gap-1 self-start text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground">
              <ChevronRight className={`size-3.5 transition-transform ${advanced ? 'rotate-90' : ''}`} /> Avançado
            </button>
            {advanced && (
              <div id="mkt-advanced" className="flex flex-col gap-4 rounded-lg border border-border p-3">
                <div className="grid grid-cols-2 gap-3">
                  {TABS.map(([t, label]) => (
                    <Field key={t} id={`mkt-gid-${t}`} label={`gid · ${label}`}>
                      <Input id={`mkt-gid-${t}`} inputMode="numeric" value={form.gids[t] ?? ''} onChange={e => setGid(t, e.target.value)} />
                    </Field>
                  ))}
                </div>
                <Field id="mkt-api-version" label="Versão da API do Meta" hint="Ex.: v23.0">
                  <Input id="mkt-api-version" value={form.metaApiVersion} onChange={e => set('metaApiVersion', e.target.value)} />
                </Field>
              </div>
            )}

            {msg && (
              <p role={msg.ok ? 'status' : 'alert'}
                className={`rounded-lg border border-border px-3 py-2 text-xs ${msg.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
                {msg.text}
              </p>
            )}

            {results && (
              <ul className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/50 p-3" aria-label="Resultado do teste de conexão">
                {results.map(r => (
                  <li key={r.source} className="flex items-start gap-2 text-xs">
                    {r.ok
                      ? <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-400" aria-label="ok" />
                      : <X className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-label="falhou" />}
                    <span><span className="font-medium text-foreground">{r.source}</span> <span className="text-muted-foreground">— {r.message}</span></span>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" onClick={test} disabled={testing || saving}>
                {testing ? <><Loader2 className="size-4 animate-spin" /> Testando...</> : 'Testar conexão'}
              </Button>
              <Button type="button" onClick={save} disabled={saving || testing}>
                {saving ? <><Loader2 className="size-4 animate-spin" /> Salvando...</> : 'Salvar integrações'}
              </Button>
            </div>
            <p className="-mt-2 text-[11px] text-muted-foreground">O teste usa os valores já salvos e não grava nada.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
