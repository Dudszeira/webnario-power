'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MarketingView } from '@/lib/marketing/view';
import type { CreativeStats } from '@/lib/marketing/metrics';
import { sortCreatives, type CreativeExtra, type CreativeSort } from '@/lib/marketing/breakdowns';
import { useTabData } from './useTabData';
import { WarnNote, type Warned } from './ui';

const brl = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`);
const BAND: Record<string, string> = { sonho: 'bg-emerald-500/20 text-emerald-300', bom: 'bg-lime-500/20 text-lime-300', limite: 'bg-amber-500/20 text-amber-300', acima: 'bg-red-500/20 text-red-300' };
// Ordem e desempates do dash antigo (vendas high ticket → agendamentos → leads etc.).
const SORTS: [CreativeSort, string][] = [['vendas', 'Vendas HT'], ['agend', 'Agendamentos'], ['leads', 'Leads'], ['qualif', 'Qualificação']];
type Row = { family: string; c: CreativeStats | null; x: CreativeExtra | null };
const NO_AD = 'Sem anúncio do Meta com este criativo na janela da 1ª edição selecionada';

export default function CreativesTab({ view, onSaved, query }: { view: MarketingView; onSaved: () => void; query: string }) {
  const [alias, setAlias] = useState({ raw: '', family: '' });
  const [saveError, setSaveError] = useState('');
  const [sort, setSort] = useState<CreativeSort>('vendas');
  const { data: payload, error: extraError } = useTabData<{ rows: CreativeExtra[] } & Warned>('criativos', query);
  const extra = payload ? payload.rows : null;

  const byFamily: Record<string, CreativeExtra> = {};
  (extra ?? []).forEach(x => { byFamily[x.family] = x; });
  const seen: Record<string, true> = {};
  const rows: Row[] = view.creatives.map(c => { seen[c.family] = true; return { family: c.family, c, x: byFamily[c.family] ?? null }; });
  (extra ?? []).forEach(x => { if (!seen[x.family]) rows.push({ family: x.family, c: null, x }); });
  const dash = (title: string) => <span className="text-muted-foreground" title={title}>—</span>;
  const loadingExtra = extraError ? 'Não foi possível carregar leads, agendamentos e vendas' : extra === null ? 'Carregando…' : 'Sem lead, agendamento ou venda deste criativo';

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label="Ordenar criativos" className="inline-flex h-8 w-fit items-center rounded-lg border border-border bg-input/20 p-0.5">
        {SORTS.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}
            className={`h-7 rounded-md px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 ${sort === k ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>
        ))}
      </div>

      <p className="-mt-3 text-[11px] text-muted-foreground">Vendas, gasto, CPA, IC e taxas: Meta + ingressos da 1ª edição selecionada. Leads, 5k+, agendamentos e vendas high ticket: todas as edições selecionadas.</p>
      <WarnNote warn={payload?.warn} />
      {extraError && <p role="alert" className="-mt-3 text-xs text-red-400">{extraError}</p>}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Criativo</TableHead><TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Gasto</TableHead>
              <TableHead className="text-right">CPA</TableHead><TableHead className="text-right">IC</TableHead><TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">Hook</TableHead><TableHead className="text-right">Body</TableHead>
              <TableHead className="text-right">Leads</TableHead><TableHead className="text-right">5k+</TableHead><TableHead className="text-right">Agend.</TableHead>
              <TableHead className="text-center" title="vendas high ticket: Power · Start · Desafio">Pw · St · Des</TableHead><TableHead>Post</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortCreatives(rows, sort).map(({ family, c, x }) => (
              <TableRow key={family}>
                <TableCell className="font-medium">{family}</TableCell>
                <TableCell className="text-right tabular-nums">{c ? c.sales : dash(NO_AD)}</TableCell>
                <TableCell className="text-right tabular-nums">{c ? brl(c.spend) : dash(NO_AD)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {!c ? dash(NO_AD) : c.band ? <span className={`rounded px-1.5 py-0.5 ${BAND[c.band]}`}>{brl(c.cpa)}</span> : brl(c.cpa)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c ? c.ic : dash(NO_AD)}</TableCell>
                <TableCell className="text-right tabular-nums">{c ? pct(c.ctr) : dash(NO_AD)}</TableCell>
                <TableCell className="text-right tabular-nums">{c ? pct(c.hookRate) : dash(NO_AD)}</TableCell>
                <TableCell className="text-right tabular-nums">{c ? pct(c.bodyRate) : dash(NO_AD)}</TableCell>
                <TableCell className="text-right tabular-nums">{x ? x.leads : dash(loadingExtra)}</TableCell>
                <TableCell className="text-right tabular-nums" title={x && x.qualifiedRate === null ? 'Sem leads deste criativo' : undefined}>{x ? pct(x.qualifiedRate) : dash(loadingExtra)}</TableCell>
                <TableCell className="text-right tabular-nums">{x ? x.scheduled : dash(loadingExtra)}</TableCell>
                <TableCell className="text-center tabular-nums">{x ? <><span className="text-amber-300">{x.power}</span> · <span className="text-sky-300">{x.start}</span> · <span className="text-red-300">{x.desafio}</span></> : dash(loadingExtra)}</TableCell>
                <TableCell>{view.permalinks[family] ? <a className="underline" href={view.permalinks[family]} target="_blank" rel="noopener noreferrer">abrir</a> : '—'}</TableCell>
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
            setSaveError('');
            try {
              const res = await fetch('/api/marketing/config', { method: 'POST', body: JSON.stringify({ alias }) });
              if (res.ok) { setAlias({ raw: '', family: '' }); onSaved(); } else setSaveError('Não foi possível salvar');
            } catch { setSaveError('Não foi possível salvar'); }
          }}>Associar</Button>
          {saveError && <p role="alert" className="text-xs text-red-400">{saveError}</p>}
        </div>
      </section>
    </div>
  );
}
