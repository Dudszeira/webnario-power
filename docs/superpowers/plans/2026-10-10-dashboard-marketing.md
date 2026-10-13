# Dashboard de Marketing — Plano de Implementação (Fase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar `/admin/marketing` com filtro por edição, lendo a planilha (só leitura), o Meta Ads e a presença da live, entregando as abas Edição, Criativos, Validação e o botão "Copiar report".

**Architecture:** Funções puras em `src/lib/marketing/*.ts` fazem todo o cálculo e são testadas com o test runner nativo do Node 24 (sem dependência nova). Conectores em `src/lib/marketing/sources/` buscam dados e gravam cache em tabelas `mkt_*` do Supabase. Duas rotas novas (`/api/marketing/sync` e `/api/marketing/data`) e uma página client. Nada existente muda além de um item no menu do admin, `tsconfig.json`, `package.json` (script `test`) e um `vercel.json` novo.

**Tech Stack:** Next.js 14.2 (App Router), TypeScript, Supabase JS, Node 24 `node --test`, Meta Graph API, Google Sheets CSV export, componentes shadcn já existentes em `src/components/ui`.

**Spec:** `docs/superpowers/specs/2026-10-10-dashboard-marketing-design.md`

## Global Constraints

- Só adição: rotas `/admin/marketing`, `/api/marketing/*`, tabelas `mkt_*`. Não alterar estrutura de `registrations`, `events`, `editions`, `comments`.
- Não tocar em `/espera`, `/ao-vivo`, `/api/cadastro`, `src/components/AoVivoContent.tsx`, `src/components/EsperaContent.tsx`.
- Planilha somente leitura. Meta somente leitura (`ads_read`).
- A IA não entra nesta fase (fase 2).
- Vendas = vendas reais pela planilha (UTM). O IC do pixel nunca é contado como venda.
- Toda tela e todo cálculo filtrável por edição (#NNN) e por período.
- Valores ausentes aparecem como "—", nunca `NaN`, `Infinity` ou `R$ 0,00` inventado.
- Segredos só em variáveis de ambiente: `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `MKT_SHEET_ID`, `CRON_SECRET`.
- Vercel Hobby: cron no máximo 1×/dia.
- Desenvolvimento na branch `feat/marketing-dashboard`; merge só depois do Preview validado e fora de dia de live (terça).

## Fatos da planilha (lidos em 2026-10-10)

Abas e `gid` (usar **gid**, nunca o nome: o endpoint por nome devolve a primeira aba em silêncio quando o nome não existe):

| Aba | gid | Colunas usadas |
|---|---|---|
| Captação | `0` | `e-mail`, `whatsapp`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `data` (`10/10/2026 08:57:00`), `Webinário` (`#022`), `Edição` (`WB03 - PAGO`) |
| Visão Geral | `214347056` | `Data` (`13/10`, sem ano), `Webinário` (`#022`), `Aplicações`, `Agendamentos PWR`, `Agendamentos PWS`, `Realizadas PWR`, `Realizadas PWS`, `Investimento Total` |
| Detalhamento Vendas | `2007849935` | `STATUS` (`" Aprovada"` com espaço, `Reembolso`), `Produto` (`Power`, `"Power "`, `Power Start`, `Desafio Poderoso`), `Ticket` (`9.990,00`), `Email`, `Telefone`, `utm_content_captacao`, `utm_content_venda`, `Data` (pode vir vazia), `Webinário` |
| Detalhamento Agendamentos | `1247583607` | `Motivo da perda`, `Closer`, `utm_content`, `SE - Agendada`, `Agendada em` (`2026-09-29`), `SE - Data`, `Ganho em`, `SE - Realizada` (`Sim`/`Não`), `E-mail - Trabalho`, `WEBNÁRIO` (`#020`) |

- **Detalhamento Vendas só tem high ticket.** Os ingressos de R$9,90 são as linhas da **Captação** cuja coluna `Edição` contém `PAGO` (a confirmar na segunda; ver lista no fim). Isso fica isolado em `ticketSales()`.
- `utm_content` vem como `webp_vendas_img_10`, `Web3_coleta_vid_2_V2`: a família do criativo é o último `img_NN`/`vid_NN` do texto.

## Estrutura de arquivos

```
src/lib/marketing/
  types.ts            tipos compartilhados (só tipos)
  parse.ts            CSV, R$, datas BR, e-mail/telefone, número da edição, ano da live
  creatives.ts        família do criativo
  sheet-rows.ts       validação de cabeçalho + conversão das 4 abas em linhas tipadas
  meta-map.ts         conversão de uma linha da API do Meta em MetaAdDay
  editions.ts         configuração da edição (janela, metas) a partir da Visão Geral
  metrics.ts          frente, fundo, criativos, janelas 1/3/7
  matching.ts         presença por cadastro + compradores × presença
  report.ts           textos para WhatsApp
  *.test.ts           testes (node --test)
  sources/sheet.ts    busca CSV por gid
  sources/meta.ts     busca insights e links dos posts
  sources/platform.ts lê cadastros e eventos (somente leitura)
  store.ts            leitura/escrita das tabelas mkt_*
  sync.ts             orquestra a sincronização
  view.ts             monta o JSON que a página consome
src/app/api/marketing/sync/route.ts
src/app/api/marketing/data/route.ts
src/app/api/marketing/config/route.ts
src/app/admin/marketing/page.tsx
src/components/marketing/MarketingDashboard.tsx
src/components/marketing/EditionTab.tsx
src/components/marketing/CreativesTab.tsx
src/components/marketing/ValidationTab.tsx
supabase/marketing.sql
vercel.json
```

Regra de import dentro de `src/lib/marketing/` (para os testes rodarem no Node sem build): imports entre arquivos puros usam caminho relativo **com** extensão `.ts` (`import { x } from './parse.ts'`) e nunca `@/`. Só `sources/`, `store.ts`, `sync.ts` e `view.ts` podem usar `@/`.

## Review Focus

- Aba renomeada, removida ou planilha privada: o sync falha com mensagem dizendo qual aba e quais colunas faltam, e o painel mostra isso; nunca lê a aba errada em silêncio. Teste em Task 3.
- Formatos brasileiros sujos (`" Aprovada"`, `"Power "`, `9.990,00`, data vazia, `13/10` sem ano na virada do ano): parse correto; venda sem data conta na edição mas fica fora dos gráficos por dia. Testes em Task 2 e Task 3.
- Reembolso nunca conta como venda. Teste em Task 3.
- Edição sem gasto ou sem venda: CPA/ROAS/custo por call = `null` e "—" na tela. Teste em Task 6.
- Token do Meta ausente ou inválido: sync do Meta registra erro, o resto funciona e o gasto cai para o `Investimento Total` da Visão Geral marcado como "fonte: planilha". Testes em Task 6 e Task 8.

---

### Task 1: Base — branch, script de teste, tsconfig, schema SQL

**Files:**
- Modify: `package.json` (scripts)
- Modify: `tsconfig.json` (compilerOptions)
- Create: `supabase/marketing.sql`
- Create: `src/lib/marketing/types.ts`

**Interfaces:**
- Produces: todos os tipos abaixo, usados por todas as tasks.

- [ ] **Step 1: Criar a branch**

```bash
git checkout -b feat/marketing-dashboard
```

- [ ] **Step 2: Script de teste e tsconfig**

Em `package.json`, dentro de `"scripts"`, adicionar:

```json
"test": "node --test \"src/lib/marketing/**/*.test.ts\""
```

Em `tsconfig.json`, dentro de `"compilerOptions"`, adicionar (permitido porque o projeto já usa `"noEmit": true`):

```json
"allowImportingTsExtensions": true
```

- [ ] **Step 3: Tipos**

`src/lib/marketing/types.ts`:

```ts
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
```

- [ ] **Step 4: Schema SQL**

`supabase/marketing.sql`:

```sql
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
```

- [ ] **Step 5: Aplicar o SQL**

Rodar o conteúdo de `supabase/marketing.sql` no Supabase → SQL Editor do projeto do webinário. Conferir em Table Editor que as 6 tabelas `mkt_*` existem e que as tabelas antigas não mudaram.

- [ ] **Step 6: Verificar build e commit**

Run: `npm run build`
Expected: `✓ Compiled successfully` e 37 páginas geradas (nada novo ainda).

```bash
git add package.json tsconfig.json supabase/marketing.sql src/lib/marketing/types.ts
git commit -m "feat(marketing): base types, mkt_* schema and test script"
```

---

### Task 2: Parse (CSV, R$, datas, contatos, edição)

**Files:**
- Create: `src/lib/marketing/parse.ts`
- Test: `src/lib/marketing/parse.test.ts`

**Interfaces:**
- Produces:
  - `parseCsv(text: string): string[][]`
  - `toRecords(rows: string[][]): Record<string, string>[]` (chaves = cabeçalho com `trim()`; ignora colunas de cabeçalho vazio e linhas totalmente vazias)
  - `parseBRL(s: string): number` (inválido → `0`)
  - `parseDateTime(s: string): string | null` → `'YYYY-MM-DDTHH:mm:ss'`
  - `parseDay(s: string): string | null` → `'YYYY-MM-DD'`
  - `parseEditionNumber(s: string): number | null`
  - `normEmail(s: string): string`
  - `phoneKey(s: string): string` (últimos 8 dígitos; `''` se tiver menos de 8)
  - `inferLiveDate(dayMonth: string, today: string): string | null`
  - `addDays(day: string, n: number): string`

- [ ] **Step 1: Teste**

`src/lib/marketing/parse.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsv, toRecords, parseBRL, parseDateTime, parseDay, parseEditionNumber,
  normEmail, phoneKey, inferLiveDate, addDays,
} from './parse.ts';

test('parseCsv handles quotes, commas and newlines inside fields', () => {
  const rows = parseCsv('"a","b,c"\r\n"x ""y""","linha\nquebrada"\n');
  assert.deepEqual(rows, [['a', 'b,c'], ['x "y"', 'linha\nquebrada']]);
});

test('toRecords trims headers, drops blank header columns and empty rows', () => {
  const recs = toRecords([[' STATUS ', '', 'Produto'], ['Aprovada', 'lixo', 'Power'], ['', '', '']]);
  assert.deepEqual(recs, [{ STATUS: 'Aprovada', Produto: 'Power' }]);
});

test('parseBRL reads Brazilian money', () => {
  assert.equal(parseBRL('9.990,00'), 9990);
  assert.equal(parseBRL('R$ 119,96'), 119.96);
  assert.equal(parseBRL('9.9'), 9.9);
  assert.equal(parseBRL(''), 0);
  assert.equal(parseBRL('abc'), 0);
});

test('parseDateTime and parseDay accept BR and ISO formats', () => {
  assert.equal(parseDateTime('10/10/2026 08:57:00'), '2026-10-10T08:57:00');
  assert.equal(parseDateTime('08/10/2026 19:01'), '2026-10-08T19:01:00');
  assert.equal(parseDateTime('2026-09-29'), '2026-09-29T00:00:00');
  assert.equal(parseDateTime(''), null);
  assert.equal(parseDay('17/09/2026 15:01:08'), '2026-09-17');
  assert.equal(parseDay('lixo'), null);
});

test('parseEditionNumber', () => {
  assert.equal(parseEditionNumber('#022'), 22);
  assert.equal(parseEditionNumber(' #9 '), 9);
  assert.equal(parseEditionNumber(''), null);
});

test('normEmail and phoneKey', () => {
  assert.equal(normEmail('  Ana@Gmail.COM '), 'ana@gmail.com');
  assert.equal(phoneKey('+55 (51) 99876-5432'), '98765432');
  assert.equal(phoneKey('(51) 9876-5432'), '98765432');
  assert.equal(phoneKey('123'), '');
});

test('inferLiveDate picks the year closest to today', () => {
  assert.equal(inferLiveDate('13/10', '2026-10-10'), '2026-10-13');
  assert.equal(inferLiveDate('30/12', '2027-01-05'), '2026-12-30');
  assert.equal(inferLiveDate('05/01', '2026-12-28'), '2027-01-05');
  assert.equal(inferLiveDate('xx', '2026-10-10'), null);
});

test('addDays crosses month boundaries', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-10-01', -1), '2026-09-30');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (`Cannot find module ... parse.ts`).

- [ ] **Step 3: Implementação**

`src/lib/marketing/parse.ts`:

```ts
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function toRecords(rows: string[][]): Record<string, string>[] {
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim());
  const out: Record<string, string>[] = [];
  for (const r of rows.slice(1)) {
    if (r.every(v => v.trim() === '')) continue;
    const rec: Record<string, string> = {};
    header.forEach((h, i) => {
      if (h && !(h in rec)) rec[h] = r[i] ?? '';
    });
    out.push(rec);
  }
  return out;
}

