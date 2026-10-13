'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNumberInput, parseNumberInput as n, type Disparo, type DisparoBlock, type DisparosTab as Data } from '@/lib/marketing/disparos';
import { useTabData } from './useTabData';
import { TabState, brl, dec, dm, int, pct, sectionTitle } from './ui';

type Form = { kind: 'convite' | 'recuperacao'; ciclo: string; nome: string; data: string; contatos: string; agendamentos: string; vendas: string; faturamento: string; custo: string; template: string };
const EMPTY: Form = { kind: 'convite', ciclo: '', nome: '', data: '', contatos: '', agendamentos: '', vendas: '', faturamento: '', custo: '', template: '' };
const s = formatNumberInput; // "16,8": sem milhar, vírgula decimal
const toForm = (r: Disparo): Form => ({
  kind: r.kind, ciclo: r.ciclo ?? '', nome: r.nome, data: r.data ?? '', contatos: s(r.contatos), agendamentos: s(r.agendamentos),
  vendas: s(r.vendas), faturamento: s(r.faturamento), custo: s(r.custo), template: r.template ?? '',
});
// Vazio = null; com vírgula o ponto é milhar, sem vírgula é decimal; texto inválido vira NaN e a API recusa.
const toBody = (f: Form) => ({
  kind: f.kind, ciclo: f.ciclo, nome: f.nome, data: f.data || null, contatos: n(f.contatos), agendamentos: n(f.agendamentos),
  vendas: n(f.vendas), faturamento: n(f.faturamento), custo: n(f.custo), template: f.template,
});
const firstLine = (t: string | null) => (t ? t.split('\n')[0] : '—');

function Block({ title, b, tone }: { title: string; b: DisparoBlock; tone: string }) {
  const stat = (label: string, value: string, sub: string) => (
    <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p><p className="text-[11px] text-muted-foreground">{sub}</p></div>
  );
  return (
    <Card className={`gap-3 border-l-4 p-4 ${tone}`}>
      <p className="text-xs font-bold uppercase tracking-widest">{title}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stat('Orçamento', brl(b.custo), `${int(b.contatos)} contatos · ${b.count} disparos`)}
        {stat('Agendamentos', int(b.agendamentos), b.agendRate === null ? '—' : `${pct(b.agendRate, 2)} dos contatos`)}
        {stat('Custo por agend.', brl(b.costPerAgend), `${brl(b.custo)} ÷ ${int(b.agendamentos)}`)}
        {stat('Vendas', int(b.vendas), b.vendas ? brl(b.faturamento) : 'nenhuma')}
        {stat('ROAS', b.roas === null ? '—' : `${dec(b.roas)}x`, b.faturamento ? `${brl(b.faturamento)} ÷ ${brl(b.custo)}` : 'sem faturamento')}
      </div>
    </Card>
  );
}

