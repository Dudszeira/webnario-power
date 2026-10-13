import type { OverviewCheck } from './types.ts';

export type ReconState = 'ok' | 'diverge' | 'so_planilha' | 'so_plataforma';
export type OfficialNumbers = {
  peak: number | null; attendance: number | null; metaSpend: number | null; applications: number | null;
  scheduled: number | null; done: number | null; sales: number | null; revenue: number | null;
};

export const RECON_METRICS: { key: keyof OfficialNumbers; label: string; decimals: number }[] = [
  { key: 'peak', label: 'Pico ao vivo', decimals: 0 },
  { key: 'attendance', label: 'Comparecimento (%)', decimals: 1 },
  { key: 'metaSpend', label: 'Investimento Meta', decimals: 2 },
  { key: 'applications', label: 'Aplicações', decimals: 0 },
  { key: 'scheduled', label: 'Agendamentos', decimals: 0 },
  { key: 'done', label: 'Calls realizadas', decimals: 0 },
  { key: 'sales', label: 'Vendas high ticket', decimals: 0 },
  { key: 'revenue', label: 'Faturamento high ticket', decimals: 2 },
];

export type ReconRow = {
  edition: number; key: keyof OfficialNumbers; label: string; official: number | null; sheet: number | null;
  diff: number | null; diffPct: number | null; state: ReconState;
};

// Oficial (plataforma/linhas) × digitado na Visão Geral, arredondado na casa da métrica.
export function reconcileEdition(edition: number, official: OfficialNumbers, sheet: OverviewCheck | null): ReconRow[] {
  const sheetOf = (k: keyof OfficialNumbers): number | null =>
    !sheet ? null : k === 'metaSpend' ? (sheet.metaSpend ?? sheet.investment) : sheet[k];
  const rows: ReconRow[] = [];
  RECON_METRICS.forEach(m => {
    const f = 10 ** m.decimals;
    const r = (n: number | null) => (n === null ? null : Math.round(n * f) / f);
    const o = r(official[m.key]), s = r(sheetOf(m.key));
    if (o === null && s === null) return;
    const state: ReconState = o === null ? 'so_planilha' : s === null ? 'so_plataforma' : o === s ? 'ok' : 'diverge';
    const diff = o !== null && s !== null ? r(o - s) : null;
    rows.push({ edition, key: m.key, label: m.label, official: o, sheet: s, diff, diffPct: diff !== null && s ? diff / s : null, state });
  });
  return rows;
}
