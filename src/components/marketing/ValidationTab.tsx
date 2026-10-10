'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import type { MarketingView } from '@/lib/marketing/view';

export default function ValidationTab({ view }: { view: MarketingView }) {
  const ht = view.buyers.filter(b => b.product !== 'Ingresso');
  const tk = view.buyers.filter(b => b.product === 'Ingresso');
  const share = (list: typeof ht, pred: (b: (typeof ht)[number]) => boolean) =>
    list.length ? `${list.filter(pred).length} de ${list.length}` : '—';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Compradores high ticket que entraram na live', share(ht, b => b.entered)],
          ['… que ficaram até o pitch', share(ht, b => b.stayedToPitch)],
          ['Ingressos que entraram na live', share(tk, b => b.entered)],
          ['Compradores sem vínculo', String(view.buyers.filter(b => !b.matchedBy).length)],
        ].map(([label, value]) => (
          <Card key={label}><CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          </CardContent></Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Sem vínculo = o e-mail e o telefone da compra não batem com nenhum cadastro da live (pode ter usado outro e-mail ou entrado pela mesma rede de outra pessoa).</p>

      <section>
        <h2 className="mb-2 text-sm font-medium">Compradores high ticket × live</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>E-mail</TableHead><TableHead>Produto</TableHead><TableHead>Vínculo</TableHead><TableHead>Entrou</TableHead>
              <TableHead className="text-right">Minutos</TableHead><TableHead>Até o pitch</TableHead><TableHead>Clicou CTA</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {ht.map((b, i) => (
                <TableRow key={`${b.email}-${i}`}>
                  <TableCell>{b.email}</TableCell><TableCell>{b.product}</TableCell><TableCell>{b.matchedBy ?? 'sem vínculo'}</TableCell>
                  <TableCell>{b.entered ? 'sim' : 'não'}</TableCell><TableCell className="text-right tabular-nums">{b.minutesWatched}</TableCell>
                  <TableCell>{b.stayedToPitch ? 'sim' : 'não'}</TableCell><TableCell>{b.clickedCta ? 'sim' : 'não'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">IC do pixel × vendas reais (UTM), por dia</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Dia</TableHead><TableHead className="text-right">IC (Meta)</TableHead><TableHead className="text-right">Vendas (planilha)</TableHead></TableRow></TableHeader>
            <TableBody>
              {view.icVsSales.map(d => (
                <TableRow key={d.day}><TableCell>{d.day}</TableCell><TableCell className="text-right tabular-nums">{d.ic}</TableCell><TableCell className="text-right tabular-nums">{d.sales}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