export function parseBRL(s: string): number {
  let t = (s ?? '').replace(/R\$/g, '').replace(/\s/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  return t !== '' && Number.isFinite(n) ? n : 0;
}

const pad = (n: string | number) => String(n).padStart(2, '0');

export function parseDateTime(s: string): string | null {
  const t = (s ?? '').trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}T${pad(m[4] ?? 0)}:${pad(m[5] ?? 0)}:${pad(m[6] ?? 0)}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '00'}:${m[5] ?? '00'}:${m[6] ?? '00'}`;
  return null;
}

export function parseDay(s: string): string | null {
  return parseDateTime(s)?.slice(0, 10) ?? null;
}

export function parseEditionNumber(s: string): number | null {
  const m = (s ?? '').match(/#?\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

export function normEmail(s: string): string {
  return (s ?? '').trim().toLowerCase();
}

// ponytail: últimos 8 dígitos ignora DDI, DDD e o 9º dígito; colisão é rara dentro de uma edição.
export function phoneKey(s: string): string {
  const d = (s ?? '').replace(/\D/g, '');
  return d.length >= 8 ? d.slice(-8) : '';
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function inferLiveDate(dayMonth: string, today: string): string | null {
  const m = (dayMonth ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const year = Number(today.slice(0, 4));
  const t = Date.parse(`${today}T12:00:00Z`);
  let best: string | null = null;
  let bestDist = Infinity;
  for (const y of [year - 1, year, year + 1]) {
    const cand = `${y}-${pad(m[2])}-${pad(m[1])}`;
    const dist = Math.abs(Date.parse(`${cand}T12:00:00Z`) - t);
    if (dist < bestDist) { bestDist = dist; best = cand; }
  }
  return best;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS, 8 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/parse.ts src/lib/marketing/parse.test.ts
git commit -m "feat(marketing): CSV, BRL, date and contact parsing"
```

---

### Task 3: Linhas tipadas da planilha + família do criativo

**Files:**
- Create: `src/lib/marketing/creatives.ts`
- Create: `src/lib/marketing/sheet-rows.ts`
- Test: `src/lib/marketing/sheet-rows.test.ts`

**Interfaces:**
- Consumes: `parse.ts` (Task 2), tipos (Task 1).
- Produces:
  - `creativeFamily(raw: string, aliases?: Record<string, string>): string`
  - `class SheetFormatError extends Error { tab: string; missing: string[] }`
  - `TAB_COLUMNS: Record<TabKey, string[]>`, `type TabKey = 'capture' | 'overview' | 'sales' | 'schedule'`
  - `checkHeaders(tab: TabKey, records: Record<string, string>[]): void`
  - `toCaptureRows(recs): CaptureRow[]`, `toSaleRows(recs): SaleRow[]`, `toScheduleRows(recs): ScheduleRow[]`, `toOverviewRows(recs): OverviewRow[]`

- [ ] **Step 1: Teste**

`src/lib/marketing/sheet-rows.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { creativeFamily } from './creatives.ts';
import {
  checkHeaders, SheetFormatError, toCaptureRows, toSaleRows, toScheduleRows, toOverviewRows,
} from './sheet-rows.ts';

test('creativeFamily groups ad name variants and UTM prefixes', () => {
  assert.equal(creativeFamily('webp_vendas_img_10'), 'img_10');
  assert.equal(creativeFamily('img_01.2'), 'img_01');
  assert.equal(creativeFamily('img_01 - Cópia do VALIDADOS'), 'img_01');
  assert.equal(creativeFamily('Web3_coleta_vid_2_V2'), 'vid_2');
  assert.equal(creativeFamily('APIWEB01'), 'apiweb01');
  assert.equal(creativeFamily('  '), '(sem utm)');
  assert.equal(creativeFamily('APIWEB01', { apiweb01: 'API' }), 'API');
});

test('checkHeaders names the tab and the missing columns', () => {
  assert.throws(
    () => checkHeaders('sales', [{ STATUS: 'x' }]),
    (e: unknown) => e instanceof SheetFormatError && e.tab === 'sales' && e.missing.includes('Produto'),
  );
  assert.throws(() => checkHeaders('capture', []), SheetFormatError);
});

test('toCaptureRows', () => {
  const [r] = toCaptureRows([{
    'e-mail': ' A@B.com', whatsapp: '(51) 99999-1111', utm_source: 'fb', utm_medium: 'x',
    utm_campaign: 'c', utm_content: 'webp_vendas_img_10', data: '10/10/2026 08:57:00',
    'Webinário': '#022', 'Edição': 'WB03 - PAGO',
  }]);
  assert.equal(r.email, 'a@b.com');
  assert.equal(r.edition, 22);
  assert.equal(r.at, '2026-10-10T08:57:00');
  assert.equal(r.funnel, 'WB03 - PAGO');
});

test('toSaleRows: trims status/product, refund is not approved, empty date kept', () => {
  const rows = toSaleRows([
    { STATUS: ' Aprovada', Produto: 'Power ', Ticket: '16.788,00', Email: 'X@y.com', Telefone: '', utm_content_captacao: '', utm_content_venda: '', Data: '', 'Webinário': '#018' },
    { STATUS: 'Reembolso', Produto: 'Power Start', Ticket: '9.990,00', Email: 'z@y.com', Telefone: '', utm_content_captacao: '', utm_content_venda: '', Data: '17/09/2026 15:01:08', 'Webinário': '#018' },
  ]);
  assert.equal(rows[0].approved, true);
  assert.equal(rows[0].product, 'Power');
  assert.equal(rows[0].amount, 16788);
  assert.equal(rows[0].at, null);
  assert.equal(rows[1].approved, false);
});

test('toScheduleRows and toOverviewRows', () => {
  const [s] = toScheduleRows([{
    'Motivo da perda': '', Closer: 'Ana', utm_content: 'Web3_coleta_vid_18', 'SE - Agendada': 'Sim, Automático',
    'Agendada em': '2026-09-29', 'SE - Data': '2026-10-09', 'Ganho em': '', 'SE - Realizada': 'Sim',
    'E-mail - Trabalho': 'Q@w.com', 'WEBNÁRIO': '#020',
  }]);
  assert.equal(s.done, true);
  assert.equal(s.edition, 20);
  assert.equal(s.callDate, '2026-10-09');
  const [o] = toOverviewRows([{
    Data: '13/10', 'Webinário': '#022', 'Aplicações': '12', 'Agendamentos PWR': '3', 'Agendamentos PWS': '2',
    'Realizadas PWR': '2', 'Realizadas PWS': '1', 'Investimento Total': 'R$ 950,07',
  }]);
  assert.deepEqual(o, { edition: 22, dayMonth: '13/10', applications: 12, scheduled: 5, done: 3, investment: 950.07 });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementação**

`src/lib/marketing/creatives.ts`:

```ts
export function creativeFamily(raw: string, aliases: Record<string, string> = {}): string {
  const key = (raw ?? '').trim().toLowerCase();
  if (!key) return '(sem utm)';
  if (aliases[key]) return aliases[key];
  const matches = key.match(/(img|vid)_\d+/g);
  return matches ? matches[matches.length - 1] : key;
}
```

`src/lib/marketing/sheet-rows.ts`:

```ts
import type { CaptureRow, SaleRow, ScheduleRow, OverviewRow } from './types.ts';
import { normEmail, parseBRL, parseDateTime, parseDay, parseEditionNumber } from './parse.ts';

export type TabKey = 'capture' | 'overview' | 'sales' | 'schedule';

export const TAB_COLUMNS: Record<TabKey, string[]> = {
  capture: ['e-mail', 'whatsapp', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'data', 'Webinário', 'Edição'],
  overview: ['Data', 'Webinário', 'Aplicações', 'Agendamentos PWR', 'Agendamentos PWS', 'Realizadas PWR', 'Realizadas PWS', 'Investimento Total'],
  sales: ['STATUS', 'Produto', 'Ticket', 'Email', 'Telefone', 'utm_content_captacao', 'utm_content_venda', 'Data', 'Webinário'],
  schedule: ['Motivo da perda', 'Closer', 'utm_content', 'SE - Agendada', 'Agendada em', 'SE - Data', 'Ganho em', 'SE - Realizada', 'E-mail - Trabalho', 'WEBNÁRIO'],
};

export class SheetFormatError extends Error {
  tab: string;
  missing: string[];
  constructor(tab: string, missing: string[]) {
    super(`Aba "${tab}": colunas não encontradas: ${missing.join(', ') || '(aba vazia)'}`);
    this.tab = tab;
    this.missing = missing;
  }
}

export function checkHeaders(tab: TabKey, records: Record<string, string>[]): void {
  if (!records.length) throw new SheetFormatError(tab, []);
  const present = new Set(Object.keys(records[0]));
  const missing = TAB_COLUMNS[tab].filter(c => !present.has(c));
  if (missing.length) throw new SheetFormatError(tab, missing);
}

const num = (s: string) => parseBRL(s);
const v = (r: Record<string, string>, k: string) => (r[k] ?? '').trim();

export function toCaptureRows(recs: Record<string, string>[]): CaptureRow[] {
  return recs.map(r => ({
    email: normEmail(v(r, 'e-mail')),
    phone: v(r, 'whatsapp'),
    utmSource: v(r, 'utm_source'),
    utmMedium: v(r, 'utm_medium'),
    utmCampaign: v(r, 'utm_campaign'),
    utmContent: v(r, 'utm_content'),
    at: parseDateTime(v(r, 'data')),
    edition: parseEditionNumber(v(r, 'Webinário')),
    funnel: v(r, 'Edição'),
  }));
}

export function toSaleRows(recs: Record<string, string>[]): SaleRow[] {
  return recs.map(r => ({
    approved: v(r, 'STATUS').toLowerCase() === 'aprovada',
    product: v(r, 'Produto'),
    amount: num(v(r, 'Ticket')),
    email: normEmail(v(r, 'Email')),
    phone: v(r, 'Telefone'),
    utmContentCapture: v(r, 'utm_content_captacao'),
    utmContentSale: v(r, 'utm_content_venda'),
    at: parseDateTime(v(r, 'Data')),
    edition: parseEditionNumber(v(r, 'Webinário')),
  }));
}

export function toScheduleRows(recs: Record<string, string>[]): ScheduleRow[] {
  return recs.map(r => ({
    lostReason: v(r, 'Motivo da perda'),
    closer: v(r, 'Closer'),
    utmContent: v(r, 'utm_content'),
    scheduledAt: parseDay(v(r, 'Agendada em')),
    callDate: parseDay(v(r, 'SE - Data')),
    wonAt: parseDay(v(r, 'Ganho em')),
    done: v(r, 'SE - Realizada').toLowerCase() === 'sim',
    email: normEmail(v(r, 'E-mail - Trabalho')),
    edition: parseEditionNumber(v(r, 'WEBNÁRIO')),
  }));
}

export function toOverviewRows(recs: Record<string, string>[]): OverviewRow[] {
  const out: OverviewRow[] = [];
  for (const r of recs) {
    const edition = parseEditionNumber(v(r, 'Webinário'));
    if (edition === null) continue;
    out.push({
      edition,
      dayMonth: v(r, 'Data'),
      applications: num(v(r, 'Aplicações')),
      scheduled: num(v(r, 'Agendamentos PWR')) + num(v(r, 'Agendamentos PWS')),
      done: num(v(r, 'Realizadas PWR')) + num(v(r, 'Realizadas PWS')),
      investment: num(v(r, 'Investimento Total')),
    });
  }
  return out;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS em todos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/creatives.ts src/lib/marketing/sheet-rows.ts src/lib/marketing/sheet-rows.test.ts
git commit -m "feat(marketing): typed sheet rows, header validation, creative families"
```

---

### Task 4: Conversão das linhas do Meta

**Files:**
- Create: `src/lib/marketing/meta-map.ts`
- Test: `src/lib/marketing/meta-map.test.ts`

**Interfaces:**
- Produces: `type MetaInsightRow` (formato cru da Graph API) e `mapInsightRow(row: MetaInsightRow): MetaAdDay`

- [ ] **Step 1: Teste**

`src/lib/marketing/meta-map.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapInsightRow } from './meta-map.ts';

test('mapInsightRow reads spend, clicks, IC (pixel first), video and LPV', () => {
  const d = mapInsightRow({
    date_start: '2026-10-08', ad_id: '1', ad_name: 'img_10', adset_name: 'cj', campaign_name: 'cp',
    spend: '100.12', impressions: '5000', inline_link_clicks: '43',
    actions: [
      { action_type: 'initiate_checkout', value: '3' },
      { action_type: 'offsite_conversion.fb_pixel_initiate_checkout', value: '2' },
      { action_type: 'landing_page_view', value: '30' },
      { action_type: 'video_view', value: '900' },
    ],
    video_thruplay_watched_actions: [{ action_type: 'video_view', value: '120' }],
  });
  assert.deepEqual(d, {
    date: '2026-10-08', adId: '1', adName: 'img_10', adsetName: 'cj', campaignName: 'cp',
    spend: 100.12, impressions: 5000, linkClicks: 43, landingViews: 30,
    initiateCheckouts: 2, video3s: 900, thruplays: 120,
  });
});

