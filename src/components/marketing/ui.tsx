'use client';

import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { useTabData } from './useTabData';

// Número sem fonte é "—" (com explicação no hover), nunca 0.
export const brl = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
export const int = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR'));
export const dec = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
export const pct = (n: number | null, digits = 1) => (n === null ? '—' : `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`);
export const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
export const ed = (n: number) => `#${String(n).padStart(3, '0')}`;
export const dm = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '—');
export function mins(n: number | null): string {
  if (n === null) return '—';
  const m = Math.round(n);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min` : `${m} min`;
}
export const sectionTitle = 'mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground';
// 1 coluna no celular, 2 no tablet, 3 no notebook, 6 em tela larga.
export const kpiGrid = 'grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6';

export function Kpi({ label, value, hint, why }: { label: string; value: string; hint?: string; why?: string }) {
  const missing = value === '—';
  return (
    <Card size="sm" className="h-full min-w-0 gap-1 px-3">
      <p className="truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground" title={label}>{label}</p>
      <p className="truncate text-xl font-semibold leading-tight tabular-nums" title={missing ? why ?? 'Sem dado na fonte para esta seleção' : value}>{value}</p>
      <p className="truncate text-[11px] text-muted-foreground" title={hint}>{hint ?? ' '}</p>
    </Card>
  );
}

// Fontes opcionais sem dados (`warn` vem do servidor): as colunas que dependem delas mostram "—".
export type Warned = { warn?: string[] };
export function WarnNote({ warn }: Warned) {
  if (!warn || !warn.length) return null;
  return <p role="status" className="text-[11px] text-amber-300">Sem dados de: {warn.join(', ')} — colunas dependentes mostram —</p>;
}

export function TabState({ loading, error }: { loading: boolean; error: string }) {
  return (
    <p role={error ? 'alert' : undefined} className={`py-12 text-center text-sm ${error ? 'text-red-400' : 'text-muted-foreground'}`}>
      {error || (loading ? 'Carregando…' : 'Sem dados para mostrar.')}
    </p>
  );
}

export function BarList({ items, total, empty = 'Sem dados.' }: { items: { key: string; count: number; note?: string }[]; total: number; empty?: string }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">{empty}</p>;
  const max = items.reduce((m, x) => Math.max(m, x.count), 1);
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map(x => (
        <li key={x.key} className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 text-xs sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_5rem_minmax(0,7rem)]">
          <span className="truncate" title={x.key}>{x.key}</span>
          <span aria-hidden className="hidden h-2.5 rounded-full bg-muted sm:block">
            <span className="block h-full rounded-full bg-primary/70" style={{ width: `${(x.count / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums"><b>{int(x.count)}</b> <span className="text-muted-foreground">{pct(ratio(x.count, total))}</span></span>
          <span className="hidden truncate text-muted-foreground sm:inline" title={x.note}>{x.note ?? ''}</span>
        </li>
      ))}
    </ul>
  );
}

export function DistChart({ data, label = 'Quantidade', colorOf }: { data: { label: string; count: number }[]; label?: string; colorOf?: (i: number) => string }) {
  if (!data.length) return <p className="text-xs text-muted-foreground">Sem dados.</p>;
  const config = { count: { label, color: 'oklch(var(--chart-1))' } } satisfies ChartConfig;
  const tilt = data.length > 6;
  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <BarChart data={data} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }}
          angle={tilt ? -30 : 0} textAnchor={tilt ? 'end' : 'middle'} height={tilt ? 56 : 24} />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="count" radius={4} fill="var(--color-count)">
          {colorOf && data.map((_, i) => <Cell key={i} fill={colorOf(i)} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// Dados pessoais só aqui: a lista é pedida com &lists=1 quando a seção é aberta.
export function PeopleList<T>({ tab, query, extra = '', title, render }: { tab: string; query: string; extra?: string; title: string; render: (data: T) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data, loading, error } = useTabData<T>(tab, query, `${extra}&lists=1`, open);
  return (
    <details className="rounded-lg border border-border" onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</summary>
      <div className="max-h-[32rem] overflow-auto border-t border-border p-3">
        {error ? <p role="alert" className="text-xs text-red-400">{error}</p>
          : loading || !data ? <p className="text-xs text-muted-foreground">Carregando…</p>
          : render(data)}
      </div>
    </details>
  );
}
