'use client';

import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ApiAgg, ApiTab as Data } from '@/lib/marketing/api-leads';
import { useTabData } from './useTabData';
import { BarList, DistChart, Kpi, TabState, brl, dm, int, kpiGrid, pct, ratio, sectionTitle } from './ui';

const bars = (xs: ApiAgg[]) => xs.map(x => ({ key: x.key, count: x.leads, note: `${x.qualified} qualif. (${pct(ratio(x.qualified, x.leads), 0)})` }));

export default function ApiTab({ query }: { query: string }) {
  const { data: d, loading, error } = useTabData<Data>('api', query);
  if (!d) return <TabState loading={loading} error={error} />;
  if (!d.leads) return <p className="py-12 text-center text-sm text-muted-foreground">Nenhum lead com utm_source = api nas edições selecionadas.</p>;
  const cell = (b: string, v: string) => d.matrix[`${b}|${v}`];
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <section>
        <h2 className={sectionTitle}>Leads via API (WhatsApp)</h2>
        <div className={kpiGrid}>
          <Kpi label="Leads via API" value={int(d.leads)} hint={`${pct(ratio(d.leads, d.totalLeads))} dos ${int(d.totalLeads)} leads${d.bestDay ? ` · melhor dia ${dm(d.bestDay.key)} (${d.bestDay.count})` : ''}`} />
          <Kpi label="Qualificados 5k+" value={int(d.qualified)} hint={`${pct(ratio(d.qualified, d.leads))} · ${d.responded} responderam`} />
          <Kpi label="Bases" value={int(d.bases.length)} hint={d.bases.slice(0, 3).map(b => `${b.key} ${b.leads}`).join(' · ')} />
          <Kpi label="Versões" value={int(d.versions.length)} hint={d.versions.map(v => `${v.key} ${v.leads}`).join(' · ')} />
          <Kpi label="Vendas" value={int(d.sales)} hint={d.sales ? brl(d.revenue) : 'nenhuma venda de lead da API'} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div><h2 className={sectionTitle}>Por base</h2><BarList items={bars(d.bases)} total={d.leads} /></div>
        <div><h2 className={sectionTitle}>Por versão</h2><BarList items={bars(d.versions)} total={d.leads} /></div>
        <div><h2 className={sectionTitle}>Por disparo</h2><BarList items={bars(d.shots)} total={d.leads} /></div>
      </section>

      <section>
        <h2 className={sectionTitle}>Base × versão <span className="font-normal normal-case tracking-normal">· leads (qualificados)</span></h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Base</TableHead>
              {d.versions.map(v => <TableHead key={v.key} className="text-center">{v.key}</TableHead>)}
              <TableHead className="text-center">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {d.bases.map(b => (
                <TableRow key={b.key}>
                  <TableCell className="font-medium">{b.key}</TableCell>
                  {d.versions.map(v => {
                    const c = cell(b.key, v.key);
                    return <TableCell key={v.key} className="text-center tabular-nums">{c ? <>{c.leads} <span className="text-emerald-400">({c.qualified})</span></> : <span className="text-muted-foreground">·</span>}</TableCell>;
                  })}
                  <TableCell className="text-center font-semibold tabular-nums">{b.leads} <span className="text-emerald-400">({b.qualified})</span></TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell>Total</TableCell>
                {d.versions.map(v => <TableCell key={v.key} className="text-center tabular-nums">{v.leads} <span className="text-emerald-400">({v.qualified})</span></TableCell>)}
                <TableCell className="text-center tabular-nums">{d.leads} <span className="text-emerald-400">({d.qualified})</span></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      <Card className="p-4">
        <h2 className={sectionTitle}>Leads via API por dia</h2>
        <DistChart data={d.byDay.map(x => ({ label: dm(x.key), count: x.count }))} label="Leads" />
      </Card>
    </div>
  );
}
