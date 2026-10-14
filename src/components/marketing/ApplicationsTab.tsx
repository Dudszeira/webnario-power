'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AppAgg, ApplicationsTab as Data } from '@/lib/marketing/applications';
import { useTabData } from './useTabData';
import { BarList, Kpi, PeopleList, TabState, dm, ed, int, kpiGrid, pct, ratio, sectionTitle } from './ui';

const bars = (xs: AppAgg[]) => xs.map(x => ({ key: x.key, count: x.count, note: `${x.qualified} qualif.` }));
const Q_TONE: Record<string, string> = { Power: 'text-amber-300', Start: 'text-sky-300', Desafio: 'text-red-300' };

export default function ApplicationsTab({ query }: { query: string }) {
  const { data: d, loading, error } = useTabData<Data>('aplicacoes', query);
  if (!d) return <TabState loading={loading} error={error} />;
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <section>
        <h2 className={sectionTitle}>Aplicações (Typeform)</h2>
        <div className={kpiGrid}>
          <Kpi label="Completas" value={int(d.complete)} hint={`${d.repeats} repetidas · ${d.incomplete} não terminaram`} />
          <Kpi label="Qualificadas" value={int(d.qualified)} hint={`${pct(ratio(d.qualified, d.complete))} · Power ${d.power} · Start ${d.start}`} />
          <Kpi label="Não qualificadas" value={int(d.desafio)} hint={`${pct(ratio(d.desafio, d.complete))} · perfil Desafio`} />
          <Kpi label="Agendaram no formulário" value={int(d.scheduled)} hint={`${d.interestYes} com interesse na mentoria`} />
          <Kpi label="Sem edição" value={int(d.noEdition)} hint="sem e-mail na captação nem data" />
        </div>
      </section>

      <section>
        <h2 className={sectionTitle}>Origem</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {d.originGroups.map(g => (
            <span key={g.key} className="rounded-md border border-border px-2 py-1 text-xs">
              <b className="tabular-nums">{g.count}</b> {g.key} <span className="text-muted-foreground">· {g.qualified} qualif.</span>
            </span>
          ))}
        </div>
        <BarList items={bars(d.origins)} total={d.complete} />
      </section>

      <section>
        <h2 className={sectionTitle}>Por webinário</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Webinário</TableHead><TableHead className="text-right">Completas</TableHead><TableHead className="text-right">Qualificadas</TableHead>
              <TableHead className="text-center">Power · Start · Desafio</TableHead><TableHead className="text-right">Agendaram</TableHead>
              <TableHead className="text-right">Não terminaram</TableHead><TableHead>Principal origem</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {d.byEdition.map(r => (
                <TableRow key={r.edition}>
                  <TableCell className="font-medium">{ed(r.edition)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.complete}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.qualified} <span className="text-muted-foreground">{pct(ratio(r.qualified, r.complete))}</span></TableCell>
                  <TableCell className="text-center tabular-nums"><span className="text-amber-300">{r.power}</span> · <span className="text-sky-300">{r.start}</span> · <span className="text-red-300">{r.desafio}</span></TableCell>
                  <TableCell className="text-right tabular-nums">{r.scheduled}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.incomplete || '·'}</TableCell>
                  <TableCell className="text-muted-foreground">{r.topOrigin ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-3">
        {([['Renda mensal', d.profile.income], ['Faturamento com fotografia', d.profile.revenue], ['Relação com a fotografia', d.profile.relation]] as [string, AppAgg[]][]).map(([t, xs]) => (
          <div key={t}><h2 className={sectionTitle}>{t}</h2><BarList items={bars(xs)} total={d.complete} /></div>
        ))}
      </section>

      <PeopleList<Data> tab="aplicacoes" query={query} title={`Lista de aplicações (${d.complete})`} render={x => x.list && (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Quando</TableHead><TableHead>Nome</TableHead><TableHead>Origem</TableHead><TableHead>Relação</TableHead>
                <TableHead>Faturamento</TableHead><TableHead>Renda</TableHead><TableHead>Perfil</TableHead><TableHead>Agendou</TableHead>
                <TableHead title="* = atribuída pela data, sem e-mail na captação">Webinário</TableHead><TableHead>Criativo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {x.list.complete.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{a.at ? `${dm(a.at)} ${a.at.slice(11, 16)}` : '(sem data)'}</TableCell>
                    <TableCell className="font-medium">{a.name || '—'}{a.repeats > 0 && <span className="ml-1 text-muted-foreground">×{a.repeats + 1}</span>}</TableCell>
                    <TableCell>{a.origin}</TableCell>
                    <TableCell className="max-w-[14rem] truncate" title={a.relation}>{a.relation || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{a.revenue || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{a.income || '—'}</TableCell>
                    <TableCell className={`font-semibold ${Q_TONE[a.qualif] ?? 'text-muted-foreground'}`}>{a.qualif || '·'}</TableCell>
                    <TableCell>{a.scheduled ? <span className="text-emerald-400">sim</span> : '·'}</TableCell>
                    <TableCell>{a.edition === null ? '—' : `${ed(a.edition)}${a.editionByEmail ? '' : '*'}`}</TableCell>
                    <TableCell className="text-xs">{a.creative || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {x.list.incomplete.length > 0 && (
            <p className="text-xs text-muted-foreground">Começaram e não terminaram ({x.list.incomplete.length}): {x.list.incomplete.join(', ')}</p>
          )}
        </div>
      )} />
    </div>
  );
}
