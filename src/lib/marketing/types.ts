export type CaptureRow = {
  email: string;
  phone: string;
  name: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
  at: string | null;        // 'YYYY-MM-DDTHH:mm:ss' horário de Brasília
  edition: number | null;   // 22 para '#022'
  funnel: string;           // coluna 'Edição', ex.: 'WB03 - PAGO'
};

export type SaleRow = {
  approved: boolean;        // = !refunded (STATUS não casa reembolso/estorno/cancelamento)
  refunded: boolean;
  status: string;
  product: string;
  amount: number;
  email: string;
  phone: string;
  name: string;
  utmContentCapture: string;
  utmContentSale: string;
  capSource: string;
  capMedium: string;
  capCampaign: string;
  saleSource: string;
  saleCampaign: string;
  funnel: string;           // coluna 'Edição' da aba de vendas
  at: string | null;
  edition: number | null;
};

export type ScheduleRow = {
  lostReason: string;
  closer: string;
  utmContent: string;
  scheduledAt: string | null; // 'YYYY-MM-DD'
  callDate: string | null;
  wonAt: string | null;
  done: boolean;
  email: string;
  edition: number | null;
  title: string;            // 'WB - Fulano' / 'SE - Fulano'
  personName: string;
  emails: string[];         // trabalho, residencial, outros (normalizados)
  via: string;              // 'SE - Agendada' cru
  realizedRaw: string;      // 'SE - Realizada' em minúsculas
  productRaw: string;       // 'Produto (certo)' ou 'Produto'
  income: string;           // 'Renda Mensal'
  value: number;            // 'Negócio - Valor'
  utmSource: string;
  utmCampaign: string;
  utmMedium: string;
};

// Números digitados na Visão Geral, só para conferência. null = célula vazia ou coluna ausente.
export type OverviewCheck = {
  applications: number | null;
  scheduled: number | null;   // PWR + PWS
  done: number | null;        // PWR + PWS
  peak: number | null;
  attendance: number | null;  // % de 0 a 100
  metaSpend: number | null;   // Investimento Captação Meta
  investment: number | null;  // Investimento Total
  sales: number | null;       // Vendas Start + Desafio + Power
  revenue: number | null;     // Faturamento total
};

export type OverviewRow = {
  edition: number;
  dayMonth: string;        // '13/10'
  applications: number;
  scheduled: number;       // PWR + PWS
  done: number;            // PWR + PWS
  investment: number;
  check: OverviewCheck;
};

export type MetaAdDay = {
  date: string;            // 'YYYY-MM-DD'
  adId: string;
  adName: string;
  adsetName: string;
  campaignName: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  landingViews: number;
  initiateCheckouts: number;
  video3s: number;
  thruplays: number;
};

export type EditionConfig = {
  number: number;
  liveDate: string;        // 'YYYY-MM-DD' = id da edição na plataforma
  windowStart: string;     // 'YYYY-MM-DD' inclusive
  windowEnd: string;       // 'YYYY-MM-DD' inclusive
  ticketPrice: number;
  cpaDream: number;
  cpaGood: number;
  cpaLimit: number;
};

export type Attendance = {
  registrationId: string;
  email: string;
  entered: boolean;
  minutesWatched: number;
  stayedToPitch: boolean;
  clickedCta: boolean;
};

export type DateRange = { from: string; to: string }; // 'YYYY-MM-DD' inclusive

export type SurveyRow = {
  email: string;
  at: string | null;
  tempo: string;
  servico: string;
  renda: string;           // código: '5a7k', 'mais50k'...
  fat: string;
  conhece: string;
  desafios: string;
};

export type ApplicationRow = {
  email: string;
  phone: string;
  name: string;
  at: string | null;       // já em horário de Brasília
  product: string;
  income: string;
  revenue: string;
  relation: string;
  interest: 'Sim' | 'Não' | '';
  scheduled: boolean;      // escolheu horário no formulário
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
};

export type MetaWindow = {
  edition: number;
  since: string;
  until: string;
  reach: number | null;
  frequency: number | null;
};
