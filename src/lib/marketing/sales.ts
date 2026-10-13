import type { CaptureRow, SaleRow, SurveyRow } from './types.ts';
import { countBy, type Count } from './metrics.ts';
import { challenges, qualified5k, surveyLabel, type Challenges, type SurveyField } from './survey.ts';

export type Product = 'powerStart' | 'power' | 'desafio' | 'outro';
export const PRODUCT_LABEL: Record<Product, string> = { powerStart: 'Power Start', power: 'Power', desafio: 'Desafio', outro: 'Outro' };

export function normProd(p: string): Product {
  const s = (p ?? '').toLowerCase().trim();
  if (s.includes('power start') || /^start\b/.test(s) || s === 'pws') return 'powerStart';
  if (s === 'power' || (s.startsWith('power') && !s.includes('start'))) return 'power';
  if (s.includes('desafio')) return 'desafio';
  return 'outro';
}

// Ticket vazio na planilha: valor padrão do produto.
export const TICKET_DEFAULT: Record<Product, number> = { powerStart: 1997, power: 20040, desafio: 997, outro: 0 };
export const saleValue = (s: SaleRow) => (s.amount > 0 ? s.amount : TICKET_DEFAULT[normProd(s.product)]);

export type Audience = 'quente' | 'frio' | 'email' | 'bio_se' | 'insta_organico' | 'api' | 'outros';
export const AUDIENCES: { key: Exclude<Audience, 'outros'>; label: string; rule: string }[] = [
  { key: 'quente', label: 'Público quente', rule: 'utm_campaign ou utm_medium contém "quente"' },
  { key: 'frio', label: 'Público frio', rule: 'utm_campaign contém "frio"' },
  { key: 'email', label: 'E-mail (base)', rule: 'utm_source = email ou utm_medium base-geral' },
  { key: 'bio_se', label: 'Bio (SE)', rule: 'utm_campaign contém "bio", "linktr" ou é pwr_perpetuo' },
  { key: 'insta_organico', label: 'Instagram orgânico', rule: 'utm_campaign = web_01_26 ou utm_medium manychat' },
  { key: 'api', label: 'API (WhatsApp)', rule: 'utm_source = api ou utm_content começa com APIWEB' },
];

// Público pela UTM de captação; a ordem dos testes é a do dash antigo.
export function classifyAudience(campaign: string, source: string, medium: string, content: string): Audience {
  const s = (source ?? '').toLowerCase().trim(), c = (campaign ?? '').toLowerCase().trim();
  const m = (medium ?? '').toLowerCase().trim(), ct = (content ?? '').toLowerCase().trim();
  if (s === 'api' || /^apiweb/.test(ct)) return 'api';
  if (s === 'email' || m.includes('base-geral') || m === 'email') return 'email';
  if (c.includes('frio')) return 'frio';
  if (c.includes('quente') || m.includes('quente')) return 'quente';
  if (c.includes('bio') || c.includes('linktr') || c === 'pwr_perpetuo') return 'bio_se';
  if (c === 'web_01_26' || m.includes('manychat')) return 'insta_organico';
  return 'outros';
}

const META_PLACEMENTS = ['ig', 'fb', 'an', 'th', 'msgr', 'metaads', 'meta', 'facebook', 'instagram', 'facebookads', 'meta_ads'];

