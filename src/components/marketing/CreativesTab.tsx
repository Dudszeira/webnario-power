'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MarketingView } from '@/lib/marketing/view';

const brl = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`);
const BAND: Record<string, string> = { sonho: 'bg-emerald-500/20 text-emerald-300', bom: 'bg-lime-500/20 text-lime-300', limite: 'bg-amber-500/20 text-amber-300', acima: 'bg-red-500/20 text-red-300' };

export default function CreativesTab({ view, onSaved }: { view: MarketingView; onSaved: () => void }) {
  const [alias, setAlias] = useState({ raw: '', family: '' });
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Criativo</TableHead><TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Gasto</TableHead>
              <TableHead className="text-right">CPA</TableHead><TableHead className="text-right">IC</TableHead><TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">Hook</TableHead><TableHead className="text-right">Body</TableHead><TableHead>Post</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.creatives.map(c => (
              <TableRow key={c.family}>
                <TableCell className="font-medium">{c.family}</TableCell>
                <TableCell className="text-right tabular-nums">{c.sales}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(c.spend)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.band ? <span className={`rounded px-1.5 py-0.5 ${BAND[c.band]}`}>{brl(c.cpa)}</span> : brl(c.cpa)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.ic}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(c.ctr)}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(c.hookRate)}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(c.bodyRate)}</TableCell>
                <TableCell>{view.permalinks[c.family] ? <a className="underline" href={view.permalinks[c.family]} target="_blank" rel="noopener noreferrer">abrir</a> : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium">Janelas 1 · 3 · 7 dias (até ontem)</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Criativo</TableHead><TableHead>Leitura</TableHead><TableHead>1d</TableHead><TableHead>3d</TableHead><TableHead>7d</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {view.windows.map(w => (
                <TableRow key={w.family}>
                  <TableCell className="font-medium">{w.family}</TableCell>
                  <TableCell><Badge variant="outline">{w.label}</Badge></TableCell>
                  {[w.d1, w.d3, w.d7].map((d, i) => (
                    <TableCell key={i} className="tabular-nums">{d.sales} vendas · {d.sales ? `CPA ${brl(d.cpa)}` : brl(d.spend)} · {d.ic} IC</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Sem correspondência</h2>
        <p className="text-xs text-muted-foreground">
          UTMs de venda sem anúncio: {view.unmatched.utmContents.join(', ') || 'nenhuma'} · Anúncios com gasto sem venda nem lead: {view.unmatched.adNames.join(', ') || 'nenhum'}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <input aria-label="UTM ou nome do anúncio" placeholder="utm_content ou nome do anúncio" className="h-8 rounded-md border border-border bg-transparent px-2 text-sm" value={alias.raw} onChange={e => setAlias({ ...alias, raw: e.target.value })} />
          <input aria-label="Criativo" placeholder="criativo (ex.: img_01)" className="h-8 rounded-md border border-border bg-transparent px-2 text-sm" value={alias.family} onChange={e => setAlias({ ...alias, family: e.target.value })} />
          <Button size="sm" disabled={!alias.raw.trim() || !alias.family.trim()} onClick={async () => {
            await fetch('/api/marketing/config', { method: 'POST', body: JSON.stringify({ alias }) });
            setAlias({ raw: '', family: '' }); onSaved();
          }}>Associar</Button>
        </div>
      </section>
    </div>
  );
}
