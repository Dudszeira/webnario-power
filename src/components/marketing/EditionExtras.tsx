'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WebinarTable } from '@/lib/marketing/breakdowns';
import { FUNNEL_ROWS, type FullFunnel } from '@/lib/marketing/full-funnel';
import { brl, dec, dm, ed, int, pct, ratio } from './ui';

const NO_LIVE = 'Sem presença registrada na plataforma';

export function WebinarTableView({ data }: { data: WebinarTable }) {
  const rows = data.total ? data.rows.concat(data.total) : data.rows;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Webinário</TableHead><TableHead className="text-right">Leads</TableHead><TableHead className="text-right">Agendamentos</TableHead>
          <TableHead className="text-center" title="dia do agendamento × dia da live">Antes · no dia · depois</TableHead>
          <TableHead className="text-right" title="utm_content do negócio começa com api (ou 197) ou utm_source = api">Via API</TableHead>
          <TableHead className="text-right">Calls feitas</TableHead><TableHead className="text-right">Vendas</TableHead>
          <TableHead className="text-right" title="plataforma (oficial) · Visão Geral entre parênteses">Pico</TableHead>
          <TableHead className="text-right">Comparecimento</TableHead><TableHead className="text-right">Até o pitch</TableHead>
          <TableHead className="text-right" title="aplicações completas entre 20h da live e 6h do dia seguinte ÷ pessoas no pitch">Conversão ao vivo</TableHead>
          <TableHead className="text-right">Aplicações</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.edition ?? 'total'} className={r.edition === null ? 'font-semibold' : ''}>
              <TableCell>{r.edition === null ? 'Total' : ed(r.edition)}</TableCell>
              <TableCell className="text-right tabular-nums">{int(r.leads)}</TableCell>
              <TableCell className="text-right tabular-nums">{int(r.scheduled)} <span className="text-muted-foreground">{pct(ratio(r.scheduled, r.leads), 2)}</span></TableCell>
              <TableCell className="text-center tabular-nums"><span className="text-red-300">{r.before}</span> · <span className="text-amber-300">{r.onDay}</span> · <span className="text-emerald-300">{r.after}</span></TableCell>
              <TableCell className="text-right tabular-nums text-amber-300">{int(r.viaApi)}</TableCell>
              <TableCell className="text-right tabular-nums">{int(r.calls)} <span className="text-muted-foreground">{pct(ratio(r.calls, r.scheduled))}</span></TableCell>
              <TableCell className="text-right tabular-nums">{int(r.sales)}{r.revenue > 0 && <span className="text-muted-foreground"> {brl(r.revenue)}</span>}</TableCell>
              <TableCell className="text-right tabular-nums" title={r.peak === null ? (r.edition === null ? 'Pico não soma entre lives' : NO_LIVE) : undefined}>{int(r.peak)}{r.sheetPeak !== null && <span className="text-muted-foreground" title="Pico digitado na Visão Geral (referência)"> ({int(r.sheetPeak)})</span>}</TableCell>
              <TableCell className="text-right tabular-nums" title={r.attendance === null ? (r.edition === null ? 'Comparecimento não soma entre lives' : 'Sem Visão Geral nem presença') : r.attendanceFromSheet ? 'Visão Geral' : 'pico ÷ leads (Visão Geral vazia)'}>
                {r.attendance === null ? '—' : `${r.attendance.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
              </TableCell>
              <TableCell className="text-right tabular-nums" title={r.toPitch === null ? NO_LIVE : undefined}>{int(r.toPitch)}</TableCell>
              <TableCell className="text-right tabular-nums" title={r.liveConversion === null ? 'Sem pessoas no pitch para dividir' : undefined}>
                {r.liveConversion === null ? '—' : <>{pct(r.liveConversion)} <span className="text-muted-foreground">({r.liveApps})</span></>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{int(r.applications)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function fmt(format: 'int' | 'money' | 'pct' | 'dec', n: number | null): string {
  if (n === null) return '—';
  return format === 'money' ? brl(n) : format === 'pct' ? pct(n, 2) : format === 'dec' ? dec(n) : int(n);
}

export function FullFunnelTable({ data }: { data: FullFunnel }) {
  const c = data.compare;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-muted-foreground">
        Campanhas com “{data.filter || 'qualquer nome'}” · coluna = edição inteira (inclui o dia da live)
        {c && ` · variação ${ed(c.prev)}→${ed(c.cur)} nos mesmos ${c.cutDays} dias de captação (${dm(c.prevRange.from)}–${dm(c.prevRange.to)} × ${dm(c.curRange.from)}–${dm(c.curRange.to)}): ${ed(c.prev)} ${c.prevSales} · ${ed(c.cur)} ${c.curSales} vendas`}
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Métrica</TableHead>
            {data.columns.map(col => (
              <TableHead key={col.edition} className="text-right">{ed(col.edition)} <span className="font-normal text-muted-foreground">{dm(col.from)}–{dm(col.to)}</span></TableHead>
            ))}
            <TableHead className="text-right">Variação</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {FUNNEL_ROWS.map(r => {
              const d = c ? c.deltas[r.key] ?? null : null;
              const why = !c ? 'Selecione duas edições (a mais recente com ao menos 1 dia de captação)'
                : (r.key === 'reach' || r.key === 'frequency') && !c.reachComparable ? 'Alcance não soma por dia: só compara edições encerradas com janelas de mesma duração'
                : 'Sem base para comparar';
              const good = d === null || d === 0 || r.better === null ? null : (r.better === 'up') === (d > 0);
              return (
                <TableRow key={r.key}>
                  <TableCell>{r.label}</TableCell>
                  {data.columns.map(col => {
                    const v = col.metrics[r.key];
                    return <TableCell key={col.edition} className="text-right tabular-nums" title={v === null ? 'Sem dado do Meta para esta janela' : undefined}>{fmt(r.format, v)}</TableCell>;
                  })}
                  <TableCell className={`text-right tabular-nums ${good === null ? '' : good ? 'text-emerald-400' : 'text-red-400'}`} title={d === null ? why : undefined}>
                    {d === null ? '—' : `${d > 0 ? '+' : ''}${(d * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
