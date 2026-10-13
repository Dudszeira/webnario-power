import type { CaptureRow, SaleRow, SurveyRow } from './types.ts';
import { qualified5k } from './survey.ts';
import { saleValue } from './sales.ts';
import { countBy, type Count } from './metrics.ts';

// Captação via API (WhatsApp): base = utm_medium, versão = utm_term, tipo = utm_campaign, disparo = utm_content.
export const isApiLead = (l: CaptureRow) => l.utmSource.toLowerCase().trim() === 'api';
const base = (l: CaptureRow) => l.utmMedium.trim() || '(sem base)';
const version = (l: CaptureRow) => l.utmTerm.trim() || '(sem versão)';
const shot = (l: CaptureRow) => `${l.utmContent.trim() || '(sem disparo)'} · ${l.utmCampaign.trim() || '(sem tipo)'}`;

export type ApiAgg = { key: string; leads: number; qualified: number; responded: number };
export type ApiTab = {
  leads: number; totalLeads: number; qualified: number; responded: number; bestDay: Count | null;
  bases: ApiAgg[]; versions: ApiAgg[]; shots: ApiAgg[];
  matrix: Record<string, { leads: number; qualified: number }>;
  byDay: Count[]; sales: number; revenue: number;
};

export function apiTab(allLeads: CaptureRow[], surveys: Record<string, SurveyRow>, sales: SaleRow[]): ApiTab {
  const leads = allLeads.filter(isApiLead);
  const q = (l: CaptureRow) => { const s = l.email ? surveys[l.email] : undefined; return !!s && qualified5k(s.renda); };
  const r = (l: CaptureRow) => !!(l.email && surveys[l.email]);
  const agg = (key: (l: CaptureRow) => string): ApiAgg[] => {
    const m: Record<string, ApiAgg> = Object.create(null);
    const list: ApiAgg[] = [];
    leads.forEach(l => {
      const k = key(l);
      if (!m[k]) { m[k] = { key: k, leads: 0, qualified: 0, responded: 0 }; list.push(m[k]); }
      m[k].leads++;
      if (q(l)) m[k].qualified++;
      if (r(l)) m[k].responded++;
    });
    return list.sort((a, b) => b.leads - a.leads || a.key.localeCompare(b.key));
  };
  const matrix: Record<string, { leads: number; qualified: number }> = {};
  leads.forEach(l => {
    const k = `${base(l)}|${version(l)}`;
    const c = matrix[k] || (matrix[k] = { leads: 0, qualified: 0 });
    c.leads++;
    if (q(l)) c.qualified++;
  });
  const byDay = countBy(leads.filter(l => l.at), l => (l.at as string).slice(0, 10));
  const apiSales = sales.filter(s => s.approved && s.capSource.toLowerCase().trim() === 'api');
  return {
    leads: leads.length, totalLeads: allLeads.length,
    qualified: leads.filter(q).length, responded: leads.filter(r).length,
    bestDay: byDay[0] ?? null,
    bases: agg(base), versions: agg(version), shots: agg(shot), matrix,
    byDay: byDay.slice().sort((a, b) => a.key.localeCompare(b.key)),
    sales: apiSales.length, revenue: Math.round(apiSales.reduce((t, s) => t + saleValue(s), 0) * 100) / 100,
  };
}
