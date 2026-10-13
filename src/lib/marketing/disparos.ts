import type { DateRange } from './types.ts';
import { inRange } from './metrics.ts';

export type DisparoKind = 'convite' | 'recuperacao';
export type Disparo = {
  id: string; kind: DisparoKind; ciclo: string | null; nome: string; data: string | null;
  contatos: number | null; agendamentos: number | null; vendas: number | null;
  faturamento: number | null; custo: number | null; template: string | null;
};
export type DisparoInput = Omit<Disparo, 'id'>;

export type DisparoBlock = {
  count: number; contatos: number; custo: number; agendamentos: number; agendRate: number | null;
  costPerAgend: number | null; vendas: number; faturamento: number; roas: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function disparoBlock(rows: Disparo[]): DisparoBlock {
  const sum = (k: 'contatos' | 'custo' | 'agendamentos' | 'vendas' | 'faturamento') => rows.reduce((t, r) => t + (r[k] ?? 0), 0);
  const contatos = sum('contatos'), custo = round2(sum('custo')), agendamentos = sum('agendamentos'), faturamento = round2(sum('faturamento'));
  return {
    count: rows.length, contatos, custo, agendamentos,
    agendRate: contatos ? agendamentos / contatos : null,
    costPerAgend: agendamentos && custo ? custo / agendamentos : null,
    vendas: sum('vendas'), faturamento,
    roas: custo ? faturamento / custo : null,
  };
}

export type DisparosTab = { convite: DisparoBlock; recuperacao: DisparoBlock; total: DisparoBlock; ranking: Disparo[]; rows: Disparo[] };

// Disparos não pertencem a edição: só o período (data do disparo) filtra.
export function disparosTab(all: Disparo[], range: DateRange | null): DisparosTab {
  const rows = all.filter(r => inRange(r.data, range)).sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''));
  const conv = rows.filter(r => r.kind === 'convite');
  return {
    convite: disparoBlock(conv),
    recuperacao: disparoBlock(rows.filter(r => r.kind === 'recuperacao')),
    total: disparoBlock(rows),
    ranking: conv.slice().sort((a, b) => (b.agendamentos ?? 0) - (a.agendamentos ?? 0)),
    rows,
  };
}

type Parsed = { ok: true; value: Partial<DisparoInput> } | { ok: false; error: string };
const fail = (error: string): Parsed => ({ ok: false, error });
const blank = (v: unknown) => v === null || v === '';

// Entrada da API de disparos: só tipos e faixas válidos; vazio = null.
export function parseDisparoInput(body: unknown, partial: boolean): Parsed {
  if (!body || typeof body !== 'object') return fail('Corpo inválido');
  const b = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (!partial || b.kind !== undefined) {
    if (b.kind !== 'convite' && b.kind !== 'recuperacao') return fail('Tipo inválido');
    out.kind = b.kind;
  }
  if (!partial || b.nome !== undefined) {
    if (typeof b.nome !== 'string' || !b.nome.trim() || b.nome.trim().length > 120) return fail('Nome inválido');
    out.nome = b.nome.trim();
  }
  if (b.data !== undefined) {
    if (blank(b.data)) out.data = null;
    else if (typeof b.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.data)) out.data = b.data;
    else return fail('Data inválida');
  }
  const texts: [string, number, string][] = [['ciclo', 40, 'Ciclo'], ['template', 5000, 'Template']];
  for (const [k, max, label] of texts) {
    const v = b[k];
    if (v === undefined) continue;
    if (blank(v)) { out[k] = null; continue; }
    if (typeof v !== 'string' || v.trim().length > max) return fail(`${label} inválido`);
    out[k] = v.trim();
  }
  const nums: [string, boolean, string][] = [
    ['contatos', true, 'Contatos'], ['agendamentos', true, 'Agendamentos'], ['vendas', true, 'Vendas'],
    ['faturamento', false, 'Faturamento'], ['custo', false, 'Custo'],
  ];
  for (const [k, int, label] of nums) {
    const v = b[k];
    if (v === undefined) continue;
    if (blank(v)) { out[k] = null; continue; }
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e9 || (int && !Number.isInteger(v))) return fail(`${label} inválido`);
    out[k] = v;
  }
  return { ok: true, value: out as Partial<DisparoInput> };
}

// Campo numérico do editor: mostra "16,8" (sem separador de milhar) e lê de volta sem perder casas.
export const formatNumberInput = (n: number | null) =>
  (n === null ? '' : n.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 2 }));

// Vazio = null. Com vírgula, ponto é milhar ("1.234,56"); sem vírgula, ponto é decimal ("16.8").
// Texto inválido vira NaN e a API recusa com mensagem.
export function parseNumberInput(s: string): number | null {
  const t = (s ?? '').trim();
  if (!t) return null;
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
}
