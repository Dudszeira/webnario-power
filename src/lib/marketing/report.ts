import type { EditionConfig } from './types.ts';
import type { CreativeStats, FrontSummary, Window137 } from './metrics.ts';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dec = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function brl(n: number | null): string {
  return n === null ? '—' : money.format(n).replace(/ /g, ' ');
}
const num2 = (n: number | null) => (n === null ? '—' : dec.format(n));
const ed = (n: number) => `#${String(n).padStart(3, '0')}`;
const vendas = (n: number) => `${n} ${n === 1 ? 'venda' : 'vendas'}`;
// Sem fonte de investimento o valor é desconhecido: "—", nunca R$ 0,00.
const spendOf = (f: FrontSummary) => (f.spendSource === 'nenhum' ? '—' : brl(f.spend));
// Igual ao report137: "a <custo>" só quando houve IC.
const icText = (ic: number, cost: number | null, suffix = '') => `${ic} IC${ic > 0 ? ` a ${brl(cost)}${suffix}` : ''}`;

function creativeLine(c: CreativeStats): string {
  return `${c.family}: ${vendas(c.sales)} | ${brl(c.spend)} | CPA ${brl(c.cpa)}`;
}

function goals(cfg: EditionConfig): string {
  return `Metas\n\nDos sonhos: ${brl(cfg.cpaDream)}\nBom: ${brl(cfg.cpaGood)}\nLimite: ${brl(cfg.cpaLimit)}`;
}

export function editionReport(
  cfg: EditionConfig, f: FrontSummary, creatives: CreativeStats[],
  permalinks: Record<string, string>, dayLabel: string,
): string {
  const selling = creatives.filter(c => c.sales > 0);
  const top3 = selling.slice(0, 3);
  const lines = [
    `REPORT WEBNÁRIO PAGO ${ed(cfg.number)} | ${dayLabel}`,
    `${vendas(f.sales)} no total (${brl(f.revenue)}) e ${spendOf(f)} investidos = ROAS ${num2(f.roas)}.`,
    '', goals(cfg), '',
    'CPA por anúncio', '',
    ...selling.map(creativeLine), '',
    'CPA GERAL', '',
    `CPA só dos anúncios que venderam: ${brl(f.cpaSellingAds)}`,
    `CPA da campanha inteira: ${brl(f.cpa)}`,
  ];
  if (f.topNoSale) {
    lines.push(`Tem ${brl(f.spendNoSales)} em anúncios que ainda não venderam. O maior deles é o ${f.topNoSale.family}, com ${brl(f.topNoSale.spend)}.`);
  }
  lines.push('', 'Top 3 criativos', '');
  for (const c of top3) {
    lines.push(`Criativo ${c.family}`, ` ${vendas(c.sales)} | ${brl(c.spend)} | CPA ${brl(c.cpa)}`);
    if (permalinks[c.family]) lines.push(` ${permalinks[c.family]}`);
    lines.push('');
  }
  if (f.spendSource === 'planilha') lines.push('(investimento: fonte planilha)');
  if (f.spendSource === 'nenhum') lines.push('(sem dados de investimento)');
  return lines.join('\n').trim();
}

export function dailyReport(
  cfg: EditionConfig, y: FrontSummary, best: CreativeStats[],
  permalinks: Record<string, string>, dayLabel: string,
): string {
  const lines = [
    `REPORT WEBNÁRIO PAGO | Fechamento ${dayLabel}`, '',
    `${vendas(y.sales)} (${brl(y.revenue)}) com ${spendOf(y)} investidos = ROAS ${num2(y.roas)}`,
    `CPA do dia: ${brl(y.cpa)}`,
    icText(y.ic, y.costPerIc, ' cada'), '',
    goals(cfg), '',
    'Melhores criativos de ontem', '',
  ];
  if (y.spendSource === 'nenhum') lines.splice(3, 0, '(sem dados de investimento)');
  for (const c of best.filter(b => b.sales > 0).slice(0, 3)) {
    lines.push(`Criativo ${c.family}`, ` ${vendas(c.sales)} | ${brl(c.spend)} | CPA ${brl(c.cpa)} | ${icText(c.ic, c.costPerIc)}`);
    if (permalinks[c.family]) lines.push(` ${permalinks[c.family]}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

export function report137(windows: Window137[], dayLabel: string): string {
  const w = (tag: string, c: CreativeStats) =>
    ` ${tag}: ${vendas(c.sales)} | ${c.sales ? `CPA ${brl(c.cpa)}` : brl(c.spend)} | ${c.ic} IC${c.ic ? ` a ${brl(c.costPerIc)}` : ''}`;
  const lines = [`Análise 1-3-7 por criativo (até ${dayLabel})`, ''];
  for (const x of windows) {
    lines.push(`${x.family}: ${x.label}`, w('1d', x.d1), w('3d', x.d3), w('7d', x.d7), '');
  }
  return lines.join('\n').trim();
}