test('mapInsightRow tolerates missing fields', () => {
  const d = mapInsightRow({ date_start: '2026-10-08', ad_id: '2' });
  assert.equal(d.spend, 0);
  assert.equal(d.initiateCheckouts, 0);
  assert.equal(d.adName, '');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test` → FAIL.

- [ ] **Step 3: Implementação**

`src/lib/marketing/meta-map.ts`:

```ts
import type { MetaAdDay } from './types.ts';

type Action = { action_type: string; value: string };

export type MetaInsightRow = {
  date_start: string;
  ad_id: string;
  ad_name?: string;
  adset_name?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  inline_link_clicks?: string;
  actions?: Action[];
  video_thruplay_watched_actions?: Action[];
};

const n = (s?: string) => (s && Number.isFinite(Number(s)) ? Number(s) : 0);
const act = (list: Action[] | undefined, type: string) => n(list?.find(a => a.action_type === type)?.value);

export function mapInsightRow(r: MetaInsightRow): MetaAdDay {
  // O Meta devolve o IC do pixel e um agregado 'initiate_checkout'; somar duplicaria.
  const pixelIc = r.actions?.find(a => a.action_type === 'offsite_conversion.fb_pixel_initiate_checkout');
  return {
    date: r.date_start,
    adId: r.ad_id,
    adName: r.ad_name ?? '',
    adsetName: r.adset_name ?? '',
    campaignName: r.campaign_name ?? '',
    spend: n(r.spend),
    impressions: n(r.impressions),
    linkClicks: n(r.inline_link_clicks),
    landingViews: act(r.actions, 'landing_page_view'),
    initiateCheckouts: pixelIc ? n(pixelIc.value) : act(r.actions, 'initiate_checkout'),
    video3s: act(r.actions, 'video_view'),
    thruplays: act(r.video_thruplay_watched_actions, 'video_view'),
  };
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/meta-map.ts src/lib/marketing/meta-map.test.ts
git commit -m "feat(marketing): map Meta insights rows"
```

---

### Task 5: Configuração da edição

**Files:**
- Create: `src/lib/marketing/editions.ts`
- Test: `src/lib/marketing/editions.test.ts`

**Interfaces:**
- Consumes: `inferLiveDate`, `addDays` (Task 2), `OverviewRow`, `EditionConfig`.
- Produces:
  - `type EditionOverride = Partial<Omit<EditionConfig, 'number'>> & { number: number }`
  - `buildEditions(overview: OverviewRow[], overrides: EditionOverride[], today: string): EditionConfig[]` ordenado por número crescente. Janela padrão: dia seguinte à live anterior até o dia da live; a primeira edição começa 7 dias antes da live. Metas padrão 25/35/45, ingresso 9,90.

- [ ] **Step 1: Teste**

`src/lib/marketing/editions.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEditions } from './editions.ts';

const ov = (edition: number, dayMonth: string) =>
  ({ edition, dayMonth, applications: 0, scheduled: 0, done: 0, investment: 0 });

test('default windows chain from the previous live', () => {
  const eds = buildEditions([ov(22, '13/10'), ov(21, '06/10')], [], '2026-10-10');
  assert.deepEqual(eds.map(e => [e.number, e.liveDate, e.windowStart, e.windowEnd]), [
    [21, '2026-10-06', '2026-09-29', '2026-10-06'],
    [22, '2026-10-13', '2026-10-07', '2026-10-13'],
  ]);
  assert.equal(eds[1].cpaGood, 35);
  assert.equal(eds[1].ticketPrice, 9.9);
});

test('overrides win over defaults', () => {
  const [e] = buildEditions([ov(22, '13/10')], [{ number: 22, windowStart: '2026-09-29', cpaGood: 30 }], '2026-10-10');
  assert.equal(e.windowStart, '2026-09-29');
  assert.equal(e.cpaGood, 30);
  assert.equal(e.cpaLimit, 45);
});

test('rows with unreadable date are skipped', () => {
  assert.equal(buildEditions([ov(5, '')], [], '2026-10-10').length, 0);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test` → FAIL.

- [ ] **Step 3: Implementação**

`src/lib/marketing/editions.ts`:

```ts
import type { EditionConfig, OverviewRow } from './types.ts';
import { addDays, inferLiveDate } from './parse.ts';

export type EditionOverride = Partial<Omit<EditionConfig, 'number'>> & { number: number };

const DEFAULTS = { ticketPrice: 9.9, cpaDream: 25, cpaGood: 35, cpaLimit: 45 };

export function buildEditions(overview: OverviewRow[], overrides: EditionOverride[], today: string): EditionConfig[] {
  const byNumber = new Map(overrides.map(o => [o.number, o]));
  const base = overview
    .map(o => ({ number: o.edition, liveDate: inferLiveDate(o.dayMonth, today) }))
    .filter((e): e is { number: number; liveDate: string } => e.liveDate !== null)
    .sort((a, b) => a.number - b.number);

  return base.map((e, i) => {
    const prev = base[i - 1];
    const o = byNumber.get(e.number) ?? { number: e.number };
    const strip = Object.fromEntries(Object.entries(o).filter(([, val]) => val !== null && val !== undefined));
    return {
      ...DEFAULTS,
      number: e.number,
      liveDate: e.liveDate,
      windowStart: prev ? addDays(prev.liveDate, 1) : addDays(e.liveDate, -7),
      windowEnd: e.liveDate,
      ...strip,
    } as EditionConfig;
  });
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/editions.ts src/lib/marketing/editions.test.ts
git commit -m "feat(marketing): edition config with capture windows and CPA goals"
```

---

### Task 6: Métricas (frente, fundo, criativos, janelas 1/3/7)

**Files:**
- Create: `src/lib/marketing/metrics.ts`
- Test: `src/lib/marketing/metrics.test.ts`

**Interfaces:**
- Consumes: `creativeFamily` (Task 3), `addDays` (Task 2), tipos.
- Produces:
  - `div(a: number, b: number): number | null`
  - `ticketSales(captures: CaptureRow[], editions: number[]): CaptureRow[]` — linhas com `edition` na lista e `funnel` contendo `pago` (sem diferenciar maiúsculas)
  - `inRange(day: string | null, r: DateRange | null): boolean` (dia nulo só passa quando `r` é nulo)
  - `adsInWindows(ads: MetaAdDay[], eds: EditionConfig[], r: DateRange | null): MetaAdDay[]`
  - `type FrontSummary = { sales: number; revenue: number; spend: number; spendSource: 'meta' | 'planilha' | 'nenhum'; roas: number | null; cpa: number | null; cpaSellingAds: number | null; spendNoSales: number; topNoSale: { family: string; spend: number } | null; ic: number; costPerIc: number | null }`
  - `frontSummary(sales: CaptureRow[], ads: MetaAdDay[], eds: EditionConfig[], aliases: Record<string,string>, fallbackSpend: number): FrontSummary`
  - `type CreativeStats = { family: string; sales: number; spend: number; cpa: number | null; ic: number; costPerIc: number | null; impressions: number; ctr: number | null; hookRate: number | null; bodyRate: number | null; band: 'sonho' | 'bom' | 'limite' | 'acima' | null }`
  - `creativeTable(sales: CaptureRow[], ads: MetaAdDay[], cfg: EditionConfig, aliases: Record<string,string>): CreativeStats[]` (ordenado por vendas desc, depois gasto desc)
  - `type TrendLabel = 'estável' | 'caindo' | 'caindo forte' | 'sem entrega' | 'sem venda'`
  - `type Window137 = { family: string; d1: CreativeStats; d3: CreativeStats; d7: CreativeStats; label: TrendLabel }`
  - `windows137(sales: CaptureRow[], ads: MetaAdDay[], cfg: EditionConfig, aliases: Record<string,string>, yesterday: string): Window137[]`
  - `type BackSummary = { applications: number; scheduled: number; done: number; highTicketSales: number; highTicketRevenue: number; costPerScheduled: number | null; costPerDone: number | null; roasTotal: number | null }`
  - `backSummary(overview: OverviewRow[], schedules: ScheduleRow[], htSales: SaleRow[], editions: number[], front: FrontSummary): BackSummary`

Regras: venda de ingresso conta pelo dia de `at` (BRT); gasto pelo `date` do Meta dentro da janela da edição. Família da venda = `creativeFamily(utmContent)`; família do anúncio = `creativeFamily(adName)`. `spendSource` = `'meta'` se houver qualquer linha do Meta na janela, senão `'planilha'` quando `fallbackSpend > 0`, senão `'nenhum'`. Agendamentos e calls: contagem das linhas do Pipedrive com `edition` na lista; se nenhuma linha, usa a soma da Visão Geral.

- [ ] **Step 1: Teste (inclui o caso real do report de 08/10)**

`src/lib/marketing/metrics.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, EditionConfig, MetaAdDay } from './types.ts';
import { div, ticketSales, frontSummary, creativeTable, windows137, backSummary } from './metrics.ts';

const cfg: EditionConfig = {
  number: 22, liveDate: '2026-10-13', windowStart: '2026-09-29', windowEnd: '2026-10-13',
  ticketPrice: 9.9, cpaDream: 25, cpaGood: 35, cpaLimit: 45,
};
const sale = (content: string, at: string): CaptureRow => ({
  email: `${content}${at}@x.com`, phone: '', utmSource: 'fb', utmMedium: '', utmCampaign: '',
  utmContent: `webp_vendas_${content}`, at: `${at}T10:00:00`, edition: 22, funnel: 'WB03 - PAGO',
});
const ad = (adName: string, date: string, spend: number, ic = 0, impressions = 1000, linkClicks = 10): MetaAdDay => ({
  date, adId: `${adName}-id`, adName, adsetName: '', campaignName: '', spend, impressions, linkClicks,
  landingViews: 0, initiateCheckouts: ic, video3s: 0, thruplays: 0,
});

test('div never returns NaN or Infinity', () => {
  assert.equal(div(1, 0), null);
  assert.equal(div(0, 0), null);
  assert.equal(div(10, 4), 2.5);
});

test('ticketSales keeps only paid funnel rows of the chosen editions', () => {
  const rows = [sale('img_10', '2026-10-08'), { ...sale('img_10', '2026-10-08'), funnel: 'WB03' }, { ...sale('img_10', '2026-10-08'), edition: 21 }];
  assert.equal(ticketSales(rows, [22]).length, 1);
});

test('report #022 (08/10): img_10 CPA 17,14 and campaign CPA 39,04', () => {
  const sales = [
    ...Array.from({ length: 7 }, () => sale('img_10', '2026-10-07')),
    ...Array.from({ length: 2 }, () => sale('vid_1', '2026-10-07')),
    ...Array.from({ length: 4 }, () => sale('img_01', '2026-10-07')),
    ...Array.from({ length: 3 }, () => sale('img_11', '2026-10-07')),
  ];
  const ads = [
    ad('img_10', '2026-10-07', 119.96), ad('vid_1', '2026-10-07', 43.94),
    ad('img_01', '2026-10-07', 150), ad('img_01.2', '2026-10-07', 77.22),
    ad('img_11', '2026-10-07', 180.47), ad('vid_6', '2026-10-07', 15.86), ad('img_04', '2026-10-07', 37.24),
  ];
  const f = frontSummary(sales, ads, [cfg], {}, 0);
  assert.equal(f.sales, 16);
  assert.equal(f.revenue, 158.4);
  assert.equal(f.spend.toFixed(2), '624.69');
  assert.equal(f.cpa?.toFixed(2), '39.04');
  assert.equal(f.cpaSellingAds?.toFixed(2), '35.72');
  assert.equal(f.spendNoSales.toFixed(2), '53.10');
  assert.deepEqual(f.topNoSale, { family: 'img_04', spend: 37.24 });
  assert.equal(f.spendSource, 'meta');

  const t = creativeTable(sales, ads, cfg, {});
  assert.equal(t[0].family, 'img_10');
  assert.equal(t[0].cpa?.toFixed(2), '17.14');
  assert.equal(t[0].band, 'sonho');
  assert.equal(t.find(c => c.family === 'img_01')?.cpa?.toFixed(2), '56.81');
  assert.equal(t.find(c => c.family === 'img_01')?.band, 'acima');
});

test('no Meta data falls back to sheet investment; no spend gives null CPA', () => {
  const sales = [sale('img_10', '2026-10-07')];
  assert.equal(frontSummary(sales, [], [cfg], {}, 100).spendSource, 'planilha');
  const none = frontSummary(sales, [], [cfg], {}, 0);
  assert.equal(none.spendSource, 'nenhum');
  assert.equal(none.cpa, null);
  assert.equal(none.roas, null);
});

test('ads outside the edition window are ignored', () => {
  const f = frontSummary([], [ad('img_10', '2026-09-01', 500)], [cfg], {}, 0);
  assert.equal(f.spend, 0);
});

test('windows137 labels match the report rules', () => {
  const y = '2026-10-08';
  const sales = [
    sale('img_10', '2026-10-02'), sale('img_10', '2026-10-06'), sale('img_10', '2026-10-08'),
    sale('img_11', '2026-10-02'), sale('img_11', '2026-10-02'), sale('img_11', '2026-10-02'), sale('img_11', '2026-10-08'),
    sale('vid_6', '2026-10-02'),
  ];
  const ads = [
    ad('img_10', '2026-10-02', 30), ad('img_10', '2026-10-06', 30), ad('img_10', '2026-10-08', 30),
    ad('img_11', '2026-10-02', 60), ad('img_11', '2026-10-08', 180),
    ad('vid_6', '2026-10-02', 20), ad('vid_6', '2026-10-07', 44),
    ad('vid_3', '2026-10-08', 3.42),
  ];
  const w = Object.fromEntries(windows137(sales, ads, cfg, {}, y).map(x => [x.family, x.label]));
  assert.equal(w['img_10'], 'estável');
  assert.equal(w['img_11'], 'caindo forte');
  assert.equal(w['vid_6'], 'caindo');
  assert.equal(w['vid_3'], 'sem entrega');
});

test('backSummary: cost per call uses front spend; Pipedrive rows win over overview', () => {
  const front = frontSummary([], [ad('img_10', '2026-10-07', 300)], [cfg], {}, 0);
  const b = backSummary(
    [{ edition: 22, dayMonth: '13/10', applications: 10, scheduled: 99, done: 99, investment: 0 }],
    [
      { lostReason: '', closer: '', utmContent: '', scheduledAt: '2026-10-14', callDate: '2026-10-15', wonAt: null, done: true, email: 'a@x', edition: 22 },
      { lostReason: '', closer: '', utmContent: '', scheduledAt: '2026-10-14', callDate: '2026-10-16', wonAt: null, done: false, email: 'b@x', edition: 22 },
    ],
    [{ approved: true, product: 'Power', amount: 16788, email: 'a@x', phone: '', utmContentCapture: '', utmContentSale: '', at: null, edition: 22 },
     { approved: false, product: 'Power', amount: 16788, email: 'c@x', phone: '', utmContentCapture: '', utmContentSale: '', at: null, edition: 22 }],
    [22], front,
  );
  assert.equal(b.scheduled, 2);
  assert.equal(b.done, 1);
  assert.equal(b.costPerScheduled, 150);
  assert.equal(b.costPerDone, 300);
  assert.equal(b.highTicketSales, 1);
  assert.equal(b.applications, 10);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test` → FAIL.

- [ ] **Step 3: Implementação**

`src/lib/marketing/metrics.ts`:

```ts
import type { CaptureRow, DateRange, EditionConfig, MetaAdDay, OverviewRow, SaleRow, ScheduleRow } from './types.ts';
import { creativeFamily } from './creatives.ts';
import { addDays } from './parse.ts';

export function div(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

const day = (at: string | null) => (at ? at.slice(0, 10) : null);

export function inRange(d: string | null, r: DateRange | null): boolean {
  if (!r) return true;
  return d !== null && d >= r.from && d <= r.to;
}

export function ticketSales(captures: CaptureRow[], editions: number[]): CaptureRow[] {
  const set = new Set(editions);
  return captures.filter(c => c.edition !== null && set.has(c.edition) && /pago/i.test(c.funnel));
}

export function adsInWindows(ads: MetaAdDay[], eds: EditionConfig[], r: DateRange | null): MetaAdDay[] {
  return ads.filter(a => eds.some(e => a.date >= e.windowStart && a.date <= e.windowEnd) && inRange(a.date, r));
}

export type FrontSummary = {
  sales: number; revenue: number; spend: number; spendSource: 'meta' | 'planilha' | 'nenhum';
  roas: number | null; cpa: number | null; cpaSellingAds: number | null;
  spendNoSales: number; topNoSale: { family: string; spend: number } | null;
  ic: number; costPerIc: number | null;
};

function spendByFamily(ads: MetaAdDay[], aliases: Record<string, string>) {
  const m = new Map<string, number>();
  for (const a of ads) {
    const f = creativeFamily(a.adName, aliases);
    m.set(f, (m.get(f) ?? 0) + a.spend);
  }
  return m;
}

function salesByFamily(sales: CaptureRow[], aliases: Record<string, string>) {
  const m = new Map<string, number>();
  for (const s of sales) {
    const f = creativeFamily(s.utmContent, aliases);
    m.set(f, (m.get(f) ?? 0) + 1);
  }
  return m;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function frontSummary(
  sales: CaptureRow[], ads: MetaAdDay[], eds: EditionConfig[],
  aliases: Record<string, string>, fallbackSpend: number,
): FrontSummary {
  const winAds = adsInWindows(ads, eds, null);
  const metaSpend = round2(winAds.reduce((s, a) => s + a.spend, 0));
  const spendSource = winAds.length ? 'meta' : fallbackSpend > 0 ? 'planilha' : 'nenhum';
  const spend = spendSource === 'meta' ? metaSpend : spendSource === 'planilha' ? fallbackSpend : 0;
  const price = eds[0]?.ticketPrice ?? 9.9;
  const revenue = round2(sales.length * price);
  const famSpend = spendByFamily(winAds, aliases);
  const famSales = salesByFamily(sales, aliases);
  let sellingSpend = 0;
  let spendNoSales = 0;
  let topNoSale: FrontSummary['topNoSale'] = null;
  for (const [family, s] of famSpend) {
    if ((famSales.get(family) ?? 0) > 0) sellingSpend += s;
    else {
      spendNoSales += s;
      if (!topNoSale || s > topNoSale.spend) topNoSale = { family, spend: round2(s) };
    }
  }
  const ic = winAds.reduce((s, a) => s + a.initiateCheckouts, 0);
  const salesFromSelling = [...famSales].filter(([f]) => famSpend.has(f)).reduce((s, [, n]) => s + n, 0);
  return {
    sales: sales.length, revenue, spend, spendSource,
    // Sem investimento conhecido, CPA é "—" e não R$ 0,00.
    roas: div(revenue, spend), cpa: spendSource === 'nenhum' ? null : div(spend, sales.length),
    cpaSellingAds: div(sellingSpend, salesFromSelling),
    spendNoSales: round2(spendNoSales), topNoSale, ic, costPerIc: div(spend, ic),
  };
}

export type CreativeStats = {
  family: string; sales: number; spend: number; cpa: number | null; ic: number; costPerIc: number | null;
  impressions: number; ctr: number | null; hookRate: number | null; bodyRate: number | null;
  band: 'sonho' | 'bom' | 'limite' | 'acima' | null;
};

function band(cpa: number | null, cfg: EditionConfig): CreativeStats['band'] {
  if (cpa === null) return null;
  if (cpa <= cfg.cpaDream) return 'sonho';
  if (cpa <= cfg.cpaGood) return 'bom';
  if (cpa <= cfg.cpaLimit) return 'limite';
  return 'acima';
}

function statsFor(family: string, sales: number, ads: MetaAdDay[], cfg: EditionConfig): CreativeStats {
  const sum = (k: keyof MetaAdDay) => ads.reduce((s, a) => s + (a[k] as number), 0);
  const spend = round2(sum('spend'));
  const impressions = sum('impressions');
  const video3s = sum('video3s');
  const ic = sum('initiateCheckouts');
  const cpa = div(spend, sales);
  return {
    family, sales, spend, cpa, ic, costPerIc: div(spend, ic), impressions,
    ctr: div(sum('linkClicks'), impressions), hookRate: div(video3s, impressions),
    bodyRate: div(sum('thruplays'), video3s), band: band(cpa, cfg),
  };
}

function table(sales: CaptureRow[], ads: MetaAdDay[], cfg: EditionConfig, aliases: Record<string, string>): CreativeStats[] {
  const famSales = salesByFamily(sales, aliases);
  const adsByFam = new Map<string, MetaAdDay[]>();
  for (const a of ads) {
    const f = creativeFamily(a.adName, aliases);
    adsByFam.set(f, [...(adsByFam.get(f) ?? []), a]);
  }
  const families = new Set([...famSales.keys(), ...adsByFam.keys()]);
  return [...families]
    .map(f => statsFor(f, famSales.get(f) ?? 0, adsByFam.get(f) ?? [], cfg))
    .sort((a, b) => b.sales - a.sales || b.spend - a.spend);
}

export function creativeTable(sales: CaptureRow[], ads: MetaAdDay[], cfg: EditionConfig, aliases: Record<string, string>): CreativeStats[] {
  return table(sales, adsInWindows(ads, [cfg], null), cfg, aliases);
}

export type TrendLabel = 'estável' | 'caindo' | 'caindo forte' | 'sem entrega' | 'sem venda';
export type Window137 = { family: string; d1: CreativeStats; d3: CreativeStats; d7: CreativeStats; label: TrendLabel };

// ponytail: regra simples e explicável; ajustar os limites 1.15 / 1.5 se a equipe discordar dos rótulos.
function label(d1: CreativeStats, d3: CreativeStats, d7: CreativeStats): TrendLabel {
  if (d3.spend < 20 && d1.spend < 5) return 'sem entrega';
  if (d7.sales === 0) return 'sem venda';
  if (d3.sales === 0) return 'caindo';
  const ratio = (d3.cpa ?? 0) / (d7.cpa ?? 1);
  if (ratio <= 1.15) return 'estável';
  if (ratio <= 1.5) return 'caindo';
  return 'caindo forte';
}

export function windows137(
  sales: CaptureRow[], ads: MetaAdDay[], cfg: EditionConfig,
  aliases: Record<string, string>, yesterday: string,
): Window137[] {
  const win = (n: number) => {
    const r = { from: addDays(yesterday, -(n - 1)), to: yesterday };
    return table(sales.filter(s => inRange(day(s.at), r)), ads.filter(a => inRange(a.date, r)), cfg, aliases);
  };
  const [w1, w3, w7] = [win(1), win(3), win(7)];
  const empty = (family: string) => statsFor(family, 0, [], cfg);
  return w7.map(d7 => {
    const d1 = w1.find(x => x.family === d7.family) ?? empty(d7.family);
    const d3 = w3.find(x => x.family === d7.family) ?? empty(d7.family);
    return { family: d7.family, d1, d3, d7, label: label(d1, d3, d7) };
  });
}

export type BackSummary = {
  applications: number; scheduled: number; done: number;
  highTicketSales: number; highTicketRevenue: number;
  costPerScheduled: number | null; costPerDone: number | null; roasTotal: number | null;
};

export function backSummary(
  overview: OverviewRow[], schedules: ScheduleRow[], htSales: SaleRow[],
  editions: number[], front: FrontSummary,
): BackSummary {
  const set = new Set(editions);
  const ov = overview.filter(o => set.has(o.edition));
  const sch = schedules.filter(s => s.edition !== null && set.has(s.edition));
  const scheduled = sch.length ? sch.length : ov.reduce((s, o) => s + o.scheduled, 0);
  const done = sch.length ? sch.filter(s => s.done).length : ov.reduce((s, o) => s + o.done, 0);
  const ht = htSales.filter(s => s.approved && s.edition !== null && set.has(s.edition));
  const htRevenue = round2(ht.reduce((s, x) => s + x.amount, 0));
  return {
    applications: ov.reduce((s, o) => s + o.applications, 0),
    scheduled, done,
    highTicketSales: ht.length, highTicketRevenue: htRevenue,
    costPerScheduled: div(front.spend, scheduled), costPerDone: div(front.spend, done),
    roasTotal: div(front.revenue + htRevenue, front.spend),
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS. Se o teste do report #022 falhar em `cpaSellingAds` ou `spendNoSales`, conferir a soma no teste antes de mudar a regra: os números vêm do report de 08/10 (`R$ 35,72` e `R$ 53,10`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/metrics.ts src/lib/marketing/metrics.test.ts
git commit -m "feat(marketing): front/back summaries, creative table, 1-3-7 windows"
```

---

### Task 7: Presença e cruzamento compradores × live

**Files:**
- Create: `src/lib/marketing/matching.ts`
- Test: `src/lib/marketing/matching.test.ts`

**Interfaces:**
- Consumes: `normEmail`, `phoneKey` (Task 2), tipos.
- Produces:
  - `buildAttendance(regs: { id: string; email: string }[], events: { registration_id: string | null; type: string; created_at: string }[], liveStartMs: number, pitchSeconds: number): Attendance[]` — `minutesWatched` = nº de heartbeats (1 por minuto, `AoVivoContent.tsx`), `stayedToPitch` = último evento ≥ início + pitch.
  - `type BuyerMatch = { email: string; product: string; amount: number; matchedBy: 'email' | 'telefone' | null; registered: boolean; entered: boolean; minutesWatched: number; stayedToPitch: boolean; clickedCta: boolean }`
  - `matchBuyers(buyers: { email: string; phone: string; product: string; amount: number }[], attendance: Attendance[], captures: CaptureRow[]): BuyerMatch[]`

- [ ] **Step 1: Teste**

`src/lib/marketing/matching.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAttendance, matchBuyers } from './matching.ts';
import type { CaptureRow } from './types.ts';

const start = Date.UTC(2026, 9, 13, 23, 0, 0);
const at = (min: number) => new Date(start + min * 60000).toISOString();

test('buildAttendance counts heartbeats, entry, CTA and pitch', () => {
  const att = buildAttendance(
    [{ id: 'r1', email: 'A@x.com' }, { id: 'r2', email: 'b@x.com' }],
    [
      { registration_id: 'r1', type: 'enter_live', created_at: at(1) },
      { registration_id: 'r1', type: 'heartbeat', created_at: at(2) },
      { registration_id: 'r1', type: 'heartbeat', created_at: at(70) },
      { registration_id: 'r1', type: 'cta_click', created_at: at(71) },
      { registration_id: null, type: 'heartbeat', created_at: at(3) },
    ],
    start, 3970,
  );
  const r1 = att.find(a => a.registrationId === 'r1')!;
  assert.equal(r1.email, 'a@x.com');
  assert.equal(r1.entered, true);
  assert.equal(r1.minutesWatched, 2);
  assert.equal(r1.stayedToPitch, true);
  assert.equal(r1.clickedCta, true);
  const r2 = att.find(a => a.registrationId === 'r2')!;
  assert.equal(r2.entered, false);
  assert.equal(r2.stayedToPitch, false);
});

test('matchBuyers: email first, then phone via capture, else unmatched', () => {
  const attendance = [
    { registrationId: 'r1', email: 'a@x.com', entered: true, minutesWatched: 50, stayedToPitch: true, clickedCta: true },
    { registrationId: 'r2', email: 'cadastro@x.com', entered: true, minutesWatched: 10, stayedToPitch: false, clickedCta: false },
  ];
  const captures = [{ email: 'cadastro@x.com', phone: '(51) 99876-5432' } as CaptureRow];
  const m = matchBuyers([
    { email: 'A@x.com', phone: '', product: 'Power', amount: 1 },
    { email: 'outro@x.com', phone: '+55 51 99876-5432', product: 'Power', amount: 1 },
    { email: 'ninguem@x.com', phone: '', product: 'Power', amount: 1 },
  ], attendance, captures);
  assert.deepEqual(m.map(x => x.matchedBy), ['email', 'telefone', null]);
  assert.equal(m[1].minutesWatched, 10);
  assert.equal(m[2].registered, false);
  assert.equal(m[2].entered, false);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test` → FAIL.

- [ ] **Step 3: Implementação**

`src/lib/marketing/matching.ts`:

```ts
import type { Attendance, CaptureRow } from './types.ts';
import { normEmail, phoneKey } from './parse.ts';

export function buildAttendance(
  regs: { id: string; email: string }[],
  events: { registration_id: string | null; type: string; created_at: string }[],
  liveStartMs: number,
  pitchSeconds: number,
): Attendance[] {
  const pitchMs = liveStartMs + pitchSeconds * 1000;
  const entered = new Set<string>();
  const cta = new Set<string>();
  const beats = new Map<string, number>();
  const last = new Map<string, number>();
  for (const e of events) {
    const id = e.registration_id;
    if (!id) continue;
    const t = Date.parse(e.created_at);
    if (t > (last.get(id) ?? 0)) last.set(id, t);
    if (e.type === 'enter_live') entered.add(id);
    else if (e.type === 'cta_click') cta.add(id);
    else if (e.type === 'heartbeat') beats.set(id, (beats.get(id) ?? 0) + 1);
  }
  return regs.map(r => ({
    registrationId: r.id,
    email: normEmail(r.email),
    entered: entered.has(r.id),
    minutesWatched: beats.get(r.id) ?? 0,
    stayedToPitch: (last.get(r.id) ?? 0) >= pitchMs,
    clickedCta: cta.has(r.id),
  }));
}

export type BuyerMatch = {
  email: string; product: string; amount: number; matchedBy: 'email' | 'telefone' | null;
  registered: boolean; entered: boolean; minutesWatched: number; stayedToPitch: boolean; clickedCta: boolean;
};

export function matchBuyers(
  buyers: { email: string; phone: string; product: string; amount: number }[],
  attendance: Attendance[],
  captures: CaptureRow[],
): BuyerMatch[] {
  const byEmail = new Map(attendance.map(a => [a.email, a]));
  const emailByPhone = new Map<string, string>();
  for (const c of captures) {
    const k = phoneKey(c.phone);
    if (k && byEmail.has(normEmail(c.email))) emailByPhone.set(k, normEmail(c.email));
  }
  return buyers.map(b => {
    const email = normEmail(b.email);
    let a = byEmail.get(email);
    let matchedBy: BuyerMatch['matchedBy'] = a ? 'email' : null;
    if (!a) {
      const viaPhone = emailByPhone.get(phoneKey(b.phone));
      if (viaPhone) { a = byEmail.get(viaPhone); matchedBy = 'telefone'; }
    }
    return {
      email, product: b.product, amount: b.amount, matchedBy,
      registered: !!a, entered: a?.entered ?? false, minutesWatched: a?.minutesWatched ?? 0,
      stayedToPitch: a?.stayedToPitch ?? false, clickedCta: a?.clickedCta ?? false,
    };
  });
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/matching.ts src/lib/marketing/matching.test.ts
git commit -m "feat(marketing): attendance and buyer x live matching"
```

---

### Task 8: Conectores, cache e sincronização

**Files:**
- Create: `src/lib/marketing/sources/sheet.ts`
- Create: `src/lib/marketing/sources/meta.ts`
- Create: `src/lib/marketing/sources/platform.ts`
- Create: `src/lib/marketing/store.ts`
- Create: `src/lib/marketing/sync.ts`
- Create: `src/app/api/marketing/sync/route.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `checkHeaders`, `TabKey`, `toOverviewRows` (Task 3), `mapInsightRow` (Task 4), `parseCsv`, `toRecords`, `inferLiveDate` (Task 2), `buildAttendance` (Task 7), `supabase` de `@/lib/db`, `getAllRegistrations`, `getLiveEventsForEdition`, `getEdition` de `@/lib/db`, `getLiveStartMs` de `@/lib/edition`, `verifyAdminFromRequest` de `@/lib/auth`.
- Produces:
  - `SHEET_GIDS: Record<TabKey, string>`; `fetchTab(tab: TabKey): Promise<Record<string, string>[]>`
  - `fetchMetaAdDays(since: string, until: string): Promise<MetaAdDay[]>`; `fetchPermalinks(adIds: string[]): Promise<Record<string, string>>`; `metaConfigured(): boolean`
  - `loadAttendance(liveDate: string): Promise<Attendance[]>`
  - store: `saveSnapshot(tab, rows)`, `loadSnapshots(): Promise<Partial<Record<TabKey, Record<string,string>[]>>>`, `upsertAdDays(rows)`, `loadAdDays(from, to): Promise<MetaAdDay[]>`, `upsertPermalinks(map)`, `loadPermalinks(): Promise<Record<string,string>>`, `seedEditions(list: { number: number; liveDate: string }[])`, `loadEditionOverrides(): Promise<EditionOverride[]>`, `saveEditionOverride(o: EditionOverride)`, `loadAliases(): Promise<Record<string,string>>`, `saveAlias(raw, family)`, `logRun(source, ok, message)`, `lastRuns(): Promise<{ source: string; ok: boolean; message: string; finished_at: string }[]>`
  - `runSync(opts: { metaDays: number }): Promise<{ source: string; ok: boolean; message: string }[]>`
  - `GET /api/marketing/sync` (cron, `Authorization: Bearer ${CRON_SECRET}`), `POST /api/marketing/sync` (admin)

- [ ] **Step 1: Conector da planilha**

`src/lib/marketing/sources/sheet.ts`:

```ts
import { parseCsv, toRecords } from '../parse.ts';
import { checkHeaders, type TabKey } from '../sheet-rows.ts';

// gids lidos em 2026-10-10. Buscar por gid: o endpoint por nome devolve a 1ª aba em silêncio.
export const SHEET_GIDS: Record<TabKey, string> = {
  capture: '0',
  overview: '214347056',
  sales: '2007849935',
  schedule: '1247583607',
};

export async function fetchTab(tab: TabKey): Promise<Record<string, string>[]> {
  const id = process.env.MKT_SHEET_ID;
  if (!id) throw new Error('MKT_SHEET_ID não configurado');
  const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${SHEET_GIDS[tab]}`;
  const res = await fetch(url, { cache: 'no-store', redirect: 'follow' });
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('text/csv')) {
    throw new Error(`Aba "${tab}": planilha inacessível (HTTP ${res.status}). Ela precisa estar como "qualquer pessoa com o link: leitor".`);
  }
  const records = toRecords(parseCsv(await res.text()));
  checkHeaders(tab, records);
  return records;
}
```

- [ ] **Step 2: Conector do Meta**

`src/lib/marketing/sources/meta.ts`:

```ts
import { mapInsightRow, type MetaInsightRow } from '../meta-map.ts';
import type { MetaAdDay } from '../types.ts';

const VERSION = process.env.META_API_VERSION || 'v23.0';
const BASE = `https://graph.facebook.com/${VERSION}`;

export function metaConfigured(): boolean {
  return !!(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

async function getAll<T>(url: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = url;
  while (next) {
    const res: Response = await fetch(next, { cache: 'no-store' });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(`Meta: ${body.error?.message ?? `HTTP ${res.status}`}`);
    out.push(...(body.data ?? []));
    next = body.paging?.next ?? null;
  }
  return out;
}

export async function fetchMetaAdDays(since: string, until: string): Promise<MetaAdDay[]> {
  const account = process.env.META_AD_ACCOUNT_ID!.replace(/^act_/, '');
  const params = new URLSearchParams({
    level: 'ad',
    time_increment: '1',
    time_range: JSON.stringify({ since, until }),
    fields: 'ad_id,ad_name,adset_name,campaign_name,spend,impressions,inline_link_clicks,actions,video_thruplay_watched_actions',
    limit: '500',
    access_token: process.env.META_ACCESS_TOKEN!,
  });
  const rows = await getAll<MetaInsightRow>(`${BASE}/act_${account}/insights?${params}`);
  return rows.map(mapInsightRow);
}

export async function fetchPermalinks(adIds: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (let i = 0; i < adIds.length; i += 50) {
    const ids = adIds.slice(i, i + 50).join(',');
    const params = new URLSearchParams({ ids, fields: 'creative{instagram_permalink_url}', access_token: process.env.META_ACCESS_TOKEN! });
    const res = await fetch(`${BASE}/?${params}`, { cache: 'no-store' });
    const body = await res.json();
    if (!res.ok || body.error) throw new Error(`Meta: ${body.error?.message ?? `HTTP ${res.status}`}`);
    for (const [id, ad] of Object.entries(body as Record<string, { creative?: { instagram_permalink_url?: string } }>)) {
      const url = ad.creative?.instagram_permalink_url;
      if (url) out[id] = url;
    }
  }
  return out;
}
```

- [ ] **Step 3: Leitura da plataforma (somente leitura)**

`src/lib/marketing/sources/platform.ts`:

```ts
import { getAllRegistrations, getLiveEventsForEdition, getEdition } from '@/lib/db';
import { getLiveStartMs } from '@/lib/edition';
import { buildAttendance } from '../matching.ts';
import type { Attendance } from '../types.ts';

const DEFAULT_PITCH_SECONDS = 66 * 60 + 10; // 1:06:10, igual ao dash atual

export async function loadAttendance(liveDate: string): Promise<Attendance[]> {
  const [regs, events, edition] = await Promise.all([
    getAllRegistrations(liveDate),
    getLiveEventsForEdition(liveDate),
    getEdition(liveDate),
  ]);
  return buildAttendance(regs, events, getLiveStartMs(liveDate), edition?.pitch_marker_seconds ?? DEFAULT_PITCH_SECONDS);
}
```

- [ ] **Step 4: Store**

`src/lib/marketing/store.ts`:

```ts
import { supabase } from '@/lib/db';
import type { MetaAdDay } from './types.ts';
import type { TabKey } from './sheet-rows.ts';
import type { EditionOverride } from './editions.ts';

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export async function saveSnapshot(tab: TabKey, rows: Record<string, string>[]) {
  const { error } = await supabase.from('mkt_sheet_snapshot').upsert({ tab, rows, fetched_at: new Date().toISOString() });
  check(error, `snapshot ${tab}`);
}

export async function loadSnapshots(): Promise<Partial<Record<TabKey, Record<string, string>[]>>> {
  const { data, error } = await supabase.from('mkt_sheet_snapshot').select('tab, rows');
  check(error, 'snapshots');
  return Object.fromEntries((data ?? []).map(r => [r.tab, r.rows]));
}

export async function upsertAdDays(rows: MetaAdDay[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('mkt_meta_ad_daily').upsert(rows.slice(i, i + 500).map(r => ({
      date: r.date, ad_id: r.adId, ad_name: r.adName, adset_name: r.adsetName, campaign_name: r.campaignName,
      spend: r.spend, impressions: r.impressions, link_clicks: r.linkClicks, landing_views: r.landingViews,
      initiate_checkouts: r.initiateCheckouts, video_3s: r.video3s, thruplays: r.thruplays,
      updated_at: new Date().toISOString(),
    })));
    check(error, 'meta ad days');
  }
}

export async function loadAdDays(from: string, to: string): Promise<MetaAdDay[]> {
  const out: MetaAdDay[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from('mkt_meta_ad_daily').select('*')
      .gte('date', from).lte('date', to).order('date').range(start, start + 999);
    check(error, 'load ad days');
    out.push(...(data ?? []).map(r => ({
      date: r.date, adId: r.ad_id, adName: r.ad_name, adsetName: r.adset_name, campaignName: r.campaign_name,
      spend: Number(r.spend), impressions: r.impressions, linkClicks: r.link_clicks, landingViews: r.landing_views,
      initiateCheckouts: r.initiate_checkouts, video3s: r.video_3s, thruplays: r.thruplays,
    })));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function upsertPermalinks(map: Record<string, string>) {
  const rows = Object.entries(map).map(([ad_id, permalink]) => ({ ad_id, permalink, updated_at: new Date().toISOString() }));
  if (!rows.length) return;
  const { error } = await supabase.from('mkt_meta_ad').upsert(rows);
  check(error, 'permalinks');
}

export async function loadPermalinks(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('mkt_meta_ad').select('ad_id, permalink');
  check(error, 'load permalinks');
  return Object.fromEntries((data ?? []).filter(r => r.permalink).map(r => [r.ad_id, r.permalink]));
}

export async function seedEditions(list: { number: number; liveDate: string }[]) {
  if (!list.length) return;
  const { error } = await supabase.from('mkt_editions')
    .upsert(list.map(e => ({ number: e.number, live_date: e.liveDate })), { onConflict: 'number', ignoreDuplicates: true });
  check(error, 'seed editions');
}

export async function loadEditionOverrides(): Promise<EditionOverride[]> {
  const { data, error } = await supabase.from('mkt_editions').select('*');
  check(error, 'editions');
  return (data ?? []).map(r => ({
    number: r.number,
    windowStart: r.window_start ?? undefined, windowEnd: r.window_end ?? undefined,
    ticketPrice: Number(r.ticket_price), cpaDream: Number(r.cpa_dream), cpaGood: Number(r.cpa_good), cpaLimit: Number(r.cpa_limit),
  }));
}

export async function saveEditionOverride(o: EditionOverride) {
  const { error } = await supabase.from('mkt_editions').update({
    window_start: o.windowStart ?? null, window_end: o.windowEnd ?? null,
    ticket_price: o.ticketPrice, cpa_dream: o.cpaDream, cpa_good: o.cpaGood, cpa_limit: o.cpaLimit,
    updated_at: new Date().toISOString(),
  }).eq('number', o.number);
  check(error, 'save edition');
}

export async function loadAliases(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('mkt_creative_alias').select('raw, family');
  check(error, 'aliases');
  return Object.fromEntries((data ?? []).map(r => [r.raw, r.family]));
}

export async function saveAlias(raw: string, family: string) {
  const { error } = await supabase.from('mkt_creative_alias').upsert({ raw: raw.trim().toLowerCase(), family: family.trim() });
  check(error, 'save alias');
}

export async function logRun(source: string, ok: boolean, message: string) {
  await supabase.from('mkt_sync_runs').insert({ source, ok, message, finished_at: new Date().toISOString() });
}

export async function lastRuns() {
  const { data } = await supabase.from('mkt_sync_runs').select('source, ok, message, finished_at')
    .order('id', { ascending: false }).limit(20);
  const seen = new Set<string>();
  return (data ?? []).filter(r => (seen.has(r.source) ? false : (seen.add(r.source), true)));
}
```

- [ ] **Step 5: Sync**

`src/lib/marketing/sync.ts`:

```ts
import { fetchTab } from './sources/sheet.ts';
import { fetchMetaAdDays, fetchPermalinks, metaConfigured } from './sources/meta.ts';
import { toOverviewRows, type TabKey } from './sheet-rows.ts';
import { addDays, inferLiveDate } from './parse.ts';
import { logRun, saveSnapshot, seedEditions, upsertAdDays, upsertPermalinks } from './store.ts';

const today = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); // Brasília

export async function runSync(opts: { metaDays: number }) {
  const results: { source: string; ok: boolean; message: string }[] = [];

  for (const tab of ['capture', 'overview', 'sales', 'schedule'] as TabKey[]) {
    try {
      const rows = await fetchTab(tab);
      await saveSnapshot(tab, rows);
      if (tab === 'overview') {
        const t = today();
        await seedEditions(toOverviewRows(rows)
          .map(o => ({ number: o.edition, liveDate: inferLiveDate(o.dayMonth, t) }))
          .filter((e): e is { number: number; liveDate: string } => e.liveDate !== null));
      }
      results.push({ source: `planilha:${tab}`, ok: true, message: `${rows.length} linhas` });
    } catch (e) {
      results.push({ source: `planilha:${tab}`, ok: false, message: (e as Error).message });
    }
  }

  if (!metaConfigured()) {
    results.push({ source: 'meta', ok: false, message: 'Token do Meta não configurado' });
  } else {
    try {
      const until = today();
      const days = await fetchMetaAdDays(addDays(until, -(opts.metaDays - 1)), until);
      await upsertAdDays(days);
      await upsertPermalinks(await fetchPermalinks([...new Set(days.map(d => d.adId))]));
      results.push({ source: 'meta', ok: true, message: `${days.length} linhas anúncio×dia` });
    } catch (e) {
      results.push({ source: 'meta', ok: false, message: (e as Error).message });
    }
  }

  for (const r of results) await logRun(r.source, r.ok, r.message);
  return results;
}
```

- [ ] **Step 6: Rota de sync e cron**

`src/app/api/marketing/sync/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/auth';
import { runSync } from '@/lib/marketing/sync';

export const maxDuration = 300;

// Cron diário da Vercel (Hobby permite 1×/dia).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ results: await runSync({ metaDays: 7 }) });
}

// Botão "Atualizar agora" e atualização automática ao abrir o painel.
export async function POST(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const metaDays = Math.min(Math.max(Number(body?.metaDays) || 7, 1), 180);
  return NextResponse.json({ results: await runSync({ metaDays }) });
}
```

`vercel.json`:

```json
{
  "crons": [{ "path": "/api/marketing/sync", "schedule": "0 9 * * *" }]
}
```

- [ ] **Step 7: Build e teste manual local**

Run: `npm test && npm run build`
Expected: testes PASS; build sem erro, com `/api/marketing/sync` listado.

Teste manual: `npm run dev`, logar em `/admin/login`, e no console do navegador:

```js
await (await fetch('/api/marketing/sync', { method: 'POST', body: JSON.stringify({ metaDays: 30 }) })).json()
```

Expected: `planilha:capture/overview/sales/schedule` com `ok: true`; `meta` com `ok: false, "Token do Meta não configurado"` enquanto não houver token. Conferir no Supabase que `mkt_sheet_snapshot` tem 4 linhas e `mkt_editions` tem as edições.

- [ ] **Step 8: Commit**

```bash
git add src/lib/marketing/sources src/lib/marketing/store.ts src/lib/marketing/sync.ts src/app/api/marketing/sync vercel.json
git commit -m "feat(marketing): sheet/Meta/platform connectors, mkt_* cache and sync endpoint"
```

---

### Task 9: Relatórios em texto

**Files:**
- Create: `src/lib/marketing/report.ts`
- Test: `src/lib/marketing/report.test.ts`

**Interfaces:**
- Consumes: `FrontSummary`, `CreativeStats`, `Window137` (Task 6), `EditionConfig`.
- Produces:
  - `brl(n: number | null): string` (`null` → `'—'`, espaço normal, ex.: `'R$ 119,96'`)
  - `editionReport(cfg: EditionConfig, front: FrontSummary, creatives: CreativeStats[], permalinks: Record<string, string>, dayLabel: string): string`
  - `dailyReport(cfg: EditionConfig, yesterdayFront: FrontSummary, best: CreativeStats[], permalinks: Record<string, string>, dayLabel: string): string`
  - `report137(windows: Window137[], dayLabel: string): string`

`permalinks` aqui é por **família** (`{ img_10: 'https://instagram.com/p/…' }`), montado em `view.ts`.

- [ ] **Step 1: Teste**

`src/lib/marketing/report.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { brl, editionReport, report137 } from './report.ts';
import type { EditionConfig } from './types.ts';
import type { CreativeStats, FrontSummary } from './metrics.ts';

const cfg: EditionConfig = { number: 22, liveDate: '2026-10-13', windowStart: '2026-09-29', windowEnd: '2026-10-13', ticketPrice: 9.9, cpaDream: 25, cpaGood: 35, cpaLimit: 45 };
const front: FrontSummary = { sales: 16, revenue: 158.4, spend: 624.69, spendSource: 'meta', roas: 0.2536, cpa: 39.04, cpaSellingAds: 35.72, spendNoSales: 53.1, topNoSale: { family: 'vid_6', spend: 15.86 }, ic: 0, costPerIc: null };
const c = (family: string, sales: number, spend: number): CreativeStats => ({ family, sales, spend, cpa: spend / sales, ic: 0, costPerIc: null, impressions: 0, ctr: null, hookRate: null, bodyRate: null, band: null });

test('brl formats money and missing values', () => {
  assert.equal(brl(119.96), 'R$ 119,96');
  assert.equal(brl(null), '—');
});

test('editionReport follows the team format', () => {
  const txt = editionReport(cfg, front, [c('img_10', 7, 119.96), c('vid_1', 2, 43.94)], { img_10: 'https://www.instagram.com/p/Dd7ZZxHstCp/' }, '08/10');
  assert.match(txt, /REPORT WEBNÁRIO PAGO #022 \| 08\/10/);
  assert.match(txt, /16 vendas no total \(R\$ 158,40\) e R\$ 624,69 investidos = ROAS 0,25/);
  assert.match(txt, /img_10: 7 vendas \| R\$ 119,96 \| CPA R\$ 17,14/);
  assert.match(txt, /Tem R\$ 53,10 em anúncios que ainda não venderam\. O maior deles é o vid_6, com R\$ 15,86\./);
  assert.match(txt, /https:\/\/www\.instagram\.com\/p\/Dd7ZZxHstCp\//);
});

test('report137 prints the three windows per creative', () => {
  const w = [{ family: 'img_10', label: 'estável' as const, d1: c('img_10', 3, 100.12), d3: c('img_10', 9, 256.14), d7: c('img_10', 18, 694.26) }];
  const txt = report137(w, '08/10');
  assert.match(txt, /img_10: estável/);
  assert.match(txt, /1d: 3 vendas \| CPA R\$ 33,37/);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test` → FAIL.

- [ ] **Step 3: Implementação**

`src/lib/marketing/report.ts`:

```ts
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
    `${vendas(f.sales)} no total (${brl(f.revenue)}) e ${brl(f.spend)} investidos = ROAS ${num2(f.roas)}.`,
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
  if (f.spendSource !== 'meta') lines.push(`(investimento: fonte ${f.spendSource})`);
  return lines.join('\n').trim();
}

export function dailyReport(
  cfg: EditionConfig, y: FrontSummary, best: CreativeStats[],
  permalinks: Record<string, string>, dayLabel: string,
): string {
  const lines = [
    `REPORT WEBNÁRIO PAGO | Fechamento ${dayLabel}`, '',
    `${vendas(y.sales)} (${brl(y.revenue)}) com ${brl(y.spend)} investidos = ROAS ${num2(y.roas)}`,
    `CPA do dia: ${brl(y.cpa)}`,
    `${y.ic} IC a ${brl(y.costPerIc)} cada`, '',
    goals(cfg), '',
    'Melhores criativos de ontem', '',
  ];
  for (const c of best.filter(b => b.sales > 0).slice(0, 3)) {
    lines.push(`Criativo ${c.family}`, ` ${vendas(c.sales)} | ${brl(c.spend)} | CPA ${brl(c.cpa)} | ${c.ic} IC a ${brl(c.costPerIc)}`);
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
```

- [ ] **Step 4: Rodar e ver passar** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/report.ts src/lib/marketing/report.test.ts
git commit -m "feat(marketing): WhatsApp-ready edition, daily and 1-3-7 reports"
```

---

### Task 10: View model e rotas de dados/config

**Files:**
- Create: `src/lib/marketing/view.ts`
- Create: `src/app/api/marketing/data/route.ts`
- Create: `src/app/api/marketing/config/route.ts`

**Interfaces:**
- Consumes: tudo das Tasks 2–9.
- Produces:
  - `type MarketingView = { editions: EditionConfig[]; selected: number[]; range: DateRange | null; front: FrontSummary; back: BackSummary; creatives: CreativeStats[]; windows: Window137[]; buyers: BuyerMatch[]; icVsSales: { day: string; ic: number; sales: number }[]; unmatched: { utmContents: string[]; adNames: string[] }; permalinks: Record<string, string>; reports: { edition: string; daily: string; w137: string }; sources: { source: string; ok: boolean; message: string; finished_at: string }[]; stale: boolean }`
  - `buildView(selected: number[], range: DateRange | null): Promise<MarketingView>`
  - `GET /api/marketing/data?editions=22,21&from=YYYY-MM-DD&to=YYYY-MM-DD` (admin) → `MarketingView`; sem `editions` usa a última edição.
  - `POST /api/marketing/config` (admin) body `{ edition?: EditionOverride, alias?: { raw: string; family: string } }`

Regras do view:
- `buyers` = compradores **high ticket** aprovados das edições selecionadas, casados com a presença da live de cada edição (`loadAttendance(liveDate)`), mais os compradores de ingresso (`ticketSales`) com `product: 'Ingresso'`.
- `icVsSales`: por dia, IC do Meta × vendas de ingresso nas janelas selecionadas.
- `unmatched.utmContents`: famílias de venda sem anúncio; `unmatched.adNames`: famílias de anúncio com gasto e sem nenhuma venda **e** sem nenhuma linha na Captação.
- Família → link do post: primeiro `permalink` encontrado entre os anúncios da família.
- `stale` = última execução bem-sucedida de `planilha:capture` há mais de 30 min (ou nenhuma).
- Os reports usam a **primeira** edição selecionada; "ontem" = dia anterior a hoje em Brasília.

- [ ] **Step 1: Implementar `view.ts`**

```ts
import type { DateRange, EditionConfig, MetaAdDay } from './types.ts';
import { toCaptureRows, toOverviewRows, toSaleRows, toScheduleRows } from './sheet-rows.ts';
import { buildEditions } from './editions.ts';
import { addDays } from './parse.ts';
import { creativeFamily } from './creatives.ts';
import {
  adsInWindows, backSummary, creativeTable, frontSummary, inRange, ticketSales, windows137,
  type BackSummary, type CreativeStats, type FrontSummary, type Window137,
} from './metrics.ts';
import { matchBuyers, type BuyerMatch } from './matching.ts';
import { dailyReport, editionReport, report137 } from './report.ts';
import { lastRuns, loadAdDays, loadAliases, loadEditionOverrides, loadPermalinks, loadSnapshots } from './store.ts';
import { loadAttendance } from './sources/platform.ts';

export type MarketingView = {
  editions: EditionConfig[]; selected: number[]; range: DateRange | null;
  front: FrontSummary; back: BackSummary; creatives: CreativeStats[]; windows: Window137[];
  buyers: BuyerMatch[]; icVsSales: { day: string; ic: number; sales: number }[];
  unmatched: { utmContents: string[]; adNames: string[] };
  permalinks: Record<string, string>;
  reports: { edition: string; daily: string; w137: string };
  sources: { source: string; ok: boolean; message: string; finished_at: string }[];
  stale: boolean;
};

const todayBRT = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export async function buildView(selectedIn: number[], range: DateRange | null): Promise<MarketingView> {
  const today = todayBRT();
  const yesterday = addDays(today, -1);
  const [snap, overrides, aliases, adPermalinks, sources] = await Promise.all([
    loadSnapshots(), loadEditionOverrides(), loadAliases(), loadPermalinks(), lastRuns(),
  ]);
  const captures = toCaptureRows(snap.capture ?? []);
  const overview = toOverviewRows(snap.overview ?? []);
  const sales = toSaleRows(snap.sales ?? []);
  const schedules = toScheduleRows(snap.schedule ?? []);
  const editions = buildEditions(overview, overrides, today);

  const selected = selectedIn.length ? selectedIn : editions.slice(-1).map(e => e.number);
  const eds = editions.filter(e => selected.includes(e.number));
  const minStart = eds.reduce((m, e) => (e.windowStart < m ? e.windowStart : m), today);
  const maxEnd = eds.reduce((m, e) => (e.windowEnd > m ? e.windowEnd : m), minStart);
  const ads: MetaAdDay[] = eds.length ? adsInWindows(await loadAdDays(minStart, maxEnd), eds, range) : [];

  const tickets = ticketSales(captures, selected).filter(s => inRange(s.at?.slice(0, 10) ?? null, range));
  const fallback = overview.filter(o => selected.includes(o.edition)).reduce((s, o) => s + o.investment, 0);
  const front = frontSummary(tickets, ads, eds, aliases, fallback);
  const back = backSummary(overview, schedules, sales, selected, front);
  const first = eds[0];
  const creatives = first ? creativeTable(tickets, ads, first, aliases) : [];
  const windows = first ? windows137(ticketSales(captures, [first.number]), ads, first, aliases, yesterday) : [];

  const attendance = (await Promise.all(eds.map(e => loadAttendance(e.liveDate)))).flat();
  const htBuyers = sales.filter(s => s.approved && s.edition !== null && selected.includes(s.edition))
    .map(s => ({ email: s.email, phone: s.phone, product: s.product, amount: s.amount }));
  const ticketBuyers = tickets.map(t => ({ email: t.email, phone: t.phone, product: 'Ingresso', amount: first?.ticketPrice ?? 9.9 }));
  const buyers = matchBuyers([...htBuyers, ...ticketBuyers], attendance, captures);

  const byDay = new Map<string, { ic: number; sales: number }>();
  for (const a of ads) byDay.set(a.date, { ic: (byDay.get(a.date)?.ic ?? 0) + a.initiateCheckouts, sales: byDay.get(a.date)?.sales ?? 0 });
  for (const t of tickets) {
    const d = t.at?.slice(0, 10);
    if (d) byDay.set(d, { ic: byDay.get(d)?.ic ?? 0, sales: (byDay.get(d)?.sales ?? 0) + 1 });
  }
  const icVsSales = [...byDay].map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day));

  const permalinks: Record<string, string> = {};
  for (const a of ads) {
    const f = creativeFamily(a.adName, aliases);
    if (!permalinks[f] && adPermalinks[a.adId]) permalinks[f] = adPermalinks[a.adId];
  }
  const adFamilies = new Set(ads.map(a => creativeFamily(a.adName, aliases)));
  const captureFamilies = new Set(captures.filter(c => c.edition !== null && selected.includes(c.edition)).map(c => creativeFamily(c.utmContent, aliases)));
  const saleFamilies = new Set(tickets.map(t => creativeFamily(t.utmContent, aliases)));
  const unmatched = {
    utmContents: [...saleFamilies].filter(f => !adFamilies.has(f)).sort(),
    adNames: [...adFamilies].filter(f => !saleFamilies.has(f) && !captureFamilies.has(f)).sort(),
  };

  const yAds = ads.filter(a => a.date === yesterday);
  const yTickets = tickets.filter(t => t.at?.slice(0, 10) === yesterday);
  const reports = first ? {
    edition: editionReport(first, front, creatives, permalinks, dm(yesterday)),
    daily: dailyReport(first, frontSummary(yTickets, yAds, [first], aliases, 0), creativeTable(yTickets, yAds, first, aliases), permalinks, dm(yesterday)),
    w137: report137(windows, dm(yesterday)),
  } : { edition: '', daily: '', w137: '' };

  const capRun = sources.find(s => s.source === 'planilha:capture' && s.ok);
  const stale = !capRun || Date.now() - Date.parse(capRun.finished_at) > 30 * 60_000;

  return { editions, selected, range, front, back, creatives, windows, buyers, icVsSales, unmatched, permalinks, reports, sources, stale };
}
```

- [ ] **Step 2: Rotas**

`src/app/api/marketing/data/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/auth';
import { buildView } from '@/lib/marketing/view';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const p = req.nextUrl.searchParams;
  const editions = (p.get('editions') ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);
  const from = p.get('from') ?? '';
  const to = p.get('to') ?? '';
  const range = DAY.test(from) && DAY.test(to) && from <= to ? { from, to } : null;
  try {
    return NextResponse.json(await buildView(editions, range));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
```

`src/app/api/marketing/config/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/auth';
import { saveAlias, saveEditionOverride } from '@/lib/marketing/store';

const money = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export async function POST(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (body?.edition && Number.isInteger(body.edition.number)) {
    const e = body.edition;
    await saveEditionOverride({
      number: e.number, windowStart: day(e.windowStart), windowEnd: day(e.windowEnd),
      ticketPrice: money(e.ticketPrice), cpaDream: money(e.cpaDream), cpaGood: money(e.cpaGood), cpaLimit: money(e.cpaLimit),
    });
  }
  if (typeof body?.alias?.raw === 'string' && typeof body?.alias?.family === 'string' && body.alias.raw.trim() && body.alias.family.trim()) {
    await saveAlias(body.alias.raw, body.alias.family);
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Build e conferência manual**

Run: `npm test && npm run build`
Expected: PASS e build sem erros, com `/api/marketing/data` e `/api/marketing/config` na lista.

Com `npm run dev` e admin logado, no console do navegador:

```js
const v = await (await fetch('/api/marketing/data?editions=22')).json(); v.front; v.back; v.reports.edition
```

Expected: `front.sales` igual ao número de linhas `#022` + `PAGO` na Captação; sem Meta, `front.spendSource` = `'planilha'` ou `'nenhum'`; `reports.edition` com o cabeçalho `REPORT WEBNÁRIO PAGO #022`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/marketing/view.ts src/app/api/marketing/data src/app/api/marketing/config
git commit -m "feat(marketing): view model and data/config endpoints"
```

---

### Task 11: Página `/admin/marketing` e item no menu

**Files:**
- Create: `src/app/admin/marketing/page.tsx`
- Create: `src/components/marketing/MarketingDashboard.tsx`
- Create: `src/components/marketing/EditionTab.tsx`
- Create: `src/components/marketing/CreativesTab.tsx`
- Create: `src/components/marketing/ValidationTab.tsx`
- Modify: `src/components/AdminSidebar.tsx:33-38` (adicionar um item ao array de navegação)

**Interfaces:**
- Consumes: `GET /api/marketing/data`, `POST /api/marketing/sync`, `POST /api/marketing/config`, tipo `MarketingView` (importar com `import type` de `@/lib/marketing/view`).
- Antes de escrever, abrir `src/components/ui/tabs.tsx`, `table.tsx`, `card.tsx`, `badge.tsx`, `button.tsx` e `checkbox.tsx` para confirmar os nomes exportados; seguir o shell de página de `src/components/AdminNavigation.tsx:57-77` (SidebarProvider → AdminSidebar → SidebarInset → header).

- [ ] **Step 1: Menu**

Em `src/components/AdminSidebar.tsx`, importar `BarChart3` de `lucide-react` junto dos ícones existentes e adicionar depois de `{ href: '/admin/live', ... }`:

```ts
  { href: '/admin/marketing', label: 'Marketing', icon: BarChart3 },
```

- [ ] **Step 2: Página**

`src/app/admin/marketing/page.tsx`:

```tsx
import MarketingDashboard from '@/components/marketing/MarketingDashboard';

export const metadata = { title: 'Marketing — Admin' };

export default function MarketingPage() {
  return <MarketingDashboard />;
}
```

- [ ] **Step 3: Container com filtro, atualização e abas**

`src/components/marketing/MarketingDashboard.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MarketingView } from '@/lib/marketing/view';
import EditionTab from './EditionTab';
import CreativesTab from './CreativesTab';
import ValidationTab from './ValidationTab';

export default function MarketingDashboard() {
  const [view, setView] = useState<MarketingView | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [range, setRange] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (eds: number[], r: { from: string; to: string }) => {
    setLoading(true); setError('');
    const q = new URLSearchParams();
    if (eds.length) q.set('editions', eds.join(','));
    if (r.from && r.to) { q.set('from', r.from); q.set('to', r.to); }
    const res = await fetch(`/api/marketing/data?${q}`);
    const body = await res.json();
    setLoading(false);
    if (!res.ok) { setError(body.error ?? 'Erro ao carregar'); return null; }
    setView(body); setSelected(body.selected);
    return body as MarketingView;
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    await fetch('/api/marketing/sync', { method: 'POST', body: JSON.stringify({ metaDays: 7 }) });
    setSyncing(false);
    await load(selected, range);
  }, [load, selected, range]);

  useEffect(() => {
    load([], { from: '', to: '' }).then(v => { if (v?.stale) sync(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (n: number) => {
    const next = selected.includes(n) ? selected.filter(x => x !== n) : [...selected, n].sort((a, b) => a - b);
    if (next.length) load(next, range);
  };

  return (
    <SidebarProvider>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border">
          <div className="flex w-full items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 h-4 data-vertical:self-auto" />
            <h1 className="text-base font-medium">Marketing</h1>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
                {syncing ? 'Atualizando…' : 'Atualizar agora'}
              </Button>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
          {view && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Edições</span>
              {view.editions.slice(-12).map(e => (
                <Button key={e.number} size="sm" variant={selected.includes(e.number) ? 'default' : 'outline'} onClick={() => toggle(e.number)}>
                  #{String(e.number).padStart(3, '0')}
                </Button>
              ))}
              <span className="ml-4 text-xs uppercase tracking-wide text-muted-foreground">Período</span>
              <input type="date" aria-label="Data inicial" className="h-8 rounded-md border border-border bg-transparent px-2 text-sm" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} />
              <input type="date" aria-label="Data final" className="h-8 rounded-md border border-border bg-transparent px-2 text-sm" value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} />
              <Button size="sm" variant="outline" onClick={() => load(selected, range)}>Aplicar</Button>
              {(range.from || range.to) && (
                <Button size="sm" variant="ghost" onClick={() => { const r = { from: '', to: '' }; setRange(r); load(selected, r); }}>Limpar</Button>
              )}
            </div>
          )}

          {view?.sources.filter(s => !s.ok).map(s => (
            <p key={s.source} role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              Fonte indisponível — {s.source}: {s.message}
            </p>
          ))}
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {loading && !view && <p className="text-sm text-muted-foreground">Carregando…</p>}

          {view && (
            <Tabs defaultValue="edicao">
              <TabsList>
                <TabsTrigger value="edicao">Edição</TabsTrigger>
                <TabsTrigger value="criativos">Criativos</TabsTrigger>
                <TabsTrigger value="validacao">Validação</TabsTrigger>
              </TabsList>
              <TabsContent value="edicao"><EditionTab view={view} onSaved={() => load(selected, range)} /></TabsContent>
              <TabsContent value="criativos"><CreativesTab view={view} onSaved={() => load(selected, range)} /></TabsContent>
              <TabsContent value="validacao"><ValidationTab view={view} /></TabsContent>
            </Tabs>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 4: Aba Edição (KPIs, metas, copiar report)**

`src/components/marketing/EditionTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { MarketingView } from '@/lib/marketing/view';

const brl = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const dec = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function CopyButton({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button size="sm" variant="outline" disabled={!text} onClick={async () => {
      await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500);
    }}>{done ? 'Copiado' : label}</Button>
  );
}

export default function EditionTab({ view, onSaved }: { view: MarketingView; onSaved: () => void }) {
  const { front: f, back: b } = view;
  const cfg = view.editions.find(e => e.number === view.selected[0]);
  const [goals, setGoals] = useState({ cpaDream: cfg?.cpaDream ?? 25, cpaGood: cfg?.cpaGood ?? 35, cpaLimit: cfg?.cpaLimit ?? 45 });

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-medium">Frente — ingresso</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Vendas" value={String(f.sales)} hint={brl(f.revenue)} />
          <Kpi label="Investimento" value={brl(f.spend)} hint={f.spendSource === 'meta' ? 'fonte: Meta' : f.spendSource === 'planilha' ? 'fonte: planilha (sem Meta)' : 'sem dados de investimento'} />
          <Kpi label="ROAS" value={dec(f.roas)} />
          <Kpi label="CPA da campanha" value={brl(f.cpa)} hint={`só anúncios que venderam: ${brl(f.cpaSellingAds)}`} />
          <Kpi label="IC (pixel)" value={String(f.ic)} hint={`${brl(f.costPerIc)} cada — sinal, não é venda`} />
          <Kpi label="Gasto sem venda" value={brl(f.spendNoSales)} hint={f.topNoSale ? `maior: ${f.topNoSale.family} (${brl(f.topNoSale.spend)})` : undefined} />
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">Fundo — high ticket</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Aplicações" value={String(b.applications)} />
          <Kpi label="Calls agendadas" value={String(b.scheduled)} hint={`custo: ${brl(b.costPerScheduled)}`} />
          <Kpi label="Calls realizadas" value={String(b.done)} hint={`custo: ${brl(b.costPerDone)}`} />
          <Kpi label="Vendas high ticket" value={String(b.highTicketSales)} hint={brl(b.highTicketRevenue)} />
          <Kpi label="ROAS total" value={dec(b.roasTotal)} hint="ingresso + high ticket ÷ investimento" />
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-sm font-medium">Copiar report</h2>
        <CopyButton label="Report da edição" text={view.reports.edition} />
        <CopyButton label="Fechamento de ontem" text={view.reports.daily} />
        <CopyButton label="Análise 1-3-7" text={view.reports.w137} />
      </section>

      {cfg && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Metas de CPA — #{String(cfg.number).padStart(3, '0')}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            {(['cpaDream', 'cpaGood', 'cpaLimit'] as const).map(k => (
              <label key={k} className="flex flex-col gap-1 text-xs text-muted-foreground">
                {k === 'cpaDream' ? 'Dos sonhos' : k === 'cpaGood' ? 'Bom' : 'Limite'}
                <input type="number" step="0.01" min="0" className="h-8 w-28 rounded-md border border-border bg-transparent px-2 text-sm text-foreground"
                  value={goals[k]} onChange={e => setGoals({ ...goals, [k]: Number(e.target.value) })} />
              </label>
            ))}
            <Button size="sm" onClick={async () => {
              await fetch('/api/marketing/config', { method: 'POST', body: JSON.stringify({ edition: { number: cfg.number, windowStart: cfg.windowStart, windowEnd: cfg.windowEnd, ticketPrice: cfg.ticketPrice, ...goals } }) });
              onSaved();
            }}>Salvar metas</Button>
            <p className="text-xs text-muted-foreground">Janela de captação: {cfg.windowStart} a {cfg.windowEnd}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Aba Criativos (tabela, 1/3/7, associação manual)**

`src/components/marketing/CreativesTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MarketingView } from '@/lib/marketing/view';

const brl = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`);
const BAND: Record<string, string> = { sonho: 'bg-emerald-500/20 text-emerald-300', bom: 'bg-lime-500/20 text-lime-300', limite: 'bg-amber-500/20 text-amber-300', acima: 'bg-red-500/20 text-red-300' };

export default function CreativesTab({ view, onSaved }: { view: MarketingView; onSaved: () => void }) {
  const [alias, setAlias] = useState({ raw: '', family: '' });
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Criativo</TableHead><TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Gasto</TableHead>
              <TableHead className="text-right">CPA</TableHead><TableHead className="text-right">IC</TableHead><TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">Hook</TableHead><TableHead className="text-right">Body</TableHead><TableHead>Post</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.creatives.map(c => (
              <TableRow key={c.family}>
                <TableCell className="font-medium">{c.family}</TableCell>
                <TableCell className="text-right tabular-nums">{c.sales}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(c.spend)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.band ? <span className={`rounded px-1.5 py-0.5 ${BAND[c.band]}`}>{brl(c.cpa)}</span> : brl(c.cpa)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.ic}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(c.ctr)}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(c.hookRate)}</TableCell>
                <TableCell className="text-right tabular-nums">{pct(c.bodyRate)}</TableCell>
                <TableCell>{view.permalinks[c.family] ? <a className="underline" href={view.permalinks[c.family]} target="_blank" rel="noopener noreferrer">abrir</a> : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium">Janelas 1 · 3 · 7 dias (até ontem)</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Criativo</TableHead><TableHead>Leitura</TableHead><TableHead>1d</TableHead><TableHead>3d</TableHead><TableHead>7d</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {view.windows.map(w => (
                <TableRow key={w.family}>
                  <TableCell className="font-medium">{w.family}</TableCell>
                  <TableCell><Badge variant="outline">{w.label}</Badge></TableCell>
                  {[w.d1, w.d3, w.d7].map((d, i) => (
                    <TableCell key={i} className="tabular-nums">{d.sales} vendas · {d.sales ? `CPA ${brl(d.cpa)}` : brl(d.spend)} · {d.ic} IC</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Sem correspondência</h2>
        <p className="text-xs text-muted-foreground">
          UTMs de venda sem anúncio: {view.unmatched.utmContents.join(', ') || 'nenhuma'} · Anúncios com gasto sem venda nem lead: {view.unmatched.adNames.join(', ') || 'nenhum'}
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <input aria-label="UTM ou nome do anúncio" placeholder="utm_content ou nome do anúncio" className="h-8 rounded-md border border-border bg-transparent px-2 text-sm" value={alias.raw} onChange={e => setAlias({ ...alias, raw: e.target.value })} />
          <input aria-label="Criativo" placeholder="criativo (ex.: img_01)" className="h-8 rounded-md border border-border bg-transparent px-2 text-sm" value={alias.family} onChange={e => setAlias({ ...alias, family: e.target.value })} />
          <Button size="sm" disabled={!alias.raw.trim() || !alias.family.trim()} onClick={async () => {
            await fetch('/api/marketing/config', { method: 'POST', body: JSON.stringify({ alias }) });
            setAlias({ raw: '', family: '' }); onSaved();
          }}>Associar</Button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Aba Validação**

`src/components/marketing/ValidationTab.tsx`:

```tsx
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import type { MarketingView } from '@/lib/marketing/view';

export default function ValidationTab({ view }: { view: MarketingView }) {
  const ht = view.buyers.filter(b => b.product !== 'Ingresso');
  const tk = view.buyers.filter(b => b.product === 'Ingresso');
  const share = (list: typeof ht, pred: (b: (typeof ht)[number]) => boolean) =>
    list.length ? `${list.filter(pred).length} de ${list.length}` : '—';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Compradores high ticket que entraram na live', share(ht, b => b.entered)],
          ['… que ficaram até o pitch', share(ht, b => b.stayedToPitch)],
          ['Ingressos que entraram na live', share(tk, b => b.entered)],
          ['Compradores sem vínculo', String(view.buyers.filter(b => !b.matchedBy).length)],
        ].map(([label, value]) => (
          <Card key={label}><CardContent className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          </CardContent></Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Sem vínculo = o e-mail e o telefone da compra não batem com nenhum cadastro da live (pode ter usado outro e-mail ou entrado pela mesma rede de outra pessoa).</p>

      <section>
        <h2 className="mb-2 text-sm font-medium">Compradores high ticket × live</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>E-mail</TableHead><TableHead>Produto</TableHead><TableHead>Vínculo</TableHead><TableHead>Entrou</TableHead>
              <TableHead className="text-right">Minutos</TableHead><TableHead>Até o pitch</TableHead><TableHead>Clicou CTA</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {ht.map((b, i) => (
                <TableRow key={`${b.email}-${i}`}>
                  <TableCell>{b.email}</TableCell><TableCell>{b.product}</TableCell><TableCell>{b.matchedBy ?? 'sem vínculo'}</TableCell>
                  <TableCell>{b.entered ? 'sim' : 'não'}</TableCell><TableCell className="text-right tabular-nums">{b.minutesWatched}</TableCell>
                  <TableCell>{b.stayedToPitch ? 'sim' : 'não'}</TableCell><TableCell>{b.clickedCta ? 'sim' : 'não'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">IC do pixel × vendas reais (UTM), por dia</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Dia</TableHead><TableHead className="text-right">IC (Meta)</TableHead><TableHead className="text-right">Vendas (planilha)</TableHead></TableRow></TableHeader>
            <TableBody>
              {view.icVsSales.map(d => (
                <TableRow key={d.day}><TableCell>{d.day}</TableCell><TableCell className="text-right tabular-nums">{d.ic}</TableCell><TableCell className="text-right tabular-nums">{d.sales}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Build e teste no navegador**

Run: `npm test && npm run build`
Expected: PASS; build lista `/admin/marketing`.

Com `npm run dev`:
1. Sem login, nenhum dado aparece: `curl -i localhost:3000/api/marketing/data` → `401` (a página em si segue o mesmo padrão das outras do admin, que dependem das APIs protegidas).
2. Logado: carrega a última edição, o filtro alterna edições, o período filtra, "Atualizar agora" roda o sync, os alertas de "Fonte indisponível" aparecem para o Meta sem token, os botões de copiar colocam texto na área de transferência.
3. Abrir `/ao-vivo`, `/espera` e `/admin/live`: continuam iguais.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/marketing src/components/marketing src/components/AdminSidebar.tsx
git commit -m "feat(marketing): /admin/marketing page with edition, creatives and validation tabs"
```

---

### Task 12: Preview, conferência com os reports e merge

**Files:** nenhum arquivo de código novo.

- [ ] **Step 1: Variáveis na Vercel (Preview e Production)**

`MKT_SHEET_ID=<ID da planilha — ver variável MKT_SHEET_ID na Vercel>`, `CRON_SECRET` (gerar com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), e quando chegarem: `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`.

- [ ] **Step 2: Push da branch e Preview**

```bash
git push -u origin feat/marketing-dashboard
```

Abrir a URL de Preview da Vercel, logar no admin, rodar "Atualizar agora" com `metaDays` 30 na primeira vez (console: `fetch('/api/marketing/sync',{method:'POST',body:JSON.stringify({metaDays:30})})`).

- [ ] **Step 3: Conferência de números**

Para a edição #022, comparar com o report de 08/10 e com o dash atual: vendas, investimento, CPA da campanha e CPA por criativo. Diferença só é aceitável quando explicada (ex.: o Meta revisou o gasto retroativamente). Registrar a comparação na descrição do PR.

- [ ] **Step 4: Garantia de não regressão**

```bash
git diff main --stat -- src/app/ao-vivo src/app/espera src/app/api/cadastro src/components/AoVivoContent.tsx src/components/EsperaContent.tsx src/lib/db.ts src/lib/edition.ts
```

Expected: saída vazia.

- [ ] **Step 5: Merge fora de terça**

Abrir PR `feat/marketing-dashboard` → `main` com a conferência do Step 3; fazer o merge num dia sem live. Depois do deploy, conferir `/ao-vivo` e `/admin/live` em produção.

---

## Fases seguintes (planos próprios)

- **Fase 2:** interpretação por IA (Vercel AI Gateway, só números agregados, botão sob demanda, texto marcado "sugestão da IA"); desgaste de CTR por criativo; comparação com a edição anterior no mesmo ponto (horas desde a abertura); histórico de orçamento via `act_{id}/activities` com alerta de aumento acima de 20% ao dia.
- **Fase 3:** portar Pesquisa, Compradores, Agendamentos, Aplicações (aba Typeform `gid 336862755`), Ao Vivo, API (aba oculta "Detalhamento API") e histórico NF10K; aposentar o dash HTML.

## Para confirmar na segunda (bloqueia ou ajusta tasks)

1. Ingresso de R$9,90 = cada linha da Captação com `Edição` contendo "PAGO"? (Task 6 `ticketSales`.) Se houver aba própria de vendas de ingresso, informar o nome.
2. O nome do anúncio no Meta contém o código do criativo (`img_10`, `vid_1`) como no `utm_content`? (Task 3 `creativeFamily`.)
3. Token do Meta (usuário do sistema, `ads_read`, sem expiração) + ID da conta `act_…` (Task 8 e 12).
4. A planilha continua "qualquer pessoa com o link: leitor"? (Task 8.)
5. Janela de captação padrão "do dia seguinte à live anterior até o dia da live" está certa? (Task 5.)
