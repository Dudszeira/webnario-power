'use client';

import { useState, type CSSProperties } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { MarketingView } from '@/lib/marketing/view';
import type { BuyerMatch } from '@/lib/marketing/matching';

const brl = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const int = (n: number) => n.toLocaleString('pt-BR');
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
// Custo sem investimento conhecido (ou etapa vazia) é "—", nunca R$ 0 nem Infinity.
const costOf = (spend: number, n: number) => (spend > 0 ? ratio(spend, n) : null);

const MIN_W = 24; // % — etapas pequenas continuam legíveis
// Rampa de um só tom: azul da marca (#2563eb) escurecendo a cada etapa; texto branco mantém contraste.
const tone = (i: number) => `oklch(${(0.56 - i * 0.03).toFixed(3)} ${(0.2 - i * 0.012).toFixed(3)} 264)`;

type Stage = {
  key: string; label: string; sub: string; value: number;
  cost: number | null; costLabel: string; people: BuyerMatch[] | null; note?: string;
};

function YesNo({ v }: { v: boolean }) {
  return v ? <span className="font-medium text-emerald-400">sim</span> : <span className="text-muted-foreground/70">não</span>;
}

function People({ stage }: { stage: Stage }) {
  if (!stage.people) return <p className="text-xs text-muted-foreground">{stage.note}</p>;
  if (!stage.people.length) return <p className="text-xs text-muted-foreground">Ninguém nesta etapa.</p>;
  const ht = stage.key === 'ht';
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-border">
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead>E-mail</TableHead>
            {ht && <TableHead>Produto</TableHead>}
            {ht && <TableHead className="text-right">Valor</TableHead>}
            <TableHead>Vínculo</TableHead><TableHead>Entrou</TableHead>
            <TableHead className="text-right">Minutos</TableHead><TableHead>Até o pitch</TableHead><TableHead>CTA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stage.people.map((b, i) => (
            <TableRow key={`${b.email}-${i}`}>
              <TableCell className="max-w-[220px] truncate" title={b.email}>{b.email || '—'}</TableCell>
              {ht && <TableCell>{b.product}</TableCell>}
              {ht && <TableCell className="text-right tabular-nums">{brl(b.amount)}</TableCell>}
              <TableCell className="text-muted-foreground">{b.matchedBy ?? 'sem vínculo'}</TableCell>
              <TableCell><YesNo v={b.entered} /></TableCell>
              <TableCell className="text-right tabular-nums">{b.minutesWatched}</TableCell>
              <TableCell><YesNo v={b.stayedToPitch} /></TableCell>
              <TableCell><YesNo v={b.clickedCta} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function LeadFunnel({ view }: { view: MarketingView }) {
  const [open, setOpen] = useState<string | null>(null);
  const { front: f, back: b } = view;
  const tk = view.buyers.filter(x => x.product === 'Ingresso');
  const ht = view.buyers.filter(x => x.product !== 'Ingresso');
  const entered = tk.filter(x => x.entered);
  const pitch = tk.filter(x => x.stayedToPitch);
  const whole = 'edição inteira';
  const sheetNote = 'A planilha traz só o total desta etapa, sem a lista de pessoas.';

  const stages: Stage[] = [
    { key: 'tickets', label: 'Ingressos vendidos', sub: view.range ? 'no período' : 'frente paga', value: f.sales, cost: costOf(f.spend, f.sales), costLabel: 'por ingresso', people: tk },
    { key: 'entered', label: 'Entraram na live', sub: 'compradores presentes', value: entered.length, cost: costOf(f.spend, entered.length), costLabel: 'por presente', people: entered },
    { key: 'pitch', label: 'Ficaram até o pitch', sub: 'compradores no pitch', value: pitch.length, cost: costOf(f.spend, pitch.length), costLabel: 'por pitch', people: pitch },
    { key: 'apps', label: 'Aplicações', sub: whole, value: b.applications, cost: costOf(view.fullSpend, b.applications), costLabel: 'por aplicação', people: null, note: sheetNote },
    { key: 'scheduled', label: 'Calls agendadas', sub: whole, value: b.scheduled, cost: b.costPerScheduled, costLabel: 'por agendada', people: null, note: sheetNote },
    { key: 'done', label: 'Calls realizadas', sub: whole, value: b.done, cost: b.costPerDone, costLabel: 'por realizada', people: null, note: sheetNote },
    { key: 'ht', label: 'Vendas high ticket', sub: brl(b.highTicketRevenue), value: b.highTicketSales, cost: costOf(view.fullSpend, b.highTicketSales), costLabel: 'por venda', people: ht },
  ];
  const max = stages.reduce((m, s) => Math.max(m, s.value), 0);
  const width = (v: number) => (max > 0 ? Math.max(MIN_W, (v / max) * 100) : MIN_W);
  const active = stages.filter(s => s.key === open)[0];

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-col gap-0.5 border-b border-border px-4 py-3">
        <p className="text-xs font-semibold">Jornada do lead</p>
        <p className="text-[11px] text-muted-foreground">
          Do ingresso à venda high ticket · clique numa etapa para ver quem está nela
          {view.range && ' · presença e ingressos no período; aplicações em diante cobrem a edição inteira'}
        </p>
      </div>

      <ol className="flex flex-col gap-1 p-2 sm:p-3">
        {stages.map((s, i) => {
          const wt = width(s.value);
          const next = stages[i + 1];
          const wb = next ? Math.min(wt, width(next.value)) : wt * 0.9;
          // Ingresso/presença seguem o período; aplicações em diante são da edição inteira.
          // Com período ativo, ou se a razão passar de 100%, as bases não se comparam: mostra "—".
          const BACK = 3; // índice de "Aplicações"
          const mixed = !!view.range && i >= BACK && i - 1 < BACK;
          const raw = i ? ratio(s.value, stages[i - 1].value) : null;
          const pass = mixed || (raw !== null && raw > 1) ? null : raw;
          const passTitle = i === 0 ? undefined : (mixed || (raw !== null && raw > 1))
            ? 'bases diferentes (período × edição inteira)' : `${s.label} ÷ ${stages[i - 1].label}`;
          const isOpen = open === s.key;
          return (
            <li key={s.key}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls="funnel-detail"
                onClick={() => setOpen(isOpen ? null : s.key)}
                className={`group grid w-full grid-cols-[7.25rem_minmax(0,1fr)_3.25rem] items-center gap-2 rounded-lg px-2 py-1 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/60 sm:grid-cols-[10rem_minmax(0,1fr)_16rem] sm:gap-4 ${isOpen ? 'bg-muted/50' : ''}`}
              >
                <span className="flex min-w-0 flex-col">
                  <span className={`text-xs font-medium leading-tight sm:truncate sm:text-sm ${isOpen ? 'text-foreground' : 'text-foreground/90'}`}>{s.label}</span>
                  <span className="text-[11px] leading-tight text-muted-foreground sm:truncate">{s.sub}</span>
                </span>
                <span
                  className="flex h-11 items-center justify-center text-sm font-semibold tabular-nums text-white transition-[filter] group-hover:brightness-110"
                  style={{
                    '--wt': `${wt}%`, '--wb': `${wb}%`, background: tone(i),
                    clipPath: 'polygon(calc(50% - var(--wt) / 2) 0, calc(50% + var(--wt) / 2) 0, calc(50% + var(--wb) / 2) 100%, calc(50% - var(--wb) / 2) 100%)',
                  } as CSSProperties}
                >
                  {int(s.value)}
                </span>
                <span className="flex items-center justify-end gap-2">
                  <span className="hidden min-w-0 truncate rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground sm:inline-block">
                    {s.cost === null ? '—' : `${brl(s.cost)} ${s.costLabel}`}
                  </span>
                  <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums text-foreground/90" title={passTitle}>
                    {i ? pct(pass) : 'topo'}
                  </span>
                  <ChevronDown aria-hidden className={`hidden size-3.5 shrink-0 text-muted-foreground transition-transform sm:block ${isOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div id="funnel-detail" role="region" aria-label="Detalhe da etapa" aria-live="polite">
        {active && (
          <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-semibold">{active.label} <span className="font-normal text-muted-foreground">· {int(active.value)}</span></p>
              <p className="text-[11px] text-muted-foreground">{active.cost === null ? 'custo —' : `${brl(active.cost)} ${active.costLabel}`}</p>
            </div>
            <People stage={active} />
          </div>
        )}
      </div>
    </Card>
  );
}
