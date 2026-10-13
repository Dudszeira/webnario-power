'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { STATUS_LABEL, type CatCounts, type CostRow, type DealStatus, type DealsTab as Data } from '@/lib/marketing/deals';
import { useTabData } from './useTabData';
import { BarList, Kpi, PeopleList, TabState, brl, dm, ed, int, kpiGrid, pct, ratio, sectionTitle, WarnNote, type Warned } from './ui';

const CATS: [Exclude<keyof CatCounts, 'total'>, string, string][] = [
  ['perdSem', 'perd. sem call', 'text-red-300'], ['perdCall', 'perd. após call', 'text-red-300'],
  ['andamento', 'em andamento', 'text-emerald-300'], ['ganho', 'ganho', 'text-amber-300'], ['aberto', 'em aberto', 'text-muted-foreground'],
];
const TONE = { red: 'bg-red-400', yellow: 'bg-amber-400', green: 'bg-emerald-400' };

function MomentCell({ c, total }: { c: CatCounts; total: number }) {
  if (!c.total) return <TableCell className="text-center text-muted-foreground">·</TableCell>;
  return (
    <TableCell className="text-center text-xs">
      <b className="tabular-nums">{c.total}</b> <span className="text-muted-foreground">{pct(ratio(c.total, total))}</span>
      <br />{CATS.filter(([k]) => c[k]).map(([k, l, cls]) => <span key={k} className={`mr-1 ${cls}`}>{c[k]} {l}</span>)}
    </TableCell>
  );
}

function CostCells({ r }: { r: CostRow }) {
  const nd = <span className="text-muted-foreground" title="Edição sem gasto oficial: fica fora do total">n/d</span>;
  const c = (v: number | null) => (r.spend === null ? nd : brl(v));
  return (
    <>
      <TableCell className="text-right tabular-nums">{r.spend === null ? nd : brl(r.spend)}</TableCell>
      <TableCell className="text-right tabular-nums">{r.n}</TableCell>
      <TableCell className="text-right tabular-nums text-amber-300">{r.power}</TableCell>
      <TableCell className="text-right tabular-nums text-sky-300">{r.start}</TableCell>
      <TableCell className="text-right font-semibold tabular-nums">{c(r.cost)}</TableCell>
      <TableCell className="text-right tabular-nums">{c(r.costPower)}</TableCell>
      <TableCell className="text-right tabular-nums">{c(r.costStart)}</TableCell>
    </>
  );
}