// ig/fb/an/th/msgr… = Meta Ads, salvo tráfego orgânico (stories, manychat, bio, linktree).
export function normSource(src: string, med: string, cmp: string): string {
  const s = (src ?? '').toLowerCase().trim(), m = (med ?? '').toLowerCase(), c = (cmp ?? '').toLowerCase();
  if (!s) return '(sem utm)';
  const organic = /stories|manychat|bio|linktr|organic|org[aâ]nico/.test(m) || /web_0\d_26|stories|bio/.test(c);
  if (META_PLACEMENTS.indexOf(s) >= 0 && !organic) return 'meta ads';
  if (['ig', 'insta', 'instagram', 'fb', 'facebook'].indexOf(s) >= 0) return 'instagram orgânico';
  return s;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const byDay = (sales: SaleRow[]) =>
  countBy(sales.filter(s => s.at), s => (s.at as string).slice(0, 10)).sort((a, b) => a.key.localeCompare(b.key));

export type AudienceCard = {
  key: Audience; label: string; rule: string; leads: number; sales: number; revenue: number; refunds: number;
  conversion: number | null; topCampaigns: Count[];
};
export type SaleListItem = { name: string; edition: number | null; product: string; capSource: string; capMedium: string; capCampaign: string };
export type SalesTab = {
  sales: number; refunds: number; revenue: number; avgTicket: number | null; leads: number; conversion: number | null;
  audiences: AudienceCard[]; byProduct: Count[]; byDay: Count[]; leadOrigin: Count[]; purchaseOrigin: Count[];
  lists: Partial<Record<Audience, SaleListItem[]>> | null;
};

export function salesTab(leads: CaptureRow[], sales: SaleRow[], lists: boolean): SalesTab {
  const ok = sales.filter(s => s.approved);
  const revenue = round2(ok.reduce((t, s) => t + saleValue(s), 0));
  const audOf = (s: SaleRow) => classifyAudience(s.capCampaign, s.capSource, s.capMedium, s.utmContentCapture);
  const audiences: AudienceCard[] = [];
  const out: Partial<Record<Audience, SaleListItem[]>> = {};
  AUDIENCES.forEach(a => {
    const ls = leads.filter(l => classifyAudience(l.utmCampaign, l.utmSource, l.utmMedium, l.utmContent) === a.key);
    const ss = sales.filter(s => audOf(s) === a.key);
    const good = ss.filter(s => s.approved);
    if (lists) out[a.key] = good.map(s => ({ name: s.name, edition: s.edition, product: s.product, capSource: s.capSource, capMedium: s.capMedium, capCampaign: s.capCampaign }));
    if (!ls.length && !ss.length) return;
    audiences.push({
      key: a.key, label: a.label, rule: a.rule, leads: ls.length, sales: good.length,
      revenue: round2(good.reduce((t, s) => t + saleValue(s), 0)), refunds: ss.length - good.length,
      conversion: ls.length ? good.length / ls.length : null,
      topCampaigns: countBy(ls, l => l.utmCampaign.trim() || '(sem utm_campaign)').slice(0, 10),
    });
  });
  return {
    sales: ok.length, refunds: sales.length - ok.length, revenue,
    avgTicket: ok.length ? round2(revenue / ok.length) : null,
    leads: leads.length, conversion: leads.length ? ok.length / leads.length : null,
    audiences,
    byProduct: countBy(ok, s => PRODUCT_LABEL[normProd(s.product)]),
    byDay: byDay(ok),
    leadOrigin: countBy(ok, s => normSource(s.capSource, s.capMedium, s.capCampaign)).slice(0, 8),
    purchaseOrigin: countBy(ok, s => s.saleSource.toLowerCase() || '(sem origem)').slice(0, 8),
    lists: lists ? out : null,
  };
}

export type BuyerFilter = 'todos' | 'power' | 'powerStart' | 'desafio';
export type BuyerListItem = {
  name: string; edition: number | null; product: string; at: string | null;
  income: string; revenue: string; tempo: string; servico: string; qualified: boolean;
};
export type BuyersTab = {
  filter: BuyerFilter; buyers: number; responded: number; qualified: number;
  topIncome: Count | null; topService: Count | null;
  profile: { renda: Count[]; fat: Count[]; tempo: Count[]; servico: Count[] };
  challenges: Challenges;
  list: BuyerListItem[] | null;
};

// Compradores (sem reembolso) × Pesquisa por e-mail.
export function buyersTab(sales: SaleRow[], surveys: Record<string, SurveyRow>, filter: string, lists: boolean): BuyersTab {
  const f: BuyerFilter = filter === 'power' || filter === 'powerStart' || filter === 'desafio' ? filter : 'todos';
  const buyers = sales.filter(s => s.approved && (f === 'todos' || normProd(s.product) === f));
  const pairs = buyers.map(b => ({ b, s: b.email ? surveys[b.email] : undefined }));
  const answered: SurveyRow[] = [];
  pairs.forEach(p => { if (p.s) answered.push(p.s); });
  const cnt = (field: SurveyField) => countBy(answered.filter(s => s[field]), s => surveyLabel(field, s[field])).slice(0, 10);
  const renda = cnt('renda'), servico = cnt('servico');
  const label = (field: SurveyField, s: SurveyRow | undefined) => (s && s[field] ? surveyLabel(field, s[field]) : '');
  return {
    filter: f, buyers: buyers.length, responded: answered.length,
    qualified: answered.filter(s => qualified5k(s.renda)).length,
    topIncome: renda[0] ?? null, topService: servico[0] ?? null,
    profile: { renda, fat: cnt('fat'), tempo: cnt('tempo'), servico },
    challenges: challenges(answered),
    list: lists ? pairs.slice().sort((x, y) => (y.b.at ?? '').localeCompare(x.b.at ?? '')).map(({ b, s }) => ({
      name: b.name, edition: b.edition, product: b.product, at: b.at,
      income: label('renda', s), revenue: label('fat', s), tempo: label('tempo', s), servico: label('servico', s),
      qualified: !!s && qualified5k(s.renda),
    })) : null,
  };
}
