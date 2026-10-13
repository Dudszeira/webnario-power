'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { MarketingView } from '@/lib/marketing/view';
import LeadFunnel from './LeadFunnel';
import type { EdicaoTab } from '@/lib/marketing/tabs';
import { editionKind } from '@/lib/marketing/editions';
import { FullFunnelTable, WebinarTableView } from './EditionExtras';
import { useTabData } from './useTabData';

const brl = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const dec = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card size="sm" className="h-full gap-1 px-3">
      <p className="truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground" title={label}>{label}</p>
      <p className="text-xl font-semibold leading-tight tabular-nums">{value}</p>
      <p className="truncate text-[11px] text-muted-foreground" title={hint}>{hint ?? ' '}</p>
    </Card>
  );
}

const sectionTitle = 'mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground';
const grid = 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6';

function CopyButton({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button size="sm" variant="outline" disabled={!text} onClick={async () => {
      await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500);
    }}>{done ? 'Copiado' : label}</Button>
  );
}

export default function EditionTab({ view, onSaved, query }: { view: MarketingView; onSaved: () => void; query: string }) {
  const { front: f, back: b } = view;
  const cfg = view.editions.find(e => e.number === view.selected[0]);
  const [saveError, setSaveError] = useState('');
  const [goals, setGoals] = useState({ cpaDream: cfg?.cpaDream ?? 25, cpaGood: cfg?.cpaGood ?? 35, cpaLimit: cfg?.cpaLimit ?? 45 });
  const { data: extra, error: extraError } = useTabData<EdicaoTab>('edicao', query);
  // Edições NF10K (#015–#020) não vendiam ingresso: métricas só do pago mostram "não se aplica".
  const ticket = view.selected.some(n => editionKind(n) === 'pago');
  const na = 'não se aplica';
  const pending = <p role={extraError ? 'alert' : undefined} className={`text-xs ${extraError ? 'text-red-400' : 'text-muted-foreground'}`}>{extraError || 'Carregando…'}</p>;

  return (
    <div className="flex flex-col gap-6">
      {/* O funil espera o complemento (linhas do Typeform/Pipedrive) para não trocar de etapas na frente da pessoa;
          se o complemento falhar, cai para os totais da Visão Geral. */}
      {extra || extraError
        ? <LeadFunnel view={view} funnel={extra ? extra.funnel : null} ticketApplies={ticket} />
        : <p className="py-6 text-center text-xs text-muted-foreground">Carregando funil…</p>}

      <section>
        <h2 className={sectionTitle}>Frente — ingresso</h2>
        <div className={grid}>
          <Kpi label="Vendas" value={ticket ? String(f.sales) : na} hint={ticket ? brl(f.revenue) : 'edições NF10K não vendiam ingresso'} />
          <Kpi label="Investimento" value={f.spendSource === 'nenhum' ? '—' : brl(f.spend)} hint={f.spendSource === 'meta' ? 'fonte: Meta' : f.spendSource === 'planilha' ? 'fonte: planilha (sem Meta)' : 'sem dados de investimento'} />
          <Kpi label="ROAS" value={ticket ? dec(f.roas) : na} />
          <Kpi label="CPA da campanha" value={ticket ? brl(f.cpa) : na} hint={ticket ? `só anúncios que venderam: ${brl(f.cpaSellingAds)}` : undefined} />
          <Kpi label="IC (pixel)" value={ticket ? String(f.ic) : na} hint={ticket ? `${brl(f.costPerIc)} cada — sinal, não é venda` : undefined} />
          <Kpi label="Gasto sem venda" value={!ticket ? na : f.spendSource === 'meta' ? brl(f.spendNoSales) : '—'} hint={ticket && f.topNoSale ? `maior: ${f.topNoSale.family} (${brl(f.topNoSale.spend)})` : undefined} />
        </div>
      </section>

      <section>
        <h2 className={sectionTitle}>Fundo — high ticket <span className="font-normal normal-case tracking-normal">(edição inteira)</span></h2>
        <div className={grid}>
          <Kpi label="Aplicações" value={String(b.applications)} />
          <Kpi label="Calls agendadas" value={String(b.scheduled)} hint={`custo: ${brl(b.costPerScheduled)}`} />
          <Kpi label="Calls realizadas" value={String(b.done)} hint={`custo: ${brl(b.costPerDone)}`} />
          <Kpi label="Vendas high ticket" value={String(b.highTicketSales)} hint={brl(b.highTicketRevenue)} />
          <Kpi label="ROAS total" value={dec(b.roasTotal)} hint="ingresso + high ticket ÷ investimento" />
        </div>
      </section>

      <section>
        <h2 className={sectionTitle}>Webinário a webinário <span className="font-normal normal-case tracking-normal">(edição inteira)</span></h2>
        {extra ? <WebinarTableView data={extra.webinars} /> : pending}
      </section>

      <section>
        <h2 className={sectionTitle}>Funil completo (Meta + planilha de UTMs)</h2>
        {extra ? <FullFunnelTable data={extra.fullFunnel} /> : pending}
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Copiar report</h2>
        <CopyButton label="Report da edição" text={view.reports.edition} />
        <CopyButton label="Fechamento de ontem" text={view.reports.daily} />
        <CopyButton label="Análise 1-3-7" text={view.reports.w137} />
      </section>

      {cfg && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Metas de CPA — #{String(cfg.number).padStart(3, '0')}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            {(['cpaDream', 'cpaGood', 'cpaLimit'] as const).map(k => (
              <label key={k} className="flex flex-col gap-1 text-xs text-muted-foreground">
                {k === 'cpaDream' ? 'Dos sonhos' : k === 'cpaGood' ? 'Bom' : 'Limite'}
                <input type="number" step="0.01" min="0" className="h-8 w-28 rounded-md border border-border bg-transparent px-2 text-sm text-foreground"
                  value={goals[k]} onChange={e => setGoals({ ...goals, [k]: Number(e.target.value) })} />
              </label>
            ))}
            <Button size="sm" onClick={async () => {
              setSaveError('');
              try {
                const res = await fetch('/api/marketing/config', { method: 'POST', body: JSON.stringify({ edition: { number: cfg.number, liveDate: cfg.liveDate, ...goals } }) });
                if (res.ok) onSaved(); else setSaveError('Não foi possível salvar');
              } catch { setSaveError('Não foi possível salvar'); }
            }}>Salvar metas</Button>
            {saveError && <p role="alert" className="text-xs text-red-400">{saveError}</p>}
            <p className="text-xs text-muted-foreground">Janela de captação: {cfg.windowStart} a {cfg.windowEnd}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
