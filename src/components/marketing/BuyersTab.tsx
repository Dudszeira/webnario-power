'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { BuyersTab as Data } from '@/lib/marketing/sales';
import { ChallengesView } from './SurveyTab';
import { useTabData } from './useTabData';
import { BarList, Kpi, PeopleList, TabState, dm, ed, int, kpiGrid, pct, ratio, sectionTitle } from './ui';

const FILTERS: [string, string][] = [['todos', 'Todos'], ['power', 'Power'], ['powerStart', 'Power Start'], ['desafio', 'Desafio']];

export default function BuyersTab({ query }: { query: string }) {
  const [produto, setProduto] = useState('todos');
  const extra = `&produto=${produto}`;
  const { data: d, loading, error } = useTabData<Data>('compradores', query, extra);
  if (!d) return <TabState loading={loading} error={error} />;
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <div role="group" aria-label="Produto" className="inline-flex h-8 w-fit items-center rounded-lg border border-border bg-input/20 p-0.5">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={produto === k} onClick={() => setProduto(k)}
            className={`h-7 rounded-md px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 ${produto === k ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>
        ))}
      </div>

      <section>
        <h2 className={sectionTitle}>Compradores × pesquisa</h2>
        <div className={kpiGrid}>
          <Kpi label="Compradores" value={int(d.buyers)} hint={`${d.responded} responderam a pesquisa (${pct(ratio(d.responded, d.buyers), 0)})`} />
          <Kpi label="Qualificados 5k+" value={int(d.qualified)} hint={`${pct(ratio(d.qualified, d.responded), 0)} dos respondentes`} />
          <Kpi label="Renda mais comum" value={d.topIncome ? d.topIncome.key : '—'} hint={d.topIncome ? `${d.topIncome.count} compradores` : undefined} why="Nenhum comprador respondeu" />
          <Kpi label="Serviço mais comum" value={d.topService ? d.topService.key : '—'} hint={d.topService ? `${d.topService.count} compradores` : undefined} why="Nenhum comprador respondeu" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {([['Renda familiar', d.profile.renda], ['Faturamento com fotografia', d.profile.fat], ['Tempo de fotografia', d.profile.tempo], ['Serviço carro-chefe', d.profile.servico]] as [string, { key: string; count: number }[]][]).map(([t, xs]) => (
          <div key={t}><h2 className={sectionTitle}>{t}</h2><BarList items={xs} total={d.responded} empty="Nenhum comprador respondeu." /></div>
        ))}
      </section>

      <section>
        <h2 className={sectionTitle}>Desafios dos compradores</h2>
        <ChallengesView data={d.challenges} />
      </section>

      <PeopleList<Data> tab="compradores" query={query} extra={extra} title={`Lista de compradores (${d.buyers})`} render={x => x.list && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Webinário</TableHead><TableHead>Produto</TableHead><TableHead>Data</TableHead>
              <TableHead>Renda</TableHead><TableHead>Fat. mensal</TableHead><TableHead>Tempo de foto</TableHead><TableHead>Serviço</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {x.list.map((b, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{b.name || '—'}</TableCell>
                  <TableCell>{b.edition === null ? '—' : ed(b.edition)}</TableCell>
                  <TableCell>{b.product || '—'}</TableCell>
                  <TableCell>{dm(b.at)}</TableCell>
                  <TableCell className={b.qualified ? 'font-semibold text-emerald-400' : ''}>{b.income || '—'}</TableCell>
                  <TableCell>{b.revenue || '—'}</TableCell><TableCell>{b.tempo || '—'}</TableCell><TableCell>{b.servico || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )} />
    </div>
  );
}
