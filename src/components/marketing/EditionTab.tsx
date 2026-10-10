'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { MarketingView } from '@/lib/marketing/view';

const brl = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const dec = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function CopyButton({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button size="sm" variant="outline" disabled={!text} onClick={async () => {
      await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500);
    }}>{done ? 'Copiado' : label}</Button>
  );
}

export default function EditionTab({ view, onSaved }: { view: MarketingView; onSaved: () => void }) {
  const { front: f, back: b } = view;
  const cfg = view.editions.find(e => e.number === view.selected[0]);
  const [goals, setGoals] = useState({ cpaDream: cfg?.cpaDream ?? 25, cpaGood: cfg?.cpaGood ?? 35, cpaLimit: cfg?.cpaLimit ?? 45 });

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-medium">Frente — ingresso</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Vendas" value={String(f.sales)} hint={brl(f.revenue)} />
          <Kpi label="Investimento" value={brl(f.spend)} hint={f.spendSource === 'meta' ? 'fonte: Meta' : f.spendSource === 'planilha' ? 'fonte: planilha (sem Meta)' : 'sem dados de investimento'} />
          <Kpi label="ROAS" value={dec(f.roas)} />
          <Kpi label="CPA da campanha" value={brl(f.cpa)} hint={`só anúncios que venderam: ${brl(f.cpaSellingAds)}`} />
          <Kpi label="IC (pixel)" value={String(f.ic)} hint={`${brl(f.costPerIc)} cada — sinal, não é venda`} />
          <Kpi label="Gasto sem venda" value={brl(f.spendNoSales)} hint={f.topNoSale ? `maior: ${f.topNoSale.family} (${brl(f.topNoSale.spend)})` : undefined} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Fundo — high ticket</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Aplicações" value={String(b.applications)} />
          <Kpi label="Calls agendadas" value={String(b.scheduled)} hint={`custo: ${brl(b.costPerScheduled)}`} />
          <Kpi label="Calls realizadas" value={String(b.done)} hint={`custo: ${brl(b.costPerDone)}`} />
          <Kpi label="Vendas high ticket" value={String(b.highTicketSales)} hint={brl(b.highTicketRevenue)} />
          <Kpi label="ROAS total" value={dec(b.roasTotal)} hint="ingresso + high ticket ÷ investimento" />
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-sm font-medium">Copiar report</h2>
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
              await fetch('/api/marketing/config', { method: 'POST', body: JSON.stringify({ edition: { number: cfg.number, windowStart: cfg.windowStart, windowEnd: cfg.windowEnd, ticketPrice: cfg.ticketPrice, ...goals } }) });
              onSaved();
            }}>Salvar metas</Button>
            <p className="text-xs text-muted-foreground">Janela de captação: {cfg.windowStart} a {cfg.windowEnd}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
