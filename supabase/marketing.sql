-- Dashboard de marketing. Só tabelas novas; nenhuma tabela existente é alterada.
create table if not exists mkt_meta_ad_daily (
  date date not null,
  ad_id text not null,
  ad_name text not null default '',
  adset_name text not null default '',
  campaign_name text not null default '',
  spend numeric not null default 0,
  impressions integer not null default 0,
  link_clicks integer not null default 0,
  landing_views integer not null default 0,
  initiate_checkouts integer not null default 0,
  video_3s integer not null default 0,
  thruplays integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (date, ad_id)
);

create table if not exists mkt_meta_ad (
  ad_id text primary key,
  permalink text,
  updated_at timestamptz not null default now()
);

create table if not exists mkt_sheet_snapshot (
  tab text primary key,
  rows jsonb not null,
  fetched_at timestamptz not null default now()
);

create table if not exists mkt_sync_runs (
  id bigserial primary key,
  source text not null,
  ok boolean not null,
  message text not null default '',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists mkt_editions (
  number integer primary key,
  live_date date not null,
  window_start date,
  window_end date,
  ticket_price numeric not null default 9.90,
  cpa_dream numeric not null default 25,
  cpa_good numeric not null default 35,
  cpa_limit numeric not null default 45,
  updated_at timestamptz not null default now()
);

create table if not exists mkt_creative_alias (
  raw text primary key,
  family text not null
);

-- Sem policies: só a service role (servidor) acessa.
alter table mkt_meta_ad_daily enable row level security;
alter table mkt_meta_ad enable row level security;
alter table mkt_sheet_snapshot enable row level security;
alter table mkt_sync_runs enable row level security;
alter table mkt_editions enable row level security;
alter table mkt_creative_alias enable row level security;

-- Credenciais do painel de marketing editáveis na plataforma (prioridade sobre env da Vercel).
create table if not exists mkt_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table mkt_settings enable row level security;

-- Fase 3 (2026-10-13): disparos de WhatsApp e alcance por janela de edição. Só tabelas novas.
create table if not exists mkt_disparos (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('convite','recuperacao')),
  ciclo text, nome text not null, data date,
  contatos int, agendamentos int, vendas int,
  faturamento numeric, custo numeric, template text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table mkt_disparos enable row level security;

create table if not exists mkt_meta_window (
  edition int primary key, since date not null, until date not null,
  reach bigint, frequency numeric, updated_at timestamptz default now()
);
alter table mkt_meta_window enable row level security;