export default function DisparosTab({ query }: { query: string }) {
  const [nonce, setNonce] = useState(0);
  const { data: d, loading, error } = useTabData<Data>('disparos', query, `&r=${nonce}`);
  const [editing, setEditing] = useState<string | null>(null); // id, 'new' ou null
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  if (!d) return <TabState loading={loading} error={error} />;

  const open = (r: Disparo | null) => { setEditing(r ? r.id : 'new'); setForm(r ? toForm(r) : EMPTY); setMsg(''); };
  const field = (k: keyof Form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true); setMsg('');
    try {
      const isNew = editing === 'new';
      const res = await fetch(isNew ? '/api/marketing/disparos' : `/api/marketing/disparos?id=${editing}`, {
        method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toBody(form)),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(b.error || 'Não foi possível salvar'); return; }
      setEditing(null); setNonce(x => x + 1); toast.success('Disparo salvo');
    } catch {
      setMsg('Erro de conexão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: Disparo) {
    if (!window.confirm(`Remover o disparo "${r.nome}" (${dm(r.data)})? Isso não pode ser desfeito.`)) return;
    const res = await fetch(`/api/marketing/disparos?id=${r.id}`, { method: 'DELETE' }).catch(() => null);
    if (res && res.ok) { setNonce(x => x + 1); toast.success('Disparo removido'); } else toast.error('Não foi possível remover');
  }

  const max = d.ranking.reduce((m, r) => Math.max(m, r.agendamentos ?? 0), 1);
  const label = 'flex flex-col gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground';
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <section className="flex flex-col gap-3">
        <Block title="Convites" b={d.convite} tone="border-l-amber-700" />
        <Block title="Recuperação" b={d.recuperacao} tone="border-l-sky-500" />
        <Block title="Total dos disparos" b={d.total} tone="border-l-amber-400" />
      </section>

      <section>
        <h2 className={sectionTitle}>Ranking dos convites <span className="font-normal normal-case tracking-normal">· clique para ver o template</span></h2>
        <div className="flex flex-col gap-2">
          {d.ranking.map((r, i) => (
            <details key={r.id} className="rounded-lg border border-border">
              <summary className="grid cursor-pointer grid-cols-[2rem_minmax(0,1fr)_4rem] items-center gap-2 px-3 py-2 text-xs">
                <span className={`text-base font-bold ${i === 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>{i + 1}º</span>
                <span className="min-w-0">
                  <span className="font-semibold">{r.nome}</span> <span className="text-muted-foreground">· {dm(r.data)} · {int(r.contatos)} contatos · {firstLine(r.template)}{r.vendas ? ` · ${r.vendas} venda(s)` : ''}</span>
                  <span aria-hidden className="mt-1 block h-2 rounded-full bg-muted"><span className="block h-full rounded-full bg-emerald-400" style={{ width: `${((r.agendamentos ?? 0) / max) * 100}%` }} /></span>
                </span>
                <span className="text-right"><b className="text-base tabular-nums text-emerald-400">{int(r.agendamentos)}</b><br /><span className="text-muted-foreground">{pct(r.contatos ? (r.agendamentos ?? 0) / r.contatos : null, 2)}</span></span>
              </summary>
              <pre className="whitespace-pre-wrap border-t border-border px-3 py-2 font-sans text-xs">{r.template || 'Sem template registrado.'}</pre>
            </details>
          ))}
          {!d.ranking.length && <p className="text-xs text-muted-foreground">Nenhum convite no período.</p>}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className={sectionTitle}>Disparos</h2>
          <Button size="sm" variant="outline" onClick={() => open(null)}>Adicionar</Button>
        </div>
        {editing && (
          <Card className="mb-3 gap-3 p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <label className={label}>Tipo
                <select value={form.kind} onChange={field('kind')} className="h-8 rounded-md border border-border bg-background px-2 text-sm normal-case tracking-normal text-foreground">
                  <option value="convite">Convite</option><option value="recuperacao">Recuperação</option>
                </select>
              </label>
              <label className={label}>Ciclo<Input value={form.ciclo} onChange={field('ciclo')} /></label>
              <label className={label}>Nome<Input value={form.nome} onChange={field('nome')} required /></label>
              <label className={label}>Data<Input type="date" value={form.data} onChange={field('data')} /></label>
              <label className={label}>Contatos<Input inputMode="numeric" value={form.contatos} onChange={field('contatos')} /></label>
              <label className={label}>Agendamentos<Input inputMode="numeric" value={form.agendamentos} onChange={field('agendamentos')} /></label>
              <label className={label}>Vendas<Input inputMode="numeric" value={form.vendas} onChange={field('vendas')} /></label>
              <label className={label}>Faturamento (R$)<Input inputMode="decimal" value={form.faturamento} onChange={field('faturamento')} /></label>
              <label className={label}>Custo (R$)<Input inputMode="decimal" value={form.custo} onChange={field('custo')} /></label>
            </div>
            <label className={label}>Template
              <textarea value={form.template} onChange={field('template')} rows={4} className="rounded-md border border-border bg-transparent px-2 py-1 text-sm normal-case tracking-normal text-foreground" />
            </label>
            {msg && <p role="alert" className="text-xs text-red-400">{msg}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving || !form.nome.trim()}>{saving ? 'Salvando…' : 'Salvar'}</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            </div>
          </Card>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tipo</TableHead><TableHead>Ciclo</TableHead><TableHead>Nome</TableHead><TableHead>Data</TableHead><TableHead>Template</TableHead>
              <TableHead className="text-right">Contatos</TableHead><TableHead className="text-right">Agend.</TableHead><TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Faturamento</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Custo/agend.</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {d.rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.kind === 'convite' ? 'Convite' : 'Recuperação'}</TableCell><TableCell>{r.ciclo ?? '—'}</TableCell>
                  <TableCell className="font-medium">{r.nome}</TableCell><TableCell>{dm(r.data)}</TableCell>
                  <TableCell className="max-w-[10rem] truncate text-xs" title={r.template ?? undefined}>{firstLine(r.template)}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(r.contatos)}</TableCell><TableCell className="text-right tabular-nums">{int(r.agendamentos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(r.vendas)}</TableCell><TableCell className="text-right tabular-nums">{brl(r.faturamento)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(r.custo)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.custo !== null && r.agendamentos ? brl(r.custo / r.agendamentos) : '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button size="sm" variant="ghost" onClick={() => open(r)}>Editar</Button>
                    <Button size="sm" variant="ghost" className="text-red-400" onClick={() => remove(r)}>Remover</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
