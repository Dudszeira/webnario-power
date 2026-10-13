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
  count: number; contatos: number | null; custo: number | null; agendamentos: number | null; agendRate: number | null;
  costPerAgend: number | null; vendas: number | null; faturamento: number | null; roas: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function disparoBlock(rows: Disparo[]): DisparoBlock {
  // Sem nenhuma linha com o valor = null ("—"), nunca 0.
  type K = 'contatos' | 'custo' | 'agendamentos' | 'vendas' | 'faturamento';
  const sum = (k: K, rs: Disparo[] = rows) => {
    const vs = rs.map(r => r[k]).filter((v): v is number => v !== null);
    return vs.length ? vs.reduce((t, v) => t + v, 0) : null;
  };
  const money = (v: number | null) => (v === null ? null : round2(v));
  const contatos = sum('contatos'), custo = money(sum('custo')), agendamentos = sum('agendamentos'), faturamento = money(sum('faturamento'));
  // Custo por agendamento: só linhas com custo E agendamentos preenchidos (senão um lado infla o outro).
  const both = rows.filter(r => r.custo !== null && r.agendamentos !== null);
  const bc = sum('custo', both), ba = sum('agendamentos', both);
  return {
    count: rows.length, contatos, custo, agendamentos,
    agendRate: contatos && agendamentos !== null ? agendamentos / contatos : null,
    costPerAgend: bc && ba ? bc / ba : null,
    vendas: sum('vendas'), faturamento,
    roas: custo && faturamento !== null ? faturamento / custo : null,
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
// Sem vírgula, "1.234" / "12.345.678" (grupos de 3) é milhar. Texto inválido vira NaN e o editor bloqueia o salvamento.
export function parseNumberInput(s: string): number | null {
  const t = (s ?? '').trim();
  if (!t) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''));
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
}
