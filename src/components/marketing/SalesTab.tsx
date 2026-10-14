'use client';

import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AUDIENCES, type SaleListItem, type SalesTab as Data } from '@/lib/marketing/sales';
import { useTabData } from './useTabData';
import { BarList, DistChart, Kpi, PeopleList, TabState, brl, dm, ed, int, kpiGrid, pct, sectionTitle } from './ui';

export default function SalesTab({ query }: { query: string }) {
  const { data: d, loading, error } = useTabData<Data>('vendas', query);
  if (!d) return <TabState loading={loading} error={error} />;
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <section>
        <h2 className={sectionTitle}>Vendas high ticket (Detalhamento Vendas)</h2>
        <div className={kpiGrid}>
          <Kpi label="Vendas aprovadas" value={int(d.sales)} hint={`${d.refunds} reembolsos fora da conta`} />
          <Kpi label="Faturamento" value={brl(d.revenue)} hint="ticket da planilha (vazio = ticket padrão)" />
          <Kpi label="Ticket médio" value={brl(d.avgTicket)} why="Sem vendas na seleção" />
          <Kpi label="Conversão geral" value={pct(d.conversion, 2)} hint={`${d.sales} vendas em ${int(d.leads)} leads`} why="Sem leads na seleção" />
        </div>
      </section>

      <section>
        <h2 className={sectionTitle}>Por público <span className="font-normal normal-case tracking-normal">· UTM de captação (passe o mouse para a regra)</span></h2>
        <div className="grid gap-3 [&>*]:min-w-0 sm:grid-cols-2 xl:grid-cols-3">
          {d.audiences.map(a => (
            <Card key={a.key} size="sm" className="gap-2 px-4" title={`Regra: ${a.rule}\n\nTop campanhas:\n${a.topCampaigns.map(c => `${c.count}× ${c.key}`).join('\n')}`}>
              <p className="text-xs font-semibold">{a.label}</p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Leads</dt><dd className="text-right tabular-nums">{int(a.leads)}</dd>
                <dt className="text-muted-foreground">Vendas</dt><dd className="text-right tabular-nums">{int(a.sales)}</dd>
                <dt className="text-muted-foreground">Conversão</dt><dd className="text-right tabular-nums" title={a.conversion === null ? 'Sem leads deste público' : undefined}>{pct(a.conversion, 2)}</dd>
                <dt className="text-muted-foreground">Faturamento</dt><dd className="text-right tabular-nums">{brl(a.revenue)}</dd>
                {a.refunds > 0 && <><dt className="text-red-300">Reembolsos</dt><dd className="text-right tabular-nums text-red-300">{a.refunds}</dd></>}
              </dl>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-2">
        <div><h2 className={sectionTitle}>Por produto</h2><BarList items={d.byProduct} total={d.sales} /></div>
        <Card className="p-4"><h2 className={sectionTitle}>Vendas por dia</h2><DistChart data={d.byDay.map(x => ({ label: dm(x.key), count: x.count }))} label="Vendas" /></Card>
        <div><h2 className={sectionTitle}>Origem do lead (captação)</h2><BarList items={d.leadOrigin} total={d.sales} /></div>
        <div><h2 className={sectionTitle}>Origem da compra</h2><BarList items={d.purchaseOrigin} total={d.sales} /></div>
      </section>

      <PeopleList<Data> tab="vendas" query={query} title="Vendas por público (nomes)" render={x => x.lists && (
        <div className="flex flex-col gap-4">
          {AUDIENCES.map(a => {
            const list: SaleListItem[] = (x.lists && x.lists[a.key]) || [];
            if (!list.length) return null;
            return (
              <div key={a.key}>
                <p className="mb-1 text-xs font-semibold">{a.label} ({list.length})</p>
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Webinário</TableHead><TableHead>Produto</TableHead><TableHead>source · medium · campaign</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {list.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{s.name || '—'}</TableCell>
                        <TableCell>{s.edition === null ? '—' : ed(s.edition)}</TableCell>
                        <TableCell>{s.product || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{[s.capSource, s.capMedium, s.capCampaign].map(v => v || '(sem)').join(' · ')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )} />
    </div>
  );
}
