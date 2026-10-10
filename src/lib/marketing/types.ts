export type CaptureRow = {
  email: string;
  phone: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  at: string | null;        // 'YYYY-MM-DDTHH:mm:ss' horário de Brasília
  edition: number | null;   // 22 para '#022'
  funnel: string;           // coluna 'Edição', ex.: 'WB03 - PAGO'
};

export type SaleRow = {
  approved: boolean;
  product: string;
  amount: number;
  email: string;
  phone: string;
  utmContentCapture: string;
  utmContentSale: string;
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
};

export type OverviewRow = {
  edition: number;
  dayMonth: string;        // '13/10'
  applications: number;
  scheduled: number;       // PWR + PWS
  done: number;            // PWR + PWS
  investment: number;
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