export default function DealsTab({ query }: { query: string }) {
  const { data: d, loading, error } = useTabData<Data & Warned>('agendamentos', query);
  if (!d) return <TabState loading={loading} error={error} />;
  const momentTotal = (m: { before: CatCounts; onDay: CatCounts; after: CatCounts }) => m.before.total + m.onDay.total + m.after.total;
  const statusBars = d.status.map(s => ({ key: STATUS_LABEL[s.key as DealStatus] ?? s.key, count: s.count }));
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <WarnNote warn={d.warn} />
      <section>
        <h2 className={sectionTitle}>Agendamentos (Pipedrive)</h2>
        <div className={kpiGrid}>
          <Kpi label="Agendamentos" value={int(d.total)} hint={`Power ${d.power} · Start ${d.start} · ${d.auto} automáticos · ${d.commercial} comercial`} />
          <Kpi label="Calls realizadas" value={int(d.realized)} hint={`${pct(d.attendance)} de comparecimento`} />
          <Kpi label="Não compareceram" value={int(d.noShow)} hint={`${pct(ratio(d.noShow, d.total))} dos agendamentos`} />
          <Kpi label="Aguardando" value={int(d.waiting)} hint={`call futura, reagendada ou sem registro${d.cancelled ? ` · ${d.cancelled} canceladas` : ''}`} />
          <Kpi label="Perdas" value={int(d.lost)} hint={d.lostByReason.map(r => `${r.key} ${r.count}`).join(' · ') || 'sem motivo registrado'} />
          <Kpi label="Ganhos" value={int(d.won)} hint={`${brl(d.wonRevenue)} · ${pct(d.wonRate)} das calls${d.refunded ? ` · ${d.refunded} reembolsados` : ''}`} />
          <Kpi label="Origem identificada" value={int(d.total)} hint={`${d.origin.planilha} planilha · ${d.origin.email} e-mail · ${d.origin.data} data · ${d.noEdition} sem edição`} />
          <Kpi label="Com alerta" value={int(d.alertCount)} hint="call >14 dias, antes do agendamento, sem registro ou sem closer" />
        </div>
      </section>

      <section>
        <h2 className={sectionTitle}>Quando agendaram × resultado</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Webinário</TableHead><TableHead className="text-center">Antes</TableHead><TableHead className="text-center">No dia</TableHead><TableHead className="text-center">Depois</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {d.moment.concat(d.moment.length > 1 ? [{ edition: 0, ...d.momentTotal }] : []).map(m => (
                <TableRow key={m.edition} className={m.edition === 0 ? 'font-semibold' : ''}>
                  <TableCell>{m.edition === 0 ? 'Total' : ed(m.edition)} <span className="text-muted-foreground">{momentTotal(m)}</span></TableCell>
                  <MomentCell c={m.before} total={momentTotal(m)} /><MomentCell c={m.onDay} total={momentTotal(m)} /><MomentCell c={m.after} total={momentTotal(m)} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className={sectionTitle}>Criativos que mais perdem agendamento <span className="font-normal normal-case tracking-normal">· 3+ agendamentos</span></h2>
        <p className="mb-2 text-xs text-muted-foreground">{int(d.lostBeforeCall)} de {int(d.total)} sumiram antes da call ({pct(ratio(d.lostBeforeCall, d.total))}).</p>
        {d.losingCreatives.length ? (
          <ul className="flex flex-col gap-2">
            {d.losingCreatives.map(c => (
              <li key={c.creative} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-2 text-xs sm:grid-cols-[14rem_3rem_minmax(0,1fr)_12rem]">
                <span className="truncate font-medium" title={c.creative}>{c.creative} <span className="font-normal text-muted-foreground">· {c.n} agend. · {c.calls} calls{c.won ? ` · ${c.won} ganhos` : ''}</span></span>
                <span className="text-right font-semibold tabular-nums">{pct(c.rate, 0)}</span>
                <span aria-hidden className="hidden h-2.5 rounded-full bg-muted sm:block"><span className={`block h-full rounded-full ${TONE[c.tone]}`} style={{ width: `${c.rate * 100}%` }} /></span>
                <span className="hidden text-right text-muted-foreground sm:inline">{c.noShow} no-show · {c.noInterest} sem int. · {c.cancelled} canc.</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-muted-foreground">Ainda não há criativo com 3 ou mais agendamentos.</p>}
      </section>

      <section>
        <h2 className={sectionTitle} title="Gasto e calls da edição inteira; o filtro de período não se aplica a esta tabela.">Custo por call por webinário <span className="font-normal normal-case tracking-normal text-muted-foreground">· edição inteira</span></h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Webinário</TableHead><TableHead className="text-right">Gasto oficial</TableHead><TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Power</TableHead><TableHead className="text-right">Start</TableHead><TableHead className="text-right">Por call</TableHead>
              <TableHead className="text-right">Por call Power</TableHead><TableHead className="text-right">Por call Start</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {d.costPerCall.rows.map(r => <TableRow key={r.edition ?? 'x'}><TableCell>{ed(r.edition as number)}</TableCell><CostCells r={r} /></TableRow>)}
              <TableRow className="font-semibold"><TableCell>Total (com gasto e calls)</TableCell><CostCells r={d.costPerCall.total} /></TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {([['Webinário de origem', d.byEdition], ['Como agendou', d.via], ['Closer', d.closer], ['Status', statusBars]] as [string, { key: string; count: number }[]][]).map(([t, xs]) => (
          <div key={t}><h2 className={sectionTitle}>{t}</h2><BarList items={xs} total={d.total} /></div>
        ))}
      </section>

      <PeopleList<Data> tab="agendamentos" query={query} title={`Tabela de agendamentos (${d.total})`} render={x => x.list && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Agendou</TableHead><TableHead>Call</TableHead><TableHead>Via</TableHead>
              <TableHead>Status</TableHead><TableHead>Closer</TableHead><TableHead>Produto</TableHead><TableHead>Renda</TableHead>
              <TableHead>Webinário</TableHead><TableHead>Criativo</TableHead><TableHead>Motivo da perda</TableHead><TableHead>Alertas</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {x.list.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.name || '—'}</TableCell><TableCell>{r.type || '—'}</TableCell>
                  <TableCell>{dm(r.scheduledAt)}</TableCell><TableCell>{dm(r.callDate)}</TableCell><TableCell>{r.via || '—'}</TableCell>
                  <TableCell>{STATUS_LABEL[r.status]}</TableCell><TableCell>{r.closer || '—'}</TableCell><TableCell>{r.product || '—'}</TableCell>
                  <TableCell>{r.income || '—'}</TableCell><TableCell>{r.edition === null ? '—' : ed(r.edition)}</TableCell>
                  <TableCell className="text-xs">{r.creative || '—'}</TableCell><TableCell className="text-red-300">{r.lostReason}</TableCell>
                  <TableCell className="text-xs text-amber-300">{r.alerts.join(' · ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )} />
    </div>
  );
}
