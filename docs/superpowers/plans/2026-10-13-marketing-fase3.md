# Dashboard de Marketing — Plano de Implementação (Fase 3: portar o dash antigo)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer para `/admin/marketing` tudo o que o dash HTML antigo mostrava (Pesquisa, Aplicações, Ao vivo, Agendamentos, Vendas, Compradores, API, Disparos, histórico NF10K, funil completo Meta + UTM e conferência entre fontes), com a plataforma como visão oficial e a planilha como conferência.

**Architecture:** Cada domínio vira um módulo puro em `src/lib/marketing/` (sem I/O, testado com `node --test`). Um módulo servidor novo, `tabs.ts`, carrega só as abas da planilha necessárias e calcula **uma** aba do painel por requisição (`/api/marketing/data?tab=...`); sem `tab`, a rota devolve exatamente o `MarketingView` de hoje (painel no ar continua igual). A UI ganha abas em dois níveis dentro de `/admin/marketing`; cada aba nova é um componente que busca o próprio payload tipado.

**Tech Stack:** Next.js 14.2 (App Router), React 18, TypeScript (target ES5), Tailwind v3, shadcn/ui sobre `@base-ui/react`, recharts via `@/components/ui/chart`, sonner, lucide-react, Supabase (`@/lib/db`, service role), Node 24 `node --test` com type stripping, Meta Graph API, export CSV do Google Sheets por gid.

**Spec:** `docs/superpowers/specs/2026-10-13-marketing-fase3-design.md` (continua `docs/superpowers/specs/2026-10-10-dashboard-marketing-design.md`; plano anterior: `docs/superpowers/plans/2026-10-10-dashboard-marketing.md`).

## Global Constraints

- Só adição: SQL só com `create table if not exists` + `alter table ... enable row level security`, **sem policies**. Nunca alterar/dropar tabela existente nem apagar linhas de `mkt_settings`, `mkt_creative_alias`, `mkt_editions`. O único DELETE novo é de uma linha de `mkt_disparos` por id.
- SQL aplicado à mão, idempotente, pela Management API: `POST https://api.supabase.com/v1/projects/iuxdimqnjyweipawytzl/database/query` com `SUPABASE_ACCESS_TOKEN` do `.env.local`.
- Não tocar em `/ao-vivo`, `/espera`, `/api/cadastro`, `src/components/AoVivoContent.tsx`, `src/components/EsperaContent.tsx`, `src/lib/db.ts`, `src/lib/auth.ts`, `src/lib/edition.ts`. Presença da plataforma é só leitura (funções já existentes de `db.ts`).
- Imports dentro de `src/lib/marketing/`: módulos puros importam uns aos outros com caminho relativo **com** `.ts` (`import { x } from './parse.ts'`) e nunca `@/`. Só `sources/*`, `store.ts`, `sync.ts`, `view.ts`, `settings.ts` e o novo `tabs.ts` podem usar `@/` (ou importar quem usa).
- Testes: `node:test` + `node:assert/strict`, arquivos `src/lib/marketing/*.test.ts`, rodados por `npm test`. Dados de teste anonimizados (e-mails `a@x`, nomes genéricos).
- TypeScript com target ES5: proibido `for..of`/spread sobre `Map`/`Set` (TS2802). Usar arrays, `forEach` e objetos (`Object.create(null)` quando a chave vem de dado externo). `for..of` sobre array é permitido.
- Planilha somente leitura, buscada por **gid**. Nunca escrever o ID da planilha em arquivo do repositório (o repo é público).
- Token do Meta nunca vai ao navegador nem a resposta de API.
- Toda rota nova/alterada de admin começa com `if (!(await verifyAdminFromRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });`.
- UI só dentro de `/admin/marketing` (nenhum item novo no menu lateral). Abas em dois níveis: **Resultado** (Edição, Criativos, Validação) · **Leads** (Pesquisa, Aplicações, Ao vivo) · **Comercial** (Agendamentos, Vendas, Compradores) · **Canais** (API, Disparos). Mesma identidade visual dos componentes atuais (cards `Card size="sm"`, rótulos `text-[10px] uppercase tracking-widest`, `tabular-nums`, cores emerald/amber/red/sky já usadas).
- Número sem fonte = "—" com explicação no hover (`title`), nunca `0`, `NaN`, `Infinity` ou `R$ 0,00` inventado.
- `/api/marketing/data` sem `tab` devolve o `MarketingView` atual, sem mudança de formato. Com `tab=<edicao|criativos|validacao|pesquisa|aplicacoes|aovivo|agendamentos|vendas|compradores|api|disparos>` calcula só aquela aba. Listas de pessoas só com `&lists=1`.
- Filtro de campanha do Meta: chave `meta_campaign_filter` (padrão `WB PG`; linha salva vazia = todas), aplicado na leitura sobre o cache `mkt_meta_ad_daily`; nada é apagado.
- Conferência de cabeçalho normaliza espaços e quebras de linha; coluna obrigatória ausente = aviso da fonte; coluna opcional ausente = métrica "—".
- Dados pessoais (nomes, e-mails) só em listas recolhíveis pedidas com `lists=1`.
- O script de import dos disparos fica **fora do repositório** e nunca é commitado com dados.

## Review Focus

- Cabeçalho da Pesquisa ou do Typeform muda de texto (pergunta reescrita): o sync avisa "Aba X: colunas não encontradas: …" pela agulha obrigatória e as métricas de colunas opcionais viram "—", nunca leitura da coluna errada em silêncio. Teste na Task 1.
- Mesma pessoa em fontes diferentes (e-mail com maiúsculas/espaços, telefone com/sem DDI, várias aplicações, compra registrada só pelo nome): junção por e-mail normalizado, deduplicação por dígitos do telefone, venda casada pelo nome sem acento. Testes nas Tasks 4 e 6.
- Fronteira de "hoje" e fuso: call marcada para hoje é "agendada" (não "sem registro"); aplicação enviada 01:30 UTC cai no dia anterior em Brasília e conta para a live daquela noite. Testes nas Tasks 1, 4 e 6.
- Edição em andamento × encerrada no comparativo: corte por dias de captação até ontem, dia da live fora do corte e dentro do total; alcance não comparável vira "—". Teste na Task 9.
- Filtro de campanha vazio significa "todas", não "nenhuma"; sem linha salva vale `WB PG`. Teste na Task 9 (`campaignFilterOf`) usado pelo `settings.ts` na Task 10.

## Decisões tomadas onde a spec não fecha

1. **Compatibilidade:** sem `tab` a rota não muda. As abas Edição/Criativos/Validação continuam lendo o `MarketingView` e buscam o complemento com `?tab=edicao|criativos|validacao`.
2. **Atribuição de edição em todo o ciclo:** aplicação/negócio vai para a captação mais recente do ciclo (#015 em diante) ou para a última live até a data. O HTML antigo só olhava #015–#020, então o #020 absorvia registros posteriores sem par; aqui eles caem na edição certa (#021+). Registros sem edição identificada (sem e-mail na captação e sem data) não entram em nenhuma edição e aparecem como contagem "sem edição" (o HTML os somava em qualquer seleção).
3. **Venda aprovada = STATUS não casa `/reembol|estorno|cancel/i`** em todo o painel (antes era `=== 'aprovada'`). Compradores também excluem reembolsos (spec: "excluído de toda contagem de venda").
4. **Stopwords dos desafios comparadas sem acento** (o HTML comparava a lista acentuada contra tokens sem acento, deixando passar "também", "porém"…).
5. **Comparecimento oficial = pico ÷ leads da edição × 100** (mesma conta de reserva do HTML) na conferência.
6. **Investimento na conferência:** Meta filtrado × "Investimento Captação Meta" (ou "Investimento Total" se a coluna não existir). Compras do pixel não entram (não são buscadas).
7. **Corte do comparativo:** dias de captação até **ontem** (o dia de hoje é parcial no Meta e na planilha).
8. **Alcance/frequência:** guardados por janela inteira da edição paga (1 chamada por edição a cada sync). A variação só aparece quando as duas edições já passaram da live e têm janelas de mesma duração; senão "—" com explicação.
9. **Vendas do funil completo** = linhas da Captação com funil `PAGO` (mesma regra de `ticketSales`), da edição, com `utm_campaign` contendo o filtro.
10. **Edições abaixo de #015** saem do seletor (o HTML também as ignorava); dados continuam no banco.
11. **Disparos** não pertencem a edição: o filtro de edição não se aplica; o período filtra pela data do disparo.
12. **Gasto oficial por edição** (custo por call): edições NF10K (#015–#020) usam sempre o "Investimento Total" da Visão Geral (como o HTML). Edições pagas: Meta filtrado na janela; sem Meta, "Investimento Total"; sem nada, "n/d" e fora do total.
13. **"Até o pitch" do Ao vivo** segue o HTML (entrou antes do pitch e saiu depois). O funil da Edição continua com a regra atual (`stayedToPitch`).
14. **Complementos da Edição ignoram o período** (edição inteira, como o bloco "Fundo"). Ao vivo também (é por live).
15. **Template importado** = rótulo (`V1`/`V2`) + texto da versão que rodou + mensagens 02 e 03, quando o disparo tem `key` nos templates do HTML.
16. **Venda ↔ negócio por ciclo:** negócio de edição NF10K só casa com venda de #015–#020; negócio do pago, com venda do pago (o HTML só via o ciclo NF10K).
17. **Criativos:** leads, % 5k+, agendamentos e vendas high ticket somam **todas** as edições selecionadas (como o HTML), com os desempates do HTML; as colunas do Meta (gasto, CPA, CTR…) continuam da 1ª edição selecionada, como hoje — a tela diz isso.
18. **Fonte vazia não vira zero:** se uma aba da planilha que a aba do painel usa não tem dados, a rota devolve `{ missing: [...] }` e a tela mostra "Fonte sem dados: … Clique em Atualizar".
19. **Desempenho:** `maxDuration = 60` na rota de dados; linhas da planilha guardadas em memória da instância enquanto o `fetched_at` do snapshot não muda; presença de lives que já passaram guardada em memória; respostas por URL guardadas no navegador (voltar a uma aba não refaz a busca).
20. **Escrita dos disparos** só por `POST/PATCH/DELETE /api/marketing/disparos`; a leitura vem da aba (`?tab=disparos`), então não há GET próprio. Erros do banco ficam no log do servidor; o navegador recebe "Falha ao salvar".
21. **Funil da Edição** espera o complemento carregar (mostra "Carregando funil…") para não trocar de etapas na frente da pessoa; com ele: Aplicações → qualificada → agendadas → realizadas (linhas do Pipedrive) → vendas high ticket (com a lista de compradores), mais a divisão Power | Start. Se o complemento falhar, volta aos totais da Visão Geral.

## Estrutura de arquivos

```
src/lib/marketing/
  types.ts            + campos novos de Captação/Vendas/Agendamentos, OverviewCheck, SurveyRow, ApplicationRow, MetaWindow
  parse.ts            + normHeader, findCol, findColAll, firstCol, parseBR, parseBROrNull, shiftHours, normName; parseDateTime só 2021–2099
  sheet-rows.ts       + abas survey/applications, agulhas obrigatórias, colunas opcionais, números com ponto de milhar
  editions.ts         + PAGO_MIN, CYCLE_MIN, editionKind, lastLiveOnOrBefore, cycleStartAt, índice de captação
  metrics.ts          + countBy
  survey.ts           NOVO  pesquisa: junção, 5k+, distribuições, filtro de renda, desafios
  applications.ts     NOVO  Typeform: fuso, completas, dedupe, edição, origem, aba Aplicações
  sales.ts            NOVO  produto, ticket padrão, público, origem, abas Vendas e Compradores
  deals.ts            NOVO  negócios do Pipedrive: status, edição, alertas, aba Agendamentos
  api-leads.ts        NOVO  leads utm_source=api
  disparos.ts         NOVO  agregados e validação de mkt_disparos
  live.ts             NOVO  presença por minuto, pico, pitch, histograma
  reconcile.ts        NOVO  oficial × planilha por edição
  full-funnel.ts      NOVO  filtro de campanha, funil Meta+UTM, corte por dias, janelas de alcance
  breakdowns.ts       NOVO  funil Power|Start, webinário a webinário, extras por criativo
  tabs.ts             NOVO  (servidor) contexto + cálculo de uma aba do painel
  settings.ts         + gids novos, meta_campaign_filter
  store.ts            + snapshots seletivos, datas dos snapshots, mkt_disparos, mkt_meta_window
  sync.ts             + abas novas, alcance por janela
  view.ts             + filtro de campanha na leitura, snapshots seletivos
  sources/meta.ts     + fetchMetaWindow
  sources/platform.ts + loadLive (leitor paginado próprio, que lança erro)
  *.test.ts           testes de cada módulo puro
src/app/api/marketing/data/route.ts       + ?tab=
src/app/api/marketing/settings/route.ts   + gids novos, metaCampaignFilter
src/app/api/marketing/disparos/route.ts   NOVO  POST/PATCH/DELETE
src/components/marketing/
  ui.tsx              NOVO  Kpi, BarList, DistChart, PeopleList, TabState, formatadores
  useTabData.ts       NOVO  hook de busca por aba
  SurveyTab.tsx  ApplicationsTab.tsx  LiveTab.tsx  DealsTab.tsx  SalesTab.tsx
  BuyersTab.tsx  ApiTab.tsx  DisparosTab.tsx  EditionExtras.tsx      NOVOS
  MarketingDashboard.tsx  EditionTab.tsx  LeadFunnel.tsx  CreativesTab.tsx  ValidationTab.tsx  IntegrationsCard.tsx   alterados
supabase/marketing.sql    + mkt_disparos, mkt_meta_window
<fora do repo> C:\Projetos\Clientes\Mentoria Power\scratch\import-disparos.mjs
```

Regras de negócio portadas do HTML antigo (`dash-exemplo.md`, fora do git, a partir da linha 773): `findCol`, `parseBR`, `normProd`, `TICKET_PADRAO`, status de negócio, dedupe de aplicações, bigramas dos desafios, `normSource`, `classifyPublico`, curva ao vivo. O HTML **não** deve ser aberto pelo implementador: tudo o que é preciso está neste plano (a Task 19 só o passa como argumento ao script de import). Conferir números contra o HTML é **verificação do usuário**, marcada assim nos passos manuais.

---

### Task 1: Parsing, cabeçalhos normalizados e linhas tipadas das abas novas

**Files:**
- Modify: `src/lib/marketing/types.ts`
- Modify: `src/lib/marketing/parse.ts`
- Modify: `src/lib/marketing/sheet-rows.ts`
- Modify: `src/lib/marketing/settings.ts` (`SETTING_KEYS`, `DEFAULT_GIDS`, `gids`) e `src/lib/marketing/sync.ts` (`TAB_TITLES`) — exigidos pelo `TabKey` novo
- Test: `src/lib/marketing/parse.test.ts`, `src/lib/marketing/sheet-rows.test.ts`
- Modify (fixtures): `src/lib/marketing/metrics.test.ts`, `src/lib/marketing/editions.test.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces:
  - `parse.ts`: `normHeader(h: string): string`, `findCol(headers: string[], ...needles: string[]): string | null`, `findColAll(headers, ...needles): string | null`, `firstCol(headers, ...needles): string | null`, `parseBR(v: string): number`, `parseBROrNull(v: string): number | null`, `shiftHours(at: string | null, hours: number): string | null`, `normName(s: string): string`. `toRecords` passa a normalizar cabeçalhos; `parseDateTime` aceita separador espaço/vírgula/T e só anos 2021–2099 (sentinela → null). Ticket e números da Visão Geral passam a usar `parseBR` ("16.788" = 16788).
  - `settings.ts`/`sync.ts`: `DEFAULT_GIDS` e `TAB_TITLES` com as 6 abas (`survey` = gid `503784201`, `applications` = gid `336862755`).
  - `sheet-rows.ts`: `type TabKey = 'capture' | 'overview' | 'sales' | 'schedule' | 'survey' | 'applications'`, `TAB_KEYS: TabKey[]`, `TAB_NEEDLES`, `isRefund(status: string): boolean`, `toSurveyRows(recs): SurveyRow[]`, `toApplicationRows(recs): ApplicationRow[]`; `toSaleRows`/`toScheduleRows`/`toCaptureRows`/`toOverviewRows` com campos novos.
  - `types.ts`: `CaptureRow` + `name`, `utmTerm`; `SaleRow` + `refunded`, `status`, `name`, `capSource`, `capMedium`, `capCampaign`, `saleSource`, `saleCampaign`, `funnel`; `ScheduleRow` + `title`, `personName`, `emails`, `via`, `realizedRaw`, `productRaw`, `income`, `value`, `utmSource`, `utmCampaign`, `utmMedium`; `OverviewCheck`; `OverviewRow.check`; `SurveyRow`; `ApplicationRow`; `MetaWindow`.

- [ ] **Step 1: Tipos novos**

Em `src/lib/marketing/types.ts`, substituir os tipos `CaptureRow`, `SaleRow`, `ScheduleRow`, `OverviewRow` por estes e acrescentar os novos ao fim do arquivo (os demais tipos ficam iguais):

```ts
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
```

E ao fim do arquivo:

```ts
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
```

- [ ] **Step 2: Testes de parse (falhando)**

Em `src/lib/marketing/parse.test.ts`, trocar o import de `./parse.ts` por:

```ts
import {
  parseCsv, toRecords, parseBRL, parseDateTime, parseDay, parseEditionNumber,
  normEmail, phoneKey, inferLiveDate, addDays,
  normHeader, findCol, findColAll, firstCol, parseBR, parseBROrNull, shiftHours, normName,
} from './parse.ts';
```

e acrescentar ao fim do arquivo:

```ts
test('normHeader and toRecords collapse spaces and newlines in headers', () => {
  assert.equal(normHeader(' Investimento Total \nAPI '), 'Investimento Total API');
  const recs = toRecords([['Agendamentos  PWR', 'Investimento Total \nAPI'], ['3', '10']]);
  assert.deepEqual(recs, [{ 'Agendamentos PWR': '3', 'Investimento Total API': '10' }]);
});

test('findCol tries needles in order; findColAll needs every needle; firstCol keeps sheet order', () => {
  const h = ['Data de envio', 'Renda familiar', 'Faturamento renda'];
  assert.equal(findCol(h, 'renda familiar', 'renda'), 'Renda familiar');
  assert.equal(findCol(h, 'xyz', 'renda'), 'Renda familiar');
  assert.equal(findCol(h, 'nada'), null);
  assert.equal(findColAll(['Investimento Captação Meta', 'Investimento Total'], 'capta', 'meta'), 'Investimento Captação Meta');
  assert.equal(firstCol(['utm_content_venda', 'utm_content_captacao'], 'utm_content_captacao', 'utm_content_venda'), 'utm_content_venda');
});

test('parseBR reads sheet numbers like the old dashboard (thousand dots, R$, %, formula errors)', () => {
  assert.equal(parseBR('16.788'), 16788);
  assert.equal(parseBR('R$ 1.000'), 1000);
  assert.equal(parseBR('1.997,00'), 1997);
  assert.equal(parseBR('R$ 1.234,56'), 1234.56);
  assert.equal(parseBR('45%'), 45);
  assert.equal(parseBR('9.9'), 9.9);
  assert.equal(parseBR('#DIV/0!'), 0);
  assert.equal(parseBR(''), 0);
  assert.equal(parseBROrNull(''), null);
  assert.equal(parseBROrNull('#N/A'), null);
  assert.equal(parseBROrNull('0'), 0);
});

test('parseDateTime: comma/T separators, 1-digit fields, only years 2021–2099', () => {
  assert.equal(parseDateTime('10/10/2026, 08:57:00'), '2026-10-10T08:57:00');
  assert.equal(parseDateTime('1/2/2026 8:5'), '2026-02-01T08:05:00');
  assert.equal(parseDateTime('2026-10-14T01:30:00.000Z'), '2026-10-14T01:30:00');
  assert.equal(parseDateTime('01/01/0001 00:00'), null);
  assert.equal(parseDateTime('1899-12-30'), null);
  assert.equal(parseDay('0001-01-01'), null);
});

test('shiftHours moves Typeform UTC to Brasília across midnight', () => {
  assert.equal(shiftHours('2026-10-14T01:30:00', -3), '2026-10-13T22:30:00');
  assert.equal(shiftHours(null, -3), null);
});

test('normName drops accents and punctuation', () => {
  assert.equal(normName('  José  da Silva-Jr. '), 'jose da silva jr');
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `SyntaxError: The requested module './parse.ts' does not provide an export named 'findCol'` (export ainda não existe).

- [ ] **Step 4: Implementar em `parse.ts`**

Em `toRecords`, trocar `const header = rows[0].map(h => h.trim());` por:

```ts
  const header = rows[0].map(normHeader);
```

Substituir a função `parseDateTime` inteira por (separador espaço/vírgula/T, campos de 1 dígito, só anos 2021–2099 — o `01/01/0001` do Typeform vira null aqui):

```ts
// Aceita "DD/MM/AAAA HH:MM[:SS]" (separador espaço, vírgula ou T) e ISO. Só anos 2021–2099:
// o "01/01/0001" do Typeform (sem data) e datas absurdas viram null.
export function parseDateTime(s: string): string | null {
  const t = (s ?? '').trim();
  const time = '(?:[\\s,T]+(\\d{1,2}):(\\d{1,2})(?::(\\d{1,2}))?)?';
  let m = t.match(new RegExp(`^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})${time}`));
  let out: string | null = null;
  if (m) out = `${m[3]}-${pad(m[2])}-${pad(m[1])}T${pad(m[4] ?? 0)}:${pad(m[5] ?? 0)}:${pad(m[6] ?? 0)}`;
  else {
    m = t.match(new RegExp(`^(\\d{4})-(\\d{2})-(\\d{2})${time}`));
    if (m) out = `${m[1]}-${m[2]}-${m[3]}T${pad(m[4] ?? 0)}:${pad(m[5] ?? 0)}:${pad(m[6] ?? 0)}`;
  }
  if (!out) return null;
  const year = Number(out.slice(0, 4));
  return year >= 2021 && year <= 2099 ? out : null;
}
```

`parseBRL` continua exportada (a linha de testes antiga usa), mas as abas passam a usar `parseBR`. Acrescentar ao fim de `src/lib/marketing/parse.ts`:

```ts
// Cabeçalho da planilha: a Visão Geral tem "Investimento Total \nAPI" e espaços duplos.
export function normHeader(h: string): string {
  return (h ?? '').replace(/\s+/g, ' ').trim();
}

// findCol do dash antigo: para cada agulha, em ordem, a 1ª coluna que a contém (sem caixa).
export function findCol(headers: string[], ...needles: string[]): string | null {
  const low = headers.map(h => (h ?? '').toLowerCase().trim());
  for (let n = 0; n < needles.length; n++) {
    const needle = needles[n].toLowerCase();
    for (let i = 0; i < low.length; i++) if (low[i].includes(needle)) return headers[i];
  }
  return null;
}

// Coluna que contém todas as agulhas.
export function findColAll(headers: string[], ...needles: string[]): string | null {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? '').toLowerCase();
    if (needles.every(n => h.includes(n.toLowerCase()))) return headers[i];
  }
  return null;
}

// 1ª coluna, na ordem da planilha, que contém qualquer agulha.
export function firstCol(headers: string[], ...needles: string[]): string | null {
  for (let i = 0; i < headers.length; i++) {
    const h = (headers[i] ?? '').toLowerCase();
    if (needles.some(n => h.includes(n.toLowerCase()))) return headers[i];
  }
  return null;
}

// parseBR do dash antigo: tira R$, espaços e %, pontos de milhar ("16.788" = 16788), vírgula = decimal;
// vazio e erro de fórmula ("#DIV/0!") = 0.
export function parseBR(v: string): number {
  const s = String(v ?? '').trim();
  if (!s || s.startsWith('#')) return 0;
  const n = parseFloat(s.replace(/[R$\s%]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

// Igual ao parseBR, mas célula vazia ou erro de fórmula = null ("—" na tela).
export function parseBROrNull(v: string): number | null {
  const s = String(v ?? '').trim();
  return !s || s.startsWith('#') ? null : parseBR(s);
}

export function shiftHours(at: string | null, hours: number): string | null {
  if (!at) return null;
  const d = new Date(`${at}Z`);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString().slice(0, 19);
}

// Nome para casar pessoas entre abas: minúsculo, sem acento, só letras.
export function normName(s: string): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 5: Rodar os testes de parse**

Run: `npm test`
Expected: os testes de `parse.test.ts` passam (os de `sheet-rows` ainda passam também).

- [ ] **Step 6: Testes de sheet-rows (falhando)**

Em `src/lib/marketing/sheet-rows.test.ts`: trocar o import de `./sheet-rows.ts` por

```ts
import {
  checkHeaders, SheetFormatError, toCaptureRows, toSaleRows, toScheduleRows, toOverviewRows, toSurveyRows, toApplicationRows,
} from './sheet-rows.ts';
```

trocar, no teste `'toScheduleRows and toOverviewRows'`, a última asserção (`assert.deepEqual(o, {...})`) por

```ts
  assert.deepEqual({ ...o, check: undefined }, { edition: 22, dayMonth: '13/10', applications: 12, scheduled: 5, done: 3, investment: 950.07, check: undefined });
```

e acrescentar ao fim:

```ts
test('checkHeaders normalizes spaces and checks needle columns of the new tabs', () => {
  assert.doesNotThrow(() => checkHeaders('overview', [{
    Data: '', 'Webinário': '', 'Aplicações': '', 'Agendamentos  PWR': '', 'Agendamentos PWS': '',
    'Realizadas PWR': '', 'Realizadas PWS': '', 'Investimento Total': '',
  }]));
  assert.throws(() => checkHeaders('survey', [{ 'Qual seu e-mail?': 'x' }]),
    (e: unknown) => e instanceof SheetFormatError && e.tab === 'survey' && e.missing.join() === 'renda familiar');
  assert.doesNotThrow(() => checkHeaders('applications', [{ 'Submitted At': '', 'E-mail': '', 'Qual produto?': '' }]));
});

test('toOverviewRows.check: blank = null, percent as 0–100, sales summed', () => {
  const [o] = toOverviewRows([{
    Data: '13/10', 'Webinário': '#020', 'Aplicações': '', 'Agendamentos PWR': '3', 'Agendamentos PWS': '',
    'Realizadas PWR': '', 'Realizadas PWS': '', 'Investimento Total': 'R$ 1.000,00', 'Investimento Captação Meta': 'R$ 800,00',
    Pico: '', Comparecimento: '0,45', 'Vendas Start': '2', 'Vendas Desafio': '1', 'Vendas Power': '', 'Faturamento Total': 'R$ 5.000,00',
  }]);
  assert.deepEqual(o.check, {
    applications: null, scheduled: 3, done: null, peak: null, attendance: 45,
    metaSpend: 800, investment: 1000, sales: 3, revenue: 5000,
  });
});

test('toSaleRows: refund regex, blank status counts, capture/sale UTMs', () => {
  const base = { Produto: 'Power Start', Ticket: '', Email: 'a@x.com', Telefone: '', utm_content_captacao: 'img_1', utm_content_venda: 'img_2', Data: '', 'Webinário': '#020' };
  const rows = toSaleRows([
    { ...base, STATUS: '', utm_source_captacao: 'ig', utm_campaign_captacao: '[WB] frio', utm_source_venda: 'email', 'Nome contato': 'Ana' },
    { ...base, STATUS: 'Estorno', utm_source_captacao: '', utm_campaign_captacao: '', utm_source_venda: '', 'Nome contato': '' },
  ]);
  assert.equal(rows[0].approved, true);
  assert.equal(rows[0].capSource, 'ig');
  assert.equal(rows[0].capCampaign, '[WB] frio');
  assert.equal(rows[0].saleSource, 'email');
  assert.equal(rows[0].name, 'Ana');
  assert.equal(rows[1].refunded, true);
  assert.equal(rows[1].approved, false);
});

test('toScheduleRows reads the extra Pipedrive columns', () => {
  const [s] = toScheduleRows([{
    'Motivo da perda': '', Closer: '', utm_content: '', 'SE - Agendada': 'Sim, pelo Comercial', 'Agendada em': '2026-10-01',
    'SE - Data': '', 'Ganho em': '', 'SE - Realizada': 'Não', 'E-mail - Trabalho': '', 'E-mail - Residencial': 'B@x.com',
    'WEBNÁRIO': '', 'Título': 'WB - Pessoa Teste', 'Negócio - Valor': '20.040', 'Produto (certo)': '',
    'Renda Mensal': 'R$5 mil a R$7 mil', utm_campaign: 'cp', utm_medium: 'md',
  }]);
  assert.deepEqual(s.emails, ['b@x.com']);
  assert.equal(s.title, 'WB - Pessoa Teste');
  assert.equal(s.value, 20040);
  assert.equal(s.realizedRaw, 'não');
  assert.equal(s.via, 'Sim, pelo Comercial');
  assert.equal(s.income, 'R$5 mil a R$7 mil');
  assert.equal(s.utmCampaign, 'cp');
  assert.equal(s.edition, null);
});

test('toSurveyRows and toApplicationRows', () => {
  const [p] = toSurveyRows([{
    'Submitted At': '10/10/2026 08:00:00', 'Qual seu e-mail?': ' A@X.com ', 'Renda familiar mensal': '5a7k', Faturamento: '1a3k',
    'Tempo de fotografia': '1a3', 'Serviço carro-chefe': 'estudio', 'Há quanto tempo conhece?': 'agora', Desafios: 'Vender mais',
  }]);
  assert.deepEqual(p, { email: 'a@x.com', at: '2026-10-10T08:00:00', tempo: '1a3', servico: 'estudio', renda: '5a7k', fat: '1a3k', conhece: 'agora', desafios: 'Vender mais' });
  const empty = { utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '' };
  const apps = toApplicationRows([
    { ...empty, 'Submitted At': '2026-10-14 01:30:00', 'E-mail': 'C@x.com', WhatsApp: '(51) 9999-0000', 'Nome completo': 'Teste', 'Qual produto?': 'Power',
      'Qual sua renda mensal?': '', 'Faturamento com fotografia': '', 'Teria interesse em mentorias focadas?': 'Sim, claro', 'Escolha o dia': '15/10', utm_source: 'plataforma', utm_content: 'botao' },
    { ...empty, 'Submitted At': '01/01/0001 00:00', 'E-mail': '', WhatsApp: '', 'Nome completo': '', 'Qual produto?': '',
      'Qual sua renda mensal?': '', 'Faturamento com fotografia': '', 'Teria interesse em mentorias focadas?': 'Não', 'Escolha o dia': '' },
  ]);
  assert.equal(apps[0].at, '2026-10-13T22:30:00');
  assert.equal(apps[0].email, 'c@x.com');
  assert.equal(apps[0].interest, 'Sim');
  assert.equal(apps[0].scheduled, true);
  assert.equal(apps[0].utmContent, 'botao');
  assert.equal(apps[1].at, null);
  assert.equal(apps[1].interest, 'Não');
});

test('Ticket and Visão Geral numbers use thousand dots like the old dashboard', () => {
  const [s] = toSaleRows([{ STATUS: 'Aprovada', Produto: 'Power', Ticket: '16.788', Email: '', Telefone: '', utm_content_captacao: '', utm_content_venda: '', Data: '', 'Webinário': '#020' }]);
  assert.equal(s.amount, 16788);
  const [o] = toOverviewRows([{
    Data: '13/10', 'Webinário': '#020', 'Aplicações': '1.204', 'Agendamentos PWR': '', 'Agendamentos PWS': '',
    'Realizadas PWR': '', 'Realizadas PWS': '', 'Investimento Total': 'R$ 1.000',
  }]);
  assert.deepEqual([o.applications, o.investment, o.check.investment], [1204, 1000, 1000]);
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `SyntaxError: The requested module './sheet-rows.ts' does not provide an export named 'toSurveyRows'`.

- [ ] **Step 8: Implementar `sheet-rows.ts`**

Substituir `src/lib/marketing/sheet-rows.ts` inteiro por:

```ts
import type { ApplicationRow, CaptureRow, OverviewCheck, OverviewRow, SaleRow, ScheduleRow, SurveyRow } from './types.ts';
import {
  findCol, findColAll, firstCol, normEmail, normHeader, parseBR, parseBROrNull, parseDateTime, parseDay,
  parseEditionNumber, shiftHours,
} from './parse.ts';

export type TabKey = 'capture' | 'overview' | 'sales' | 'schedule' | 'survey' | 'applications';
export const TAB_KEYS: TabKey[] = ['capture', 'overview', 'sales', 'schedule', 'survey', 'applications'];

// Obrigatórias por nome exato (comparado depois de normalizar espaços).
export const TAB_COLUMNS: Record<TabKey, string[]> = {
  capture: ['e-mail', 'whatsapp', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'data', 'Webinário', 'Edição'],
  overview: ['Data', 'Webinário', 'Aplicações', 'Agendamentos PWR', 'Agendamentos PWS', 'Realizadas PWR', 'Realizadas PWS', 'Investimento Total'],
  sales: ['STATUS', 'Produto', 'Ticket', 'Email', 'Telefone', 'utm_content_captacao', 'utm_content_venda', 'Data', 'Webinário'],
  schedule: ['Motivo da perda', 'Closer', 'utm_content', 'SE - Agendada', 'Agendada em', 'SE - Data', 'Ganho em', 'SE - Realizada', 'E-mail - Trabalho', 'WEBNÁRIO'],
  survey: [],
  applications: [],
};

// Abas novas: o texto da pergunta muda; obrigatório = alguma coluna contém uma das agulhas.
export const TAB_NEEDLES: Record<TabKey, string[][]> = {
  capture: [], overview: [], sales: [], schedule: [],
  survey: [['e-mail', 'email'], ['renda familiar', 'renda']],
  applications: [['submitted'], ['e-mail', 'email'], ['produto']],
};

export class SheetFormatError extends Error {
  tab: string;
  missing: string[];
  constructor(tab: string, missing: string[]) {
    super(`colunas não encontradas: ${missing.join(', ') || '(aba vazia)'}`);
    this.tab = tab;
    this.missing = missing;
  }
}

export function checkHeaders(tab: TabKey, records: Record<string, string>[]): void {
  if (!records.length) throw new SheetFormatError(tab, []);
  const keys = Object.keys(records[0]);
  const present: Record<string, true> = Object.create(null);
  keys.forEach(k => { present[normHeader(k)] = true; });
  const missing = TAB_COLUMNS[tab].filter(c => !present[normHeader(c)])
    .concat(TAB_NEEDLES[tab].filter(alts => !findCol(keys, ...alts)).map(alts => alts[0]));
  if (missing.length) throw new SheetFormatError(tab, missing);
}

export const isRefund = (status: string) => /reembol|estorno|cancel/i.test(status ?? '');

// Ticket e números da Visão Geral: "16.788" = 16788 (ponto de milhar), como o dash antigo.
const num = (s: string) => parseBR(s);
const v = (r: Record<string, string>, k: string) => (r[k] ?? '').trim();
const cell = (r: Record<string, string>, k: string | null) => (k ? (r[k] ?? '').trim() : '');
const headersOf = (recs: Record<string, string>[]) => (recs.length ? Object.keys(recs[0]) : []);

// dealCol do dash antigo: para cada agulha, a 1ª coluna que a contém; vale se a célula não estiver vazia.
function dealCol(r: Record<string, string>, ...needles: string[]): string {
  const keys = Object.keys(r);
  for (let i = 0; i < needles.length; i++) {
    const n = needles[i].toLowerCase();
    const k = keys.filter(x => x.toLowerCase().includes(n))[0];
    if (k && (r[k] ?? '').trim()) return r[k].trim();
  }
  return '';
}

export function toCaptureRows(recs: Record<string, string>[]): CaptureRow[] {
  const h = headersOf(recs);
  const cName = findCol(h, 'nome');
  const cTerm = findCol(h, 'utm_term', 'utm term');
  return recs.map(r => ({
    email: normEmail(v(r, 'e-mail')),
    phone: v(r, 'whatsapp'),
    name: cell(r, cName),
    utmSource: v(r, 'utm_source'),
    utmMedium: v(r, 'utm_medium'),
    utmCampaign: v(r, 'utm_campaign'),
    utmTerm: cell(r, cTerm),
    utmContent: v(r, 'utm_content'),
    at: parseDateTime(v(r, 'data')),
    edition: parseEditionNumber(v(r, 'Webinário')),
    funnel: v(r, 'Edição'),
  }));
}

export function toSaleRows(recs: Record<string, string>[]): SaleRow[] {
  const h = headersOf(recs);
  const capSrc = firstCol(h, 'utm_source_captacao', 'utm_source_captação');
  const capMed = firstCol(h, 'utm_medium_captacao', 'utm_medium_captação');
  const capCmp = firstCol(h, 'utm_campaign_captacao', 'utm_campaign_captação');
  const saleSrc = firstCol(h, 'utm_source_venda', 'utm_source_vendas');
  const saleCmp = firstCol(h, 'utm_campaign_venda');
  const cName = firstCol(h, 'nome contato', 'nome');
  const cFunnel = findCol(h, 'edição', 'edicao');
  return recs.map(r => {
    const status = v(r, 'STATUS');
    return {
      approved: !isRefund(status),
      refunded: isRefund(status),
      status,
      product: v(r, 'Produto'),
      amount: num(v(r, 'Ticket')),
      email: normEmail(v(r, 'Email')),
      phone: v(r, 'Telefone'),
      name: cell(r, cName),
      utmContentCapture: v(r, 'utm_content_captacao'),
      utmContentSale: v(r, 'utm_content_venda'),
      capSource: cell(r, capSrc),
      capMedium: cell(r, capMed),
      capCampaign: cell(r, capCmp),
      saleSource: cell(r, saleSrc),
      saleCampaign: cell(r, saleCmp),
      funnel: cell(r, cFunnel),
      at: parseDateTime(v(r, 'Data')),
      edition: parseEditionNumber(v(r, 'Webinário')),
    };
  });
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
    title: dealCol(r, 'Título'),
    personName: dealCol(r, 'Pessoa - Nome', 'Pessoa de contato'),
    emails: [dealCol(r, 'E-mail - Trabalho'), dealCol(r, 'E-mail - Residencial'), dealCol(r, 'E-mail - Outros')]
      .filter(Boolean).map(normEmail),
    via: dealCol(r, 'SE - Agendada'),
    realizedRaw: dealCol(r, 'SE - Realizada').toLowerCase(),
    productRaw: dealCol(r, 'Produto (certo)', 'Produto'),
    income: dealCol(r, 'Renda Mensal'),
    value: parseBR(dealCol(r, 'Negócio - Valor', 'Valor')),
    utmSource: dealCol(r, 'utm_source'),
    utmCampaign: dealCol(r, 'utm_campaign'),
    utmMedium: dealCol(r, 'utm_medium'),
  }));
}

const sumOrNull = (...xs: (number | null)[]): number | null =>
  xs.every(x => x === null) ? null : xs.reduce<number>((s, x) => s + (x ?? 0), 0);

export function toOverviewRows(recs: Record<string, string>[]): OverviewRow[] {
  const h = headersOf(recs);
  const c = {
    peak: findCol(h, 'pico'),
    attendance: findCol(h, 'comparecimento'),
    metaSpend: findColAll(h, 'capta', 'meta'),
    revenue: findCol(h, 'faturamento total'),
    salesStart: findCol(h, 'vendas start'),
    salesDesafio: findCol(h, 'vendas desafio'),
    salesPower: h.filter(x => { const l = x.toLowerCase(); return l.includes('venda') && l.includes('power') && !l.includes('start'); })[0] ?? null,
  };
  const opt = (r: Record<string, string>, col: string | null) => (col ? parseBROrNull(r[col] ?? '') : null);
  // Comparecimento pode vir "45%" ou 0,45.
  const pct = (r: Record<string, string>) => {
    const raw = c.attendance ? (r[c.attendance] ?? '') : '';
    const n = parseBROrNull(raw);
    return n !== null && !raw.includes('%') && n > 0 && n < 1 ? Math.round(n * 10000) / 100 : n;
  };
  const out: OverviewRow[] = [];
  for (const r of recs) {
    const edition = parseEditionNumber(v(r, 'Webinário'));
    if (edition === null) continue;
    const check: OverviewCheck = {
      applications: opt(r, 'Aplicações'),
      scheduled: sumOrNull(opt(r, 'Agendamentos PWR'), opt(r, 'Agendamentos PWS')),
      done: sumOrNull(opt(r, 'Realizadas PWR'), opt(r, 'Realizadas PWS')),
      peak: opt(r, c.peak),
      attendance: pct(r),
      metaSpend: opt(r, c.metaSpend),
      investment: opt(r, 'Investimento Total'),
      sales: sumOrNull(opt(r, c.salesStart), opt(r, c.salesDesafio), opt(r, c.salesPower)),
      revenue: opt(r, c.revenue),
    };
    out.push({
      edition,
      dayMonth: v(r, 'Data'),
      applications: num(v(r, 'Aplicações')),
      scheduled: num(v(r, 'Agendamentos PWR')) + num(v(r, 'Agendamentos PWS')),
      done: num(v(r, 'Realizadas PWR')) + num(v(r, 'Realizadas PWS')),
      investment: num(v(r, 'Investimento Total')),
      check,
    });
  }
  return out;
}

export function toSurveyRows(recs: Record<string, string>[]): SurveyRow[] {
  const h = headersOf(recs);
  const c = {
    email: findCol(h, 'e-mail', 'email'),
    at: findCol(h, 'data de envio', 'submitted at', 'timestamp') ?? findCol(h, 'data') ?? findCol(h, 'hora'),
    tempo: findCol(h, 'tempo de fotografia', 'tempo'),
    servico: findCol(h, 'serviço carro', 'servico carro', 'carro-chefe', 'carro chefe'),
    renda: findCol(h, 'renda familiar', 'renda'),
    fat: findCol(h, 'faturamento'),
    conhece: findCol(h, 'conhece'),
    desafios: findCol(h, 'desafios'),
  };
  return recs
    .map(r => ({
      email: normEmail(cell(r, c.email)), at: parseDateTime(cell(r, c.at)), tempo: cell(r, c.tempo), servico: cell(r, c.servico),
      renda: cell(r, c.renda), fat: cell(r, c.fat), conhece: cell(r, c.conhece), desafios: cell(r, c.desafios),
    }))
    .filter(s => s.email);
}

export function toApplicationRows(recs: Record<string, string>[]): ApplicationRow[] {
  const h = headersOf(recs);
  const c = {
    email: findCol(h, 'e-mail', 'email'), phone: findCol(h, 'whatsapp'), name: findCol(h, 'nome completo', 'nome'),
    at: findCol(h, 'submitted'), product: findCol(h, 'produto'), income: findCol(h, 'renda mensal'),
    revenue: findCol(h, 'faturamento'), relation: findCol(h, 'relação com a fotografia', 'relacao com a fotografia'),
    interest: findCol(h, 'teria interesse', 'mentorias focadas'), calendar: findCol(h, 'escolha o dia', 'calendário', 'calendario'),
    src: findCol(h, 'utm_source'), med: findCol(h, 'utm_medium'), cmp: findCol(h, 'utm_campaign'), content: findCol(h, 'utm_content'),
  };
  return recs.map((r): ApplicationRow => {
    const raw = parseDateTime(cell(r, c.at));
    const interest = cell(r, c.interest);
    return {
      email: normEmail(cell(r, c.email)),
      phone: cell(r, c.phone),
      name: cell(r, c.name),
      // Submitted At vem em UTC; "01/01/0001" (sem data) já vira null no parseDateTime.
      at: shiftHours(raw, -3),
      product: cell(r, c.product),
      income: cell(r, c.income),
      revenue: cell(r, c.revenue),
      relation: cell(r, c.relation),
      interest: /^sim/i.test(interest) ? 'Sim' : /^n[aã]o/i.test(interest) ? 'Não' : '',
      scheduled: !!cell(r, c.calendar),
      utmSource: cell(r, c.src),
      utmMedium: cell(r, c.med),
      utmCampaign: cell(r, c.cmp),
      utmContent: cell(r, c.content),
    };
  });
}
```

- [ ] **Step 9: Ajustar fixtures dos testes existentes aos tipos novos**

`OverviewRow.check` e os campos novos são obrigatórios; sem isto `tsc` e `next build` (que checa os `.test.ts`) quebram.

Em `src/lib/marketing/editions.test.ts`, trocar o topo (import + helper `ov`) por:

```ts
import type { OverviewRow } from './types.ts';
import { buildEditions } from './editions.ts';

const noCheck = { applications: null, scheduled: null, done: null, peak: null, attendance: null, metaSpend: null, investment: null, sales: null, revenue: null };
const ov = (edition: number, dayMonth: string): OverviewRow =>
  ({ edition, dayMonth, applications: 0, scheduled: 0, done: 0, investment: 0, check: noCheck });
```

(as linhas `import test` e `import assert` continuam no topo, antes destas.)

Em `src/lib/marketing/metrics.test.ts`: no import de tipos, acrescentar `OverviewRow, SaleRow, ScheduleRow`; no helper `sale`, acrescentar `name: '', utmTerm: '',` ao objeto; e no teste `'backSummary: ...'` envolver os três literais com asserção de tipo:

```ts
  const b = backSummary(
    [{ edition: 22, dayMonth: '13/10', applications: 10, scheduled: 99, done: 99, investment: 0 } as OverviewRow],
    [
      { lostReason: '', closer: '', utmContent: '', scheduledAt: '2026-10-14', callDate: '2026-10-15', wonAt: null, done: true, email: 'a@x', edition: 22 },
      { lostReason: '', closer: '', utmContent: '', scheduledAt: '2026-10-14', callDate: '2026-10-16', wonAt: null, done: false, email: 'b@x', edition: 22 },
    ] as ScheduleRow[],
    [{ approved: true, product: 'Power', amount: 16788, email: 'a@x', phone: '', utmContentCapture: '', utmContentSale: '', at: null, edition: 22 },
     { approved: false, product: 'Power', amount: 16788, email: 'c@x', phone: '', utmContentCapture: '', utmContentSale: '', at: null, edition: 22 }] as SaleRow[],
    [22], front,
  );
```

- [ ] **Step 10: `TabKey` com 6 abas — gids e títulos**

O `TabKey` novo exige as 6 chaves em todo `Record<TabKey, …>`; por isso estes três ajustes entram já nesta task (a busca das abas novas no sync fica na Task 2).

Em `src/lib/marketing/settings.ts`, substituir `SETTING_KEYS`, `DEFAULT_GIDS` e o bloco `gids:` de `getMarketingSettings`:

```ts
export const SETTING_KEYS = [
  'sheet_id', 'gid_capture', 'gid_overview', 'gid_sales', 'gid_schedule', 'gid_survey', 'gid_applications',
  'meta_token', 'meta_ad_account', 'meta_api_version',
] as const;
```

```ts
// gids lidos em 2026-10-10 e 2026-10-13. Buscar por gid: o endpoint por nome devolve a 1ª aba em silêncio.
export const DEFAULT_GIDS: Record<TabKey, string> = {
  capture: '0',
  overview: '214347056',
  sales: '2007849935',
  schedule: '1247583607',
  survey: '503784201',
  applications: '336862755',
};
```

```ts
    gids: {
      capture: db.gid_capture || DEFAULT_GIDS.capture,
      overview: db.gid_overview || DEFAULT_GIDS.overview,
      sales: db.gid_sales || DEFAULT_GIDS.sales,
      schedule: db.gid_schedule || DEFAULT_GIDS.schedule,
      survey: db.gid_survey || DEFAULT_GIDS.survey,
      applications: db.gid_applications || DEFAULT_GIDS.applications,
    },
```

Em `src/lib/marketing/sync.ts`, substituir `TAB_TITLES` por:

```ts
export const TAB_TITLES: Record<TabKey, string> = {
  capture: 'Captação',
  overview: 'Visão Geral',
  sales: 'Detalhamento Vendas',
  schedule: 'Detalhamento Agendamentos',
  survey: 'Pesquisa [novo]',
  applications: 'Análise Individual (Typeform)',
};
```

- [ ] **Step 11: Rodar testes e checar tipos**

Run: `npm test && npx tsc --noEmit`
Expected: todos os testes passam; `tsc` sem erros (o sync ainda busca só as 4 abas antigas).

- [ ] **Step 12: Commit**

```bash
git add src/lib/marketing/types.ts src/lib/marketing/parse.ts src/lib/marketing/sheet-rows.ts src/lib/marketing/parse.test.ts src/lib/marketing/sheet-rows.test.ts src/lib/marketing/metrics.test.ts src/lib/marketing/editions.test.ts src/lib/marketing/settings.ts src/lib/marketing/sync.ts
git commit -m "feat(marketing): normalized headers, survey/Typeform rows and extra sheet columns"
```

---

### Task 2: Abas novas no sync e em Configurações (snapshots seletivos)

**Files:**
- Modify: `src/lib/marketing/sync.ts`
- Modify: `src/lib/marketing/store.ts:15-19` (`loadSnapshots`)
- Modify: `src/lib/marketing/view.ts:34-36`
- Modify: `src/app/api/marketing/settings/route.ts:11`
- Modify: `src/components/marketing/IntegrationsCard.tsx:12,24-27`

**Interfaces:**
- Consumes: `TabKey`, `TAB_KEYS`, `DEFAULT_GIDS`, `TAB_TITLES` (Task 1).
- Produces: sync busca as 6 abas; `loadSnapshots(tabs?: TabKey[])`; gids das abas novas editáveis em Configurações.

- [ ] **Step 1: `sync.ts` — buscar as 6 abas**

Em `src/lib/marketing/sync.ts`: trocar o import de `sheet-rows` por `import { TAB_KEYS, toOverviewRows, type TabKey } from './sheet-rows.ts';` e trocar `for (const tab of ['capture', 'overview', 'sales', 'schedule'] as TabKey[]) {` por `for (const tab of TAB_KEYS) {`.

- [ ] **Step 2: `store.ts` — snapshots só das abas pedidas**

Substituir `loadSnapshots` em `src/lib/marketing/store.ts`:

```ts
// Pesquisa e Typeform são grandes: cada leitor pede só as abas que usa.
export async function loadSnapshots(tabs?: TabKey[]): Promise<Partial<Record<TabKey, Record<string, string>[]>>> {
  let q = supabase.from('mkt_sheet_snapshot').select('tab, rows');
  if (tabs) q = q.in('tab', tabs);
  const { data, error } = await q;
  check(error, 'snapshots');
  return Object.fromEntries((data ?? []).map(r => [r.tab, r.rows]));
}
```

Em `src/lib/marketing/view.ts`, dentro do `Promise.all` de `buildView`, trocar `loadSnapshots()` por `loadSnapshots(['capture', 'overview', 'sales', 'schedule'])`.

- [ ] **Step 3: Rota de settings e card de integrações**

Em `src/app/api/marketing/settings/route.ts`: trocar `import type { TabKey } from '@/lib/marketing/sheet-rows';` por `import { TAB_KEYS } from '@/lib/marketing/sheet-rows';` e a linha `const TABS: TabKey[] = [...]` por `const TABS = TAB_KEYS;`.

Em `src/components/marketing/IntegrationsCard.tsx`: trocar

```ts
type Tab = 'capture' | 'overview' | 'sales' | 'schedule';
```

por

```ts
type Tab = 'capture' | 'overview' | 'sales' | 'schedule' | 'survey' | 'applications';
```

e o array `TABS` por

```ts
const TABS: [Tab, string][] = [
  ['capture', 'Captação'], ['overview', 'Visão Geral'],
  ['sales', 'Detalhamento Vendas'], ['schedule', 'Detalhamento Agendamentos'],
  ['survey', 'Pesquisa [novo]'], ['applications', 'Análise Individual (Typeform)'],
];
```

- [ ] **Step 4: Verificar**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, sem erros de tipo.

Manual (com `npm run dev` e `.env.local`): em Configurações → Integrações → **Testar conexão**, aparecem 6 linhas "Planilha · …", incluindo "Pesquisa [novo]" e "Análise Individual (Typeform)" com "N linhas, cabeçalho ok". Em `/admin/marketing`, **Atualizar** não gera aviso novo. Edição/Criativos/Validação mostram os mesmos números de antes, **exceto** as vendas high ticket: venda com STATUS diferente de "Aprovada" que não seja reembolso/estorno/cancelamento (ex.: vazio, "Pendente") passa a contar (Task 1), e Ticket com ponto de milhar ("16.788") passa a valer 16.788 em vez de 16,788 — ambos corretos e esperados.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/sync.ts src/lib/marketing/store.ts src/lib/marketing/view.ts src/app/api/marketing/settings/route.ts src/components/marketing/IntegrationsCard.tsx
git commit -m "feat(marketing): sync Pesquisa and Typeform tabs; load only needed snapshots"
```

---

### Task 3: Helpers de edição + módulo `survey.ts`

**Files:**
- Modify: `src/lib/marketing/editions.ts`
- Modify: `src/lib/marketing/metrics.ts` (acrescenta `countBy`)
- Create: `src/lib/marketing/survey.ts`
- Test: `src/lib/marketing/editions.test.ts`, `src/lib/marketing/survey.test.ts`

**Interfaces:**
- Consumes: `CaptureRow`, `SurveyRow` (Task 1), `shiftHours` (Task 1).
- Produces:
  - `editions.ts`: `PAGO_MIN = 21`, `CYCLE_MIN = 15`, `type EditionKind = 'pago' | 'nf10k' | 'antiga'`, `editionKind(n: number): EditionKind`, `lastLiveOnOrBefore(eds: { number: number; liveDate: string }[], day: string | null): number | null`, `cycleStartAt(captures: CaptureRow[]): string | null`, `type CaptureIndex = Record<string, CaptureRow[]>`, `indexCaptures(captures): CaptureIndex`, `latestCycleCapture(idx: CaptureIndex, emails: string[], until: string | null): CaptureRow | null`.
  - `metrics.ts`: `type Count = { key: string; count: number }`, `countBy<T>(items: T[], key: (t: T) => string): Count[]`.
  - `survey.ts`: `ORDER_RENDA`, `QUALIFIED_RENDA`, `LABEL_RENDA`, `type SurveyField = 'renda' | 'fat' | 'tempo' | 'servico' | 'conhece'`, `surveyLabel(field, v): string`, `qualified5k(renda: string): boolean`, `latestSurveys(rows: SurveyRow[], cycleStart: string | null): Record<string, SurveyRow>` (resposta sem data nunca substitui uma datada), `type DistItem = { key: string; label: string; count: number; qualified: boolean }`, `distribution(items, field): DistItem[]`, `INCOME_FILTERS`, `filterIncome(items, f): SurveyRow[]`, `type Challenges = { keywords: { word: string; count: number; examples: string[] }[]; phrases: { text: string; count: number }[] }`, `challenges(items: SurveyRow[]): Challenges`, `type SurveyTab`, `surveyTab(leads: CaptureRow[], surveys: Record<string, SurveyRow>, filter: string): SurveyTab`.

- [ ] **Step 1: Testes de edições (falhando)**

Em `src/lib/marketing/editions.test.ts`, trocar `import type { OverviewRow } from './types.ts';` por `import type { CaptureRow, OverviewRow } from './types.ts';` e `import { buildEditions } from './editions.ts';` por `import { buildEditions, editionKind, lastLiveOnOrBefore, cycleStartAt, indexCaptures, latestCycleCapture } from './editions.ts';` (o helper `ov` da Task 1 fica). Acrescentar ao fim:

```ts
const cap = (email: string, at: string, edition: number): CaptureRow => ({
  email, at, edition, phone: '', name: '', utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: `c${edition}`, funnel: '',
});

test('editionKind splits paid and NF10K history', () => {
  assert.equal(editionKind(22), 'pago');
  assert.equal(editionKind(21), 'pago');
  assert.equal(editionKind(20), 'nf10k');
  assert.equal(editionKind(15), 'nf10k');
  assert.equal(editionKind(14), 'antiga');
});

test('lastLiveOnOrBefore counts the live day itself', () => {
  const eds = [{ number: 21, liveDate: '2026-10-06' }, { number: 22, liveDate: '2026-10-13' }];
  assert.equal(lastLiveOnOrBefore(eds, '2026-10-13'), 22);
  assert.equal(lastLiveOnOrBefore(eds, '2026-10-12'), 21);
  assert.equal(lastLiveOnOrBefore(eds, '2026-10-01'), null);
  assert.equal(lastLiveOnOrBefore(eds, null), null);
});

test('cycleStartAt and latestCycleCapture', () => {
  const rows = [cap('a@x', '2026-08-20T10:00:00', 14), cap('a@x', '2026-08-25T10:00:00', 15), cap('a@x', '2026-10-10T10:00:00', 22)];
  assert.equal(cycleStartAt(rows), '2026-08-24T10:00:00');
  const idx = indexCaptures(rows);
  assert.equal(latestCycleCapture(idx, ['a@x'], '2026-09-01T00:00:00')?.edition, 15);
  assert.equal(latestCycleCapture(idx, ['a@x'], null)?.edition, 22);
  assert.equal(latestCycleCapture(idx, ['a@x'], '2026-08-01T00:00:00')?.edition, 22); // nada antes: usa todas
  assert.equal(latestCycleCapture(idx, ['b@x'], null), null);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `SyntaxError: The requested module './editions.ts' does not provide an export named 'editionKind'`.

- [ ] **Step 3: Implementar em `editions.ts`**

Trocar os imports do topo de `src/lib/marketing/editions.ts` por:

```ts
import type { CaptureRow, EditionConfig, OverviewRow } from './types.ts';
import { addDays, inferLiveDate, shiftHours } from './parse.ts';
```

E acrescentar ao fim:

```ts
export const PAGO_MIN = 21;   // #021 em diante: webinário pago (ingresso)
export const CYCLE_MIN = 15;  // #015–#020: histórico NF10K (gratuito)
export type EditionKind = 'pago' | 'nf10k' | 'antiga';
export const editionKind = (n: number): EditionKind => (n >= PAGO_MIN ? 'pago' : n >= CYCLE_MIN ? 'nf10k' : 'antiga');

// Última live até o dia (inclusive): quem não tem e-mail na captação vai para ela.
export function lastLiveOnOrBefore(eds: { number: number; liveDate: string }[], day: string | null): number | null {
  if (!day) return null;
  let best: { number: number; liveDate: string } | null = null;
  for (let i = 0; i < eds.length; i++) {
    const e = eds[i];
    if (e.liveDate <= day && (best === null || e.liveDate > best.liveDate)) best = e;
  }
  return best === null ? null : best.number;
}

// Início do ciclo = primeira captação das edições do ciclo − 1 dia (respostas anteriores são de ciclos antigos).
export function cycleStartAt(captures: CaptureRow[]): string | null {
  let min: string | null = null;
  for (let i = 0; i < captures.length; i++) {
    const c = captures[i];
    if (c.at && c.edition !== null && c.edition >= CYCLE_MIN && (min === null || c.at < min)) min = c.at;
  }
  return shiftHours(min, -24);
}

export type CaptureIndex = Record<string, CaptureRow[]>;

export function indexCaptures(captures: CaptureRow[]): CaptureIndex {
  const idx: CaptureIndex = Object.create(null);
  captures.forEach(c => { if (c.email) (idx[c.email] || (idx[c.email] = [])).push(c); });
  return idx;
}

// Captação mais recente do ciclo até `until`; se nenhuma é anterior, considera todas (igual ao dash antigo).
export function latestCycleCapture(idx: CaptureIndex, emails: string[], until: string | null): CaptureRow | null {
  let leads: CaptureRow[] = [];
  emails.forEach(e => { (idx[e] || []).forEach(l => leads.push(l)); });
  if (until) {
    const before = leads.filter(l => !l.at || l.at <= until);
    if (before.length) leads = before;
  }
  leads.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  for (let i = 0; i < leads.length; i++) {
    const ed = leads[i].edition;
    if (ed !== null && ed >= CYCLE_MIN) return leads[i];
  }
  return null;
}
```

- [ ] **Step 4: `countBy` em `metrics.ts`**

Acrescentar ao fim de `src/lib/marketing/metrics.ts`:

```ts
export type Count = { key: string; count: number };

// Contagem por chave, maior primeiro (empate: ordem de aparição).
export function countBy<T>(items: T[], key: (t: T) => string): Count[] {
  const m: Record<string, number> = Object.create(null);
  const order: string[] = [];
  items.forEach(t => {
    const k = key(t);
    if (m[k] === undefined) { m[k] = 0; order.push(k); }
    m[k]++;
  });
  return order.map(k => ({ key: k, count: m[k] })).sort((a, b) => b.count - a.count);
}
```

- [ ] **Step 5: Testes do `survey.ts` (falhando)**

Criar `src/lib/marketing/survey.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, SurveyRow } from './types.ts';
import { challenges, distribution, filterIncome, latestSurveys, qualified5k, surveyTab } from './survey.ts';

const sv = (email: string, renda: string, at: string | null, extra: Partial<SurveyRow> = {}): SurveyRow =>
  ({ email, at, tempo: '', servico: '', renda, fat: '', conhece: '', desafios: '', ...extra });

test('latestSurveys keeps the most recent answer of the cycle', () => {
  const m = latestSurveys([
    sv('a@x', '1a3k', '2026-09-01T10:00:00'), sv('a@x', '5a7k', '2026-09-05T10:00:00'), sv('a@x', 'mais50k', '2026-09-03T10:00:00'),
    sv('b@x', '5a7k', '2026-07-01T00:00:00'), sv('', '5a7k', null),
  ], '2026-08-24T10:00:00');
  assert.equal(m['a@x'].renda, '5a7k');
  assert.equal(m['b@x'], undefined);
  assert.deepEqual(Object.keys(m), ['a@x']);
});

test('latestSurveys: an undated row never overwrites a dated answer', () => {
  const m = latestSurveys([sv('a@x', '5a7k', '2026-09-05T10:00:00'), sv('a@x', '1a3k', null), sv('b@x', '1a3k', null), sv('b@x', '7a10k', '2026-09-06T10:00:00')], null);
  assert.equal(m['a@x'].renda, '5a7k');
  assert.equal(m['b@x'].renda, '7a10k');
});

test('qualified5k and income filters', () => {
  assert.equal(qualified5k('5a7k'), true);
  assert.equal(qualified5k('3a5k'), false);
  const xs = [sv('a', '3a5k', null), sv('b', '7a10k', null), sv('c', 'mais50k', null)];
  assert.equal(filterIncome(xs, '5kplus').length, 2);
  assert.equal(filterIncome(xs, '3a5k').length, 1);
  assert.equal(filterIncome(xs, 'all').length, 3);
  assert.equal(filterIncome(xs, 'constructor').length, 0);
});

test('distribution follows the fixed order, labels, marks qualified, keeps unknown answers last', () => {
  const d = distribution([sv('a', '7a10k', null), sv('b', 'zero', null), sv('c', '7a10k', null), sv('d', 'outra coisa', null), sv('e', '', null)], 'renda');
  assert.deepEqual(d.map(x => [x.label, x.count, x.qualified]), [['Zero', 1, false], ['R$7k a 10k', 2, true], ['outra coisa', 1, false]]);
});

test('challenges: phrases normalized and counted; bigrams skip short words, stopwords and vague-verb pairs', () => {
  const c = challenges([
    sv('a', '', null, { desafios: 'Conseguir clientes novos.' }),
    sv('b', '', null, { desafios: 'conseguir   clientes novos' }),
    sv('c', '', null, { desafios: 'Precificação dos ensaios' }),
    sv('d', '', null, { desafios: 'conseguir buscar' }),
    sv('e', '', null, { desafios: 'x' }),
  ]);
  assert.deepEqual(c.phrases.map(p => [p.text, p.count]), [['Conseguir clientes novos.', 2], ['Precificação dos ensaios', 1], ['conseguir buscar', 1]]);
  assert.deepEqual(c.keywords.map(k => [k.word, k.count]), [['conseguir clientes', 2], ['clientes novos', 2]]);
  assert.deepEqual(c.keywords[0].examples, ['Conseguir clientes novos.']);
});

test('surveyTab joins survey to leads by e-mail and computes rates', () => {
  const leads = [{ email: 'a@x' }, { email: 'a@x' }, { email: 'b@x' }, { email: 'c@x' }] as CaptureRow[];
  const t = surveyTab(leads, { 'a@x': sv('a@x', '5a7k', null), 'b@x': sv('b@x', '1a3k', null), 'z@x': sv('z@x', 'mais50k', null) }, 'all');
  assert.deepEqual([t.leads, t.responses, t.filtered, t.qualified, t.responseRate, t.quality], [4, 2, 2, 1, 0.5, 0.5]);
  assert.equal(t.charts.renda.length, 2);
  assert.equal(surveyTab(leads, {}, 'all').quality, null);
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/survey.ts'`.

- [ ] **Step 7: Implementar `survey.ts`**

Criar `src/lib/marketing/survey.ts`:

```ts
import type { CaptureRow, SurveyRow } from './types.ts';

export const ORDER_RENDA = ['zero', 'menos1k', '1a3k', '3a5k', '5a7k', '7a10k', '10a15k', '15a20k', '20a30k', '30a50k', 'mais50k'];
export const ORDER_TEMPO = ['nunca', 'menos1', '1a3', '3a5', '5a10', 'mais10'];
export const ORDER_CONHECE = ['agora', 'menos3m', '3a6m', '6a12m', 'mais1a', 'mais2a', 'mais3a'];
export const ORDER_SERVICO = ['estudio', 'ensaios-ext', 'casamentos', 'formaturas', 'esporte', 'outro', 'nunca'];
export const QUALIFIED_RENDA = ['5a7k', '7a10k', '10a15k', '15a20k', '20a30k', '30a50k', 'mais50k'];
export const LABEL_RENDA: Record<string, string> = {
  zero: 'Zero', menos1k: '< R$1k', '1a3k': 'R$1k a 3k', '3a5k': 'R$3k a 5k', '5a7k': 'R$5k a 7k', '7a10k': 'R$7k a 10k',
  '10a15k': 'R$10k a 15k', '15a20k': 'R$15k a 20k', '20a30k': 'R$20k a 30k', '30a50k': 'R$30k a 50k', mais50k: '> R$50k',
};
const LABEL_TEMPO: Record<string, string> = { nunca: 'Nunca', menos1: '< 1 ano', '1a3': '1 a 3 anos', '3a5': '3 a 5 anos', '5a10': '5 a 10 anos', mais10: '> 10 anos' };
const LABEL_CONHECE: Record<string, string> = { agora: 'Agora', menos3m: '< 3 meses', '3a6m': '3 a 6 meses', '6a12m': '6 a 12 meses', mais1a: '> 1 ano', mais2a: '> 2 anos', mais3a: '> 3 anos' };
const LABEL_SERVICO: Record<string, string> = { estudio: 'Estúdio', 'ensaios-ext': 'Ensaios externos', casamentos: 'Casamentos', formaturas: 'Formaturas', esporte: 'Esporte', outro: 'Outro', nunca: 'Nunca atuou' };

export type SurveyField = 'renda' | 'fat' | 'tempo' | 'servico' | 'conhece';
const ORDER: Record<SurveyField, string[]> = { renda: ORDER_RENDA, fat: ORDER_RENDA, tempo: ORDER_TEMPO, servico: ORDER_SERVICO, conhece: ORDER_CONHECE };
const LABEL: Record<SurveyField, Record<string, string>> = { renda: LABEL_RENDA, fat: LABEL_RENDA, tempo: LABEL_TEMPO, servico: LABEL_SERVICO, conhece: LABEL_CONHECE };
const own = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export const surveyLabel = (field: SurveyField, v: string) => (own(LABEL[field], v) ? LABEL[field][v] : v);
export const qualified5k = (renda: string) => QUALIFIED_RENDA.indexOf(renda) >= 0;

// Uma resposta por e-mail: a mais recente do ciclo.
export function latestSurveys(rows: SurveyRow[], cycleStart: string | null): Record<string, SurveyRow> {
  const out: Record<string, SurveyRow> = Object.create(null);
  rows.forEach(r => {
    if (!r.email) return;
    if (cycleStart && r.at && r.at < cycleStart) return; // resposta de ciclo anterior
    const prev = out[r.email];
    // Fica a mais recente; resposta sem data não substitui uma datada.
    if (prev && (!r.at || (prev.at && r.at <= prev.at))) return;
    out[r.email] = r;
  });
  return out;
}

export type DistItem = { key: string; label: string; count: number; qualified: boolean };

export function distribution(items: SurveyRow[], field: SurveyField): DistItem[] {
  const counts: Record<string, number> = Object.create(null);
  const extras: string[] = [];
  items.forEach(x => {
    const k = x[field] || '';
    if (counts[k] === undefined) { counts[k] = 0; if (k && ORDER[field].indexOf(k) < 0) extras.push(k); }
    counts[k]++;
  });
  return ORDER[field].filter(k => counts[k] !== undefined).concat(extras)
    .map(k => ({ key: k, label: surveyLabel(field, k), count: counts[k], qualified: field === 'renda' && qualified5k(k) }));
}

export const INCOME_FILTERS: Record<string, string[]> = {
  '3kplus': ['3a5k', '5a7k', '7a10k', '10a15k', '15a20k', '20a30k', '30a50k', 'mais50k'],
  '5kplus': QUALIFIED_RENDA,
  '7kplus': ['7a10k', '10a15k', '15a20k', '20a30k', '30a50k', 'mais50k'],
  '10kplus': ['10a15k', '15a20k', '20a30k', '30a50k', 'mais50k'],
  '20kplus': ['20a30k', '30a50k', 'mais50k'],
};

export function filterIncome(items: SurveyRow[], f: string): SurveyRow[] {
  if (!f || f === 'all') return items;
  if (own(INCOME_FILTERS, f)) { const set = INCOME_FILTERS[f]; return items.filter(p => set.indexOf(p.renda) >= 0); }
  return items.filter(p => p.renda === f);
}

// Listas do dash antigo, comparadas sem acento.
const STOPWORDS_RAW = ['a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'uns', 'umas', 'para', 'pra', 'por', 'com', 'sem', 'que', 'se', 'é', 'ser', 'ter', 'tem', 'tenho', 'tenha', 'não', 'sim', 'mas', 'ou', 'como', 'onde', 'quando', 'porque', 'porquê', 'muito', 'mais', 'menos', 'já', 'ainda', 'só', 'apenas', 'também', 'sobre', 'me', 'meu', 'minha', 'meus', 'minhas', 'eu', 'você', 'vocês', 'estou', 'está', 'estar', 'estava', 'vou', 'vai', 'ia', 'foi', 'fazer', 'faço', 'faz', 'fiz', 'fazia', 'quero', 'queria', 'preciso', 'precisa', 'precisar', 'pode', 'poder', 'posso', 'sei', 'sabe', 'saber', 'ao', 'à', 'às', 'aos', 'tá', 'tô', 'ficar', 'fica', 'fico', 'ficou', 'vem', 'ir', 'indo', 'nao', 'os', 'as', 'esta', 'isso', 'aquilo', 'todo', 'toda', 'todos', 'todas', 'cada', 'esse', 'essa', 'esses', 'essas', 'este', 'isto', 'estes', 'estas', 'coisa', 'coisas', 'forma', 'jeito', 'vez', 'vezes', 'hora', 'horas', 'tempo', 'tempos', 'pouco', 'pouca', 'pouquinho', 'realmente', 'quase', 'mesmo', 'mesma', 'além', 'tudo', 'nada', 'qualquer', 'tipo', 'tipos', 'fim', 'conta', 'muitas', 'muitos', 'entao', 'então', 'assim', 'pois', 'porem', 'porém', 'antes', 'depois'];
const VAGUE_VERBS_RAW = ['conseguir', 'conseguindo', 'consigo', 'consegue', 'conseguido', 'conseguiu', 'chamar', 'chamando', 'chama', 'chamam', 'chamado', 'entender', 'entendendo', 'entendo', 'entende', 'entendido', 'buscar', 'buscando', 'busco', 'busca', 'aprender', 'aprendendo', 'aprendo', 'aprende', 'aprendido', 'começar', 'começando', 'começo', 'começa', 'comecei', 'ganhar', 'ganhando', 'ganho', 'ganha', 'ganhei', 'ganhou', 'ver', 'vendo', 'vejo', 'vê', 'vi', 'melhorar', 'melhorando', 'melhoro', 'melhora', 'melhorei', 'crescer', 'crescendo', 'cresço', 'cresce', 'cresceu', 'gerar', 'gerando', 'gera', 'gerou', 'trazer', 'trazendo', 'trago', 'traz', 'trouxe', 'dar', 'dando', 'dou', 'dá', 'deu', 'fazendo', 'fez', 'colocar', 'colocando', 'coloco', 'coloca', 'coloquei', 'tendo', 'teve', 'teria', 'organizar', 'organizando', 'organizo', 'organiza', 'trabalhar', 'trabalhando', 'trabalho', 'trabalha', 'trabalhei'];
const deaccent = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const toSet = (words: string[]) => { const o: Record<string, true> = Object.create(null); words.forEach(w => { o[deaccent(w)] = true; }); return o; };
const STOPWORDS = toSet(STOPWORDS_RAW);
const VAGUE_VERBS = toSet(VAGUE_VERBS_RAW);

export type Challenges = { keywords: { word: string; count: number; examples: string[] }[]; phrases: { text: string; count: number }[] };

export function challenges(items: SurveyRow[]): Challenges {
  const byNorm: Record<string, { text: string; count: number }> = Object.create(null);
  const phrases: { text: string; count: number }[] = [];
  items.forEach(p => {
    const raw = (p.desafios || '').trim();
    if (raw.length < 2) return;
    const k = raw.toLowerCase().replace(/\s+/g, ' ').replace(/[.!?,;:]+$/, '').trim();
    if (!byNorm[k]) { byNorm[k] = { text: raw, count: 0 }; phrases.push(byNorm[k]); }
    byNorm[k].count++;
  });
  phrases.sort((a, b) => b.count - a.count || b.text.length - a.text.length);

  // Palavras-chave = pares de palavras vizinhas (≥ 4 letras, sem stopword, não dois verbos vagos).
  const grams: Record<string, { word: string; count: number; examples: string[] }> = Object.create(null);
  const list: { word: string; count: number; examples: string[] }[] = [];
  phrases.forEach(d => {
    const tokens = d.text.toLowerCase().replace(/[^a-záàâãéèêíïóôõöúüç\s]/gi, ' ').split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens.length - 1; i++) {
      const a = tokens[i], b = tokens[i + 1], nA = deaccent(a), nB = deaccent(b);
      if (nA.length < 4 || nB.length < 4) continue;
      if (STOPWORDS[nA] || STOPWORDS[nB]) continue;
      if (VAGUE_VERBS[nA] && VAGUE_VERBS[nB]) continue;
      const key = `${nA} ${nB}`;
      let g = grams[key];
      if (!g) { g = grams[key] = { word: `${a} ${b}`, count: 0, examples: [] }; list.push(g); }
      g.count += d.count;
      if (g.examples.length < 3 && g.examples.indexOf(d.text) < 0) g.examples.push(d.text);
    }
  });
  list.sort((a, b) => b.count - a.count);
  return { keywords: list.slice(0, 15), phrases };
}

export type SurveyTab = {
  leads: number; responses: number; filtered: number; qualified: number;
  responseRate: number | null; quality: number | null; filter: string;
  charts: Record<SurveyField, DistItem[]>;
  challenges: Challenges;
};

// leads = linhas da Captação das edições/período; a pesquisa liga por e-mail.
export function surveyTab(leads: CaptureRow[], surveys: Record<string, SurveyRow>, filter: string): SurveyTab {
  const seen: Record<string, true> = Object.create(null);
  const answered: SurveyRow[] = [];
  leads.forEach(l => {
    const s = l.email ? surveys[l.email] : undefined;
    if (s && !seen[l.email]) { seen[l.email] = true; answered.push(s); }
  });
  const items = filterIncome(answered, filter);
  const qualified = items.filter(p => qualified5k(p.renda)).length;
  return {
    leads: leads.length, responses: answered.length, filtered: items.length, qualified,
    responseRate: leads.length ? items.length / leads.length : null,
    quality: items.length ? qualified / items.length : null,
    filter: filter || 'all',
    charts: {
      renda: distribution(items, 'renda'), fat: distribution(items, 'fat'), tempo: distribution(items, 'tempo'),
      servico: distribution(items, 'servico'), conhece: distribution(items, 'conhece'),
    },
    challenges: challenges(items),
  };
}
```

- [ ] **Step 8: Rodar testes e tipos**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/marketing/editions.ts src/lib/marketing/editions.test.ts src/lib/marketing/metrics.ts src/lib/marketing/survey.ts src/lib/marketing/survey.test.ts
git commit -m "feat(marketing): survey module (5k+, distributions, income filter, challenges) and cycle helpers"
```

---
### Task 4: Módulo `applications.ts` (Typeform)

**Files:**
- Create: `src/lib/marketing/applications.ts`
- Test: `src/lib/marketing/applications.test.ts`

**Interfaces:**
- Consumes: `ApplicationRow`, `DateRange` (Task 1); `phoneKey` (parse.ts, já existe); `CaptureIndex`, `latestCycleCapture`, `lastLiveOnOrBefore`, `indexCaptures` (Task 3); `inRange` (metrics.ts).
- Produces:
  - `applicationOrigin(src: string, cmp: string, content: string): string`, `applicationOriginGroup(src: string, cmp: string): string`
  - Origens com o rótulo do HTML: "Botão da plataforma (ao vivo)", "Comentários (ao vivo)". Pessoa = `phoneKey` (últimos 8 dígitos; com ou sem +55 é a mesma), senão e-mail, senão nome.
  - `type Application = { name: string; email: string; at: string | null; product: string; qualif: 'Power' | 'Start' | 'Desafio' | ''; qualified: boolean; complete: boolean; income: string; revenue: string; relation: string; interest: 'Sim' | 'Não' | ''; scheduled: boolean; origin: string; originGroup: string; edition: number | null; editionByEmail: boolean; creative: string; repeats: number; key: string }`
  - `buildApplications(rows: ApplicationRow[], idx: CaptureIndex, eds: { number: number; liveDate: string }[]): Application[]`
  - `type AppAgg = { key: string; count: number; qualified: number }`, `type ApplicationListItem`, `type ApplicationsTab`, `applicationsTab(apps: Application[], selected: number[], range: DateRange | null, lists: boolean): ApplicationsTab`

- [ ] **Step 1: Testes (falhando)**

Criar `src/lib/marketing/applications.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApplicationRow, CaptureRow } from './types.ts';
import { indexCaptures } from './editions.ts';
import { applicationOrigin, applicationOriginGroup, applicationsTab, buildApplications } from './applications.ts';

const row = (o: Partial<ApplicationRow>): ApplicationRow => ({
  email: '', phone: '', name: '', at: null, product: '', income: '', revenue: '', relation: '', interest: '', scheduled: false,
  utmSource: '', utmMedium: '', utmCampaign: '', utmContent: '', ...o,
});
const cap = (email: string, at: string, edition: number): CaptureRow => ({
  email, at, edition, phone: '', name: '', utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: `c${edition}`, funnel: '',
});
const eds = [{ number: 21, liveDate: '2026-10-06' }, { number: 22, liveDate: '2026-10-13' }];

test('applicationOrigin labels', () => {
  assert.equal(applicationOrigin('plataforma', '', 'botao'), 'Botão da plataforma (ao vivo)');
  assert.equal(applicationOrigin('plataforma', '', 'comentarios'), 'Comentários (ao vivo)');
  assert.equal(applicationOrigin('whatsapp', 'grupo', '3'), 'Grupo WhatsApp · msg 3');
  assert.equal(applicationOrigin('whats', 'replay', '2'), 'Replay WhatsApp · msg 2');
  assert.equal(applicationOrigin('api', 'apiweb01', '1'), 'API apiweb01 · msg 1');
  assert.equal(applicationOrigin('', '', ''), '(sem utm)');
  assert.equal(applicationOriginGroup('whatsapp', 'replay'), 'Replay WhatsApp');
  assert.equal(applicationOriginGroup('plataforma', ''), 'Plataforma (ao vivo)');
});

test('buildApplications: dedupe by phone digits, latest complete wins, incomplete dropped when the person completed', () => {
  const apps = buildApplications([
    row({ phone: '(51) 99999-0001', email: 'a@x', at: '2026-10-13T21:00:00', product: 'Power', name: 'A' }),
    row({ phone: '+55 51 99999-0001', email: 'outro@x', at: '2026-10-13T22:00:00', product: 'Start', name: 'A' }),
    row({ phone: '51999990001', at: '2026-10-13T20:30:00', name: 'A' }),
    row({ email: 'b@x', at: '2026-10-13T23:00:00', name: 'B' }),
    row({ email: 'b@x', at: '2026-10-13T23:05:00', name: 'B' }),
  ], indexCaptures([]), eds);
  assert.equal(apps.length, 2);
  assert.deepEqual([apps[0].qualif, apps[0].repeats, apps[0].qualified], ['Start', 1, true]);
  assert.deepEqual([apps[1].complete, apps[1].name], [false, 'B']);
});

test('buildApplications: edition by e-mail capture up to the submission, else last live', () => {
  const idx = indexCaptures([cap('a@x', '2026-10-01T10:00:00', 21), cap('a@x', '2026-10-14T10:00:00', 22)]);
  const [a, b] = buildApplications([
    row({ email: 'a@x', at: '2026-10-13T22:30:00', product: 'Power' }),
    row({ email: 'z@x', at: '2026-10-13T22:30:00', product: 'Desafio' }),
  ], idx, eds);
  assert.deepEqual([a.edition, a.editionByEmail, a.creative], [21, true, 'c21']);
  assert.deepEqual([b.edition, b.editionByEmail, b.qualified], [22, false, false]);
});

test('applicationsTab counts per edition and only lists people with lists=1', () => {
  const apps = buildApplications([
    row({ email: 'a@x', at: '2026-10-13T21:00:00', product: 'Power', utmSource: 'plataforma', utmContent: 'botao', scheduled: true }),
    row({ email: 'b@x', at: '2026-10-13T21:10:00', product: 'Desafio', utmSource: 'plataforma', utmContent: 'botao' }),
    row({ email: 'c@x', at: '2026-10-13T21:20:00', name: 'C' }),
    row({ email: 'd@x', at: '2026-10-05T10:00:00', product: 'Start' }),
  ], indexCaptures([]), eds);
  const t = applicationsTab(apps, [22], null, false);
  assert.deepEqual([t.complete, t.qualified, t.power, t.desafio, t.incomplete, t.scheduled, t.noEdition], [2, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(t.originGroups, [{ key: 'Plataforma (ao vivo)', count: 2, qualified: 1 }]);
  assert.equal(t.byEdition[0].edition, 22);
  assert.equal(t.list, null);
  assert.equal(applicationsTab(apps, [22], null, true).list?.incomplete[0], 'C');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/applications.ts'`.

- [ ] **Step 3: Implementar**

Criar `src/lib/marketing/applications.ts`:

```ts
import type { ApplicationRow, DateRange } from './types.ts';
import { lastLiveOnOrBefore, latestCycleCapture, type CaptureIndex } from './editions.ts';
import { inRange } from './metrics.ts';
import { phoneKey } from './parse.ts';

export function applicationOrigin(src: string, cmp: string, content: string): string {
  const s = src.toLowerCase(), c = cmp.toLowerCase(), k = content.toLowerCase();
  if (!s && !k) return '(sem utm)';
  if (s === 'plataforma' && k === 'botao') return 'Botão da plataforma (ao vivo)';
  if (s === 'plataforma' && k === 'comentarios') return 'Comentários (ao vivo)';
  if (s === 'plataforma') return `Plataforma · ${content || cmp}`;
  if (/^whats/.test(s) && c === 'grupo') return `Grupo WhatsApp · msg ${content}`;
  if (/^whats/.test(s) && c === 'replay') return `Replay WhatsApp · msg ${content}`;
  if (s === 'api') return `API ${cmp} · msg ${content}`;
  return [src, cmp, content].filter(Boolean).join(' · ');
}

export function applicationOriginGroup(src: string, cmp: string): string {
  const s = src.toLowerCase(), c = cmp.toLowerCase();
  if (!s) return '(sem utm)';
  if (s === 'plataforma') return 'Plataforma (ao vivo)';
  if (/^whats/.test(s) && c === 'replay') return 'Replay WhatsApp';
  if (/^whats/.test(s)) return 'Grupo WhatsApp';
  if (s === 'api') return 'API';
  return src;
}

export type Application = {
  name: string; email: string; at: string | null; product: string;
  qualif: 'Power' | 'Start' | 'Desafio' | ''; qualified: boolean; complete: boolean;
  income: string; revenue: string; relation: string; interest: 'Sim' | 'Não' | ''; scheduled: boolean;
  origin: string; originGroup: string;
  edition: number | null; editionByEmail: boolean; // false = atribuída pela data (mostrada com *)
  creative: string; repeats: number;
  key: string; // pessoa: telefone (últimos 8 dígitos, ignora +55/DDD) > e-mail > nome
};

export function buildApplications(rows: ApplicationRow[], idx: CaptureIndex, eds: { number: number; liveDate: string }[]): Application[] {
  const all: Application[] = rows.map((r): Application => {
    const lead = r.email ? latestCycleCapture(idx, [r.email], r.at) : null;
    const p = r.product;
    const qualif = /power/i.test(p) ? 'Power' : /start/i.test(p) ? 'Start' : /desafio/i.test(p) ? 'Desafio' : '';
    return {
      name: r.name, email: r.email, at: r.at, product: p, qualif, qualified: qualif === 'Power' || qualif === 'Start',
      complete: !!(p || r.income || r.revenue),
      income: r.income, revenue: r.revenue, relation: r.relation, interest: r.interest, scheduled: r.scheduled,
      origin: applicationOrigin(r.utmSource, r.utmCampaign, r.utmContent),
      originGroup: applicationOriginGroup(r.utmSource, r.utmCampaign),
      edition: lead ? lead.edition : lastLiveOnOrBefore(eds, r.at ? r.at.slice(0, 10) : null),
      editionByEmail: !!lead,
      creative: lead ? lead.utmContent : '',
      repeats: 0,
      key: phoneKey(r.phone) || r.email || r.name.toLowerCase(),
    };
  });
  // Das completas fica a mais recente de cada pessoa; incompletas caem se a pessoa completou.
  const kept: Record<string, Application> = Object.create(null);
  const out: Application[] = [];
  all.filter(a => a.complete)
    .sort((x, y) => (y.at ?? '').localeCompare(x.at ?? ''))
    .forEach(a => { if (kept[a.key]) kept[a.key].repeats++; else { kept[a.key] = a; out.push(a); } });
  const seenInc: Record<string, true> = Object.create(null);
  all.forEach(a => {
    if (a.complete || kept[a.key] || seenInc[a.key]) return;
    seenInc[a.key] = true;
    out.push(a);
  });
  return out;
}

export type AppAgg = { key: string; count: number; qualified: number };

function agg(apps: Application[], key: (a: Application) => string): AppAgg[] {
  const m: Record<string, AppAgg> = Object.create(null);
  const list: AppAgg[] = [];
  apps.forEach(a => {
    const k = key(a);
    if (!m[k]) { m[k] = { key: k, count: 0, qualified: 0 }; list.push(m[k]); }
    m[k].count++;
    if (a.qualified) m[k].qualified++;
  });
  return list.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

const INCOME_ORDER = ['Menos de R$1 mil', 'R$1 mil a R$3 mil', 'R$3 mil a R$5 mil', 'R$5 mil a R$7 mil', 'R$7 mil a R$10 mil', 'R$10 mil a R$15 mil', 'R$15 mil a R$20 mil', 'R$20 mil a R$30 mil', 'R$30 mil a R$50 mil', 'Mais de R$50 mil'];
const byIncome = (xs: AppAgg[]) => xs.sort((a, b) => {
  const ia = INCOME_ORDER.indexOf(a.key), ib = INCOME_ORDER.indexOf(b.key);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});

export type ApplicationListItem = {
  at: string | null; name: string; origin: string; relation: string; revenue: string; income: string;
  qualif: string; scheduled: boolean; edition: number | null; editionByEmail: boolean; creative: string; repeats: number;
};

export type ApplicationsTab = {
  complete: number; repeats: number; incomplete: number; noEdition: number;
  qualified: number; power: number; start: number; desafio: number; scheduled: number; interestYes: number;
  originGroups: AppAgg[]; origins: AppAgg[];
  byEdition: { edition: number; complete: number; qualified: number; power: number; start: number; desafio: number; scheduled: number; incomplete: number; topOrigin: string | null }[];
  profile: { income: AppAgg[]; revenue: AppAgg[]; relation: AppAgg[] };
  list: { complete: ApplicationListItem[]; incomplete: string[] } | null;
};

export function applicationsTab(apps: Application[], selected: number[], range: DateRange | null, lists: boolean): ApplicationsTab {
  const inPeriod = apps.filter(a => inRange(a.at ? a.at.slice(0, 10) : null, range));
  const mine = inPeriod.filter(a => a.edition !== null && selected.indexOf(a.edition) >= 0);
  const done = mine.filter(a => a.complete);
  const inc = mine.filter(a => !a.complete);
  const n = (q: string) => done.filter(a => a.qualif === q).length;
  const byEdition = selected.map(ed => {
    const d = done.filter(a => a.edition === ed);
    const top = agg(d, a => a.originGroup)[0];
    return {
      edition: ed, complete: d.length, qualified: d.filter(a => a.qualified).length,
      power: d.filter(a => a.qualif === 'Power').length, start: d.filter(a => a.qualif === 'Start').length,
      desafio: d.filter(a => a.qualif === 'Desafio').length, scheduled: d.filter(a => a.scheduled).length,
      incomplete: inc.filter(a => a.edition === ed).length, topOrigin: top ? top.key : null,
    };
  }).filter(r => r.complete || r.incomplete);
  return {
    complete: done.length, repeats: done.reduce((s, a) => s + a.repeats, 0), incomplete: inc.length,
    noEdition: inPeriod.filter(a => a.edition === null).length,
    qualified: done.filter(a => a.qualified).length, power: n('Power'), start: n('Start'), desafio: n('Desafio'),
    scheduled: done.filter(a => a.scheduled).length, interestYes: done.filter(a => a.interest === 'Sim').length,
    originGroups: agg(done, a => a.originGroup), origins: agg(done, a => a.origin),
    byEdition,
    profile: {
      income: byIncome(agg(done, a => a.income || '(não informou)')),
      revenue: byIncome(agg(done, a => a.revenue || '(não informou)')),
      relation: agg(done, a => a.relation || '(não informou)'),
    },
    list: lists ? {
      complete: done.slice().sort((x, y) => (y.at ?? '').localeCompare(x.at ?? '')).map(a => ({
        at: a.at, name: a.name, origin: a.origin, relation: a.relation, revenue: a.revenue, income: a.income, qualif: a.qualif,
        scheduled: a.scheduled, edition: a.edition, editionByEmail: a.editionByEmail, creative: a.creative, repeats: a.repeats,
      })),
      incomplete: inc.map(a => a.name || a.email),
    } : null,
  };
}
```

- [ ] **Step 4: Rodar testes e tipos**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/applications.ts src/lib/marketing/applications.test.ts
git commit -m "feat(marketing): applications module (Typeform timezone, dedupe, edition, origin)"
```

---

### Task 5: Módulo `sales.ts` (produto, público, Vendas e Compradores)

**Files:**
- Create: `src/lib/marketing/sales.ts`
- Test: `src/lib/marketing/sales.test.ts`

**Interfaces:**
- Consumes: `SaleRow`, `CaptureRow`, `SurveyRow` (Task 1); `countBy`, `Count` (Task 3); `challenges`, `qualified5k`, `surveyLabel`, `Challenges`, `SurveyField` (Task 3).
- Produces: `type Product = 'powerStart' | 'power' | 'desafio' | 'outro'`, `PRODUCT_LABEL`, `normProd(p: string): Product`, `TICKET_DEFAULT`, `saleValue(s: SaleRow): number`, `type Audience`, `AUDIENCES`, `classifyAudience(campaign, source, medium, content): Audience`, `normSource(src, med, cmp): string`, `type AudienceCard`, `type SaleListItem`, `type SalesTab`, `salesTab(leads: CaptureRow[], sales: SaleRow[], lists: boolean): SalesTab`, `type BuyerFilter = 'todos' | 'power' | 'powerStart' | 'desafio'`, `type BuyerListItem`, `type BuyersTab`, `buyersTab(sales: SaleRow[], surveys: Record<string, SurveyRow>, filter: string, lists: boolean): BuyersTab`.

- [ ] **Step 1: Testes (falhando)**

Criar `src/lib/marketing/sales.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, SaleRow, SurveyRow } from './types.ts';
import { buyersTab, classifyAudience, normProd, normSource, saleValue, salesTab } from './sales.ts';

const sale = (o: Partial<SaleRow>): SaleRow => ({
  approved: true, refunded: false, status: 'Aprovada', product: 'Power', amount: 0, email: '', phone: '', name: '',
  utmContentCapture: '', utmContentSale: '', capSource: '', capMedium: '', capCampaign: '', saleSource: '', saleCampaign: '',
  funnel: '', at: null, edition: 20, ...o,
});
const lead = (o: Partial<CaptureRow>): CaptureRow => ({
  email: '', phone: '', name: '', utmSource: 'ig', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: '', at: null, edition: 20, funnel: '', ...o,
});
const sv = (email: string, renda: string, servico = ''): SurveyRow => ({ email, at: null, tempo: '', servico, renda, fat: '', conhece: '', desafios: '' });

test('normProd and saleValue default tickets', () => {
  assert.equal(normProd('Power Start'), 'powerStart');
  assert.equal(normProd('Start (dupla)'), 'powerStart');
  assert.equal(normProd('PWS'), 'powerStart');
  assert.equal(normProd('Power '), 'power');
  assert.equal(normProd('Desafio Poderoso'), 'desafio');
  assert.equal(normProd('Outro'), 'outro');
  assert.equal(saleValue(sale({ product: 'Power Start' })), 1997);
  assert.equal(saleValue(sale({ product: 'Power', amount: 16788 })), 16788);
});

test('classifyAudience follows the old precedence', () => {
  assert.equal(classifyAudience('frio', 'api', '', ''), 'api');
  assert.equal(classifyAudience('', 'fb', '', 'APIWEB01'), 'api');
  assert.equal(classifyAudience('frio', 'email', '', ''), 'email');
  assert.equal(classifyAudience('[wb] frio', 'ig', 'quente', ''), 'frio');
  assert.equal(classifyAudience('x', 'ig', 'publico-quente', ''), 'quente');
  assert.equal(classifyAudience('pwr_perpetuo', 'ig', '', ''), 'bio_se');
  assert.equal(classifyAudience('web_01_26', 'ig', '', ''), 'insta_organico');
  assert.equal(classifyAudience('outra', 'ig', '', ''), 'outros');
});

test('normSource maps Meta placements unless organic', () => {
  assert.equal(normSource('ig', 'cpc', 'x'), 'meta ads');
  assert.equal(normSource('ig', 'stories', 'x'), 'instagram orgânico');
  assert.equal(normSource('', '', ''), '(sem utm)');
  assert.equal(normSource('Google', '', ''), 'google');
});

test('salesTab excludes refunds from every count', () => {
  const leads = [lead({ utmCampaign: 'frio' }), lead({ utmCampaign: 'frio' }), lead({ utmCampaign: 'quente' }), lead({ utmSource: 'api' })];
  const t = salesTab(leads, [
    sale({ product: 'Power Start', capCampaign: 'frio', capSource: 'ig' }),
    sale({ product: 'Power', capCampaign: 'quente', approved: false, refunded: true }),
    sale({ product: 'Desafio', capSource: 'api', amount: 997, at: '2026-10-10T10:00:00' }),
  ], false);
  assert.deepEqual([t.sales, t.refunds, t.revenue, t.avgTicket, t.conversion], [2, 1, 2994, 1497, 0.5]);
  assert.deepEqual(t.audiences.map(a => [a.key, a.leads, a.sales, a.refunds]), [['quente', 1, 0, 1], ['frio', 2, 1, 0], ['api', 1, 1, 0]]);
  assert.deepEqual(t.byDay, [{ key: '2026-10-10', count: 1 }]);
  assert.equal(t.lists, null);
  assert.equal(salesTab(leads, [], true).lists?.frio?.length, 0);
});

test('buyersTab joins survey by e-mail and filters product', () => {
  const sales = [
    sale({ email: 'a@x', product: 'Power' }), sale({ email: 'b@x', product: 'Power Start' }),
    sale({ email: 'c@x', product: 'Power', approved: false, refunded: true }),
  ];
  const surveys = { 'a@x': sv('a@x', '5a7k', 'estudio') };
  const p = buyersTab(sales, surveys, 'power', false);
  assert.deepEqual([p.filter, p.buyers, p.responded, p.qualified], ['power', 1, 1, 1]);
  assert.deepEqual(p.topIncome, { key: 'R$5k a 7k', count: 1 });
  assert.deepEqual(p.topService, { key: 'Estúdio', count: 1 });
  assert.equal(p.list, null);
  const all = buyersTab(sales, surveys, 'x', true);
  assert.deepEqual([all.filter, all.buyers, all.responded, all.list?.length], ['todos', 2, 1, 2]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/sales.ts'`.

- [ ] **Step 3: Implementar**

Criar `src/lib/marketing/sales.ts`:

```ts
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
```

- [ ] **Step 4: Rodar testes e tipos**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/sales.ts src/lib/marketing/sales.test.ts
git commit -m "feat(marketing): sales module (product, default ticket, audience, buyers x survey)"
```

---

### Task 6: Módulo `deals.ts` (Agendamentos do Pipedrive)

**Files:**
- Create: `src/lib/marketing/deals.ts`
- Test: `src/lib/marketing/deals.test.ts`

**Interfaces:**
- Consumes: `ScheduleRow`, `SaleRow`, `SurveyRow`, `DateRange` (Task 1); `CYCLE_MIN`, `lastLiveOnOrBefore`, `latestCycleCapture`, `indexCaptures`, `CaptureIndex` (Task 3); `normProd`, `saleValue` (Task 5); `LABEL_RENDA` (Task 3); `countBy`, `Count`, `inRange` (metrics.ts); `addDays`, `normName` (parse.ts).
- Produces:
  - `type DealStatus = 'agendada' | 'realizada' | 'reagendada' | 'cancelada' | 'nao_realizada' | 'sem_registro' | 'perdido' | 'ganho' | 'reembolsado'`, `STATUS_LABEL: Record<DealStatus, string>`
  - `dealStatus(d: { won: boolean; saleOk: boolean; saleRefunded: boolean; lostReason: string; realizedRaw: string; callDate: string | null }, today: string): DealStatus`
  - `type Deal = { name: string; type: 'SE' | 'WB' | ''; closer: string; via: string; product: string; scheduledAt: string | null; callDate: string | null; realized: boolean; lostReason: string; status: DealStatus; alerts: string[]; income: string; value: number; edition: number | null; editionBy: 'planilha' | 'email' | 'data' | null; creative: string; utmContent: string; utmSource: string }` (`creative` = utm_content do negócio, senão o do lead; `utmContent` = só o do negócio, usado em "Via API")
  - Venda casada por ciclo: negócio de edição NF10K (#015–#020) só com venda NF10K; negócio do pago só com venda do pago (a edição do negócio é calculada antes do casamento).
  - `buildDeals(rows: ScheduleRow[], sales: SaleRow[], idx: CaptureIndex, surveys: Record<string, SurveyRow>, eds: { number: number; liveDate: string }[], today: string): Deal[]`
  - `dealDone(d: Deal): boolean`, `type MomentCat`, `momentCat(d: Deal): MomentCat`, `type CatCounts = { total; ganho; perdCall; perdSem; andamento; aberto: number }`, `type CostRow`, `type DealListItem`, `type DealsTab`, `dealsTab(deals: Deal[], eds: { number: number; liveDate: string }[], spend: Record<number, number | null>, range: DateRange | null, lists: boolean): DealsTab`

- [ ] **Step 1: Testes (falhando)**

Criar `src/lib/marketing/deals.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, SaleRow, ScheduleRow } from './types.ts';
import { indexCaptures } from './editions.ts';
import { buildDeals, dealStatus, dealsTab, type Deal } from './deals.ts';

const eds = [{ number: 21, liveDate: '2026-10-06' }, { number: 22, liveDate: '2026-10-13' }];
const st = (o: Partial<Parameters<typeof dealStatus>[0]>) =>
  dealStatus({ won: false, saleOk: false, saleRefunded: false, lostReason: '', realizedRaw: '', callDate: null, ...o }, '2026-10-13');
const sch = (o: Partial<ScheduleRow>): ScheduleRow => ({
  lostReason: '', closer: 'Ana', utmContent: '', scheduledAt: '2026-10-14', callDate: '2026-10-16', wonAt: null, done: false,
  email: '', edition: null, title: 'WB - Pessoa', personName: '', emails: [], via: '', realizedRaw: '', productRaw: '',
  income: '', value: 0, utmSource: '', utmCampaign: '', utmMedium: '', ...o,
});
const sale = (o: Partial<SaleRow>): SaleRow => ({
  approved: true, refunded: false, status: 'Aprovada', product: 'Power', amount: 0, email: '', phone: '', name: '',
  utmContentCapture: '', utmContentSale: '', capSource: '', capMedium: '', capCampaign: '', saleSource: '', saleCampaign: '',
  funnel: '', at: null, edition: 22, ...o,
});
const cap = (email: string, at: string, edition: number, utmContent: string): CaptureRow => ({
  email, at, edition, phone: '', name: '', utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent, funnel: '',
});

test('dealStatus follows the old rules, with "today" in Brasília passed in', () => {
  assert.equal(st({ saleOk: true, lostReason: 'x' }), 'ganho');
  assert.equal(st({ won: true, saleRefunded: true }), 'reembolsado');
  assert.equal(st({ won: true }), 'ganho');
  assert.equal(st({ lostReason: 'Sem dinheiro', realizedRaw: 'sim' }), 'perdido');
  assert.equal(st({ realizedRaw: 'Sim' }), 'realizada');
  assert.equal(st({ realizedRaw: 'reagendada' }), 'reagendada');
  assert.equal(st({ realizedRaw: 'Cancelou' }), 'cancelada');
  assert.equal(st({ realizedRaw: 'no show' }), 'nao_realizada');
  assert.equal(st({ realizedRaw: 'Não', callDate: '2026-10-13' }), 'agendada'); // call hoje ainda vai acontecer
  assert.equal(st({ realizedRaw: 'Não', callDate: '2026-10-12' }), 'nao_realizada');
  assert.equal(st({ callDate: '2026-10-12' }), 'sem_registro');
  assert.equal(st({ callDate: '2026-10-13' }), 'agendada');
  assert.equal(st({}), 'agendada');
});

test('buildDeals: sale by e-mail, edition from sheet > e-mail > date, alerts', () => {
  const idx = indexCaptures([cap('b@x', '2026-10-10T10:00:00', 22, 'vid_3')]);
  const ds = buildDeals([
    sch({ emails: ['a@x'], edition: 21, via: 'Sim, Automático', realizedRaw: 'sim' }),
    sch({ emails: ['b@x'], title: 'SE - Fulano', closer: '', callDate: '2026-11-30' }),
    sch({ title: 'WB - Sem Email', scheduledAt: '2026-10-08', callDate: '2026-10-07', personName: 'Beltrano' }),
  ], [sale({ email: 'a@x', product: 'Power', amount: 20040, edition: 21 })], idx, {}, eds, '2026-10-13');
  assert.deepEqual([ds[0].status, ds[0].edition, ds[0].editionBy, ds[0].value, ds[0].via, ds[0].product], ['ganho', 21, 'planilha', 20040, 'Automático', 'Power']);
  assert.deepEqual([ds[1].edition, ds[1].editionBy, ds[1].creative, ds[1].type, ds[1].product, ds[1].name], [22, 'email', 'vid_3', 'SE', 'Start', 'Fulano']);
  assert.ok(ds[1].alerts.some(a => a.includes('dias depois')));
  assert.ok(ds[1].alerts.indexOf('sem closer') >= 0);
  assert.deepEqual([ds[2].edition, ds[2].editionBy, ds[2].name], [21, 'data', 'Beltrano']);
  assert.ok(ds[2].alerts.indexOf('call antes do agendamento') >= 0);
});

test('buildDeals matches a sale by normalized name when there is no e-mail', () => {
  const [d] = buildDeals([sch({ personName: 'José da Silva' })], [sale({ name: 'jose  DA silva', product: 'Power Start' })], indexCaptures([]), {}, eds, '2026-10-13');
  assert.deepEqual([d.status, d.value], ['ganho', 1997]);
});

test('buildDeals: an NF10K deal only matches #015–#020 sales; a paid deal only paid sales', () => {
  const ds = buildDeals([
    sch({ emails: ['a@x'], edition: 18 }),
    sch({ emails: ['b@x'], edition: 22 }),
  ], [sale({ email: 'a@x', edition: 22 }), sale({ email: 'b@x', edition: 22, amount: 20040 })], indexCaptures([]), {}, eds, '2026-10-13');
  assert.deepEqual([ds[0].status, ds[0].value], ['agendada', 0]);
  assert.deepEqual([ds[1].status, ds[1].value], ['ganho', 20040]);
  const [nf] = buildDeals([sch({ emails: ['a@x'], edition: 18 })], [sale({ email: 'a@x', edition: 18, product: 'Power Start' })], indexCaptures([]), {}, eds, '2026-10-13');
  assert.equal(nf.status, 'ganho');
});

test('dealsTab: KPIs, moment buckets, losing creatives (n ≥ 3), cost per call', () => {
  const mk = (o: Partial<Deal>): Deal => ({
    name: 'x', type: 'WB', closer: 'Ana', via: 'Automático', product: 'Power', scheduledAt: '2026-10-13', callDate: '2026-10-15',
    realized: false, lostReason: '', status: 'agendada', alerts: [], income: '', value: 0, edition: 22, editionBy: 'planilha',
    creative: 'vid_1', utmContent: '', utmSource: '', ...o,
  });
  const deals = [
    mk({ status: 'ganho', realized: true, value: 20040, scheduledAt: '2026-10-12' }),
    mk({ status: 'perdido', realized: true, lostReason: 'Preço' }),
    mk({ status: 'nao_realizada', product: 'Start', scheduledAt: '2026-10-14' }),
    mk({ status: 'cancelada', creative: 'vid_2' }),
    mk({ status: 'agendada', edition: 21 }),
  ];
  const t = dealsTab(deals, [{ number: 22, liveDate: '2026-10-13' }], { 22: 400 }, null, false);
  assert.deepEqual([t.total, t.power, t.start, t.realized, t.noShow, t.won, t.wonRevenue, t.lost], [4, 3, 1, 2, 1, 1, 20040, 1]);
  assert.equal(t.attendance, 2 / 3);
  assert.deepEqual(t.lostByReason, [{ key: 'Preço', count: 1 }]);
  const m = t.moment[0];
  assert.deepEqual([m.before.ganho, m.onDay.perdCall, m.onDay.perdSem, m.after.perdSem, m.onDay.total], [1, 1, 1, 1, 2]);
  assert.deepEqual(t.losingCreatives.map(c => [c.creative, c.n, c.lost, c.tone]), [['vid_1', 3, 1, 'green']]);
  const r = t.costPerCall.rows[0];
  assert.deepEqual([r.cost, r.costPower, r.costStart], [100, 400 / 3, 400]);
  assert.equal(t.list, null);
  assert.equal(dealsTab(deals, [{ number: 22, liveDate: '2026-10-13' }], { 22: null }, null, true).costPerCall.rows[0].cost, null);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/deals.ts'`.

- [ ] **Step 3: Implementar**

Criar `src/lib/marketing/deals.ts`:

```ts
import type { DateRange, SaleRow, ScheduleRow, SurveyRow } from './types.ts';
import { addDays, normName } from './parse.ts';
import { CYCLE_MIN, editionKind, lastLiveOnOrBefore, latestCycleCapture, type CaptureIndex } from './editions.ts';
import { normProd, saleValue } from './sales.ts';
import { LABEL_RENDA } from './survey.ts';
import { countBy, inRange, type Count } from './metrics.ts';

export type DealStatus = 'agendada' | 'realizada' | 'reagendada' | 'cancelada' | 'nao_realizada' | 'sem_registro' | 'perdido' | 'ganho' | 'reembolsado';
export const STATUS_LABEL: Record<DealStatus, string> = {
  agendada: 'Agendada', realizada: 'Realizada', reagendada: 'Reagendada', cancelada: 'Cancelada', nao_realizada: 'Não compareceu',
  sem_registro: 'Sem registro', perdido: 'Perdido', ganho: 'Ganho', reembolsado: 'Reembolsado',
};

// "today" = data de Brasília (YYYY-MM-DD). Call hoje conta como futura.
export function dealStatus(
  d: { won: boolean; saleOk: boolean; saleRefunded: boolean; lostReason: string; realizedRaw: string; callDate: string | null },
  today: string,
): DealStatus {
  if (d.won || d.saleOk) return d.saleOk ? 'ganho' : d.saleRefunded ? 'reembolsado' : 'ganho';
  if (d.lostReason) return 'perdido';
  const r = d.realizedRaw.toLowerCase();
  if (r.startsWith('sim')) return 'realizada';
  if (/reagend/.test(r)) return 'reagendada';
  if (/cancel/.test(r)) return 'cancelada';
  if (/no show/.test(r)) return 'nao_realizada';
  if (/^n[aã]o/.test(r)) return d.callDate && d.callDate >= today ? 'agendada' : 'nao_realizada';
  return d.callDate && d.callDate < today ? 'sem_registro' : 'agendada';
}

export type Deal = {
  name: string; type: 'SE' | 'WB' | ''; closer: string; via: string; product: string;
  scheduledAt: string | null; callDate: string | null; realized: boolean; lostReason: string;
  status: DealStatus; alerts: string[]; income: string; value: number;
  edition: number | null; editionBy: 'planilha' | 'email' | 'data' | null;
  creative: string;   // utm_content do negócio, senão o do lead
  utmContent: string; // utm_content do próprio negócio ("Via API")
  utmSource: string;
};

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

export function buildDeals(
  rows: ScheduleRow[], sales: SaleRow[], idx: CaptureIndex, surveys: Record<string, SurveyRow>,
  eds: { number: number; liveDate: string }[], today: string,
): Deal[] {
  // Venda do Detalhamento Vendas (valor oficial): por e-mail, senão por nome normalizado.
  const byEmail: Record<string, SaleRow[]> = Object.create(null);
  const byName: Record<string, SaleRow[]> = Object.create(null);
  sales.filter(s => s.edition !== null && s.edition >= CYCLE_MIN).forEach(s => {
    if (s.email) (byEmail[s.email] || (byEmail[s.email] = [])).push(s);
    const nn = normName(s.name);
    if (nn) (byName[nn] || (byName[nn] = [])).push(s);
  });
  return rows.map((r): Deal => {
    const name = r.personName || r.title.replace(/^(SE|WB)\s*-\s*/i, '');
    // Webinário: coluna WEBNÁRIO > captação pelo e-mail (até agendamento + 1 dia) > última live até o agendamento.
    const lead = latestCycleCapture(idx, r.emails, r.scheduledAt ? `${addDays(r.scheduledAt, 1)}T00:00:00` : null);
    const byDate = lastLiveOnOrBefore(eds, r.scheduledAt);
    const edition = r.edition ?? (lead ? lead.edition : byDate);
    const editionBy = r.edition !== null ? 'planilha' : lead ? 'email' : byDate !== null ? 'data' : null;
    // Negócio NF10K só casa com venda de #015–#020; negócio do pago, com venda do pago (como o dash antigo, por ciclo).
    const sameCycle = (s: SaleRow) => edition === null || editionKind(s.edition as number) === editionKind(edition);
    let mine: SaleRow[] = [];
    r.emails.forEach(e => { (byEmail[e] || []).forEach(s => mine.push(s)); });
    if (!mine.length) { const nn = normName(name); if (nn) mine = byName[nn] || []; }
    mine = mine.filter(sameCycle);
    const saleOk = mine.filter(s => !s.refunded)[0] ?? null;
    const saleRef = saleOk ? null : mine.filter(s => s.refunded)[0] ?? null;
    const status = dealStatus({
      won: !!r.wonAt, saleOk: !!saleOk, saleRefunded: !!saleRef, lostReason: r.lostReason, realizedRaw: r.realizedRaw, callDate: r.callDate,
    }, today);
    const alerts: string[] = [];
    const gap = r.scheduledAt && r.callDate ? days(r.scheduledAt, r.callDate) : null;
    if (gap !== null && gap > 14) alerts.push(`call marcada ${gap} dias depois do agendamento`);
    if (gap !== null && gap < 0) alerts.push('call antes do agendamento');
    if (status === 'sem_registro') alerts.push('call já passou sem registro');
    if (!r.closer) alerts.push('sem closer');
    const survey = r.emails.map(e => surveys[e]).filter(Boolean)[0];
    const viaRaw = r.via.toLowerCase();
    const isWB = /^wb\b/i.test(r.title), isSE = /^se\b/i.test(r.title);
    return {
      name, type: isSE ? 'SE' : isWB ? 'WB' : '', closer: r.closer,
      via: viaRaw.includes('comercial') ? 'Comercial' : viaRaw.includes('autom') ? 'Automático' : r.via,
      product: r.productRaw || (isWB ? 'Power' : isSE ? 'Start' : ''),
      scheduledAt: r.scheduledAt, callDate: r.callDate, realized: r.realizedRaw.startsWith('sim'), lostReason: r.lostReason,
      status, alerts,
      income: r.income || (survey ? LABEL_RENDA[survey.renda] ?? survey.renda : ''),
      value: saleOk ? saleValue(saleOk) : 0,
      edition, editionBy, creative: r.utmContent || (lead ? lead.utmContent : ''), utmContent: r.utmContent, utmSource: r.utmSource,
    };
  });
}

// Call feita: realizada, ganho, reembolsado ou perdido depois da call.
export const dealDone = (d: Deal) =>
  d.status === 'realizada' || d.status === 'ganho' || d.status === 'reembolsado' || (d.status === 'perdido' && d.realized);

export type MomentCat = 'ganho' | 'perdCall' | 'perdSem' | 'andamento' | 'aberto';
export function momentCat(d: Deal): MomentCat {
  if (d.status === 'ganho' || d.status === 'reembolsado') return 'ganho';
  if (d.status === 'perdido' && d.realized) return 'perdCall';
  if (d.status === 'nao_realizada' || d.status === 'perdido' || d.status === 'cancelada') return 'perdSem';
  if (d.status === 'realizada') return 'andamento';
  return 'aberto';
}

export type CatCounts = { total: number; ganho: number; perdCall: number; perdSem: number; andamento: number; aberto: number };
const emptyCats = (): CatCounts => ({ total: 0, ganho: 0, perdCall: 0, perdSem: 0, andamento: 0, aberto: 0 });
const addCat = (c: CatCounts, d: Deal) => { c.total++; c[momentCat(d)]++; };

export type CostRow = {
  edition: number | null; spend: number | null; n: number; power: number; start: number;
  cost: number | null; costPower: number | null; costStart: number | null;
};
export type DealListItem = {
  name: string; type: string; scheduledAt: string | null; callDate: string | null; via: string; status: DealStatus; closer: string;
  product: string; income: string; edition: number | null; creative: string; lostReason: string; alerts: string[];
};
export type LosingCreative = {
  creative: string; n: number; noShow: number; noInterest: number; cancelled: number; lost: number; rate: number;
  calls: number; won: number; open: number; tone: 'red' | 'yellow' | 'green';
};
export type DealsTab = {
  total: number; noEdition: number; power: number; start: number; auto: number; commercial: number;
  realized: number; attendance: number | null; noShow: number; waiting: number; cancelled: number;
  lost: number; lostByReason: Count[]; won: number; wonRevenue: number; wonRate: number | null; refunded: number;
  origin: { planilha: number; email: number; data: number };
  alertCount: number;
  moment: { edition: number; before: CatCounts; onDay: CatCounts; after: CatCounts }[];
  momentTotal: { before: CatCounts; onDay: CatCounts; after: CatCounts };
  losingCreatives: LosingCreative[];
  lostBeforeCall: number;
  costPerCall: { rows: CostRow[]; total: CostRow };
  byEdition: Count[]; via: Count[]; closer: Count[]; status: Count[];
  list: DealListItem[] | null;
};

const ed = (n: number) => `#${String(n).padStart(3, '0')}`;
const per = (spend: number | null, n: number) => (spend !== null && spend > 0 && n > 0 ? spend / n : null);

export function dealsTab(
  all: Deal[], eds: { number: number; liveDate: string }[], spend: Record<number, number | null>,
  range: DateRange | null, lists: boolean,
): DealsTab {
  const selected = eds.map(e => e.number);
  const inPeriod = all.filter(d => inRange(d.scheduledAt, range));
  const deals = inPeriod.filter(d => d.edition !== null && selected.indexOf(d.edition) >= 0);
  const count = (s: DealStatus) => deals.filter(d => d.status === s).length;
  const realized = deals.filter(dealDone).length;
  const noShow = count('nao_realizada');
  const won = count('ganho');

  // Quando agendaram: dia do agendamento − dia da live da edição.
  const moment = eds.map(e => {
    const row = { edition: e.number, before: emptyCats(), onDay: emptyCats(), after: emptyCats() };
    deals.filter(d => d.edition === e.number && d.scheduledAt).forEach(d => {
      const off = days(e.liveDate, d.scheduledAt as string);
      addCat(off < 0 ? row.before : off === 0 ? row.onDay : row.after, d);
    });
    return row;
  });
  const momentTotal = { before: emptyCats(), onDay: emptyCats(), after: emptyCats() };
  moment.forEach(m => (['before', 'onDay', 'after'] as const).forEach(k => {
    (Object.keys(m[k]) as (keyof CatCounts)[]).forEach(c => { momentTotal[k][c] += m[k][c]; });
  }));

  // Criativos que perdem: não compareceu + cancelada + perdido sem call; só com 3+ agendamentos.
  type Acc = Omit<LosingCreative, 'lost' | 'rate' | 'tone'>;
  const byCreative: Record<string, Acc> = Object.create(null);
  const accs: Acc[] = [];
  deals.forEach(d => {
    const k = d.creative || '(sem utm_content)';
    let c = byCreative[k];
    if (!c) { c = byCreative[k] = { creative: k, n: 0, noShow: 0, noInterest: 0, cancelled: 0, calls: 0, won: 0, open: 0 }; accs.push(c); }
    c.n++;
    if (d.status === 'nao_realizada') c.noShow++;
    else if (d.status === 'cancelada') c.cancelled++;
    else if (d.status === 'perdido' && !d.realized) c.noInterest++;
    if (dealDone(d)) c.calls++;
    if (d.status === 'ganho') c.won++;
    if (d.status === 'agendada' || d.status === 'reagendada') c.open++;
  });
  const losingCreatives: LosingCreative[] = accs
    .filter(c => c.n >= 3)
    .map(c => {
      const lost = c.noShow + c.noInterest + c.cancelled;
      const rate = lost / c.n;
      const tone: LosingCreative['tone'] = rate >= 0.6 ? 'red' : rate >= 0.4 ? 'yellow' : 'green';
      return { ...c, lost, rate, tone };
    })
    .sort((a, b) => b.rate - a.rate || b.lost - a.lost);

  // Custo por call: gasto oficial da edição ÷ negócios; edição sem gasto fica "n/d" e fora do total.
  const rows: CostRow[] = eds.map(e => {
    const ds = deals.filter(d => d.edition === e.number);
    const power = ds.filter(d => normProd(d.product) === 'power').length;
    const start = ds.filter(d => normProd(d.product) === 'powerStart').length;
    const s = spend[e.number] ?? null;
    return { edition: e.number, spend: s, n: ds.length, power, start, cost: per(s, ds.length), costPower: per(s, power), costStart: per(s, start) };
  });
  const counted = rows.filter(r => r.spend !== null && r.spend > 0 && r.n > 0);
  const tSpend = counted.reduce((t, r) => t + (r.spend as number), 0);
  const tN = counted.reduce((t, r) => t + r.n, 0), tP = counted.reduce((t, r) => t + r.power, 0), tS = counted.reduce((t, r) => t + r.start, 0);

  return {
    total: deals.length, noEdition: inPeriod.filter(d => d.edition === null).length,
    power: deals.filter(d => normProd(d.product) === 'power').length,
    start: deals.filter(d => normProd(d.product) === 'powerStart').length,
    auto: deals.filter(d => d.via === 'Automático').length, commercial: deals.filter(d => d.via === 'Comercial').length,
    realized, attendance: realized + noShow ? realized / (realized + noShow) : null, noShow,
    waiting: count('agendada') + count('sem_registro') + count('reagendada'), cancelled: count('cancelada'),
    lost: count('perdido'), lostByReason: countBy(deals.filter(d => d.status === 'perdido' && d.lostReason), d => d.lostReason),
    won, wonRevenue: deals.filter(d => d.status === 'ganho').reduce((t, d) => t + d.value, 0),
    wonRate: realized ? won / realized : null, refunded: count('reembolsado'),
    origin: {
      planilha: deals.filter(d => d.editionBy === 'planilha').length,
      email: deals.filter(d => d.editionBy === 'email').length,
      data: deals.filter(d => d.editionBy === 'data').length,
    },
    alertCount: deals.filter(d => d.alerts.length).length,
    moment, momentTotal, losingCreatives,
    lostBeforeCall: deals.filter(d => d.status === 'nao_realizada' || d.status === 'cancelada' || (d.status === 'perdido' && !d.realized)).length,
    costPerCall: {
      rows,
      total: { edition: null, spend: counted.length ? tSpend : null, n: tN, power: tP, start: tS, cost: per(tSpend, tN), costPower: per(tSpend, tP), costStart: per(tSpend, tS) },
    },
    byEdition: countBy(deals, d => ed(d.edition as number)),
    via: countBy(deals, d => d.via || 'Sem registro'),
    closer: countBy(deals, d => d.closer || 'Sem closer'),
    status: countBy(deals, d => d.status),
    list: lists ? deals.slice().sort((a, b) => (b.scheduledAt ?? '').localeCompare(a.scheduledAt ?? '')).map(d => ({
      name: d.name, type: d.type, scheduledAt: d.scheduledAt, callDate: d.callDate, via: d.via, status: d.status, closer: d.closer,
      product: d.product, income: d.income, edition: d.edition, creative: d.creative, lostReason: d.lostReason, alerts: d.alerts,
    })) : null,
  };
}
```

- [ ] **Step 4: Rodar testes e tipos**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/deals.ts src/lib/marketing/deals.test.ts
git commit -m "feat(marketing): deals module (status, edition attribution, alerts, losing creatives, cost per call)"
```

---

### Task 7: Módulos `api-leads.ts` e `disparos.ts`

**Files:**
- Create: `src/lib/marketing/api-leads.ts`, `src/lib/marketing/disparos.ts`
- Test: `src/lib/marketing/api-leads.test.ts`, `src/lib/marketing/disparos.test.ts`

**Interfaces:**
- Consumes: `CaptureRow`, `SaleRow`, `SurveyRow`, `DateRange` (Task 1); `qualified5k` (Task 3); `saleValue` (Task 5); `countBy`, `Count`, `inRange` (metrics.ts).
- Produces:
  - `api-leads.ts`: `isApiLead(l: CaptureRow): boolean`, `type ApiAgg = { key: string; leads: number; qualified: number; responded: number }`, `type ApiTab = { leads: number; totalLeads: number; qualified: number; responded: number; bestDay: Count | null; bases: ApiAgg[]; versions: ApiAgg[]; shots: ApiAgg[]; matrix: Record<string, { leads: number; qualified: number }>; byDay: Count[]; sales: number; revenue: number }`, `apiTab(leads: CaptureRow[], surveys: Record<string, SurveyRow>, sales: SaleRow[]): ApiTab`. Chave da matriz: `` `${base}|${version}` ``.
  - `disparos.ts`: `type DisparoKind = 'convite' | 'recuperacao'`, `type Disparo = { id: string; kind: DisparoKind; ciclo: string | null; nome: string; data: string | null; contatos: number | null; agendamentos: number | null; vendas: number | null; faturamento: number | null; custo: number | null; template: string | null }`, `type DisparoInput = Omit<Disparo, 'id'>`, `type DisparoBlock`, `disparoBlock(rows: Disparo[]): DisparoBlock`, `type DisparosTab = { convite: DisparoBlock; recuperacao: DisparoBlock; total: DisparoBlock; ranking: Disparo[]; rows: Disparo[] }`, `disparosTab(rows: Disparo[], range: DateRange | null): DisparosTab`, `parseDisparoInput(body: unknown, partial: boolean): { ok: true; value: Partial<DisparoInput> } | { ok: false; error: string }`, `formatNumberInput(n: number | null): string` ("16,8", sem milhar) e `parseNumberInput(s: string): number | null` (com vírgula o ponto é milhar; sem vírgula é decimal) — usados pelo editor da Task 16.

- [ ] **Step 1: Testes (falhando)**

Criar `src/lib/marketing/api-leads.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, SaleRow, SurveyRow } from './types.ts';
import { apiTab } from './api-leads.ts';

const cap = (o: Partial<CaptureRow>): CaptureRow => ({
  email: '', phone: '', name: '', utmSource: 'api', utmMedium: 'base-2024', utmCampaign: 'convite', utmTerm: 'v1',
  utmContent: 'APIWEB01', at: '2026-10-10T10:00:00', edition: 22, funnel: '', ...o,
});
const sv = (email: string, renda: string): SurveyRow => ({ email, at: null, tempo: '', servico: '', renda, fat: '', conhece: '', desafios: '' });
const sale = (o: Partial<SaleRow>): SaleRow => ({
  approved: true, refunded: false, status: 'Aprovada', product: 'Power', amount: 0, email: '', phone: '', name: '',
  utmContentCapture: '', utmContentSale: '', capSource: '', capMedium: '', capCampaign: '', saleSource: '', saleCampaign: '',
  funnel: '', at: null, edition: 22, ...o,
});

test('apiTab aggregates API leads by base, version and shot', () => {
  const leads = [cap({ email: 'a@x' }), cap({ email: 'b@x', utmTerm: 'v2', at: '2026-10-11T09:00:00' }), cap({ email: 'c@x', utmMedium: '' }), cap({ utmSource: 'ig' })];
  const t = apiTab(leads, { 'a@x': sv('a@x', '7a10k'), 'b@x': sv('b@x', '1a3k') }, [
    sale({ capSource: 'API', amount: 997, product: 'Desafio' }),
    sale({ capSource: 'api', approved: false, refunded: true }),
  ]);
  assert.deepEqual([t.leads, t.totalLeads, t.qualified, t.responded], [3, 4, 1, 2]);
  assert.deepEqual(t.bases.map(b => [b.key, b.leads, b.qualified]), [['base-2024', 2, 1], ['(sem base)', 1, 0]]);
  assert.deepEqual(t.versions.map(v => v.key), ['v1', 'v2']);
  assert.deepEqual(t.shots.map(s => s.key), ['APIWEB01 · convite']);
  assert.deepEqual(t.matrix['base-2024|v1'], { leads: 1, qualified: 1 });
  assert.deepEqual(t.byDay, [{ key: '2026-10-10', count: 2 }, { key: '2026-10-11', count: 1 }]);
  assert.deepEqual(t.bestDay, { key: '2026-10-10', count: 2 });
  assert.deepEqual([t.sales, t.revenue], [1, 997]);
});
```

Criar `src/lib/marketing/disparos.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { disparoBlock, disparosTab, formatNumberInput, parseDisparoInput, parseNumberInput, type Disparo } from './disparos.ts';

const d = (o: Partial<Disparo>): Disparo => ({
  id: '1', kind: 'convite', ciclo: null, nome: 'Copy 01', data: '2026-09-20', contatos: 1000, agendamentos: 10,
  vendas: 0, faturamento: null, custo: 40, template: null, ...o,
});

test('disparoBlock: budget, rates, ROAS', () => {
  const b = disparoBlock([d({}), d({ agendamentos: 0, vendas: 1, faturamento: 30000, custo: 60 })]);
  assert.deepEqual(b, { count: 2, contatos: 2000, custo: 100, agendamentos: 10, agendRate: 0.005, costPerAgend: 10, vendas: 1, faturamento: 30000, roas: 300 });
  assert.deepEqual([disparoBlock([]).roas, disparoBlock([]).costPerAgend], [null, null]);
});

test('disparosTab: blocks per kind, ranking by agendamentos, period filter by date', () => {
  const rows = [d({ id: 'a', agendamentos: 2 }), d({ id: 'b', agendamentos: 9 }), d({ id: 'c', kind: 'recuperacao', data: '2026-08-01', agendamentos: 1 })];
  const t = disparosTab(rows, null);
  assert.deepEqual(t.ranking.map(r => r.id), ['b', 'a']);
  assert.deepEqual([t.convite.count, t.recuperacao.count, t.total.count], [2, 1, 3]);
  assert.equal(disparosTab(rows, { from: '2026-09-01', to: '2026-09-30' }).total.count, 2);
});

test('parseDisparoInput validates at the trust boundary', () => {
  assert.equal(parseDisparoInput({ kind: 'convite', nome: 'Copy 01', contatos: 10, custo: 1.5 }, false).ok, true);
  assert.equal(parseDisparoInput({ kind: 'spam', nome: 'x' }, false).ok, false);
  assert.equal(parseDisparoInput({ kind: 'convite', nome: '  ' }, false).ok, false);
  assert.equal(parseDisparoInput({ kind: 'convite', nome: 'x', contatos: -1 }, false).ok, false);
  assert.equal(parseDisparoInput({ kind: 'convite', nome: 'x', contatos: 1.5 }, false).ok, false);
  assert.equal(parseDisparoInput({ kind: 'convite', nome: 'x', custo: Number.NaN }, false).ok, false);
  assert.equal(parseDisparoInput({ kind: 'convite', nome: 'x', data: '20/09/2026' }, false).ok, false);
  assert.equal(parseDisparoInput({ kind: 'convite', nome: 'x'.repeat(121) }, false).ok, false);
  assert.deepEqual(parseDisparoInput({ custo: '' }, true), { ok: true, value: { custo: null } });
  assert.equal(parseDisparoInput(null, true).ok, false);
});

test('editor numbers round-trip without losing decimals', () => {
  assert.equal(parseNumberInput('16,80'), 16.8);
  assert.equal(parseNumberInput('16.8'), 16.8);
  assert.equal(parseNumberInput('1.234,56'), 1234.56);
  assert.equal(parseNumberInput('3213'), 3213);
  assert.equal(parseNumberInput('  '), null);
  assert.ok(Number.isNaN(parseNumberInput('abc')));
  assert.equal(formatNumberInput(16.8), '16,8');
  assert.equal(formatNumberInput(1234.5), '1234,5');
  assert.equal(formatNumberInput(null), '');
  assert.equal(parseNumberInput(formatNumberInput(158.68)), 158.68); // editar sem mudar mantém o valor
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` (os módulos ainda não existem).

- [ ] **Step 3: Implementar `api-leads.ts`**

Criar `src/lib/marketing/api-leads.ts`:

```ts
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
```

- [ ] **Step 4: Implementar `disparos.ts`**

Criar `src/lib/marketing/disparos.ts`:

```ts
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
```

- [ ] **Step 5: Rodar testes e tipos**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/marketing/api-leads.ts src/lib/marketing/api-leads.test.ts src/lib/marketing/disparos.ts src/lib/marketing/disparos.test.ts
git commit -m "feat(marketing): API leads and WhatsApp disparos modules with input validation"
```

---

### Task 8: Módulo `live.ts` (presença da plataforma)

**Files:**
- Create: `src/lib/marketing/live.ts`
- Test: `src/lib/marketing/live.test.ts`

**Interfaces:**
- Consumes: nada além de tipos locais.
- Produces: `type LiveEvent = { registration_id: string | null; type: string; created_at: string }`, `type Presence = { first: number; last: number; minutes: number; cta: boolean }`, `presenceFromEvents(events: LiveEvent[]): Presence[]`, `LIVE_HISTOGRAM`, `type LiveStats = { people: number; watched: number; peak: number; peakMinute: number; mean: number | null; median: number | null; toPitch: number; min30: number; min60: number; cta: number; curve: number[]; histogram: { label: string; count: number }[]; pitchMinute: number }`, `liveStats(people: Presence[], liveStartMs: number, pitchSeconds: number): LiveStats`, `type LiveTotals`, `liveTotals(stats: LiveStats[]): LiveTotals | null`, `type LiveTab = { editions: { edition: number; liveDate: string; stats: LiveStats | null }[]; totals: LiveTotals | null }`.

- [ ] **Step 1: Testes (falhando)**

Criar `src/lib/marketing/live.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { liveStats, liveTotals, presenceFromEvents } from './live.ts';

const t0 = Date.UTC(2026, 9, 13, 23, 0, 0); // 20h de Brasília
const at = (min: number) => new Date(t0 + min * 60000).toISOString();
const ev = (id: string, type: string, min: number) => ({ registration_id: id, type, created_at: at(min) });
const sample = () => presenceFromEvents([
  ev('a', 'enter_live', -5), ev('a', 'heartbeat', 30), ev('a', 'heartbeat', 70),
  ev('b', 'enter_live', 10), ev('b', 'heartbeat', 20), ev('b', 'cta_click', 15),
]);

test('presenceFromEvents: first/last presence, heartbeats as minutes, CTA flag', () => {
  const p = presenceFromEvents([
    ev('a', 'enter_live', -5), ev('a', 'heartbeat', 30), ev('a', 'heartbeat', 70),
    ev('b', 'enter_live', 10), ev('b', 'heartbeat', 20), ev('b', 'cta_click', 15),
    { registration_id: null, type: 'heartbeat', created_at: at(1) }, ev('c', 'cta_click', 3),
  ]);
  assert.deepEqual(p, [
    { first: t0 - 5 * 60000, last: t0 + 70 * 60000, minutes: 2, cta: false },
    { first: t0 + 10 * 60000, last: t0 + 20 * 60000, minutes: 1, cta: true },
  ]);
});

test('liveStats: curve from 20h, peak, tail cut, pitch, histogram', () => {
  const s = liveStats(sample(), t0, 66 * 60 + 10);
  assert.equal(s.curve[0], 1);
  assert.equal(s.curve[10], 2);
  assert.deepEqual([s.peak, s.peakMinute], [2, 10]);
  assert.equal(s.curve.length, 23); // corta a cauda abaixo de max(2, 5% do pico) e deixa 2 minutos
  assert.deepEqual([s.people, s.watched, s.mean, s.median, s.toPitch, s.cta], [2, 2, 1.5, 2, 1, 1]);
  assert.deepEqual(s.histogram[0], { label: 'até 5 min', count: 2 });
  assert.equal(Math.round(s.pitchMinute * 100) / 100, 66.17);
  assert.equal(liveStats([], t0, 0).mean, null);
});

test('liveTotals: sums, weighted mean, average peak with max', () => {
  const a = liveStats(presenceFromEvents([ev('a', 'enter_live', 0), ev('a', 'heartbeat', 1), ev('a', 'heartbeat', 2)]), t0, 3960);
  const b = liveStats(presenceFromEvents([ev('b', 'enter_live', 0), ev('b', 'heartbeat', 1), ev('c', 'enter_live', 0), ev('c', 'heartbeat', 1)]), t0, 3960);
  const t = liveTotals([a, b]);
  assert.deepEqual([t?.editions, t?.people, t?.peak, t?.peakMax, t?.peakMinute], [2, 3, 2, 2, null]);
  assert.equal(t?.mean, (2 * 1 + 1 * 2) / 3);
  assert.equal(liveTotals([]), null);
});
```

Conta do teste: `a` entra 5 min antes (conta a partir do minuto 0) e sai aos 70; `b` fica de 10 a 20 → pico 2 no minuto 10; da cauda (1 pessoa < 2) corta até o minuto 20 e soma 2 → 23 pontos. `liveTotals`: pico médio de 1 e 2 = 1,5 → arredonda 2.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/live.ts'`.

- [ ] **Step 3: Implementar**

Criar `src/lib/marketing/live.ts`:

```ts
export type LiveEvent = { registration_id: string | null; type: string; created_at: string };
export type Presence = { first: number; last: number; minutes: number; cta: boolean };

// Uma pessoa por cadastro: primeira e última presença (entrada ou heartbeat); heartbeats = minutos.
export function presenceFromEvents(events: LiveEvent[]): Presence[] {
  const by: Record<string, Presence> = Object.create(null);
  const ids: string[] = [];
  const cta: Record<string, true> = Object.create(null);
  events.forEach(e => {
    const id = e.registration_id;
    if (!id) return;
    if (e.type === 'cta_click') { cta[id] = true; return; }
    if (e.type !== 'enter_live' && e.type !== 'heartbeat') return;
    const t = Date.parse(e.created_at);
    let p = by[id];
    if (!p) { p = by[id] = { first: t, last: t, minutes: 0, cta: false }; ids.push(id); }
    if (t < p.first) p.first = t;
    if (t > p.last) p.last = t;
    if (e.type === 'heartbeat') p.minutes++;
  });
  return ids.map(id => ({ ...by[id], cta: !!cta[id] }));
}

export const LIVE_HISTOGRAM: [string, number, number][] = [
  ['até 5 min', 0, 5], ['5 a 15', 5, 15], ['15 a 30', 15, 30], ['30 a 45', 30, 45], ['45 a 60', 45, 60], ['60 a 75', 60, 75], ['75+', 75, Infinity],
];

export type LiveStats = {
  people: number; watched: number; peak: number; peakMinute: number; mean: number | null; median: number | null;
  toPitch: number; min30: number; min60: number; cta: number; curve: number[];
  histogram: { label: string; count: number }[]; pitchMinute: number;
};

export function liveStats(people: Presence[], liveStartMs: number, pitchSeconds: number): LiveStats {
  const t0 = liveStartMs;
  const end = people.reduce((m, p) => Math.max(m, p.last), t0);
  const dur = Math.min(240, Math.max(1, Math.ceil((end - t0) / 60000)));
  const curve: number[] = [];
  for (let i = 0; i <= dur; i++) curve.push(0);
  // Minuto a minuto desde as 20h: quem já entrou e ainda não saiu (quem entrou antes conta a partir das 20h).
  people.forEach(p => {
    const a = Math.max(0, Math.ceil((p.first - t0) / 60000));
    const b = Math.min(dur, Math.floor((p.last - t0) / 60000));
    for (let t = a; t <= b; t++) curve[t]++;
  });
  const peak = curve.reduce((m, x) => Math.max(m, x), 0);
  const peakMinute = curve.indexOf(peak);
  // Corta a cauda (replay depois do fim): último minuto com pelo menos max(2, 5% do pico), mais 2.
  let cut = curve.length - 1;
  while (cut > peakMinute && curve[cut] < Math.max(2, peak * 0.05)) cut--;
  curve.length = Math.min(curve.length, cut + 3);
  const watched = people.filter(p => p.minutes > 0).map(p => p.minutes).sort((a, b) => a - b);
  const pitchMs = t0 + pitchSeconds * 1000;
  return {
    people: people.length, watched: watched.length, peak, peakMinute,
    mean: watched.length ? watched.reduce((s, m) => s + m, 0) / watched.length : null,
    median: watched.length ? watched[Math.floor(watched.length / 2)] : null,
    toPitch: people.filter(p => p.first <= pitchMs && p.last >= pitchMs).length,
    min30: people.filter(p => p.minutes >= 30).length,
    min60: people.filter(p => p.minutes >= 60).length,
    cta: people.filter(p => p.cta).length,
    curve,
    histogram: LIVE_HISTOGRAM.map(([label, a, b]) => ({ label, count: people.filter(p => p.minutes >= a && p.minutes < b).length })),
    pitchMinute: pitchSeconds / 60,
  };
}

export type LiveTotals = {
  editions: number; people: number; mean: number | null; median: number | null;
  peak: number; peakMinute: number | null; peakMax: number;
  toPitch: number; min30: number; min60: number; cta: number; histogram: { label: string; count: number }[];
};

// Uma edição: os números dela. Várias: somas, média ponderada, pico médio e maior pico.
export function liveTotals(stats: LiveStats[]): LiveTotals | null {
  if (!stats.length) return null;
  const sum = (k: 'people' | 'watched' | 'peak' | 'toPitch' | 'min30' | 'min60' | 'cta') => stats.reduce((s, x) => s + x[k], 0);
  const watched = sum('watched');
  const medians = stats.filter(x => x.median !== null);
  const one = stats.length === 1;
  return {
    editions: stats.length, people: sum('people'),
    mean: watched ? stats.reduce((s, x) => s + (x.mean ?? 0) * x.watched, 0) / watched : null,
    median: medians.length ? medians.reduce((s, x) => s + (x.median as number), 0) / medians.length : null,
    peak: one ? stats[0].peak : Math.round(sum('peak') / stats.length),
    peakMinute: one ? stats[0].peakMinute : null,
    peakMax: stats.reduce((m, x) => Math.max(m, x.peak), 0),
    toPitch: sum('toPitch'), min30: sum('min30'), min60: sum('min60'), cta: sum('cta'),
    histogram: stats[0].histogram.map((h, i) => ({ label: h.label, count: stats.reduce((s, x) => s + x.histogram[i].count, 0) })),
  };
}

export type LiveTab = { editions: { edition: number; liveDate: string; stats: LiveStats | null }[]; totals: LiveTotals | null };
```

- [ ] **Step 4: Rodar testes e tipos**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/live.ts src/lib/marketing/live.test.ts
git commit -m "feat(marketing): live presence curve, peak, pitch and histogram from platform events"
```

---

### Task 9: Módulos `reconcile.ts` e `full-funnel.ts`

**Files:**
- Create: `src/lib/marketing/reconcile.ts`, `src/lib/marketing/full-funnel.ts`
- Test: `src/lib/marketing/reconcile.test.ts`, `src/lib/marketing/full-funnel.test.ts`

**Interfaces:**
- Consumes: `OverviewCheck`, `CaptureRow`, `EditionConfig`, `MetaAdDay`, `MetaWindow`, `DateRange` (Task 1); `PAGO_MIN` (Task 3); `div` (metrics.ts); `addDays` (parse.ts).
- Produces:
  - `reconcile.ts`: `type ReconState = 'ok' | 'diverge' | 'so_planilha' | 'so_plataforma'`, `type OfficialNumbers = { peak; attendance; metaSpend; applications; scheduled; done; sales; revenue: number | null }`, `RECON_METRICS`, `type ReconRow = { edition: number; key: keyof OfficialNumbers; label: string; official: number | null; sheet: number | null; diff: number | null; diffPct: number | null; state: ReconState }`, `reconcileEdition(edition: number, official: OfficialNumbers, sheet: OverviewCheck | null): ReconRow[]`.
  - `full-funnel.ts`: `DEFAULT_CAMPAIGN_FILTER`, `campaignFilterOf(stored: string | undefined): string`, `matchesCampaign(name: string, filter: string): boolean`, `filterAds(ads: MetaAdDay[], filter: string): MetaAdDay[]`, `type FunnelMetrics`, `funnelMetrics(ads, sales: number, win): FunnelMetrics`, `FUNNEL_ROWS`, `captureDays(ed: EditionConfig, today: string): number`, `ticketSalesIn(captures, edition: number, filter: string, range: DateRange | null): number`, `type FunnelColumn`, `type FunnelCompare` (inclui `prevSales`/`curSales`: vendas das duas edições no mesmo nº de dias), `type FullFunnel = { filter: string; columns: FunnelColumn[]; compare: FunnelCompare | null }`, `fullFunnel(eds: EditionConfig[], ads: MetaAdDay[], captures: CaptureRow[], windows: MetaWindow[], filter: string, today: string): FullFunnel`, `metaWindowRanges(eds: EditionConfig[], today: string): { edition: number; since: string; until: string }[]`.

- [ ] **Step 1: Testes (falhando)**

Criar `src/lib/marketing/reconcile.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { OverviewCheck } from './types.ts';
import { reconcileEdition } from './reconcile.ts';

test('reconcileEdition: ok, diverge, só planilha, só plataforma; both missing dropped', () => {
  const sheet: OverviewCheck = { applications: 12, scheduled: 5, done: null, peak: 40, attendance: 12.5, metaSpend: null, investment: 1000, sales: 3, revenue: null };
  const rows = reconcileEdition(22, { peak: 40, attendance: 12.49, metaSpend: 950.4, applications: 10, scheduled: null, done: null, sales: 3, revenue: 6000 }, sheet);
  const by = Object.fromEntries(rows.map(r => [r.key, r]));
  assert.equal(by.peak.state, 'ok');
  assert.equal(by.attendance.state, 'ok'); // 12,49 → 12,5 com 1 casa
  assert.deepEqual([by.metaSpend.state, by.metaSpend.sheet, by.metaSpend.diff], ['diverge', 1000, -49.6]);
  assert.deepEqual([by.applications.state, by.applications.diff, by.applications.diffPct], ['diverge', -2, -2 / 12]);
  assert.equal(by.scheduled.state, 'so_planilha');
  assert.equal(by.revenue.state, 'so_plataforma');
  assert.equal(by.done, undefined);
  const none = { peak: 1, attendance: null, metaSpend: null, applications: null, scheduled: null, done: null, sales: null, revenue: null };
  assert.deepEqual(reconcileEdition(22, none, null).map(r => r.state), ['so_plataforma']);
});
```

Criar `src/lib/marketing/full-funnel.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, EditionConfig, MetaAdDay, MetaWindow } from './types.ts';
import { campaignFilterOf, fullFunnel, funnelMetrics, matchesCampaign, metaWindowRanges } from './full-funnel.ts';

const cfg = (number: number, liveDate: string, windowStart: string): EditionConfig =>
  ({ number, liveDate, windowStart, windowEnd: liveDate, ticketPrice: 9.9, cpaDream: 25, cpaGood: 35, cpaLimit: 45 });
const tk = (edition: number, day: string, utmCampaign = '[AK7] [VENDAS] [WB PG]'): CaptureRow => ({
  email: '', phone: '', name: '', utmSource: 'ig', utmMedium: '', utmCampaign, utmTerm: '', utmContent: '',
  at: `${day}T10:00:00`, edition, funnel: 'WB03 - PAGO',
});
const ad = (date: string, spend: number, impressions = 1000, linkClicks = 10, landingViews = 5, initiateCheckouts = 0): MetaAdDay => ({
  date, adId: date, adName: 'img_1', adsetName: '', campaignName: '[WB PG]', spend, impressions, linkClicks, landingViews,
  initiateCheckouts, video3s: 0, thruplays: 0,
});
const e21 = cfg(21, '2026-10-06', '2026-09-30');
const e22 = cfg(22, '2026-10-13', '2026-10-07');
const caps = [
  tk(21, '2026-09-30'), tk(21, '2026-10-02'), tk(21, '2026-10-05'), tk(21, '2026-10-06'), tk(21, '2026-10-03', 'Outra campanha'),
  tk(22, '2026-10-08'), tk(22, '2026-10-09'),
];
const ads = [ad('2026-10-01', 50), ad('2026-10-06', 30), ad('2026-10-08', 40)];

test('campaign filter: default WB PG, saved empty = all, contains ignoring case', () => {
  assert.equal(campaignFilterOf(undefined), 'WB PG');
  assert.equal(campaignFilterOf(''), '');
  assert.equal(campaignFilterOf('  WB PG '), 'WB PG');
  assert.equal(matchesCampaign('[AK7] [VENDAS] [wb pg]', 'WB PG'), true);
  assert.equal(matchesCampaign('Outra', 'WB PG'), false);
  assert.equal(matchesCampaign('Outra', ''), true);
});

test('funnelMetrics derives rates and never divides by zero', () => {
  const m = funnelMetrics([ad('2026-10-08', 100, 10000, 200, 100, 10)], 5, { reach: 8000, frequency: 1.25 });
  assert.deepEqual(m, {
    spend: 100, impressions: 10000, reach: 8000, frequency: 1.25, cpm: 10, ctr: 0.02, linkClicks: 200, cpc: 0.5,
    landingViews: 100, loadRate: 0.5, costPerView: 1, ic: 10, costPerIc: 10, sales: 5, pageToSale: 0.05,
  });
  const none = funnelMetrics([], 3, null);
  assert.deepEqual([none.cpm, none.spend, none.sales], [null, null, 3]);
});

test('fullFunnel: total includes live day; comparison uses the capture days of the current edition', () => {
  const f = fullFunnel([e21, e22], ads, caps, [], 'WB PG', '2026-10-10');
  assert.deepEqual(f.columns.map(c => [c.edition, c.metrics.sales, c.metrics.spend]), [[21, 4, 80], [22, 2, 40]]);
  assert.equal(f.compare?.cutDays, 3); // 07, 08 e 09/10 (até ontem)
  assert.deepEqual(f.compare?.prevRange, { from: '2026-09-30', to: '2026-10-02' });
  assert.equal(f.compare?.deltas.sales, 0); // 2 × 2 nos 3 primeiros dias
  assert.equal(f.compare?.deltas.reach, null);
  assert.equal(f.compare?.reachComparable, false);
});

test('fullFunnel after the live: window ends the day before the live (rule verified on real data: #021 = 65, #022 = 41)', () => {
  const f = fullFunnel([e21, e22], ads, caps, [], 'WB PG', '2026-10-14');
  assert.equal(f.compare?.cutDays, 6);
  assert.deepEqual(f.compare?.prevRange, { from: '2026-09-30', to: '2026-10-05' });
  assert.deepEqual(f.compare?.curRange, { from: '2026-10-07', to: '2026-10-12' });
  assert.deepEqual([f.compare?.prevSales, f.compare?.curSales], [3, 2]);
  assert.equal(f.compare?.deltas.sales, (2 - 3) / 3);
  assert.equal(fullFunnel([e22], ads, caps, [], 'WB PG', '2026-10-14').compare, null);
});

test('fullFunnel compares reach only for closed editions with equal windows', () => {
  const w: MetaWindow[] = [
    { edition: 21, since: '2026-09-30', until: '2026-10-06', reach: 1000, frequency: 1.5 },
    { edition: 22, since: '2026-10-07', until: '2026-10-13', reach: 1200, frequency: 1.4 },
  ];
  const f = fullFunnel([e21, e22], ads, caps, w, 'WB PG', '2026-10-14');
  assert.equal(f.compare?.reachComparable, true);
  assert.equal(f.compare?.deltas.reach, 0.2);
  assert.equal(f.columns[1].metrics.reach, 1200);
});

test('metaWindowRanges: only paid editions already started, capped at today', () => {
  const r = metaWindowRanges([cfg(20, '2026-09-29', '2026-09-23'), e21, e22, cfg(23, '2026-10-20', '2026-10-14')], '2026-10-10');
  assert.deepEqual(r, [{ edition: 21, since: '2026-09-30', until: '2026-10-06' }, { edition: 22, since: '2026-10-07', until: '2026-10-10' }]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` (os módulos ainda não existem).

- [ ] **Step 3: Implementar `reconcile.ts`**

Criar `src/lib/marketing/reconcile.ts`:

```ts
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
```

- [ ] **Step 4: Implementar `full-funnel.ts`**

Criar `src/lib/marketing/full-funnel.ts`:

```ts
import type { CaptureRow, DateRange, EditionConfig, MetaAdDay, MetaWindow } from './types.ts';
import { addDays } from './parse.ts';
import { div } from './metrics.ts';
import { PAGO_MIN } from './editions.ts';

export const DEFAULT_CAMPAIGN_FILTER = 'WB PG';
// Sem linha salva = padrão; linha salva vazia = todas as campanhas.
export const campaignFilterOf = (stored: string | undefined) => (stored === undefined ? DEFAULT_CAMPAIGN_FILTER : stored.trim());
export function matchesCampaign(name: string, filter: string): boolean {
  const f = filter.trim().toLowerCase();
  return !f || (name ?? '').toLowerCase().includes(f);
}
export const filterAds = (ads: MetaAdDay[], filter: string) => ads.filter(a => matchesCampaign(a.campaignName, filter));

export type FunnelMetrics = {
  spend: number | null; impressions: number | null; reach: number | null; frequency: number | null; cpm: number | null;
  ctr: number | null; linkClicks: number | null; cpc: number | null; landingViews: number | null; loadRate: number | null;
  costPerView: number | null; ic: number | null; costPerIc: number | null; sales: number; pageToSale: number | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function funnelMetrics(ads: MetaAdDay[], sales: number, win: { reach: number | null; frequency: number | null } | null): FunnelMetrics {
  const reach = win ? win.reach : null, frequency = win ? win.frequency : null;
  if (!ads.length) {
    return {
      spend: null, impressions: null, reach, frequency, cpm: null, ctr: null, linkClicks: null, cpc: null,
      landingViews: null, loadRate: null, costPerView: null, ic: null, costPerIc: null, sales, pageToSale: null,
    };
  }
  const sum = (k: 'spend' | 'impressions' | 'linkClicks' | 'landingViews' | 'initiateCheckouts') => ads.reduce((s, a) => s + a[k], 0);
  const spend = round2(sum('spend')), imp = sum('impressions'), clicks = sum('linkClicks'), lpv = sum('landingViews'), ic = sum('initiateCheckouts');
  const cost = (n: number) => (spend > 0 ? div(spend, n) : null);
  return {
    spend, impressions: imp, reach, frequency,
    cpm: imp > 0 && spend > 0 ? (spend / imp) * 1000 : null,
    ctr: div(clicks, imp), linkClicks: clicks, cpc: cost(clicks),
    landingViews: lpv, loadRate: div(lpv, clicks), costPerView: cost(lpv),
    ic, costPerIc: cost(ic), sales, pageToSale: div(sales, lpv),
  };
}

export const FUNNEL_ROWS: { key: keyof FunnelMetrics; label: string; better: 'up' | 'down' | null; format: 'int' | 'money' | 'pct' | 'dec' }[] = [
  { key: 'spend', label: 'Investimento', better: null, format: 'money' },
  { key: 'impressions', label: 'Impressões', better: 'up', format: 'int' },
  { key: 'reach', label: 'Alcance', better: 'up', format: 'int' },
  { key: 'frequency', label: 'Frequência', better: null, format: 'dec' },
  { key: 'cpm', label: 'CPM', better: 'down', format: 'money' },
  { key: 'ctr', label: 'CTR do link', better: 'up', format: 'pct' },
  { key: 'linkClicks', label: 'Cliques no link', better: 'up', format: 'int' },
  { key: 'cpc', label: 'Custo por clique', better: 'down', format: 'money' },
  { key: 'landingViews', label: 'Visualizações da página', better: 'up', format: 'int' },
  { key: 'loadRate', label: 'Página carregada', better: 'up', format: 'pct' },
  { key: 'costPerView', label: 'Custo por visualização', better: 'down', format: 'money' },
  { key: 'ic', label: 'IC (pixel)', better: 'up', format: 'int' },
  { key: 'costPerIc', label: 'Custo por IC', better: 'down', format: 'money' },
  { key: 'sales', label: 'Vendas (UTM)', better: 'up', format: 'int' },
  { key: 'pageToSale', label: 'Página para venda', better: 'up', format: 'pct' },
];

// Dias de captação (sem o dia da live) já corridos até ontem; hoje é parcial no Meta e na planilha.
export function captureDays(ed: EditionConfig, today: string): number {
  const lastCapture = addDays(ed.liveDate, -1);
  const yesterday = addDays(today, -1);
  const end = yesterday < lastCapture ? yesterday : lastCapture;
  if (end < ed.windowStart) return 0;
  return Math.round((Date.parse(end) - Date.parse(ed.windowStart)) / 864e5) + 1;
}

// Vendas = linhas da Captação (funil PAGO) da edição cuja utm_campaign passa no filtro.
export function ticketSalesIn(captures: CaptureRow[], edition: number, filter: string, range: DateRange | null): number {
  return captures.filter(c => {
    if (c.edition !== edition || !/pago/i.test(c.funnel) || !matchesCampaign(c.utmCampaign, filter)) return false;
    if (!range) return true;
    const d = c.at ? c.at.slice(0, 10) : null;
    return d !== null && d >= range.from && d <= range.to;
  }).length;
}

export type FunnelColumn = { edition: number; from: string; to: string; metrics: FunnelMetrics };
export type FunnelCompare = {
  prev: number; cur: number; cutDays: number; prevRange: DateRange; curRange: DateRange;
  prevSales: number; curSales: number; // vendas no mesmo nº de dias de captação
  deltas: Partial<Record<keyof FunnelMetrics, number | null>>; reachComparable: boolean;
};
export type FullFunnel = { filter: string; columns: FunnelColumn[]; compare: FunnelCompare | null };

const inDays = (ads: MetaAdDay[], from: string, to: string) => ads.filter(a => a.date >= from && a.date <= to);

// `ads` já vem filtrado pelo filtro de campanha. Coluna = edição inteira (inclui o dia da live);
// variação entre as duas últimas com o mesmo número de dias de captação, definido pela edição mais recente.
export function fullFunnel(eds: EditionConfig[], ads: MetaAdDay[], captures: CaptureRow[], windows: MetaWindow[], filter: string, today: string): FullFunnel {
  const win = (n: number) => windows.filter(w => w.edition === n)[0] ?? null;
  const columns = eds.map(e => ({
    edition: e.number, from: e.windowStart, to: e.windowEnd,
    metrics: funnelMetrics(inDays(ads, e.windowStart, e.windowEnd), ticketSalesIn(captures, e.number, filter, null), win(e.number)),
  }));
  if (eds.length < 2) return { filter, columns, compare: null };
  const prevEd = eds[eds.length - 2], curEd = eds[eds.length - 1];
  const cutDays = captureDays(curEd, today);
  if (cutDays === 0) return { filter, columns, compare: null };
  const rangeOf = (e: EditionConfig): DateRange => {
    const last = addDays(e.liveDate, -1), end = addDays(e.windowStart, cutDays - 1);
    return { from: e.windowStart, to: end < last ? end : last };
  };
  const pr = rangeOf(prevEd), cr = rangeOf(curEd);
  const pm = funnelMetrics(inDays(ads, pr.from, pr.to), ticketSalesIn(captures, prevEd.number, filter, pr), null);
  const cm = funnelMetrics(inDays(ads, cr.from, cr.to), ticketSalesIn(captures, curEd.number, filter, cr), null);
  // Alcance não soma por dia: só compara edições encerradas com janelas de mesma duração.
  const wp = win(prevEd.number), wc = win(curEd.number);
  const span = (w: MetaWindow) => Date.parse(w.until) - Date.parse(w.since);
  const reachComparable = !!(wp && wc && today > curEd.liveDate && span(wp) === span(wc));
  const deltas: Partial<Record<keyof FunnelMetrics, number | null>> = {};
  FUNNEL_ROWS.forEach(r => {
    const reachy = r.key === 'reach' || r.key === 'frequency';
    const pick = (w: MetaWindow | null, m: FunnelMetrics) =>
      reachy ? (reachComparable && w ? w[r.key as 'reach' | 'frequency'] : null) : m[r.key];
    const a = pick(wp, pm), b = pick(wc, cm);
    deltas[r.key] = a !== null && b !== null && a !== 0 ? (b - a) / a : null;
  });
  return { filter, columns, compare: { prev: prevEd.number, cur: curEd.number, cutDays, prevRange: pr, curRange: cr, prevSales: pm.sales, curSales: cm.sales, deltas, reachComparable } };
}

// Janelas de alcance que o sync pede ao Meta: edições pagas já começadas, até hoje.
export function metaWindowRanges(eds: EditionConfig[], today: string): { edition: number; since: string; until: string }[] {
  return eds
    .filter(e => e.number >= PAGO_MIN && e.windowStart <= today)
    .map(e => ({ edition: e.number, since: e.windowStart, until: e.windowEnd < today ? e.windowEnd : today }));
}
```

- [ ] **Step 5: Rodar testes e tipos**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/marketing/reconcile.ts src/lib/marketing/reconcile.test.ts src/lib/marketing/full-funnel.ts src/lib/marketing/full-funnel.test.ts
git commit -m "feat(marketing): source reconciliation and Meta+UTM full funnel with equal-day comparison"
```

---

### Task 10: Banco (SQL), store e chave `meta_campaign_filter`

**Files:**
- Modify: `supabase/marketing.sql` (acrescentar ao fim)
- Modify: `src/lib/marketing/store.ts`
- Modify: `src/lib/marketing/settings.ts`
- Modify: `src/app/api/marketing/settings/route.ts`
- Modify: `src/components/marketing/IntegrationsCard.tsx`

**Interfaces:**
- Consumes: `Disparo`, `DisparoInput` (Task 7), `MetaWindow` (Task 1), `campaignFilterOf` (Task 9).
- Produces:
  - `store.ts`: `loadDisparos(): Promise<Disparo[]>`, `insertDisparo(d: DisparoInput): Promise<Disparo>`, `updateDisparo(id: string, patch: Partial<DisparoInput>): Promise<void>`, `deleteDisparo(id: string): Promise<void>`, `upsertMetaWindows(rows: MetaWindow[]): Promise<void>`, `loadMetaWindows(editions: number[]): Promise<MetaWindow[]>`.
  - `settings.ts`: `MarketingSettings.metaCampaignFilter: string`; `saveCampaignFilter(value: string): Promise<void>`; chave `meta_campaign_filter` em `SETTING_KEYS`.
  - `GET /api/marketing/settings` passa a devolver `metaCampaignFilter`; `POST` aceita `metaCampaignFilter` (string ≤ 100, vazio = todas).

- [ ] **Step 1: SQL**

Acrescentar ao fim de `supabase/marketing.sql`:

```sql
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
```

- [ ] **Step 2: Aplicar o SQL (manual, idempotente)**

Run (Git Bash, na raiz do repo):

```bash
TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2- | tr -d '"\r')
node -e "process.stdout.write(JSON.stringify({query: require('fs').readFileSync('supabase/marketing.sql','utf8')}))" > "$TEMP/mkt-fase3.json"
curl -s -X POST "https://api.supabase.com/v1/projects/iuxdimqnjyweipawytzl/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @"$TEMP/mkt-fase3.json"
rm "$TEMP/mkt-fase3.json"
```

Expected: `[]` (sem erro). Rodar de novo também devolve `[]` (tudo `if not exists`). Conferir:

```bash
node -e "process.stdout.write(JSON.stringify({query: \"select table_name from information_schema.tables where table_name in ('mkt_disparos','mkt_meta_window')\"}))" > "$TEMP/q.json"
curl -s -X POST "https://api.supabase.com/v1/projects/iuxdimqnjyweipawytzl/database/query" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @"$TEMP/q.json"; rm "$TEMP/q.json"
```

Expected: as duas tabelas listadas.

- [ ] **Step 3: Store**

Em `src/lib/marketing/store.ts`, trocar o import de tipos por

```ts
import type { MetaAdDay, MetaWindow } from './types.ts';
import type { Disparo, DisparoInput, DisparoKind } from './disparos.ts';
```

e acrescentar ao fim:

```ts
const numOrNull = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const toDisparo = (r: Record<string, unknown>): Disparo => ({
  id: String(r.id), kind: r.kind as DisparoKind, ciclo: (r.ciclo as string | null) ?? null, nome: String(r.nome),
  data: (r.data as string | null) ?? null, contatos: numOrNull(r.contatos), agendamentos: numOrNull(r.agendamentos),
  vendas: numOrNull(r.vendas), faturamento: numOrNull(r.faturamento), custo: numOrNull(r.custo),
  template: (r.template as string | null) ?? null,
});

export async function loadDisparos(): Promise<Disparo[]> {
  const { data, error } = await supabase.from('mkt_disparos').select('*').order('data', { ascending: true });
  check(error, 'disparos');
  return (data ?? []).map(toDisparo);
}

export async function insertDisparo(d: DisparoInput): Promise<Disparo> {
  const { data, error } = await supabase.from('mkt_disparos').insert(d).select().single();
  check(error, 'novo disparo');
  return toDisparo(data);
}

export async function updateDisparo(id: string, patch: Partial<DisparoInput>) {
  const { error } = await supabase.from('mkt_disparos').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  check(error, 'editar disparo');
}

// Único DELETE do painel: uma linha de mkt_disparos por id.
export async function deleteDisparo(id: string) {
  const { error } = await supabase.from('mkt_disparos').delete().eq('id', id);
  check(error, 'remover disparo');
}

export async function upsertMetaWindows(rows: MetaWindow[]) {
  if (!rows.length) return;
  const now = new Date().toISOString();
  const { error } = await supabase.from('mkt_meta_window').upsert(rows.map(r => ({
    edition: r.edition, since: r.since, until: r.until, reach: r.reach, frequency: r.frequency, updated_at: now,
  })));
  check(error, 'alcance por janela');
}

export async function loadMetaWindows(editions: number[]): Promise<MetaWindow[]> {
  if (!editions.length) return [];
  const { data, error } = await supabase.from('mkt_meta_window').select('*').in('edition', editions);
  check(error, 'load alcance');
  return (data ?? []).map(r => ({
    edition: r.edition, since: r.since, until: r.until, reach: numOrNull(r.reach), frequency: numOrNull(r.frequency),
  }));
}
```

- [ ] **Step 4: Settings — filtro de campanha**

Em `src/lib/marketing/settings.ts`:

1. Acrescentar o import `import { campaignFilterOf } from './full-funnel.ts';`.
2. Em `SETTING_KEYS`, acrescentar `'meta_campaign_filter'` ao fim da lista.
3. Em `MarketingSettings`, acrescentar `metaCampaignFilter: string;`.
4. Em `loadRows`, trocar a linha do `forEach` para manter também valores vazios (vazio no filtro = todas as campanhas; `pick` e os gids continuam tratando vazio como ausente):

```ts
    (data ?? []).forEach(r => { if (typeof r.value === 'string') out[r.key as SettingKey] = r.value.trim(); });
```

5. No objeto retornado por `getMarketingSettings`, acrescentar:

```ts
    metaCampaignFilter: campaignFilterOf(db.meta_campaign_filter),
```

6. Acrescentar ao fim do arquivo:

```ts
// O filtro de campanha aceita vazio (= todas); o save genérico ignora vazios, então tem o seu.
export async function saveCampaignFilter(value: string) {
  const { error } = await supabase.from('mkt_settings')
    .upsert({ key: 'meta_campaign_filter', value: value.trim(), updated_at: new Date().toISOString() });
  if (error) throw new Error(`salvar filtro de campanha: ${error.message}`);
}
```

- [ ] **Step 5: Rota de settings**

Em `src/app/api/marketing/settings/route.ts`:

1. Importar `saveCampaignFilter` junto de `saveMarketingSettings`.
2. Em `view(s)`, acrescentar `metaCampaignFilter: s.metaCampaignFilter,`.
3. No `POST`, logo depois de `const gids = ...`, validar:

```ts
  const filter = body.metaCampaignFilter;
  if (filter !== undefined && (typeof filter !== 'string' || filter.length > 100 || /[\u0000-\u001f]/.test(filter))) {
    return NextResponse.json({ error: 'Filtro de campanha inválido' }, { status: 400 });
  }
```

4. Dentro do `try` que chama `saveMarketingSettings(patch)`, acrescentar depois dele:

```ts
    if (typeof filter === 'string') await saveCampaignFilter(filter);
```

- [ ] **Step 6: Campo no card de integrações**

Em `src/components/marketing/IntegrationsCard.tsx`:

1. Em `type Settings`, acrescentar `metaCampaignFilter: string;`.
2. Trocar o estado `form` para incluir o filtro:

```ts
  const [form, setForm] = useState({ sheetId: '', metaAdAccount: '', metaApiVersion: '', metaCampaignFilter: '', gids: {} as Record<Tab, string> });
```

3. Em `apply(s)`: `setForm({ sheetId: s.sheetId, metaAdAccount: s.metaAdAccount, metaApiVersion: s.metaApiVersion, metaCampaignFilter: s.metaCampaignFilter, gids: { ...s.gids } });`
4. Em `save()`, depois da linha do `metaApiVersion`: `if (form.metaCampaignFilter.trim() !== saved.metaCampaignFilter) body.metaCampaignFilter = form.metaCampaignFilter;`
5. Trocar a assinatura de `set` para `const set = (k: 'sheetId' | 'metaAdAccount' | 'metaApiVersion' | 'metaCampaignFilter', v: string) => setForm(f => ({ ...f, [k]: v }));`
6. Logo depois do `Field` "ID da conta de anúncios", acrescentar:

```tsx
            <Field id="mkt-campaign-filter" label="Filtro de campanha do Meta"
              hint="Só entra gasto de campanhas cujo nome contém este texto. Vazio = todas as campanhas. Nada é apagado.">
              <Input id="mkt-campaign-filter" value={form.metaCampaignFilter} onChange={e => set('metaCampaignFilter', e.target.value)} placeholder="WB PG" autoComplete="off" />
            </Field>
```

- [ ] **Step 7: Verificar**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

Manual (`npm run dev`): Configurações → Integrações mostra "Filtro de campanha do Meta" = `WB PG`. Apagar o texto, salvar, recarregar: o campo continua vazio (todas). Voltar para `WB PG` e salvar. `GET /api/marketing/settings` no DevTools não contém o token, só `last4`.

- [ ] **Step 8: Commit**

```bash
git add supabase/marketing.sql src/lib/marketing/store.ts src/lib/marketing/settings.ts src/app/api/marketing/settings/route.ts src/components/marketing/IntegrationsCard.tsx
git commit -m "feat(marketing): mkt_disparos and mkt_meta_window tables, store access, Meta campaign filter setting"
```

---

### Task 11: Alcance por janela no sync e filtro de campanha na leitura

**Files:**
- Modify: `src/lib/marketing/sources/meta.ts`
- Modify: `src/lib/marketing/sync.ts`
- Modify: `src/lib/marketing/view.ts`

**Interfaces:**
- Consumes: `metaWindowRanges`, `filterAds` (Task 9); `upsertMetaWindows`, `loadEditionOverrides`, `loadSnapshots` (store); `buildEditions` (editions.ts); `MarketingSettings.metaCampaignFilter` (Task 10).
- Produces: `fetchMetaWindow(since: string, until: string, filter: string, s: MarketingSettings): Promise<{ reach: number | null; frequency: number | null }>`; sync grava `mkt_meta_window` e registra a fonte `meta:alcance`; `buildView` passa a ler só anúncios de campanhas que passam no filtro.

- [ ] **Step 1: Busca de alcance no Meta**

Acrescentar ao fim de `src/lib/marketing/sources/meta.ts`:

```ts
// Alcance e frequência não somam entre dias/anúncios: uma chamada por janela, nível conta, filtrando a campanha.
export async function fetchMetaWindow(since: string, until: string, filter: string, s: MarketingSettings): Promise<{ reach: number | null; frequency: number | null }> {
  const params = new URLSearchParams({
    level: 'account',
    fields: 'reach,frequency',
    time_range: JSON.stringify({ since, until }),
    access_token: s.metaToken,
  });
  if (filter.trim()) params.set('filtering', JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: filter.trim() }]));
  const rows = await getAll<{ reach?: string; frequency?: string }>(`${base(s)}/act_${accountId(s)}/insights?${params}`);
  const r = rows[0];
  return { reach: r?.reach ? Number(r.reach) : null, frequency: r?.frequency ? Number(r.frequency) : null };
}
```

- [ ] **Step 2: Sync grava as janelas**

Em `src/lib/marketing/sync.ts`:

1. Imports: trocar a linha de `./sources/meta.ts` por `import { fetchMetaAdDays, fetchMetaWindow, fetchPermalinks } from './sources/meta.ts';`, a de `./store.ts` por `import { hasAdDays, loadEditionOverrides, loadSnapshots, logRun, saveSnapshot, seedEditions, upsertAdDays, upsertMetaWindows, upsertPermalinks } from './store.ts';` e acrescentar `import { buildEditions } from './editions.ts';`, `import { metaWindowRanges } from './full-funnel.ts';` e `import type { MetaWindow } from './types.ts';`. O import de `./sheet-rows.ts` já tem `toOverviewRows`.
2. Antes do `for (const tab of TAB_KEYS)`, declarar `let overviewRecs: Record<string, string>[] | null = null;` e, dentro do `if (tab === 'overview') {`, como primeira linha: `overviewRecs = rows;`.
3. Dentro do `else` do Meta, depois do bloco `if (ids.length) { ... }` (permalinks), acrescentar:

```ts
    // ponytail: refaz o alcance de todas as edições pagas a cada sync (1 chamada por edição); pular as encerradas se ficar lento.
    try {
      const t = today();
      const recs = overviewRecs ?? (await loadSnapshots(['overview'])).overview ?? [];
      const ranges = metaWindowRanges(buildEditions(toOverviewRows(recs), await loadEditionOverrides(), t), t);
      const rows: MetaWindow[] = [];
      for (const r of ranges) rows.push({ ...r, ...(await fetchMetaWindow(r.since, r.until, settings.metaCampaignFilter, settings)) });
      await upsertMetaWindows(rows);
      results.push({ source: 'meta:alcance', ok: true, message: `${rows.length} edições` });
    } catch (e) {
      results.push({ source: 'meta:alcance', ok: false, message: (e as Error).message });
    }
```

- [ ] **Step 3: Filtro de campanha na leitura do painel atual**

Em `src/lib/marketing/view.ts`:

1. Imports: acrescentar `import { filterAds } from './full-funnel.ts';` e `import { getMarketingSettings } from './settings.ts';`.
2. No `Promise.all` de `buildView`, acrescentar `getMarketingSettings()` ao fim e o nome `settings` ao fim da desestruturação:

```ts
  const [snap, overrides, aliases, adPermalinks, sources, settings] = await Promise.all([
    loadSnapshots(['capture', 'overview', 'sales', 'schedule']), loadEditionOverrides(), loadAliases(), loadPermalinks(), lastRuns(), getMarketingSettings(),
  ]);
```

3. Trocar a linha do `rawAds` por:

```ts
  // Só campanhas que passam no filtro (padrão "WB PG"); o cache não é apagado.
  const rawAds: MetaAdDay[] = eds.length ? filterAds(await loadAdDays(minStart, maxEnd), settings.metaCampaignFilter) : [];
```

- [ ] **Step 4: Verificar**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

Manual (`npm run dev`, Meta configurado): **Atualizar** em `/admin/marketing`; o botão de avisos não mostra `meta:alcance` com erro. Conferir no banco (com `TOKEN` definido como na Task 10, Step 2):

```bash
node -e "process.stdout.write(JSON.stringify({query: 'select edition, since, until, reach, frequency from mkt_meta_window order by edition'}))" > "$TEMP/q.json"
curl -s -X POST "https://api.supabase.com/v1/projects/iuxdimqnjyweipawytzl/database/query" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @"$TEMP/q.json"; rm "$TEMP/q.json"
```

Expected: uma linha por edição paga (#021+) com `reach` preenchido. Em Edição, o investimento de #021/#022 só considera campanhas "WB PG" (se existirem outras campanhas no período, o número cai — é o esperado).

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/sources/meta.ts src/lib/marketing/sync.ts src/lib/marketing/view.ts
git commit -m "feat(marketing): reach/frequency per edition window in sync; campaign filter applied at read time"
```

---

### Task 12: Rota por aba, navegação em dois níveis e aba Pesquisa

**Files:**
- Modify: `src/lib/marketing/store.ts` (`loadSnapshotTimes`)
- Create: `src/lib/marketing/tabs.ts`
- Modify: `src/app/api/marketing/data/route.ts`
- Create: `src/components/marketing/useTabData.ts`
- Create: `src/components/marketing/ui.tsx`
- Create: `src/components/marketing/SurveyTab.tsx`
- Modify: `src/components/marketing/MarketingDashboard.tsx`

**Interfaces:**
- Consumes: `surveyTab`, `latestSurveys`, `SurveyTab`, `ORDER_RENDA`, `LABEL_RENDA`, `Challenges` (Task 3); `toCaptureRows`, `toOverviewRows`, `toSurveyRows`, `TabKey` (Task 1); `buildEditions`, `cycleStartAt` (Task 3); `loadSnapshots(tabs)` (Task 2), `loadEditionOverrides` (store); `TAB_TITLES` (Task 1).
- Produces:
  - `tabs.ts`: `PANEL_TABS`, `type PanelTab`, `isPanelTab(t: string): t is PanelTab`, `type TabOptions = { lists: boolean; renda: string; produto: string }`, `type TabData` (mapa aba → payload), `type Ctx`, `type MissingSources = { missing: string[] }`, `buildTab(tab: PanelTab, selected: number[], range: DateRange | null, o: TabOptions): Promise<TabData[PanelTab] | MissingSources>`. `NEEDS` lista as abas da planilha de cada aba do painel (Visão Geral sempre; Captação só quem usa — Ao vivo e Disparos não). Linhas da planilha ficam em memória da instância enquanto o `fetched_at` do snapshot não muda; aba da planilha sem dados → `{ missing: [títulos] }` em vez de zeros. As próximas tasks só trocam o bloco de imports e acrescentam entradas em `PANEL_TABS`, `TabData`, `NEEDS`, helpers e `BUILDERS`.
  - `store.ts`: `loadSnapshotTimes(tabs: TabKey[]): Promise<{ tab: TabKey; fetchedAt: string }[]>` (só `tab, fetched_at`, consulta barata).
  - Rota: `GET /api/marketing/data?tab=pesquisa&editions=…&from=…&to=…&renda=…` → `SurveyTab` (ou `{ missing }`); aba desconhecida → 400; sem `tab` → `MarketingView` (igual a hoje). `maxDuration = 60`.
  - `useTabData<T>(tab: string, query: string, extra?: string, enabled?: boolean): { data: T | null; loading: boolean; error: string }` — guarda a resposta por URL (até 40): a mesma URL não é buscada de novo (o painel desmonta a aba fechada; voltar a ela é instantâneo); `{ missing }` vira erro "Fonte sem dados: … Clique em Atualizar.".
  - `ui.tsx`: `brl`, `int`, `dec`, `pct`, `ratio`, `ed`, `dm`, `mins`, `sectionTitle`, `kpiGrid`, `Kpi`, `TabState`, `BarList`, `DistChart`, `PeopleList<T>`.
  - `SurveyTab.tsx`: default `SurveyTab({ query })`, named `ChallengesView({ data }: { data: Challenges })`.
  - `MarketingDashboard`: estado `query` (string `editions=…&from=…&to=…&v=N`, muda a cada carga bem-sucedida), `group`, `tab`; `GROUPS`.

- [ ] **Step 1: Módulo servidor `tabs.ts`**

Acrescentar a `src/lib/marketing/store.ts`, logo antes de `loadSnapshots`:

```ts
// Só a data de cada aba (barato): quem guarda as linhas em memória sabe se precisa reler.
export async function loadSnapshotTimes(tabs: TabKey[]): Promise<{ tab: TabKey; fetchedAt: string }[]> {
  const { data, error } = await supabase.from('mkt_sheet_snapshot').select('tab, fetched_at').in('tab', tabs);
  check(error, 'snapshot times');
  return (data ?? []).map(r => ({ tab: r.tab as TabKey, fetchedAt: String(r.fetched_at) }));
}
```

Criar `src/lib/marketing/tabs.ts`:

```ts
// Dados de cada aba do painel (/api/marketing/data?tab=...). Só servidor: calcula só a aba pedida
// e lê só as abas da planilha que ela usa (Visão Geral sempre, para montar as edições).
import type { CaptureRow, DateRange, EditionConfig, OverviewRow, SurveyRow } from './types.ts';
import { toCaptureRows, toOverviewRows, toSurveyRows, type TabKey } from './sheet-rows.ts';
import { buildEditions, cycleStartAt } from './editions.ts';
import { inRange } from './metrics.ts';
import { latestSurveys, surveyTab, type SurveyTab } from './survey.ts';
import { TAB_TITLES } from './sync.ts';
import { loadEditionOverrides, loadSnapshotTimes, loadSnapshots } from './store.ts';

export const PANEL_TABS = [
  'pesquisa',
] as const;
export type PanelTab = typeof PANEL_TABS[number];
export const isPanelTab = (t: string): t is PanelTab => (PANEL_TABS as readonly string[]).indexOf(t) >= 0;
export type TabOptions = { lists: boolean; renda: string; produto: string };

export type TabData = {
  pesquisa: SurveyTab;
};
// Aba da planilha sem dados: a tela diz qual fonte falta, em vez de mostrar zeros.
export type MissingSources = { missing: string[] };

// Abas da planilha que cada aba do painel lê, além da Visão Geral. Ao vivo e Disparos não leem a Captação.
const NEEDS: Record<PanelTab, TabKey[]> = {
  pesquisa: ['capture', 'survey'],
};

// Linhas da planilha em memória da instância, por aba, enquanto o `fetched_at` do snapshot não muda.
// ponytail: some no cold start da Vercel; se ainda ficar lento, guardar o resultado por aba no banco.
type Entry = { at: string; recs: Record<string, string>[]; typed?: unknown[] };
const memo: Partial<Record<TabKey, Entry>> = {};
let surveyMemo: { key: string; value: Record<string, SurveyRow> } | null = null;

async function snapshots(tabs: TabKey[]): Promise<Partial<Record<TabKey, Entry>>> {
  const times = await loadSnapshotTimes(tabs);
  const stale = times.filter(t => { const m = memo[t.tab]; return !m || m.at !== t.fetchedAt; });
  if (stale.length) {
    const fresh = await loadSnapshots(stale.map(t => t.tab));
    stale.forEach(t => { memo[t.tab] = { at: t.fetchedAt, recs: fresh[t.tab] ?? [] }; });
  }
  const out: Partial<Record<TabKey, Entry>> = {};
  times.forEach(t => { out[t.tab] = memo[t.tab]; });
  return out;
}

// Conversão tipada também fica na memória, junto das linhas.
function typed<T>(e: Entry | undefined, convert: (recs: Record<string, string>[]) => T[]): T[] {
  if (!e) return [];
  if (!e.typed) e.typed = convert(e.recs);
  return e.typed as T[];
}

export type Ctx = {
  today: string; range: DateRange | null;
  editions: EditionConfig[]; selected: number[]; eds: EditionConfig[];
  snap: Partial<Record<TabKey, Entry>>;
  captures: CaptureRow[];   // Captação inteira
  leads: CaptureRow[];      // Captação das edições selecionadas, no período
  overview: OverviewRow[];
  surveys: Record<string, SurveyRow>;
};

const todayBRT = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
const day = (at: string | null) => (at ? at.slice(0, 10) : null);
const inSel = (c: Ctx, n: number | null) => n !== null && c.selected.indexOf(n) >= 0;

async function context(tab: PanelTab, selectedIn: number[], range: DateRange | null): Promise<Ctx | MissingSources> {
  const today = todayBRT();
  const need = (['overview'] as TabKey[]).concat(NEEDS[tab]);
  const [snap, overrides] = await Promise.all([snapshots(need), loadEditionOverrides()]);
  const missing = need.filter(t => { const e = snap[t]; return !e || !e.recs.length; }).map(t => TAB_TITLES[t]);
  if (missing.length) return { missing };
  const captures = typed(snap.capture, toCaptureRows);
  const overview = typed(snap.overview, toOverviewRows);
  const editions = buildEditions(overview, overrides, today);
  // Mesma regra do buildView: sem seleção, a edição mais recente.
  const selected = selectedIn.length ? selectedIn : editions.slice(-1).map(e => e.number);
  let surveys: Record<string, SurveyRow> = {};
  const sv = snap.survey, cap = snap.capture;
  if (sv && cap) {
    const key = `${sv.at}|${cap.at}`;
    if (!surveyMemo || surveyMemo.key !== key) surveyMemo = { key, value: latestSurveys(typed(sv, toSurveyRows), cycleStartAt(captures)) };
    surveys = surveyMemo.value;
  }
  const ctx: Ctx = {
    today, range, editions, selected, eds: editions.filter(e => selected.indexOf(e.number) >= 0),
    snap, captures, overview, leads: [], surveys,
  };
  ctx.leads = captures.filter(c => inSel(ctx, c.edition) && inRange(day(c.at), range));
  return ctx;
}

type Builder<K extends PanelTab> = (c: Ctx, o: TabOptions) => TabData[K] | Promise<TabData[K]>;
const BUILDERS: { [K in PanelTab]: Builder<K> } = {
  pesquisa: (c, o) => surveyTab(c.leads, c.surveys, o.renda),
};
export async function buildTab(tab: PanelTab, selected: number[], range: DateRange | null, o: TabOptions): Promise<TabData[PanelTab] | MissingSources> {
  const c = await context(tab, selected, range);
  if ('missing' in c) return c;
  return BUILDERS[tab](c, o);
}
```

- [ ] **Step 2: Rota `?tab=`**

Substituir `src/app/api/marketing/data/route.ts` por:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/auth';
import { buildView } from '@/lib/marketing/view';
import { buildTab, isPanelTab } from '@/lib/marketing/tabs';

// Abas pesadas (Edição com várias lives) podem passar dos 10 s padrão no primeiro acesso.
export const maxDuration = 60;

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
  const tab = p.get('tab');
  try {
    // Sem `tab`: o MarketingView de sempre (painel no ar não muda). Com `tab`: só aquela aba.
    if (tab === null) return NextResponse.json(await buildView(editions, range));
    if (!isPanelTab(tab)) return NextResponse.json({ error: 'Aba inválida' }, { status: 400 });
    return NextResponse.json(await buildTab(tab, editions, range, {
      lists: p.get('lists') === '1',
      renda: (p.get('renda') ?? 'all').slice(0, 20),
      produto: (p.get('produto') ?? 'todos').slice(0, 20),
    }));
  } catch (e) {
    console.error('marketing data', tab, e);
    return NextResponse.json({ error: 'Falha ao montar o painel' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Hook `useTabData`**

Criar `src/components/marketing/useTabData.ts`:

```ts
'use client';

import { useEffect, useRef, useState } from 'react';

// Resposta por URL. `query` traz a versão da carga (&v=N), então a mesma URL = mesmos dados:
// voltar a uma aba (o painel desmonta abas fechadas) mostra na hora, sem nova requisição.
// ponytail: guarda só as 40 últimas URLs.
const cache: Record<string, unknown> = {};
const order: string[] = [];
function remember(url: string, data: unknown) {
  if (!(url in cache)) { order.push(url); if (order.length > 40) delete cache[order.shift() as string]; }
  cache[url] = data;
}

export function useTabData<T>(tab: string, query: string, extra = '', enabled = true) {
  const url = `/api/marketing/data?tab=${tab}&${query}${extra}`;
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string }>(
    () => (url in cache ? { data: cache[url] as T, loading: false, error: '' } : { data: null, loading: enabled, error: '' }),
  );
  const seq = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    if (url in cache) { setState({ data: cache[url] as T, loading: false, error: '' }); return; }
    const id = ++seq.current; // só a última requisição vale
    setState(s => ({ data: s.data, loading: true, error: '' }));
    fetch(url)
      .then(async r => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || 'Erro ao carregar');
        // Aba da planilha sem dados: o servidor diz qual; nada de zeros na tela.
        if (body && Array.isArray(body.missing)) throw new Error(`Fonte sem dados: ${body.missing.join(', ')}. Clique em Atualizar.`);
        remember(url, body);
        return body as T;
      })
      .then(data => { if (id === seq.current) setState({ data, loading: false, error: '' }); })
      .catch(e => { if (id === seq.current) setState(s => ({ data: s.data, loading: false, error: (e as Error).message || 'Erro ao carregar' })); });
  }, [url, enabled]);
  return state;
}
```

- [ ] **Step 4: Peças de UI compartilhadas**

Criar `src/components/marketing/ui.tsx`:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { useTabData } from './useTabData';

// Número sem fonte é "—" (com explicação no hover), nunca 0.
export const brl = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
export const int = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR'));
export const dec = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
export const pct = (n: number | null, digits = 1) => (n === null ? '—' : `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: digits })}%`);
export const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
export const ed = (n: number) => `#${String(n).padStart(3, '0')}`;
export const dm = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '—');
export function mins(n: number | null): string {
  if (n === null) return '—';
  const m = Math.round(n);
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min` : `${m} min`;
}
export const sectionTitle = 'mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground';
export const kpiGrid = 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6';

export function Kpi({ label, value, hint, why }: { label: string; value: string; hint?: string; why?: string }) {
  const missing = value === '—';
  return (
    <Card size="sm" className="h-full gap-1 px-3">
      <p className="truncate text-[10px] font-bold uppercase tracking-widest text-muted-foreground" title={label}>{label}</p>
      <p className="text-xl font-semibold leading-tight tabular-nums" title={missing ? why ?? 'Sem dado na fonte para esta seleção' : undefined}>{value}</p>
      <p className="truncate text-[11px] text-muted-foreground" title={hint}>{hint ?? ' '}</p>
    </Card>
  );
}

export function TabState({ loading, error }: { loading: boolean; error: string }) {
  return (
    <p role={error ? 'alert' : undefined} className={`py-12 text-center text-sm ${error ? 'text-red-400' : 'text-muted-foreground'}`}>
      {error || (loading ? 'Carregando…' : 'Sem dados para mostrar.')}
    </p>
  );
}

export function BarList({ items, total, empty = 'Sem dados.' }: { items: { key: string; count: number; note?: string }[]; total: number; empty?: string }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">{empty}</p>;
  const max = items.reduce((m, x) => Math.max(m, x.count), 1);
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map(x => (
        <li key={x.key} className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-2 text-xs sm:grid-cols-[12rem_minmax(0,1fr)_5rem_7rem]">
          <span className="truncate" title={x.key}>{x.key}</span>
          <span aria-hidden className="hidden h-2.5 rounded-full bg-muted sm:block">
            <span className="block h-full rounded-full bg-primary/70" style={{ width: `${(x.count / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums"><b>{int(x.count)}</b> <span className="text-muted-foreground">{pct(ratio(x.count, total))}</span></span>
          <span className="hidden truncate text-muted-foreground sm:inline">{x.note ?? ''}</span>
        </li>
      ))}
    </ul>
  );
}

export function DistChart({ data, label = 'Quantidade', colorOf }: { data: { label: string; count: number }[]; label?: string; colorOf?: (i: number) => string }) {
  if (!data.length) return <p className="text-xs text-muted-foreground">Sem dados.</p>;
  const config = { count: { label, color: 'oklch(var(--chart-1))' } } satisfies ChartConfig;
  const tilt = data.length > 6;
  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <BarChart data={data} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fontSize: 10 }}
          angle={tilt ? -30 : 0} textAnchor={tilt ? 'end' : 'middle'} height={tilt ? 56 : 24} />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="count" radius={4} fill="var(--color-count)">
          {colorOf && data.map((_, i) => <Cell key={i} fill={colorOf(i)} />)}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// Dados pessoais só aqui: a lista é pedida com &lists=1 quando a seção é aberta.
export function PeopleList<T>({ tab, query, extra = '', title, render }: { tab: string; query: string; extra?: string; title: string; render: (data: T) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data, loading, error } = useTabData<T>(tab, query, `${extra}&lists=1`, open);
  return (
    <details className="rounded-lg border border-border" onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</summary>
      <div className="max-h-[32rem] overflow-auto border-t border-border p-3">
        {error ? <p role="alert" className="text-xs text-red-400">{error}</p>
          : loading || !data ? <p className="text-xs text-muted-foreground">Carregando…</p>
          : render(data)}
      </div>
    </details>
  );
}
```

- [ ] **Step 5: Aba Pesquisa**

Criar `src/components/marketing/SurveyTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { LABEL_RENDA, ORDER_RENDA, type Challenges, type SurveyTab as Data } from '@/lib/marketing/survey';
import { useTabData } from './useTabData';
import { DistChart, Kpi, TabState, int, kpiGrid, pct, sectionTitle } from './ui';

const BANDS: [string, string][] = [['3kplus', '3k ou mais'], ['5kplus', '5k ou mais'], ['7kplus', '7k ou mais'], ['10kplus', '10k ou mais'], ['20kplus', '20k ou mais']];

export function ChallengesView({ data }: { data: Challenges }) {
  if (!data.phrases.length) return <p className="text-xs text-muted-foreground">Sem desafios nesta seleção.</p>;
  const max = data.keywords.length ? data.keywords[0].count : 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {data.keywords.map(k => (
          <div key={k.word} title={`Ex.: ${k.examples.join(' · ')}`} className="relative overflow-hidden rounded-md border border-border px-3 py-2">
            <div aria-hidden className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${(k.count / max) * 100}%` }} />
            <div className="relative flex items-center justify-between gap-2 text-sm"><span>{k.word}</span><span className="font-semibold tabular-nums">{k.count}</span></div>
          </div>
        ))}
      </div>
      <details className="rounded-lg border border-border">
        <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Todas as frases ({data.phrases.length})</summary>
        <ul className="grid max-h-96 gap-2 overflow-auto border-t border-border p-3 sm:grid-cols-2">
          {data.phrases.map((p, i) => (
            <li key={i} className="rounded-md bg-muted/40 px-3 py-2 text-xs">
              “{p.text}”{p.count > 1 && <span className="ml-1 text-muted-foreground">· {p.count}×</span>}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export default function SurveyTab({ query }: { query: string }) {
  const [renda, setRenda] = useState('all');
  const { data: d, loading, error } = useTabData<Data>('pesquisa', query, `&renda=${renda}`);
  if (!d) return <TabState loading={loading} error={error} />;
  const charts: [keyof Data['charts'], string][] = [['fat', 'Faturamento com fotografia'], ['tempo', 'Tempo de fotografia'], ['servico', 'Serviço carro-chefe'], ['conhece', 'Conhece há quanto tempo']];
  const dist = (k: keyof Data['charts']) => d.charts[k].map(x => ({ label: x.label, count: x.count }));
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="mkt-renda" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Renda familiar</label>
        <select id="mkt-renda" value={renda} onChange={e => setRenda(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-sm">
          <option value="all">Todas</option>
          <optgroup label="Acumuladas">{BANDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</optgroup>
          <optgroup label="Faixas">{ORDER_RENDA.map(k => <option key={k} value={k}>{LABEL_RENDA[k]}</option>)}</optgroup>
        </select>
        <span className="text-xs text-muted-foreground">{renda === 'all' ? `${int(d.responses)} respostas` : `${int(d.filtered)} de ${int(d.responses)} respostas`}</span>
      </div>

      <section>
        <h2 className={sectionTitle}>Pesquisa × captação</h2>
        <div className={kpiGrid}>
          <Kpi label="Taxa de resposta" value={pct(d.responseRate)} hint={`${int(d.filtered)} de ${int(d.leads)} leads`} why="Sem leads na seleção" />
          <Kpi label="Qualificados 5k+" value={int(d.qualified)} hint="responderam e têm renda familiar 5k+" />
          <Kpi label="Qualidade" value={pct(d.quality)} hint="dos que responderam, são 5k+" why="Ninguém respondeu" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className={sectionTitle}>Renda familiar <span className="font-normal normal-case tracking-normal">· verde = qualificado</span></h2>
          <DistChart data={dist('renda')} label="Respostas" colorOf={i => (d.charts.renda[i].qualified ? '#34d399' : '#fbbf24')} />
        </Card>
        {charts.map(([k, title]) => (
          <Card key={k} className="p-4">
            <h2 className={sectionTitle}>{title}</h2>
            <DistChart data={dist(k)} label="Respostas" />
          </Card>
        ))}
      </section>

      <section>
        <h2 className={sectionTitle}>Desafios · palavras-chave mais citadas</h2>
        <ChallengesView data={d.challenges} />
      </section>
    </div>
  );
}
```

- [ ] **Step 6: Navegação em dois níveis**

Em `src/components/marketing/MarketingDashboard.tsx`:

1. Acrescentar o import `import SurveyTab from './SurveyTab';`.
2. Logo abaixo de `const dm = ...`, acrescentar:

```tsx
// Abas em dois níveis (tudo dentro de /admin/marketing, sem itens novos no menu).
const GROUPS: { key: string; label: string; tabs: { key: string; label: string }[] }[] = [
  { key: 'resultado', label: 'Resultado', tabs: [{ key: 'edicao', label: 'Edição' }, { key: 'criativos', label: 'Criativos' }, { key: 'validacao', label: 'Validação' }] },
  { key: 'leads', label: 'Leads', tabs: [{ key: 'pesquisa', label: 'Pesquisa' }] },
];
```

3. Depois de `const [now, setNow] = useState(() => Date.now());`, acrescentar:

```tsx
  const [query, setQuery] = useState(''); // filtros da última carga + versão: as abas refazem a busca quando muda
  const [group, setGroup] = useState('resultado');
  const [tab, setTab] = useState('edicao');
```

4. Em `load`, trocar `setView(body); setSelected(body.selected);` por:

```tsx
      setView(body); setSelected(body.selected);
      setQuery(`${q.toString()}&v=${id}`);
```

5. Substituir todo o bloco `{view && ( <Tabs defaultValue="edicao" ...> ... </Tabs> )}` por:

```tsx
          {view && (
            <div aria-busy={loading} className={`flex flex-col gap-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              <div role="group" aria-label="Grupo de abas" className="inline-flex h-9 max-w-full items-center overflow-x-auto rounded-lg border border-border bg-input/20 p-0.5">
                {GROUPS.map(g => (
                  <button key={g.key} type="button" aria-pressed={g.key === group} onClick={() => { setGroup(g.key); setTab(g.tabs[0].key); }}
                    className={`h-8 shrink-0 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 ${g.key === group ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                    {g.label}
                  </button>
                ))}
              </div>
              <Tabs value={tab} onValueChange={v => setTab(String(v))}>
                <TabsList variant="line">
                  {GROUPS.filter(g => g.key === group)[0].tabs.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
                </TabsList>
                <TabsContent value="edicao"><EditionTab key={view.selected[0]} view={view} onSaved={() => load(selected, range)} /></TabsContent>
                <TabsContent value="criativos"><CreativesTab view={view} onSaved={() => load(selected, range)} /></TabsContent>
                <TabsContent value="validacao"><ValidationTab view={view} /></TabsContent>
                <TabsContent value="pesquisa"><SurveyTab query={query} /></TabsContent>
              </Tabs>
            </div>
          )}
```

- [ ] **Step 7: Verificar**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: testes passam, sem erro de tipo, build ok.

Manual (`npm run dev`, logado como admin, em `/admin/marketing`):
- Aparecem os grupos **Resultado** e **Leads**; Resultado → Edição/Criativos/Validação mostram o mesmo de antes.
- Leads → Pesquisa: KPIs, 5 gráficos (renda com barras verdes nas faixas 5k+), palavras-chave e "Todas as frases" recolhível.
- Trocar o filtro de renda para "5k ou mais": a contagem vira "N de M respostas" e a Qualidade vai a 100%.
- Trocar a edição no seletor: a Pesquisa recarrega.
- No DevTools: `GET /api/marketing/data` (sem tab) continua com o formato antigo; `?tab=xyz` → 400; deslogado → 401.
- Celular (360 px): grupos cabem ou rolam na horizontal; nada estoura a tela.
- Fonte vazia: com a linha `survey` de `mkt_sheet_snapshot` ausente (ambiente de teste/Preview, antes do primeiro Atualizar), Leads → Pesquisa mostra "Fonte sem dados: Pesquisa [novo]. Clique em Atualizar." — nunca zeros.
- Cache no navegador: Pesquisa → Edição → Pesquisa não gera nova chamada `?tab=pesquisa` no DevTools; trocar a edição ou clicar Atualizar gera.
- Tempo: no DevTools, a chamada `?tab=pesquisa` repetida (segunda vez na mesma instância, "warm") fica abaixo de 1 s.

- [ ] **Step 8: Commit**

```bash
git add src/lib/marketing/store.ts src/lib/marketing/tabs.ts src/app/api/marketing/data/route.ts src/components/marketing/useTabData.ts src/components/marketing/ui.tsx src/components/marketing/SurveyTab.tsx src/components/marketing/MarketingDashboard.tsx
git commit -m "feat(marketing): per-tab data endpoint, two-level tabs and Pesquisa tab"
```

---

### Task 13: Abas Aplicações e Ao vivo

**Files:**
- Modify: `src/lib/marketing/sources/platform.ts`
- Modify: `src/lib/marketing/tabs.ts`
- Create: `src/components/marketing/ApplicationsTab.tsx`
- Create: `src/components/marketing/LiveTab.tsx`
- Modify: `src/components/marketing/MarketingDashboard.tsx`

**Interfaces:**
- Consumes: `buildApplications`, `applicationsTab`, `Application`, `ApplicationsTab` (Task 4); `presenceFromEvents`, `liveStats`, `liveTotals`, `LiveStats`, `LiveTab` (Task 8); `indexCaptures` (Task 3); `toApplicationRows` (Task 1); `supabase` e `getEdition` (`@/lib/db`, só leitura; `db.ts` não muda), `getLiveStartMs` (`@/lib/edition`).
- Produces:
  - `platform.ts`: `loadLive(liveDate: string): Promise<{ events: LiveEvent[]; liveStartMs: number; pitchSeconds: number }>` com leitor paginado próprio de `events` que **lança** em erro (o `getLiveEventsForEdition` de `db.ts` engole o erro e devolve linhas parciais).
  - `tabs.ts`: presença de lives que já passaram fica em memória da instância (não muda mais); erro não é guardado.
  - `tabs.ts`: abas `aplicacoes` (`ApplicationsTab`) e `aovivo` (`LiveTab`); helpers internos `applications(c: Ctx): Application[]` e `liveByEdition(c: Ctx): Promise<Record<number, LiveStats | null>>` (usados de novo nas Tasks 17 e 18).
  - Componentes `ApplicationsTab({ query })`, `LiveTab({ query })`.

- [ ] **Step 1: Presença crua da plataforma (só leitura)**

Em `src/lib/marketing/sources/platform.ts`, acrescentar junto dos imports do topo:

```ts
import type { LiveEvent } from '../live.ts';
```

e ao fim do arquivo:

```ts
// Eventos de presença da live, paginados e só leitura. Ao contrário de getLiveEventsForEdition (db.ts),
// um erro aqui lança: melhor "—" na tela do que uma curva calculada com metade dos eventos.
async function loadLiveEvents(liveDate: string): Promise<LiveEvent[]> {
  const out: LiveEvent[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase.from('events').select('registration_id, type, created_at')
      .eq('edition_id', liveDate).in('type', ['enter_live', 'cta_click', 'heartbeat'])
      .order('created_at', { ascending: true }).range(start, start + 999);
    if (error) throw new Error(`events: ${error.message}`);
    (data ?? []).forEach(e => out.push(e));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// Presença da live (só leitura) + início e marcador do pitch.
export async function loadLive(liveDate: string): Promise<{ events: LiveEvent[]; liveStartMs: number; pitchSeconds: number }> {
  const [events, edition] = await Promise.all([loadLiveEvents(liveDate), getEdition(liveDate)]);
  return { events, liveStartMs: getLiveStartMs(liveDate), pitchSeconds: edition?.pitch_marker_seconds ?? DEFAULT_PITCH_SECONDS };
}
```

- [ ] **Step 2: `tabs.ts` — aplicacoes e aovivo**

Em `src/lib/marketing/tabs.ts` (cada estado intermediário compila: o plano foi verificado aplicando as Tasks 12–18 em sequência):

1. Substituir o bloco de imports do topo (todas as linhas `import`) por:

```ts
import type { CaptureRow, DateRange, EditionConfig, OverviewRow, SurveyRow } from './types.ts';
import { toApplicationRows, toCaptureRows, toOverviewRows, toSurveyRows, type TabKey } from './sheet-rows.ts';
import { buildEditions, cycleStartAt, indexCaptures } from './editions.ts';
import { inRange } from './metrics.ts';
import { latestSurveys, surveyTab, type SurveyTab } from './survey.ts';
import { applicationsTab, buildApplications, type Application, type ApplicationsTab } from './applications.ts';
import { liveStats, liveTotals, presenceFromEvents, type LiveStats, type LiveTab } from './live.ts';
import { TAB_TITLES } from './sync.ts';
import { loadEditionOverrides, loadSnapshotTimes, loadSnapshots } from './store.ts';
import { loadLive } from './sources/platform.ts';
```

2. Substituir a declaração de `PANEL_TABS` por:

```ts
export const PANEL_TABS = [
  'pesquisa', 'aplicacoes', 'aovivo',
] as const;
```

3. Dentro de `export type TabData = { … }`, acrescentar ao fim:

```ts
  aplicacoes: ApplicationsTab;
  aovivo: LiveTab;
```

4. Dentro de `const NEEDS = { … }`, acrescentar ao fim:

```ts
  aplicacoes: ['capture', 'applications'],
  aovivo: [],
```

5. Logo antes de `type Builder<K extends PanelTab>`, acrescentar:

```ts
function applications(c: Ctx): Application[] {
  return buildApplications(typed(c.snap.applications, toApplicationRows), indexCaptures(c.captures), c.editions);
}

// Presença de lives que já passaram não muda mais: fica na memória da instância.
const liveMemo: Record<string, LiveStats | null> = {};

// Presença oficial por edição (plataforma). Edição sem evento ou com erro = null ("—" na tela).
async function liveByEdition(c: Ctx): Promise<Record<number, LiveStats | null>> {
  const out: Record<number, LiveStats | null> = {};
  await Promise.all(c.eds.map(async e => {
    const past = e.liveDate < c.today;
    if (past && e.liveDate in liveMemo) { out[e.number] = liveMemo[e.liveDate]; return; }
    try {
      const l = await loadLive(e.liveDate);
      const people = presenceFromEvents(l.events);
      out[e.number] = people.length ? liveStats(people, l.liveStartMs, l.pitchSeconds) : null;
      if (past) liveMemo[e.liveDate] = out[e.number];
    } catch {
      out[e.number] = null; // erro não vai para a memória: tenta de novo na próxima
    }
  }));
  return out;
}
```

6. Dentro de `const BUILDERS = { … }`, acrescentar ao fim (antes do `};`):

```ts
  aplicacoes: (c, o) => applicationsTab(applications(c), c.selected, c.range, o.lists),
  aovivo: async c => {
    const live = await liveByEdition(c);
    const editions = c.eds.map(e => ({ edition: e.number, liveDate: e.liveDate, stats: live[e.number] ?? null }));
    const stats: LiveStats[] = [];
    editions.forEach(e => { if (e.stats) stats.push(e.stats); });
    return { editions, totals: liveTotals(stats) };
  },
```

- [ ] **Step 3: Componente Aplicações**

Criar `src/components/marketing/ApplicationsTab.tsx`:

```tsx
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AppAgg, ApplicationsTab as Data } from '@/lib/marketing/applications';
import { useTabData } from './useTabData';
import { BarList, Kpi, PeopleList, TabState, dm, ed, int, kpiGrid, pct, ratio, sectionTitle } from './ui';

const bars = (xs: AppAgg[]) => xs.map(x => ({ key: x.key, count: x.count, note: `${x.qualified} qualif.` }));
const Q_TONE: Record<string, string> = { Power: 'text-amber-300', Start: 'text-sky-300', Desafio: 'text-red-300' };

export default function ApplicationsTab({ query }: { query: string }) {
  const { data: d, loading, error } = useTabData<Data>('aplicacoes', query);
  if (!d) return <TabState loading={loading} error={error} />;
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <section>
        <h2 className={sectionTitle}>Aplicações (Typeform)</h2>
        <div className={kpiGrid}>
          <Kpi label="Completas" value={int(d.complete)} hint={`${d.repeats} repetidas · ${d.incomplete} não terminaram`} />
          <Kpi label="Qualificadas" value={int(d.qualified)} hint={`${pct(ratio(d.qualified, d.complete))} · Power ${d.power} · Start ${d.start}`} />
          <Kpi label="Não qualificadas" value={int(d.desafio)} hint={`${pct(ratio(d.desafio, d.complete))} · perfil Desafio`} />
          <Kpi label="Agendaram no formulário" value={int(d.scheduled)} hint={`${d.interestYes} com interesse na mentoria`} />
          <Kpi label="Sem edição" value={int(d.noEdition)} hint="sem e-mail na captação nem data" />
        </div>
      </section>

      <section>
        <h2 className={sectionTitle}>Origem</h2>
        <div className="mb-3 flex flex-wrap gap-2">
          {d.originGroups.map(g => (
            <span key={g.key} className="rounded-md border border-border px-2 py-1 text-xs">
              <b className="tabular-nums">{g.count}</b> {g.key} <span className="text-muted-foreground">· {g.qualified} qualif.</span>
            </span>
          ))}
        </div>
        <BarList items={bars(d.origins)} total={d.complete} />
      </section>

      <section>
        <h2 className={sectionTitle}>Por webinário</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Webinário</TableHead><TableHead className="text-right">Completas</TableHead><TableHead className="text-right">Qualificadas</TableHead>
              <TableHead className="text-center">Power · Start · Desafio</TableHead><TableHead className="text-right">Agendaram</TableHead>
              <TableHead className="text-right">Não terminaram</TableHead><TableHead>Principal origem</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {d.byEdition.map(r => (
                <TableRow key={r.edition}>
                  <TableCell className="font-medium">{ed(r.edition)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.complete}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.qualified} <span className="text-muted-foreground">{pct(ratio(r.qualified, r.complete))}</span></TableCell>
                  <TableCell className="text-center tabular-nums"><span className="text-amber-300">{r.power}</span> · <span className="text-sky-300">{r.start}</span> · <span className="text-red-300">{r.desafio}</span></TableCell>
                  <TableCell className="text-right tabular-nums">{r.scheduled}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.incomplete || '·'}</TableCell>
                  <TableCell className="text-muted-foreground">{r.topOrigin ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {([['Renda mensal', d.profile.income], ['Faturamento com fotografia', d.profile.revenue], ['Relação com a fotografia', d.profile.relation]] as [string, AppAgg[]][]).map(([t, xs]) => (
          <div key={t}><h2 className={sectionTitle}>{t}</h2><BarList items={bars(xs)} total={d.complete} /></div>
        ))}
      </section>

      <PeopleList<Data> tab="aplicacoes" query={query} title={`Lista de aplicações (${d.complete})`} render={x => x.list && (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Quando</TableHead><TableHead>Nome</TableHead><TableHead>Origem</TableHead><TableHead>Relação</TableHead>
                <TableHead>Faturamento</TableHead><TableHead>Renda</TableHead><TableHead>Perfil</TableHead><TableHead>Agendou</TableHead>
                <TableHead title="* = atribuída pela data, sem e-mail na captação">Webinário</TableHead><TableHead>Criativo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {x.list.complete.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{a.at ? `${dm(a.at)} ${a.at.slice(11, 16)}` : '(sem data)'}</TableCell>
                    <TableCell className="font-medium">{a.name || '—'}{a.repeats > 0 && <span className="ml-1 text-muted-foreground">×{a.repeats + 1}</span>}</TableCell>
                    <TableCell>{a.origin}</TableCell>
                    <TableCell className="max-w-[14rem] truncate" title={a.relation}>{a.relation || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{a.revenue || '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{a.income || '—'}</TableCell>
                    <TableCell className={`font-semibold ${Q_TONE[a.qualif] ?? 'text-muted-foreground'}`}>{a.qualif || '·'}</TableCell>
                    <TableCell>{a.scheduled ? <span className="text-emerald-400">sim</span> : '·'}</TableCell>
                    <TableCell>{a.edition === null ? '—' : `${ed(a.edition)}${a.editionByEmail ? '' : '*'}`}</TableCell>
                    <TableCell className="text-xs">{a.creative || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {x.list.incomplete.length > 0 && (
            <p className="text-xs text-muted-foreground">Começaram e não terminaram ({x.list.incomplete.length}): {x.list.incomplete.join(', ')}</p>
          )}
        </div>
      )} />
    </div>
  );
}
```

- [ ] **Step 4: Componente Ao vivo**

Criar `src/components/marketing/LiveTab.tsx`:

```tsx
'use client';

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { LiveStats, LiveTab as Data } from '@/lib/marketing/live';
import { useTabData } from './useTabData';
import { DistChart, Kpi, TabState, dm, ed, int, kpiGrid, mins, pct, ratio, sectionTitle } from './ui';

const COLORS = ['oklch(var(--chart-1))', 'oklch(var(--chart-2))', 'oklch(var(--chart-3))', 'oklch(var(--chart-4))', 'oklch(var(--chart-5))'];

export default function LiveTab({ query }: { query: string }) {
  const { data: d, loading, error } = useTabData<Data>('aovivo', query);
  if (!d) return <TabState loading={loading} error={error} />;
  const t = d.totals;
  const withData = d.editions.filter(e => e.stats) as { edition: number; liveDate: string; stats: LiveStats }[];
  if (!t || !withData.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Sem presença registrada na plataforma para as edições selecionadas.</p>;
  }
  const one = withData.length === 1;
  const config: ChartConfig = {};
  withData.forEach((e, i) => { config[`e${e.edition}`] = { label: `${ed(e.edition)} (${dm(e.liveDate)})`, color: COLORS[i % COLORS.length] }; });
  const len = withData.reduce((m, e) => Math.max(m, e.stats.curve.length), 0);
  const rows = Array.from({ length: len }, (_, minute) => {
    const r: Record<string, number> = { minute };
    withData.forEach(e => { const v = e.stats.curve[minute]; if (v !== undefined) r[`e${e.edition}`] = v; });
    return r;
  });
  const pitch = withData[withData.length - 1].stats.pitchMinute;

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <section>
        <h2 className={sectionTitle}>Presença na plataforma</h2>
        <div className={kpiGrid}>
          <Kpi label="Pessoas no ao vivo" value={int(t.people)} hint={one ? ed(withData[0].edition) : `${t.editions} lives · média ${int(Math.round(t.people / t.editions))}`} />
          <Kpi label="Tempo médio" value={mins(t.mean)} hint={`mediana ${mins(t.median)} · só quem assistiu`} why="Ninguém assistiu" />
          <Kpi label="Pico simultâneo" value={int(t.peak)} hint={one ? `aos ${t.peakMinute} min das 20h` : `média por live · maior ${int(t.peakMax)}`} />
          <Kpi label="Até o pitch" value={int(t.toPitch)} hint={`${pct(ratio(t.toPitch, t.people))} das pessoas`} />
          <Kpi label="30 min ou mais" value={pct(ratio(t.min30, t.people))} hint={`${int(t.min30)} pessoas · 60+ min: ${int(t.min60)}`} />
          <Kpi label="Clicaram no CTA" value={int(t.cta)} hint={`${pct(ratio(t.cta, t.people))} das pessoas`} />
        </div>
      </section>

      <Card className="p-4">
        <h2 className={sectionTitle}>Audiência por minuto desde as 20h</h2>
        <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
          <LineChart data={rows}>
            <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
            <XAxis dataKey="minute" type="number" domain={[0, 'dataMax']} tickLine={false} axisLine={false} tickFormatter={v => `${v} min`} />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ReferenceLine x={pitch} stroke="oklch(var(--muted-foreground))" strokeDasharray="4 4"
              label={{ value: 'Pitch', position: 'insideTopRight', fontSize: 10, fill: 'oklch(var(--muted-foreground))' }} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(_, p) => `minuto ${(p?.[0]?.payload as { minute?: number } | undefined)?.minute ?? 0}`} />} />
            <ChartLegend content={<ChartLegendContent />} />
            {withData.map(e => <Line key={e.edition} dataKey={`e${e.edition}`} type="monotone" stroke={`var(--color-e${e.edition})`} strokeWidth={2} dot={false} connectNulls={false} />)}
          </LineChart>
        </ChartContainer>
      </Card>

      <Card className="p-4">
        <h2 className={sectionTitle}>Tempo assistido</h2>
        <DistChart data={t.histogram} label="Pessoas" colorOf={i => (i < 2 ? '#f87171' : i < 4 ? '#fbbf24' : '#34d399')} />
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {d.editions.map(e => (
          <Card key={e.edition} size="sm" className="gap-1 px-4">
            <p className="text-xs font-semibold">{ed(e.edition)} <span className="font-normal text-muted-foreground">· {dm(e.liveDate)}</span></p>
            {e.stats ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Pessoas</dt><dd className="text-right tabular-nums">{int(e.stats.people)}</dd>
                <dt className="text-muted-foreground">Tempo médio</dt><dd className="text-right tabular-nums">{mins(e.stats.mean)}</dd>
                <dt className="text-muted-foreground">Mediana</dt><dd className="text-right tabular-nums">{mins(e.stats.median)}</dd>
                <dt className="text-muted-foreground">Pico</dt><dd className="text-right tabular-nums">{int(e.stats.peak)} <span className="text-muted-foreground">aos {e.stats.peakMinute} min</span></dd>
                <dt className="text-muted-foreground">Até o pitch</dt><dd className="text-right tabular-nums">{int(e.stats.toPitch)}</dd>
                <dt className="text-muted-foreground">30+ / 60+ min</dt><dd className="text-right tabular-nums">{int(e.stats.min30)} / {int(e.stats.min60)}</dd>
                <dt className="text-muted-foreground">CTA</dt><dd className="text-right tabular-nums">{int(e.stats.cta)}</dd>
              </dl>
            ) : <p className="text-xs text-muted-foreground" title="Nenhum evento de presença nesta live">—</p>}
          </Card>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Ligar as abas**

Em `src/components/marketing/MarketingDashboard.tsx`: importar `ApplicationsTab` e `LiveTab`; no grupo `leads` de `GROUPS`, deixar `tabs: [{ key: 'pesquisa', label: 'Pesquisa' }, { key: 'aplicacoes', label: 'Aplicações' }, { key: 'aovivo', label: 'Ao vivo' }]`; e acrescentar dentro do `<Tabs>`:

```tsx
                <TabsContent value="aplicacoes"><ApplicationsTab query={query} /></TabsContent>
                <TabsContent value="aovivo"><LiveTab query={query} /></TabsContent>
```

- [ ] **Step 6: Verificar**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: PASS.

Manual:
- Leads → Aplicações: KPIs, chips de origem (ex.: "Plataforma (ao vivo)") + barras por origem, tabela por webinário, perfil em 3 colunas. "Lista de aplicações" só busca ao abrir (no DevTools aparece uma chamada `…&lists=1`); fechada, a resposta da aba não tem nomes (`list: null`).
- Leads → Ao vivo com uma edição: KPIs, curva com a linha tracejada do pitch (~66 min), histograma colorido, cartão da edição. Com duas edições: uma linha por edição e legenda.
- Por edição, o cartão "Pessoas" é igual ao número de cadastros distintos com presença naquela live. Conferir uma edição (trocar a data `AAAA-MM-DD` pela data da live):

```bash
node -e "process.stdout.write(JSON.stringify({query: \"select count(distinct registration_id) from events where edition_id = 'AAAA-MM-DD' and type in ('enter_live','heartbeat')\"}))" > "$TEMP/q.json"
curl -s -X POST "https://api.supabase.com/v1/projects/iuxdimqnjyweipawytzl/database/query" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data @"$TEMP/q.json"; rm "$TEMP/q.json"
```

  Expected: o `count` é exatamente o valor de "Pessoas" no cartão da edição. Edição com `count` = 0 mostra "—" no cartão e o texto "Sem presença registrada…" quando nenhuma edição selecionada tem presença.
- Abrir Ao vivo, ir para outra aba e voltar: no DevTools não há nova chamada `?tab=aovivo`. Uma live já passada, pedida de novo depois de Atualizar, responde mais rápido que a primeira (presença em memória).

- [ ] **Step 7: Commit**

```bash
git add src/lib/marketing/sources/platform.ts src/lib/marketing/tabs.ts src/components/marketing/ApplicationsTab.tsx src/components/marketing/LiveTab.tsx src/components/marketing/MarketingDashboard.tsx
git commit -m "feat(marketing): Aplicações and Ao vivo tabs"
```

---

### Task 14: Aba Agendamentos

**Files:**
- Modify: `src/lib/marketing/tabs.ts`
- Create: `src/components/marketing/DealsTab.tsx`
- Modify: `src/components/marketing/MarketingDashboard.tsx`

**Interfaces:**
- Consumes: `buildDeals`, `dealsTab`, `Deal`, `DealsTab`, `CatCounts`, `STATUS_LABEL`, `DealStatus` (Task 6); `filterAds` (Task 9); `getMarketingSettings().metaCampaignFilter` (Task 10); `loadAdDays` (store); `toSaleRows`, `toScheduleRows` (Task 1).
- Produces: aba `agendamentos` (`DealsTab`); helpers internos em `tabs.ts`: `deals(c: Ctx): Deal[]`, `adsOf(c: Ctx): Promise<{ ads: MetaAdDay[]; filter: string }>`, `spendByEdition(c: Ctx, ads: MetaAdDay[]): Record<number, number | null>` — NF10K (#015–#020) sempre "Investimento Total" da Visão Geral; pago: Meta filtrado, senão Visão Geral, senão null (reusados nas Tasks 17 e 18); componente `DealsTab({ query })`.

- [ ] **Step 1: `tabs.ts` — agendamentos**

Em `src/lib/marketing/tabs.ts` (cada estado intermediário compila: o plano foi verificado aplicando as Tasks 12–18 em sequência):

1. Substituir o bloco de imports do topo (todas as linhas `import`) por:

```ts
import type { CaptureRow, DateRange, EditionConfig, MetaAdDay, OverviewRow, SurveyRow } from './types.ts';
import { toApplicationRows, toCaptureRows, toOverviewRows, toSaleRows, toScheduleRows, toSurveyRows, type TabKey } from './sheet-rows.ts';
import { buildEditions, cycleStartAt, editionKind, indexCaptures } from './editions.ts';
import { inRange } from './metrics.ts';
import { latestSurveys, surveyTab, type SurveyTab } from './survey.ts';
import { applicationsTab, buildApplications, type Application, type ApplicationsTab } from './applications.ts';
import { liveStats, liveTotals, presenceFromEvents, type LiveStats, type LiveTab } from './live.ts';
import { buildDeals, dealsTab, type Deal, type DealsTab } from './deals.ts';
import { filterAds } from './full-funnel.ts';
import { getMarketingSettings } from './settings.ts';
import { TAB_TITLES } from './sync.ts';
import { loadAdDays, loadEditionOverrides, loadSnapshotTimes, loadSnapshots } from './store.ts';
import { loadLive } from './sources/platform.ts';
```

2. Substituir a declaração de `PANEL_TABS` por:

```ts
export const PANEL_TABS = [
  'pesquisa', 'aplicacoes', 'aovivo', 'agendamentos',
] as const;
```

3. Dentro de `export type TabData = { … }`, acrescentar ao fim:

```ts
  agendamentos: DealsTab;
```

4. Dentro de `const NEEDS = { … }`, acrescentar ao fim:

```ts
  agendamentos: ['capture', 'schedule', 'sales', 'survey'],
```

5. Logo antes de `type Builder<K extends PanelTab>`, acrescentar:

```ts
function deals(c: Ctx): Deal[] {
  return buildDeals(typed(c.snap.schedule, toScheduleRows), typed(c.snap.sales, toSaleRows), indexCaptures(c.captures), c.surveys, c.editions, c.today);
}

// Anúncios das janelas selecionadas, só das campanhas que passam no filtro.
async function adsOf(c: Ctx): Promise<{ ads: MetaAdDay[]; filter: string }> {
  const settings = await getMarketingSettings();
  if (!c.eds.length) return { ads: [], filter: settings.metaCampaignFilter };
  const from = c.eds.reduce((m, e) => (e.windowStart < m ? e.windowStart : m), c.eds[0].windowStart);
  const to = c.eds.reduce((m, e) => (e.windowEnd > m ? e.windowEnd : m), c.eds[0].windowEnd);
  return { ads: filterAds(await loadAdDays(from, to), settings.metaCampaignFilter), filter: settings.metaCampaignFilter };
}

// Gasto oficial da edição. NF10K (#015–#020): "Investimento Total" da Visão Geral, como o dash antigo.
// Pago: Meta (campanhas filtradas) na janela; sem Meta, "Investimento Total"; sem nada, null ("n/d").
function spendByEdition(c: Ctx, ads: MetaAdDay[]): Record<number, number | null> {
  const out: Record<number, number | null> = {};
  c.eds.forEach(e => {
    const ov = c.overview.filter(o => o.edition === e.number)[0];
    const sheet = ov && ov.investment > 0 ? ov.investment : null;
    if (editionKind(e.number) !== 'pago') { out[e.number] = sheet; return; }
    const meta = ads.filter(a => a.date >= e.windowStart && a.date <= e.windowEnd).reduce((s, a) => s + a.spend, 0);
    out[e.number] = meta > 0 ? Math.round(meta * 100) / 100 : sheet;
  });
  return out;
}
```

6. Dentro de `const BUILDERS = { … }`, acrescentar ao fim (antes do `};`):

```ts
  agendamentos: async (c, o) => dealsTab(deals(c), c.eds, spendByEdition(c, (await adsOf(c)).ads), c.range, o.lists),
```

- [ ] **Step 2: Componente Agendamentos**

Criar `src/components/marketing/DealsTab.tsx`:

```tsx
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { STATUS_LABEL, type CatCounts, type CostRow, type DealStatus, type DealsTab as Data } from '@/lib/marketing/deals';
import { useTabData } from './useTabData';
import { BarList, Kpi, PeopleList, TabState, brl, dm, ed, int, kpiGrid, pct, ratio, sectionTitle } from './ui';

const CATS: [Exclude<keyof CatCounts, 'total'>, string, string][] = [
  ['perdSem', 'perd. sem call', 'text-red-300'], ['perdCall', 'perd. após call', 'text-red-300'],
  ['andamento', 'em andamento', 'text-emerald-300'], ['ganho', 'ganho', 'text-amber-300'], ['aberto', 'em aberto', 'text-muted-foreground'],
];
const TONE = { red: 'bg-red-400', yellow: 'bg-amber-400', green: 'bg-emerald-400' };

function MomentCell({ c, total }: { c: CatCounts; total: number }) {
  if (!c.total) return <TableCell className="text-center text-muted-foreground">·</TableCell>;
  return (
    <TableCell className="text-center text-xs">
      <b className="tabular-nums">{c.total}</b> <span className="text-muted-foreground">{pct(ratio(c.total, total))}</span>
      <br />{CATS.filter(([k]) => c[k]).map(([k, l, cls]) => <span key={k} className={`mr-1 ${cls}`}>{c[k]} {l}</span>)}
    </TableCell>
  );
}

function CostCells({ r }: { r: CostRow }) {
  const nd = <span className="text-muted-foreground" title="Edição sem gasto oficial: fica fora do total">n/d</span>;
  const c = (v: number | null) => (r.spend === null ? nd : brl(v));
  return (
    <>
      <TableCell className="text-right tabular-nums">{r.spend === null ? nd : brl(r.spend)}</TableCell>
      <TableCell className="text-right tabular-nums">{r.n}</TableCell>
      <TableCell className="text-right tabular-nums text-amber-300">{r.power}</TableCell>
      <TableCell className="text-right tabular-nums text-sky-300">{r.start}</TableCell>
      <TableCell className="text-right font-semibold tabular-nums">{c(r.cost)}</TableCell>
      <TableCell className="text-right tabular-nums">{c(r.costPower)}</TableCell>
      <TableCell className="text-right tabular-nums">{c(r.costStart)}</TableCell>
    </>
  );
}

export default function DealsTab({ query }: { query: string }) {
  const { data: d, loading, error } = useTabData<Data>('agendamentos', query);
  if (!d) return <TabState loading={loading} error={error} />;
  const momentTotal = (m: { before: CatCounts; onDay: CatCounts; after: CatCounts }) => m.before.total + m.onDay.total + m.after.total;
  const statusBars = d.status.map(s => ({ key: STATUS_LABEL[s.key as DealStatus] ?? s.key, count: s.count }));
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <section>
        <h2 className={sectionTitle}>Agendamentos (Pipedrive)</h2>
        <div className={kpiGrid}>
          <Kpi label="Agendamentos" value={int(d.total)} hint={`Power ${d.power} · Start ${d.start} · ${d.auto} automáticos · ${d.commercial} comercial`} />
          <Kpi label="Calls realizadas" value={int(d.realized)} hint={`${pct(d.attendance)} de comparecimento`} />
          <Kpi label="Não compareceram" value={int(d.noShow)} hint={`${pct(ratio(d.noShow, d.total))} dos agendamentos`} />
          <Kpi label="Aguardando" value={int(d.waiting)} hint={`call futura, reagendada ou sem registro${d.cancelled ? ` · ${d.cancelled} canceladas` : ''}`} />
          <Kpi label="Perdas" value={int(d.lost)} hint={d.lostByReason.map(r => `${r.key} ${r.count}`).join(' · ') || 'sem motivo registrado'} />
          <Kpi label="Ganhos" value={int(d.won)} hint={`${brl(d.wonRevenue)} · ${pct(d.wonRate)} das calls${d.refunded ? ` · ${d.refunded} reembolsados` : ''}`} />
          <Kpi label="Origem identificada" value={int(d.total)} hint={`${d.origin.planilha} planilha · ${d.origin.email} e-mail · ${d.origin.data} data · ${d.noEdition} sem edição`} />
          <Kpi label="Com alerta" value={int(d.alertCount)} hint="call >14 dias, antes do agendamento, sem registro ou sem closer" />
        </div>
      </section>

      <section>
        <h2 className={sectionTitle}>Quando agendaram × resultado</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Webinário</TableHead><TableHead className="text-center">Antes</TableHead><TableHead className="text-center">No dia</TableHead><TableHead className="text-center">Depois</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {d.moment.concat(d.moment.length > 1 ? [{ edition: 0, ...d.momentTotal }] : []).map(m => (
                <TableRow key={m.edition} className={m.edition === 0 ? 'font-semibold' : ''}>
                  <TableCell>{m.edition === 0 ? 'Total' : ed(m.edition)} <span className="text-muted-foreground">{momentTotal(m)}</span></TableCell>
                  <MomentCell c={m.before} total={momentTotal(m)} /><MomentCell c={m.onDay} total={momentTotal(m)} /><MomentCell c={m.after} total={momentTotal(m)} />
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <h2 className={sectionTitle}>Criativos que mais perdem agendamento <span className="font-normal normal-case tracking-normal">· 3+ agendamentos</span></h2>
        <p className="mb-2 text-xs text-muted-foreground">{int(d.lostBeforeCall)} de {int(d.total)} sumiram antes da call ({pct(ratio(d.lostBeforeCall, d.total))}).</p>
        {d.losingCreatives.length ? (
          <ul className="flex flex-col gap-2">
            {d.losingCreatives.map(c => (
              <li key={c.creative} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-2 text-xs sm:grid-cols-[14rem_3rem_minmax(0,1fr)_12rem]">
                <span className="truncate font-medium" title={c.creative}>{c.creative} <span className="font-normal text-muted-foreground">· {c.n} agend. · {c.calls} calls{c.won ? ` · ${c.won} ganhos` : ''}</span></span>
                <span className="text-right font-semibold tabular-nums">{pct(c.rate, 0)}</span>
                <span aria-hidden className="hidden h-2.5 rounded-full bg-muted sm:block"><span className={`block h-full rounded-full ${TONE[c.tone]}`} style={{ width: `${c.rate * 100}%` }} /></span>
                <span className="hidden text-right text-muted-foreground sm:inline">{c.noShow} no-show · {c.noInterest} sem int. · {c.cancelled} canc.</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-muted-foreground">Ainda não há criativo com 3 ou mais agendamentos.</p>}
      </section>

      <section>
        <h2 className={sectionTitle}>Custo por call por webinário</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Webinário</TableHead><TableHead className="text-right">Gasto oficial</TableHead><TableHead className="text-right">Calls</TableHead>
              <TableHead className="text-right">Power</TableHead><TableHead className="text-right">Start</TableHead><TableHead className="text-right">Por call</TableHead>
              <TableHead className="text-right">Por call Power</TableHead><TableHead className="text-right">Por call Start</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {d.costPerCall.rows.map(r => <TableRow key={r.edition ?? 'x'}><TableCell>{ed(r.edition as number)}</TableCell><CostCells r={r} /></TableRow>)}
              <TableRow className="font-semibold"><TableCell>Total (com gasto e calls)</TableCell><CostCells r={d.costPerCall.total} /></TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        {([['Webinário de origem', d.byEdition], ['Como agendou', d.via], ['Closer', d.closer], ['Status', statusBars]] as [string, { key: string; count: number }[]][]).map(([t, xs]) => (
          <div key={t}><h2 className={sectionTitle}>{t}</h2><BarList items={xs} total={d.total} /></div>
        ))}
      </section>

      <PeopleList<Data> tab="agendamentos" query={query} title={`Tabela de agendamentos (${d.total})`} render={x => x.list && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Agendou</TableHead><TableHead>Call</TableHead><TableHead>Via</TableHead>
              <TableHead>Status</TableHead><TableHead>Closer</TableHead><TableHead>Produto</TableHead><TableHead>Renda</TableHead>
              <TableHead>Webinário</TableHead><TableHead>Criativo</TableHead><TableHead>Motivo da perda</TableHead><TableHead>Alertas</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {x.list.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.name || '—'}</TableCell><TableCell>{r.type || '—'}</TableCell>
                  <TableCell>{dm(r.scheduledAt)}</TableCell><TableCell>{dm(r.callDate)}</TableCell><TableCell>{r.via || '—'}</TableCell>
                  <TableCell>{STATUS_LABEL[r.status]}</TableCell><TableCell>{r.closer || '—'}</TableCell><TableCell>{r.product || '—'}</TableCell>
                  <TableCell>{r.income || '—'}</TableCell><TableCell>{r.edition === null ? '—' : ed(r.edition)}</TableCell>
                  <TableCell className="text-xs">{r.creative || '—'}</TableCell><TableCell className="text-red-300">{r.lostReason}</TableCell>
                  <TableCell className="text-xs text-amber-300">{r.alerts.join(' · ')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )} />
    </div>
  );
}
```

- [ ] **Step 3: Ligar a aba**

Em `MarketingDashboard.tsx`: importar `DealsTab`; acrescentar a `GROUPS`, depois de `leads`, o grupo `{ key: 'comercial', label: 'Comercial', tabs: [{ key: 'agendamentos', label: 'Agendamentos' }] }`; e dentro do `<Tabs>`:

```tsx
                <TabsContent value="agendamentos"><DealsTab query={query} /></TabsContent>
```

- [ ] **Step 4: Verificar**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: PASS.

Manual:
- Comercial → Agendamentos com #020: aparecem total, Power/Start, realizadas, não compareceram, perdas e ganhos. (**Verificação do usuário**, não do implementador: comparar com o dash antigo, só com agendamentos até 06/10/2026 — ver exceções esperadas na Task 20.)
- "Quando agendaram × resultado" com cores por categoria; linha Total só com 2+ edições.
- "Custo por call": edições #015–#020 mostram o "Investimento Total" da Visão Geral; edição paga sem Meta também; edição sem nada mostra "n/d" com hover explicando e fica fora do total.
- "Tabela de agendamentos" só carrega ao abrir.

- [ ] **Step 5: Commit**

```bash
git add src/lib/marketing/tabs.ts src/components/marketing/DealsTab.tsx src/components/marketing/MarketingDashboard.tsx
git commit -m "feat(marketing): Agendamentos tab (status, moment, losing creatives, cost per call)"
```

---

### Task 15: Abas Vendas e Compradores

**Files:**
- Modify: `src/lib/marketing/tabs.ts`
- Create: `src/components/marketing/SalesTab.tsx`
- Create: `src/components/marketing/BuyersTab.tsx`
- Modify: `src/components/marketing/MarketingDashboard.tsx`

**Interfaces:**
- Consumes: `salesTab`, `buyersTab`, `SalesTab`, `BuyersTab`, `SaleListItem`, `AUDIENCES` (Task 5); `ChallengesView` (Task 12); `toSaleRows` (Task 1).
- Produces: abas `vendas` (`SalesTab`) e `compradores` (`BuyersTab`, parâmetro `&produto=todos|power|powerStart|desafio`); helper interno `salesOf(c: Ctx): SaleRow[]` (vendas das edições selecionadas no período; reusado nas Tasks 16 e 18); componentes `SalesTab({ query })`, `BuyersTab({ query })`.

- [ ] **Step 1: `tabs.ts` — vendas e compradores**

Em `src/lib/marketing/tabs.ts` (cada estado intermediário compila: o plano foi verificado aplicando as Tasks 12–18 em sequência):

1. Substituir o bloco de imports do topo (todas as linhas `import`) por:

```ts
import type { CaptureRow, DateRange, EditionConfig, MetaAdDay, OverviewRow, SaleRow, SurveyRow } from './types.ts';
import { toApplicationRows, toCaptureRows, toOverviewRows, toSaleRows, toScheduleRows, toSurveyRows, type TabKey } from './sheet-rows.ts';
import { buildEditions, cycleStartAt, editionKind, indexCaptures } from './editions.ts';
import { inRange } from './metrics.ts';
import { latestSurveys, surveyTab, type SurveyTab } from './survey.ts';
import { applicationsTab, buildApplications, type Application, type ApplicationsTab } from './applications.ts';
import { liveStats, liveTotals, presenceFromEvents, type LiveStats, type LiveTab } from './live.ts';
import { buildDeals, dealsTab, type Deal, type DealsTab } from './deals.ts';
import { buyersTab, salesTab, type BuyersTab, type SalesTab } from './sales.ts';
import { filterAds } from './full-funnel.ts';
import { getMarketingSettings } from './settings.ts';
import { TAB_TITLES } from './sync.ts';
import { loadAdDays, loadEditionOverrides, loadSnapshotTimes, loadSnapshots } from './store.ts';
import { loadLive } from './sources/platform.ts';
```

2. Substituir a declaração de `PANEL_TABS` por:

```ts
export const PANEL_TABS = [
  'pesquisa', 'aplicacoes', 'aovivo', 'agendamentos', 'vendas', 'compradores',
] as const;
```

3. Dentro de `export type TabData = { … }`, acrescentar ao fim:

```ts
  vendas: SalesTab;
  compradores: BuyersTab;
```

4. Dentro de `const NEEDS = { … }`, acrescentar ao fim:

```ts
  vendas: ['capture', 'sales'],
  compradores: ['capture', 'sales', 'survey'],
```

5. Logo antes de `type Builder<K extends PanelTab>`, acrescentar:

```ts
// Vendas high ticket das edições selecionadas; com período, só as datadas dentro dele.
function salesOf(c: Ctx): SaleRow[] {
  return typed(c.snap.sales, toSaleRows).filter(s => inSel(c, s.edition) && inRange(day(s.at), c.range));
}
```

6. Dentro de `const BUILDERS = { … }`, acrescentar ao fim (antes do `};`):

```ts
  vendas: (c, o) => salesTab(c.leads, salesOf(c), o.lists),
  compradores: (c, o) => buyersTab(salesOf(c), c.surveys, o.produto, o.lists),
```

- [ ] **Step 2: Componente Vendas**

Criar `src/components/marketing/SalesTab.tsx`:

```tsx
'use client';

import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AUDIENCES, type SaleListItem, type SalesTab as Data } from '@/lib/marketing/sales';
import { useTabData } from './useTabData';
import { BarList, DistChart, Kpi, PeopleList, TabState, brl, dm, ed, int, kpiGrid, pct, sectionTitle } from './ui';

export default function SalesTab({ query }: { query: string }) {
  const { data: d, loading, error } = useTabData<Data>('vendas', query);
  if (!d) return <TabState loading={loading} error={error} />;
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <section>
        <h2 className={sectionTitle}>Vendas high ticket (Detalhamento Vendas)</h2>
        <div className={kpiGrid}>
          <Kpi label="Vendas aprovadas" value={int(d.sales)} hint={`${d.refunds} reembolsos fora da conta`} />
          <Kpi label="Faturamento" value={brl(d.revenue)} hint="ticket da planilha (vazio = ticket padrão)" />
          <Kpi label="Ticket médio" value={brl(d.avgTicket)} why="Sem vendas na seleção" />
          <Kpi label="Conversão geral" value={pct(d.conversion, 2)} hint={`${d.sales} vendas em ${int(d.leads)} leads`} why="Sem leads na seleção" />
        </div>
      </section>

      <section>
        <h2 className={sectionTitle}>Por público <span className="font-normal normal-case tracking-normal">· UTM de captação (passe o mouse para a regra)</span></h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {d.audiences.map(a => (
            <Card key={a.key} size="sm" className="gap-2 px-4" title={`Regra: ${a.rule}\n\nTop campanhas:\n${a.topCampaigns.map(c => `${c.count}× ${c.key}`).join('\n')}`}>
              <p className="text-xs font-semibold">{a.label}</p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Leads</dt><dd className="text-right tabular-nums">{int(a.leads)}</dd>
                <dt className="text-muted-foreground">Vendas</dt><dd className="text-right tabular-nums">{int(a.sales)}</dd>
                <dt className="text-muted-foreground">Conversão</dt><dd className="text-right tabular-nums" title={a.conversion === null ? 'Sem leads deste público' : undefined}>{pct(a.conversion, 2)}</dd>
                <dt className="text-muted-foreground">Faturamento</dt><dd className="text-right tabular-nums">{brl(a.revenue)}</dd>
                {a.refunds > 0 && <><dt className="text-red-300">Reembolsos</dt><dd className="text-right tabular-nums text-red-300">{a.refunds}</dd></>}
              </dl>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div><h2 className={sectionTitle}>Por produto</h2><BarList items={d.byProduct} total={d.sales} /></div>
        <Card className="p-4"><h2 className={sectionTitle}>Vendas por dia</h2><DistChart data={d.byDay.map(x => ({ label: dm(x.key), count: x.count }))} label="Vendas" /></Card>
        <div><h2 className={sectionTitle}>Origem do lead (captação)</h2><BarList items={d.leadOrigin} total={d.sales} /></div>
        <div><h2 className={sectionTitle}>Origem da compra</h2><BarList items={d.purchaseOrigin} total={d.sales} /></div>
      </section>

      <PeopleList<Data> tab="vendas" query={query} title="Vendas por público (nomes)" render={x => x.lists && (
        <div className="flex flex-col gap-4">
          {AUDIENCES.map(a => {
            const list: SaleListItem[] = (x.lists && x.lists[a.key]) || [];
            if (!list.length) return null;
            return (
              <div key={a.key}>
                <p className="mb-1 text-xs font-semibold">{a.label} ({list.length})</p>
                <Table>
                  <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Webinário</TableHead><TableHead>Produto</TableHead><TableHead>source · medium · campaign</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {list.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{s.name || '—'}</TableCell>
                        <TableCell>{s.edition === null ? '—' : ed(s.edition)}</TableCell>
                        <TableCell>{s.product || '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{[s.capSource, s.capMedium, s.capCampaign].map(v => v || '(sem)').join(' · ')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )} />
    </div>
  );
}
```

- [ ] **Step 3: Componente Compradores**

Criar `src/components/marketing/BuyersTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { BuyersTab as Data } from '@/lib/marketing/sales';
import { ChallengesView } from './SurveyTab';
import { useTabData } from './useTabData';
import { BarList, Kpi, PeopleList, TabState, dm, ed, int, kpiGrid, pct, ratio, sectionTitle } from './ui';

const FILTERS: [string, string][] = [['todos', 'Todos'], ['power', 'Power'], ['powerStart', 'Power Start'], ['desafio', 'Desafio']];

export default function BuyersTab({ query }: { query: string }) {
  const [produto, setProduto] = useState('todos');
  const extra = `&produto=${produto}`;
  const { data: d, loading, error } = useTabData<Data>('compradores', query, extra);
  if (!d) return <TabState loading={loading} error={error} />;
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <div role="group" aria-label="Produto" className="inline-flex h-8 w-fit items-center rounded-lg border border-border bg-input/20 p-0.5">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={produto === k} onClick={() => setProduto(k)}
            className={`h-7 rounded-md px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 ${produto === k ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>
        ))}
      </div>

      <section>
        <h2 className={sectionTitle}>Compradores × pesquisa</h2>
        <div className={kpiGrid}>
          <Kpi label="Compradores" value={int(d.buyers)} hint={`${d.responded} responderam a pesquisa (${pct(ratio(d.responded, d.buyers), 0)})`} />
          <Kpi label="Qualificados 5k+" value={int(d.qualified)} hint={`${pct(ratio(d.qualified, d.responded), 0)} dos respondentes`} />
          <Kpi label="Renda mais comum" value={d.topIncome ? d.topIncome.key : '—'} hint={d.topIncome ? `${d.topIncome.count} compradores` : undefined} why="Nenhum comprador respondeu" />
          <Kpi label="Serviço mais comum" value={d.topService ? d.topService.key : '—'} hint={d.topService ? `${d.topService.count} compradores` : undefined} why="Nenhum comprador respondeu" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {([['Renda familiar', d.profile.renda], ['Faturamento com fotografia', d.profile.fat], ['Tempo de fotografia', d.profile.tempo], ['Serviço carro-chefe', d.profile.servico]] as [string, { key: string; count: number }[]][]).map(([t, xs]) => (
          <div key={t}><h2 className={sectionTitle}>{t}</h2><BarList items={xs} total={d.responded} empty="Nenhum comprador respondeu." /></div>
        ))}
      </section>

      <section>
        <h2 className={sectionTitle}>Desafios dos compradores</h2>
        <ChallengesView data={d.challenges} />
      </section>

      <PeopleList<Data> tab="compradores" query={query} extra={extra} title={`Lista de compradores (${d.buyers})`} render={x => x.list && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Webinário</TableHead><TableHead>Produto</TableHead><TableHead>Data</TableHead>
              <TableHead>Renda</TableHead><TableHead>Fat. mensal</TableHead><TableHead>Tempo de foto</TableHead><TableHead>Serviço</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {x.list.map((b, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{b.name || '—'}</TableCell>
                  <TableCell>{b.edition === null ? '—' : ed(b.edition)}</TableCell>
                  <TableCell>{b.product || '—'}</TableCell>
                  <TableCell>{dm(b.at)}</TableCell>
                  <TableCell className={b.qualified ? 'font-semibold text-emerald-400' : ''}>{b.income || '—'}</TableCell>
                  <TableCell>{b.revenue || '—'}</TableCell><TableCell>{b.tempo || '—'}</TableCell><TableCell>{b.servico || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )} />
    </div>
  );
}
```

- [ ] **Step 4: Ligar as abas**

Em `MarketingDashboard.tsx`: importar `SalesTab` e `BuyersTab`; no grupo `comercial`, `tabs: [{ key: 'agendamentos', label: 'Agendamentos' }, { key: 'vendas', label: 'Vendas' }, { key: 'compradores', label: 'Compradores' }]`; e:

```tsx
                <TabsContent value="vendas"><SalesTab query={query} /></TabsContent>
                <TabsContent value="compradores"><BuyersTab query={query} /></TabsContent>
```

- [ ] **Step 5: Verificar**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: PASS.

Manual:
- Comercial → Vendas com #018–#020: "Vendas aprovadas" = linhas do Detalhamento Vendas dessas edições cujo STATUS não é reembolso/estorno/cancelamento; reembolsos aparecem só no texto auxiliar. (**Verificação do usuário**: comparar com o dash antigo — ver Task 20.)
- Cartões por público com a regra no hover; "Outros" não aparece.
- Compradores: alternar Todos/Power/Power Start/Desafio recarrega; a lista abre só ao expandir e respeita o produto escolhido.

- [ ] **Step 6: Commit**

```bash
git add src/lib/marketing/tabs.ts src/components/marketing/SalesTab.tsx src/components/marketing/BuyersTab.tsx src/components/marketing/MarketingDashboard.tsx
git commit -m "feat(marketing): Vendas and Compradores tabs"
```

---

### Task 16: Abas API e Disparos (com rota CRUD e editor)

**Files:**
- Modify: `src/lib/marketing/tabs.ts`
- Create: `src/app/api/marketing/disparos/route.ts`
- Create: `src/components/marketing/ApiTab.tsx`
- Create: `src/components/marketing/DisparosTab.tsx`
- Modify: `src/components/marketing/MarketingDashboard.tsx`

**Interfaces:**
- Consumes: `apiTab`, `ApiTab` (Task 7); `disparosTab`, `DisparosTab`, `Disparo`, `DisparoBlock`, `DisparoInput`, `parseDisparoInput`, `formatNumberInput`, `parseNumberInput` (Task 7); `loadDisparos`, `insertDisparo`, `updateDisparo`, `deleteDisparo` (Task 10); `salesOf` (Task 15).
- Produces: abas `api` e `disparos`; rota `POST /api/marketing/disparos` (corpo `DisparoInput`) → `{ row }`, `PATCH ?id=<uuid>` (corpo parcial) → `{ ok: true }`, `DELETE ?id=<uuid>` → `{ ok: true }` (sem GET: a leitura é `?tab=disparos`; erro do banco vai para o log e o navegador recebe "Falha ao salvar"); editor usa `formatNumberInput`/`parseNumberInput` da Task 7; componentes `ApiTab({ query })`, `DisparosTab({ query })`.

- [ ] **Step 1: `tabs.ts` — api e disparos**

Em `src/lib/marketing/tabs.ts` (cada estado intermediário compila: o plano foi verificado aplicando as Tasks 12–18 em sequência):

1. Substituir o bloco de imports do topo (todas as linhas `import`) por:

```ts
import type { CaptureRow, DateRange, EditionConfig, MetaAdDay, OverviewRow, SaleRow, SurveyRow } from './types.ts';
import { toApplicationRows, toCaptureRows, toOverviewRows, toSaleRows, toScheduleRows, toSurveyRows, type TabKey } from './sheet-rows.ts';
import { buildEditions, cycleStartAt, editionKind, indexCaptures } from './editions.ts';
import { inRange } from './metrics.ts';
import { latestSurveys, surveyTab, type SurveyTab } from './survey.ts';
import { applicationsTab, buildApplications, type Application, type ApplicationsTab } from './applications.ts';
import { liveStats, liveTotals, presenceFromEvents, type LiveStats, type LiveTab } from './live.ts';
import { buildDeals, dealsTab, type Deal, type DealsTab } from './deals.ts';
import { buyersTab, salesTab, type BuyersTab, type SalesTab } from './sales.ts';
import { apiTab, type ApiTab } from './api-leads.ts';
import { disparosTab, type DisparosTab } from './disparos.ts';
import { filterAds } from './full-funnel.ts';
import { getMarketingSettings } from './settings.ts';
import { TAB_TITLES } from './sync.ts';
import { loadAdDays, loadDisparos, loadEditionOverrides, loadSnapshotTimes, loadSnapshots } from './store.ts';
import { loadLive } from './sources/platform.ts';
```

2. Substituir a declaração de `PANEL_TABS` por:

```ts
export const PANEL_TABS = [
  'pesquisa', 'aplicacoes', 'aovivo', 'agendamentos', 'vendas', 'compradores', 'api', 'disparos',
] as const;
```

3. Dentro de `export type TabData = { … }`, acrescentar ao fim:

```ts
  api: ApiTab;
  disparos: DisparosTab;
```

4. Dentro de `const NEEDS = { … }`, acrescentar ao fim:

```ts
  api: ['capture', 'survey', 'sales'],
  disparos: [],
```

5. Dentro de `const BUILDERS = { … }`, acrescentar ao fim (antes do `};`):

```ts
  api: c => apiTab(c.leads, c.surveys, salesOf(c)),
  disparos: async c => disparosTab(await loadDisparos(), c.range),
```

- [ ] **Step 2: Rota CRUD de disparos**

Criar `src/app/api/marketing/disparos/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminFromRequest } from '@/lib/auth';
import { parseDisparoInput, type DisparoInput } from '@/lib/marketing/disparos';
import { deleteDisparo, insertDisparo, updateDisparo } from '@/lib/marketing/store';

export const dynamic = 'force-dynamic';

// A leitura dos disparos vem de /api/marketing/data?tab=disparos; aqui só escrita.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const deny = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
// Erro do banco fica no log do servidor; o navegador recebe só uma mensagem genérica.
const fail = (what: string, e: unknown) => {
  console.error(`marketing disparos ${what}`, e);
  return NextResponse.json({ error: 'Falha ao salvar' }, { status: 500 });
};

export async function POST(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) return deny();
  const parsed = parseDisparoInput(await req.json().catch(() => null), false);
  if (!parsed.ok) return bad(parsed.error);
  try { return NextResponse.json({ row: await insertDisparo(parsed.value as DisparoInput) }); } catch (e) { return fail('insert', e); }
}

export async function PATCH(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) return deny();
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!UUID.test(id)) return bad('id inválido');
  const parsed = parseDisparoInput(await req.json().catch(() => null), true);
  if (!parsed.ok) return bad(parsed.error);
  if (!Object.keys(parsed.value).length) return bad('Nada para salvar');
  try { await updateDisparo(id, parsed.value); return NextResponse.json({ ok: true }); } catch (e) { return fail('update', e); }
}

// Remove só uma linha de mkt_disparos; nada mais é apagado.
export async function DELETE(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) return deny();
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!UUID.test(id)) return bad('id inválido');
  try { await deleteDisparo(id); return NextResponse.json({ ok: true }); } catch (e) { return fail('delete', e); }
}
```

- [ ] **Step 3: Componente API**

Criar `src/components/marketing/ApiTab.tsx`:

```tsx
'use client';

import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ApiAgg, ApiTab as Data } from '@/lib/marketing/api-leads';
import { useTabData } from './useTabData';
import { BarList, DistChart, Kpi, TabState, brl, dm, int, kpiGrid, pct, ratio, sectionTitle } from './ui';

const bars = (xs: ApiAgg[]) => xs.map(x => ({ key: x.key, count: x.leads, note: `${x.qualified} qualif. (${pct(ratio(x.qualified, x.leads), 0)})` }));

export default function ApiTab({ query }: { query: string }) {
  const { data: d, loading, error } = useTabData<Data>('api', query);
  if (!d) return <TabState loading={loading} error={error} />;
  if (!d.leads) return <p className="py-12 text-center text-sm text-muted-foreground">Nenhum lead com utm_source = api nas edições selecionadas.</p>;
  const cell = (b: string, v: string) => d.matrix[`${b}|${v}`];
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <section>
        <h2 className={sectionTitle}>Leads via API (WhatsApp)</h2>
        <div className={kpiGrid}>
          <Kpi label="Leads via API" value={int(d.leads)} hint={`${pct(ratio(d.leads, d.totalLeads))} dos ${int(d.totalLeads)} leads${d.bestDay ? ` · melhor dia ${dm(d.bestDay.key)} (${d.bestDay.count})` : ''}`} />
          <Kpi label="Qualificados 5k+" value={int(d.qualified)} hint={`${pct(ratio(d.qualified, d.leads))} · ${d.responded} responderam`} />
          <Kpi label="Bases" value={int(d.bases.length)} hint={d.bases.slice(0, 3).map(b => `${b.key} ${b.leads}`).join(' · ')} />
          <Kpi label="Versões" value={int(d.versions.length)} hint={d.versions.map(v => `${v.key} ${v.leads}`).join(' · ')} />
          <Kpi label="Vendas" value={int(d.sales)} hint={d.sales ? brl(d.revenue) : 'nenhuma venda de lead da API'} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div><h2 className={sectionTitle}>Por base</h2><BarList items={bars(d.bases)} total={d.leads} /></div>
        <div><h2 className={sectionTitle}>Por versão</h2><BarList items={bars(d.versions)} total={d.leads} /></div>
        <div><h2 className={sectionTitle}>Por disparo</h2><BarList items={bars(d.shots)} total={d.leads} /></div>
      </section>

      <section>
        <h2 className={sectionTitle}>Base × versão <span className="font-normal normal-case tracking-normal">· leads (qualificados)</span></h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Base</TableHead>
              {d.versions.map(v => <TableHead key={v.key} className="text-center">{v.key}</TableHead>)}
              <TableHead className="text-center">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {d.bases.map(b => (
                <TableRow key={b.key}>
                  <TableCell className="font-medium">{b.key}</TableCell>
                  {d.versions.map(v => {
                    const c = cell(b.key, v.key);
                    return <TableCell key={v.key} className="text-center tabular-nums">{c ? <>{c.leads} <span className="text-emerald-400">({c.qualified})</span></> : <span className="text-muted-foreground">·</span>}</TableCell>;
                  })}
                  <TableCell className="text-center font-semibold tabular-nums">{b.leads} <span className="text-emerald-400">({b.qualified})</span></TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell>Total</TableCell>
                {d.versions.map(v => <TableCell key={v.key} className="text-center tabular-nums">{v.leads} <span className="text-emerald-400">({v.qualified})</span></TableCell>)}
                <TableCell className="text-center tabular-nums">{d.leads} <span className="text-emerald-400">({d.qualified})</span></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      <Card className="p-4">
        <h2 className={sectionTitle}>Leads via API por dia</h2>
        <DistChart data={d.byDay.map(x => ({ label: dm(x.key), count: x.count }))} label="Leads" />
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Componente Disparos (blocos, ranking e tabela editável)**

Criar `src/components/marketing/DisparosTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNumberInput, parseNumberInput as n, type Disparo, type DisparoBlock, type DisparosTab as Data } from '@/lib/marketing/disparos';
import { useTabData } from './useTabData';
import { TabState, brl, dec, dm, int, pct, sectionTitle } from './ui';

type Form = { kind: 'convite' | 'recuperacao'; ciclo: string; nome: string; data: string; contatos: string; agendamentos: string; vendas: string; faturamento: string; custo: string; template: string };
const EMPTY: Form = { kind: 'convite', ciclo: '', nome: '', data: '', contatos: '', agendamentos: '', vendas: '', faturamento: '', custo: '', template: '' };
const s = formatNumberInput; // "16,8": sem milhar, vírgula decimal
const toForm = (r: Disparo): Form => ({
  kind: r.kind, ciclo: r.ciclo ?? '', nome: r.nome, data: r.data ?? '', contatos: s(r.contatos), agendamentos: s(r.agendamentos),
  vendas: s(r.vendas), faturamento: s(r.faturamento), custo: s(r.custo), template: r.template ?? '',
});
// Vazio = null; com vírgula o ponto é milhar, sem vírgula é decimal; texto inválido vira NaN e a API recusa.
const toBody = (f: Form) => ({
  kind: f.kind, ciclo: f.ciclo, nome: f.nome, data: f.data || null, contatos: n(f.contatos), agendamentos: n(f.agendamentos),
  vendas: n(f.vendas), faturamento: n(f.faturamento), custo: n(f.custo), template: f.template,
});
const firstLine = (t: string | null) => (t ? t.split('\n')[0] : '—');

function Block({ title, b, tone }: { title: string; b: DisparoBlock; tone: string }) {
  const stat = (label: string, value: string, sub: string) => (
    <div><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p><p className="text-xl font-semibold tabular-nums">{value}</p><p className="text-[11px] text-muted-foreground">{sub}</p></div>
  );
  return (
    <Card className={`gap-3 border-l-4 p-4 ${tone}`}>
      <p className="text-xs font-bold uppercase tracking-widest">{title}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stat('Orçamento', brl(b.custo), `${int(b.contatos)} contatos · ${b.count} disparos`)}
        {stat('Agendamentos', int(b.agendamentos), b.agendRate === null ? '—' : `${pct(b.agendRate, 2)} dos contatos`)}
        {stat('Custo por agend.', brl(b.costPerAgend), `${brl(b.custo)} ÷ ${int(b.agendamentos)}`)}
        {stat('Vendas', int(b.vendas), b.vendas ? brl(b.faturamento) : 'nenhuma')}
        {stat('ROAS', b.roas === null ? '—' : `${dec(b.roas)}x`, b.faturamento ? `${brl(b.faturamento)} ÷ ${brl(b.custo)}` : 'sem faturamento')}
      </div>
    </Card>
  );
}

export default function DisparosTab({ query }: { query: string }) {
  const [nonce, setNonce] = useState(0);
  const { data: d, loading, error } = useTabData<Data>('disparos', query, `&r=${nonce}`);
  const [editing, setEditing] = useState<string | null>(null); // id, 'new' ou null
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  if (!d) return <TabState loading={loading} error={error} />;

  const open = (r: Disparo | null) => { setEditing(r ? r.id : 'new'); setForm(r ? toForm(r) : EMPTY); setMsg(''); };
  const field = (k: keyof Form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true); setMsg('');
    try {
      const isNew = editing === 'new';
      const res = await fetch(isNew ? '/api/marketing/disparos' : `/api/marketing/disparos?id=${editing}`, {
        method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toBody(form)),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(b.error || 'Não foi possível salvar'); return; }
      setEditing(null); setNonce(x => x + 1); toast.success('Disparo salvo');
    } catch {
      setMsg('Erro de conexão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: Disparo) {
    if (!window.confirm(`Remover o disparo "${r.nome}" (${dm(r.data)})? Isso não pode ser desfeito.`)) return;
    const res = await fetch(`/api/marketing/disparos?id=${r.id}`, { method: 'DELETE' }).catch(() => null);
    if (res && res.ok) { setNonce(x => x + 1); toast.success('Disparo removido'); } else toast.error('Não foi possível remover');
  }

  const max = d.ranking.reduce((m, r) => Math.max(m, r.agendamentos ?? 0), 1);
  const label = 'flex flex-col gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground';
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
      <section className="flex flex-col gap-3">
        <Block title="Convites" b={d.convite} tone="border-l-amber-700" />
        <Block title="Recuperação" b={d.recuperacao} tone="border-l-sky-500" />
        <Block title="Total dos disparos" b={d.total} tone="border-l-amber-400" />
      </section>

      <section>
        <h2 className={sectionTitle}>Ranking dos convites <span className="font-normal normal-case tracking-normal">· clique para ver o template</span></h2>
        <div className="flex flex-col gap-2">
          {d.ranking.map((r, i) => (
            <details key={r.id} className="rounded-lg border border-border">
              <summary className="grid cursor-pointer grid-cols-[2rem_minmax(0,1fr)_4rem] items-center gap-2 px-3 py-2 text-xs">
                <span className={`text-base font-bold ${i === 0 ? 'text-amber-400' : 'text-muted-foreground'}`}>{i + 1}º</span>
                <span className="min-w-0">
                  <span className="font-semibold">{r.nome}</span> <span className="text-muted-foreground">· {dm(r.data)} · {int(r.contatos)} contatos · {firstLine(r.template)}{r.vendas ? ` · ${r.vendas} venda(s)` : ''}</span>
                  <span aria-hidden className="mt-1 block h-2 rounded-full bg-muted"><span className="block h-full rounded-full bg-emerald-400" style={{ width: `${((r.agendamentos ?? 0) / max) * 100}%` }} /></span>
                </span>
                <span className="text-right"><b className="text-base tabular-nums text-emerald-400">{int(r.agendamentos)}</b><br /><span className="text-muted-foreground">{pct(r.contatos ? (r.agendamentos ?? 0) / r.contatos : null, 2)}</span></span>
              </summary>
              <pre className="whitespace-pre-wrap border-t border-border px-3 py-2 font-sans text-xs">{r.template || 'Sem template registrado.'}</pre>
            </details>
          ))}
          {!d.ranking.length && <p className="text-xs text-muted-foreground">Nenhum convite no período.</p>}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className={sectionTitle}>Disparos</h2>
          <Button size="sm" variant="outline" onClick={() => open(null)}>Adicionar</Button>
        </div>
        {editing && (
          <Card className="mb-3 gap-3 p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <label className={label}>Tipo
                <select value={form.kind} onChange={field('kind')} className="h-8 rounded-md border border-border bg-background px-2 text-sm normal-case tracking-normal text-foreground">
                  <option value="convite">Convite</option><option value="recuperacao">Recuperação</option>
                </select>
              </label>
              <label className={label}>Ciclo<Input value={form.ciclo} onChange={field('ciclo')} /></label>
              <label className={label}>Nome<Input value={form.nome} onChange={field('nome')} required /></label>
              <label className={label}>Data<Input type="date" value={form.data} onChange={field('data')} /></label>
              <label className={label}>Contatos<Input inputMode="numeric" value={form.contatos} onChange={field('contatos')} /></label>
              <label className={label}>Agendamentos<Input inputMode="numeric" value={form.agendamentos} onChange={field('agendamentos')} /></label>
              <label className={label}>Vendas<Input inputMode="numeric" value={form.vendas} onChange={field('vendas')} /></label>
              <label className={label}>Faturamento (R$)<Input inputMode="decimal" value={form.faturamento} onChange={field('faturamento')} /></label>
              <label className={label}>Custo (R$)<Input inputMode="decimal" value={form.custo} onChange={field('custo')} /></label>
            </div>
            <label className={label}>Template
              <textarea value={form.template} onChange={field('template')} rows={4} className="rounded-md border border-border bg-transparent px-2 py-1 text-sm normal-case tracking-normal text-foreground" />
            </label>
            {msg && <p role="alert" className="text-xs text-red-400">{msg}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving || !form.nome.trim()}>{saving ? 'Salvando…' : 'Salvar'}</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            </div>
          </Card>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tipo</TableHead><TableHead>Ciclo</TableHead><TableHead>Nome</TableHead><TableHead>Data</TableHead><TableHead>Template</TableHead>
              <TableHead className="text-right">Contatos</TableHead><TableHead className="text-right">Agend.</TableHead><TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Faturamento</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Custo/agend.</TableHead><TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {d.rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.kind === 'convite' ? 'Convite' : 'Recuperação'}</TableCell><TableCell>{r.ciclo ?? '—'}</TableCell>
                  <TableCell className="font-medium">{r.nome}</TableCell><TableCell>{dm(r.data)}</TableCell>
                  <TableCell className="max-w-[10rem] truncate text-xs" title={r.template ?? undefined}>{firstLine(r.template)}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(r.contatos)}</TableCell><TableCell className="text-right tabular-nums">{int(r.agendamentos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{int(r.vendas)}</TableCell><TableCell className="text-right tabular-nums">{brl(r.faturamento)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(r.custo)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.custo !== null && r.agendamentos ? brl(r.custo / r.agendamentos) : '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button size="sm" variant="ghost" onClick={() => open(r)}>Editar</Button>
                    <Button size="sm" variant="ghost" className="text-red-400" onClick={() => remove(r)}>Remover</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Ligar as abas**

Em `MarketingDashboard.tsx`: importar `ApiTab` e `DisparosTab`; acrescentar a `GROUPS` o grupo `{ key: 'canais', label: 'Canais', tabs: [{ key: 'api', label: 'API' }, { key: 'disparos', label: 'Disparos' }] }`; e:

```tsx
                <TabsContent value="api"><ApiTab query={query} /></TabsContent>
                <TabsContent value="disparos"><DisparosTab query={query} /></TabsContent>
```

- [ ] **Step 6: Verificar**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: PASS.

Manual:
- Canais → API com #018–#020: "Leads via API" = linhas da Captação dessas edições com `utm_source = api`; bases/versões = `utm_medium`/`utm_term`. (**Verificação do usuário**: comparar com o dash antigo — ver Task 20.)
- Canais → Disparos (tabela ainda vazia antes do import da Task 19): **Adicionar** um disparo de teste (convite, nome "Teste", 100 contatos, 2 agendamentos, custo 4), salvar → aparece nos blocos e no ranking; **Editar** mudando o custo para "4,50" → custo por agend. R$ 2,25; **Editar** um disparo com custo R$ 16,80 e salvar sem mudar nada → continua R$ 16,80 (o campo mostra "16,8"); tentar contatos "1,5" → mensagem "Contatos inválido"; **Remover** pede confirmação e some. Nenhuma outra tabela é tocada.
- `curl -X DELETE "http://localhost:3000/api/marketing/disparos?id=x"` sem cookie → 401; com cookie e id inválido → 400. `GET /api/marketing/disparos` → 405 (não existe).

- [ ] **Step 7: Commit**

```bash
git add src/lib/marketing/tabs.ts src/app/api/marketing/disparos/route.ts src/components/marketing/ApiTab.tsx src/components/marketing/DisparosTab.tsx src/components/marketing/MarketingDashboard.tsx
git commit -m "feat(marketing): API and Disparos tabs with admin CRUD for WhatsApp shots"
```

---

### Task 17: Edição — funil Power | Start, webinário a webinário, funil completo Meta + UTM e histórico NF10K

**Files:**
- Create: `src/lib/marketing/breakdowns.ts`
- Test: `src/lib/marketing/breakdowns.test.ts`
- Modify: `src/lib/marketing/tabs.ts`
- Create: `src/components/marketing/EditionExtras.tsx`
- Modify: `src/components/marketing/EditionTab.tsx`
- Modify: `src/components/marketing/LeadFunnel.tsx`
- Modify: `src/components/marketing/MarketingDashboard.tsx`

**Interfaces:**
- Consumes: `Application` (Task 4); `Deal`, `dealDone` (Task 6); `SaleRow`, `CaptureRow`, `OverviewCheck`, `SurveyRow` (Task 1); `creativeFamily` (creatives.ts); `qualified5k` (Task 3); `normProd`, `saleValue`, `Product` (Task 5); `LiveStats` (Task 8); `fullFunnel`, `FullFunnel`, `FUNNEL_ROWS` (Task 9); `loadMetaWindows` (Task 10); `editionKind` (Task 3); helpers `applications`, `liveByEdition` (Task 13), `deals`, `adsOf` (Task 14).
- Produces:
  - `breakdowns.ts`: `type Stage4 = { qualified: number; scheduled: number; done: number; sales: number }`, `type EditionFunnel = { applications: number; qualified: number; scheduled: number; done: number; power: Stage4; start: Stage4; desafioSales: number }` (`scheduled`/`done` = todos os negócios), `editionFunnel(apps: Application[], deals: Deal[], sales: SaleRow[]): EditionFunnel`, `dealViaApi(d: Deal): boolean`, `type WebinarRow` (inclui `viaApi`, `sheetPeak`, `attendance` + `attendanceFromSheet`, `applications`), `type WebinarTable = { rows: WebinarRow[]; total: WebinarRow | null }`, `webinarTable(eds: { number: number; liveDate: string }[], leads: CaptureRow[], deals: Deal[], sales: SaleRow[], apps: Application[], live: Record<number, LiveStats | null>, sheet: Record<number, OverviewCheck | null>): WebinarTable`; e já para a Task 18: `type CreativeExtra = { family; leads; qualified; qualifiedRate: number | null; scheduled; sales; power; start; desafio }`, `creativeExtras(leads: CaptureRow[], surveys: Record<string, SurveyRow>, deals: Deal[], sales: SaleRow[], aliases: Record<string, string>): CreativeExtra[]`, `type CreativeSort = 'vendas' | 'agend' | 'qualif' | 'leads'`, `sortCreatives<T extends { x: CreativeExtra | null }>(rows: T[], s: CreativeSort): T[]` (desempates do HTML: vendas → agendamentos → leads; agendamentos → leads; qualificação → leads; leads → vendas).
  - `tabs.ts`: `type EdicaoTab = { ticketApplies: boolean; funnel: EditionFunnel; webinars: WebinarTable; fullFunnel: FullFunnel }`, aba `edicao`, helper `sheetChecks(c)` (números da Visão Geral por edição).
  - `EditionExtras.tsx`: `WebinarTableView({ data }: { data: WebinarTable })`, `FullFunnelTable({ data }: { data: FullFunnel })`.
  - `EditionTab` recebe `query` e só mostra o funil depois do complemento (ou do erro dele); `LeadFunnel` recebe `funnel: EditionFunnel | null` e `ticketApplies: boolean`.

- [ ] **Step 1: Testes (falhando)**

Criar `src/lib/marketing/breakdowns.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { CaptureRow, OverviewCheck, SaleRow, SurveyRow } from './types.ts';
import type { Application } from './applications.ts';
import type { Deal } from './deals.ts';
import type { LiveStats } from './live.ts';
import { creativeExtras, editionFunnel, sortCreatives, webinarTable } from './breakdowns.ts';

const app = (o: Partial<Application>): Application => ({
  name: '', email: '', at: null, product: '', qualif: '', qualified: false, complete: true, income: '', revenue: '', relation: '',
  interest: '', scheduled: false, origin: '', originGroup: '', edition: 22, editionByEmail: true, creative: '', repeats: 0, key: '', ...o,
});
const deal = (o: Partial<Deal>): Deal => ({
  name: '', type: 'WB', closer: 'Ana', via: '', product: 'Power', scheduledAt: '2026-10-13', callDate: null, realized: false,
  lostReason: '', status: 'agendada', alerts: [], income: '', value: 0, edition: 22, editionBy: 'planilha',
  creative: '', utmContent: '', utmSource: '', ...o,
});
const sale = (o: Partial<SaleRow>): SaleRow => ({
  approved: true, refunded: false, status: 'Aprovada', product: 'Power', amount: 0, email: '', phone: '', name: '',
  utmContentCapture: '', utmContentSale: '', capSource: '', capMedium: '', capCampaign: '', saleSource: '', saleCampaign: '',
  funnel: '', at: null, edition: 22, ...o,
});
const lead = (edition: number): CaptureRow => ({
  email: '', phone: '', name: '', utmSource: '', utmMedium: '', utmCampaign: '', utmTerm: '', utmContent: '', at: null, edition, funnel: '',
});
const stats = (o: Partial<LiveStats>): LiveStats => ({
  people: 0, watched: 0, peak: 0, peakMinute: 0, mean: null, median: null, toPitch: 0, min30: 0, min60: 0, cta: 0, curve: [], histogram: [], pitchMinute: 66, ...o,
});
const check = (o: Partial<OverviewCheck>): OverviewCheck => ({
  applications: null, scheduled: null, done: null, peak: null, attendance: null, metaSpend: null, investment: null, sales: null, revenue: null, ...o,
});

test('editionFunnel splits Power and Start; refunds and incomplete applications stay out', () => {
  const f = editionFunnel(
    [app({ qualif: 'Power', qualified: true }), app({ qualif: 'Start', qualified: true }), app({ qualif: 'Desafio' }), app({ complete: false })],
    [deal({ product: 'Power', status: 'ganho', realized: true }), deal({ product: 'Power' }), deal({ product: 'Start', status: 'perdido', realized: true }), deal({ product: '' })],
    [sale({ product: 'Power' }), sale({ product: 'Desafio' }), sale({ product: 'Power Start', approved: false, refunded: true })],
  );
  assert.deepEqual(f, {
    applications: 3, qualified: 2, scheduled: 4, done: 2,
    power: { qualified: 1, scheduled: 2, done: 1, sales: 1 },
    start: { qualified: 1, scheduled: 1, done: 1, sales: 0 },
    desafioSales: 1,
  });
});

test('webinarTable: moment buckets, via API, calls, attendance, live conversion from 20h to 6h', () => {
  const t = webinarTable(
    [{ number: 22, liveDate: '2026-10-13' }],
    [lead(22), lead(22), lead(21)],
    [deal({ scheduledAt: '2026-10-12', utmContent: 'APIAI02' }), deal({ status: 'realizada', realized: true, utmContent: '197' }), deal({ scheduledAt: '2026-10-15', utmSource: 'API' })],
    [sale({ amount: 20040 })],
    [app({ at: '2026-10-13T21:00:00' }), app({ at: '2026-10-14T05:59:00' }), app({ at: '2026-10-14T06:01:00' }), app({ at: '2026-10-13T21:30:00', complete: false })],
    { 22: stats({ peak: 50, toPitch: 20 }) },
    { 22: check({ peak: 52 }) },
  );
  const r = t.rows[0];
  assert.deepEqual(
    [r.leads, r.scheduled, r.before, r.onDay, r.after, r.viaApi, r.calls, r.sales, r.revenue, r.peak, r.sheetPeak, r.toPitch, r.applications, r.liveApps, r.liveConversion],
    [2, 3, 1, 1, 1, 3, 1, 1, 20040, 50, 52, 20, 3, 2, 0.1],
  );
  assert.deepEqual([r.attendance, r.attendanceFromSheet], [2500, false]); // sem Visão Geral: pico ÷ leads × 100
  assert.equal(t.total, null);
  const two = webinarTable(
    [{ number: 21, liveDate: '2026-10-06' }, { number: 22, liveDate: '2026-10-13' }], [lead(21), lead(22)], [], [], [],
    { 21: null, 22: stats({ toPitch: 10 }) }, { 21: check({ attendance: 12.5 }), 22: null },
  );
  assert.deepEqual([two.rows[0].peak, two.rows[0].attendance, two.rows[0].attendanceFromSheet], [null, 12.5, true]);
  assert.deepEqual([two.total?.leads, two.total?.toPitch, two.total?.peak, two.total?.attendance], [2, 10, null, null]);
});

test('creativeExtras: leads, 5k+ rate, schedules and high-ticket sales per creative family', () => {
  const lc = (utmContent: string, email: string): CaptureRow => ({ ...lead(22), utmContent, email });
  const sv = (email: string, renda: string): SurveyRow => ({ email, at: null, tempo: '', servico: '', renda, fat: '', conhece: '', desafios: '' });
  const x = creativeExtras(
    [lc('webp_vendas_img_10', 'a@x'), lc('img_10', 'b@x'), lc('vid_2', 'c@x')],
    { 'a@x': sv('a@x', '7a10k') },
    [deal({ creative: 'Web3_coleta_img_10' })],
    [sale({ utmContentCapture: 'img_10', product: 'Power Start' }), sale({ utmContentCapture: 'img_10', approved: false, refunded: true })],
    {},
  );
  const img = x.filter(r => r.family === 'img_10')[0];
  assert.deepEqual([img.leads, img.qualified, img.qualifiedRate, img.scheduled, img.sales, img.start, img.power], [2, 1, 0.5, 1, 1, 1, 0]);
  assert.equal(x.filter(r => r.family === 'vid_2')[0].qualifiedRate, 0);
});

test('sortCreatives keeps the old tie-breaks', () => {
  const ex = (family: string, leads: number, qualified: number, scheduled: number, sales: number) =>
    ({ x: { family, leads, qualified, qualifiedRate: null, scheduled, sales, power: 0, start: 0, desafio: 0 } });
  const rows = [ex('a', 10, 1, 2, 1), ex('b', 20, 1, 2, 1), ex('c', 5, 3, 0, 0), ex('d', 20, 0, 0, 2)];
  const ids = (s: 'vendas' | 'agend' | 'qualif' | 'leads') => sortCreatives(rows, s).map(r => r.x.family).join('');
  assert.equal(ids('vendas'), 'dbac');
  assert.equal(ids('agend'), 'badc');
  assert.equal(ids('qualif'), 'cbad');
  assert.equal(ids('leads'), 'dbac');
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test`
Expected: FAIL — `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/breakdowns.ts'` (os 4 testes: funil, webinário a webinário, extras e ordenação dos criativos).

- [ ] **Step 3: Implementar `breakdowns.ts`**

Criar `src/lib/marketing/breakdowns.ts`:

```ts
// Agregados que cruzam aplicações, negócios, vendas e presença (Edição e Criativos).
import type { CaptureRow, OverviewCheck, SaleRow, SurveyRow } from './types.ts';
import type { Application } from './applications.ts';
import type { LiveStats } from './live.ts';
import { dealDone, type Deal } from './deals.ts';
import { normProd, saleValue, type Product } from './sales.ts';
import { addDays } from './parse.ts';
import { creativeFamily } from './creatives.ts';
import { qualified5k } from './survey.ts';

export type Stage4 = { qualified: number; scheduled: number; done: number; sales: number };
export type EditionFunnel = {
  applications: number; qualified: number;
  scheduled: number; done: number;      // todos os negócios (qualquer produto)
  power: Stage4; start: Stage4; desafioSales: number;
};

// Funil oficial: aplicações do Typeform → qualificada (Power/Start) → agendada → realizada → venda, por produto.
export function editionFunnel(apps: Application[], deals: Deal[], sales: SaleRow[]): EditionFunnel {
  const complete = apps.filter(a => a.complete);
  const ok = sales.filter(s => s.approved);
  const stage = (qualif: 'Power' | 'Start', prod: Product): Stage4 => {
    const ds = deals.filter(d => normProd(d.product) === prod);
    return {
      qualified: complete.filter(a => a.qualif === qualif).length,
      scheduled: ds.length, done: ds.filter(dealDone).length,
      sales: ok.filter(s => normProd(s.product) === prod).length,
    };
  };
  return {
    applications: complete.length, qualified: complete.filter(a => a.qualified).length,
    scheduled: deals.length, done: deals.filter(dealDone).length,
    power: stage('Power', 'power'), start: stage('Start', 'powerStart'),
    desafioSales: ok.filter(s => normProd(s.product) === 'desafio').length,
  };
}

export type WebinarRow = {
  edition: number | null; // null = linha de total
  leads: number; scheduled: number; before: number; onDay: number; after: number; viaApi: number; calls: number;
  sales: number; revenue: number;
  peak: number | null;        // plataforma (oficial)
  sheetPeak: number | null;   // Visão Geral, só referência
  attendance: number | null;  // % 0–100: Visão Geral; sem ela, pico ÷ leads
  attendanceFromSheet: boolean;
  toPitch: number | null; applications: number; liveApps: number; liveConversion: number | null;
};
export type WebinarTable = { rows: WebinarRow[]; total: WebinarRow | null };

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const round2 = (n: number) => Math.round(n * 100) / 100;
// Agendamento via API, como o dash antigo: utm_content do negócio começa com "api" ou é "197", ou utm_source = api.
export const dealViaApi = (d: Deal) => /^api/i.test(d.utmContent) || d.utmContent === '197' || /^api$/i.test(d.utmSource);

export function webinarTable(
  eds: { number: number; liveDate: string }[], leads: CaptureRow[], deals: Deal[], sales: SaleRow[],
  apps: Application[], live: Record<number, LiveStats | null>, sheet: Record<number, OverviewCheck | null>,
): WebinarTable {
  const rows: WebinarRow[] = eds.map(e => {
    const n = e.number;
    const ds = deals.filter(d => d.edition === n);
    const ss = sales.filter(s => s.approved && s.edition === n);
    const complete = apps.filter(a => a.complete && a.edition === n);
    // Conversão ao vivo: aplicações completas das 20h da live às 6h do dia seguinte ÷ pessoas no pitch.
    const from = `${e.liveDate}T20:00:00`, to = `${addDays(e.liveDate, 1)}T06:00:00`;
    const liveApps = complete.filter(a => a.at !== null && a.at >= from && a.at <= to).length;
    const st = live[n] ?? null;
    const ov = sheet[n] ?? null;
    const nLeads = leads.filter(l => l.edition === n).length;
    const toPitch = st ? st.toPitch : null;
    const sheetAttendance = ov ? ov.attendance : null;
    let before = 0, onDay = 0, after = 0;
    ds.forEach(d => {
      if (!d.scheduledAt) return;
      const off = days(e.liveDate, d.scheduledAt);
      if (off < 0) before++; else if (off === 0) onDay++; else after++;
    });
    return {
      edition: n, leads: nLeads, scheduled: ds.length, before, onDay, after, viaApi: ds.filter(dealViaApi).length,
      calls: ds.filter(dealDone).length, sales: ss.length, revenue: round2(ss.reduce((t, s) => t + saleValue(s), 0)),
      peak: st ? st.peak : null, sheetPeak: ov ? ov.peak : null,
      attendance: sheetAttendance !== null ? sheetAttendance : st && nLeads ? Math.round((st.peak / nLeads) * 1000) / 10 : null,
      attendanceFromSheet: sheetAttendance !== null,
      toPitch, applications: complete.length, liveApps, liveConversion: toPitch ? liveApps / toPitch : null,
    };
  });
  if (rows.length < 2) return { rows, total: null };
  const sum = (k: 'leads' | 'scheduled' | 'before' | 'onDay' | 'after' | 'viaApi' | 'calls' | 'sales' | 'revenue' | 'applications' | 'liveApps') =>
    rows.reduce((t, r) => t + r[k], 0);
  const withPitch = rows.filter(r => r.toPitch !== null);
  const toPitch = withPitch.length ? withPitch.reduce((t, r) => t + (r.toPitch as number), 0) : null;
  const liveApps = sum('liveApps');
  return {
    rows,
    total: {
      edition: null, leads: sum('leads'), scheduled: sum('scheduled'), before: sum('before'), onDay: sum('onDay'), after: sum('after'),
      viaApi: sum('viaApi'), calls: sum('calls'), sales: sum('sales'), revenue: round2(sum('revenue')),
      peak: null, sheetPeak: null, attendance: null, attendanceFromSheet: false, // pico e comparecimento não somam entre lives
      toPitch, applications: sum('applications'), liveApps, liveConversion: toPitch ? liveApps / toPitch : null,
    },
  };
}

export type CreativeExtra = {
  family: string; leads: number; qualified: number; qualifiedRate: number | null; scheduled: number;
  sales: number; power: number; start: number; desafio: number; // vendas high ticket (sales = todas, sem reembolso)
};

// Por família de criativo: leads da captação, % 5k+ na pesquisa, agendamentos e vendas high ticket por produto.
export function creativeExtras(
  leads: CaptureRow[], surveys: Record<string, SurveyRow>, deals: Deal[], sales: SaleRow[], aliases: Record<string, string>,
): CreativeExtra[] {
  const m: Record<string, CreativeExtra> = Object.create(null);
  const list: CreativeExtra[] = [];
  const get = (raw: string) => {
    const f = creativeFamily(raw, aliases);
    let x = m[f];
    if (!x) { x = m[f] = { family: f, leads: 0, qualified: 0, qualifiedRate: null, scheduled: 0, sales: 0, power: 0, start: 0, desafio: 0 }; list.push(x); }
    return x;
  };
  leads.forEach(l => {
    const x = get(l.utmContent);
    x.leads++;
    const s = l.email ? surveys[l.email] : undefined;
    if (s && qualified5k(s.renda)) x.qualified++;
  });
  deals.forEach(d => { get(d.creative).scheduled++; });
  sales.filter(s => s.approved).forEach(s => {
    const x = get(s.utmContentCapture);
    x.sales++;
    const p = normProd(s.product);
    if (p === 'power') x.power++; else if (p === 'powerStart') x.start++; else if (p === 'desafio') x.desafio++;
  });
  list.forEach(x => { x.qualifiedRate = x.leads ? x.qualified / x.leads : null; });
  return list;
}

// Ordenação do dash antigo: vendas → agendamentos → leads; agendamentos → leads; qualificação → leads; leads → vendas.
export type CreativeSort = 'vendas' | 'agend' | 'qualif' | 'leads';
export function sortCreatives<T extends { x: CreativeExtra | null }>(rows: T[], s: CreativeSort): T[] {
  const v = (r: T, k: 'sales' | 'scheduled' | 'qualified' | 'leads') => (r.x ? r.x[k] : 0);
  return rows.slice().sort((a, b) =>
    s === 'qualif' ? v(b, 'qualified') - v(a, 'qualified') || v(b, 'leads') - v(a, 'leads')
      : s === 'agend' ? v(b, 'scheduled') - v(a, 'scheduled') || v(b, 'leads') - v(a, 'leads')
      : s === 'leads' ? v(b, 'leads') - v(a, 'leads') || v(b, 'sales') - v(a, 'sales')
      : v(b, 'sales') - v(a, 'sales') || v(b, 'scheduled') - v(a, 'scheduled') || v(b, 'leads') - v(a, 'leads'));
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: `tabs.ts` — edicao**

Em `src/lib/marketing/tabs.ts` (cada estado intermediário compila: o plano foi verificado aplicando as Tasks 12–18 em sequência):

1. Substituir o bloco de imports do topo (todas as linhas `import`) por:

```ts
import type { CaptureRow, DateRange, EditionConfig, MetaAdDay, OverviewCheck, OverviewRow, SaleRow, SurveyRow } from './types.ts';
import {
  toApplicationRows, toCaptureRows, toOverviewRows, toSaleRows, toScheduleRows, toSurveyRows, type TabKey,
} from './sheet-rows.ts';
import { buildEditions, cycleStartAt, editionKind, indexCaptures } from './editions.ts';
import { inRange } from './metrics.ts';
import { latestSurveys, surveyTab, type SurveyTab } from './survey.ts';
import { applicationsTab, buildApplications, type Application, type ApplicationsTab } from './applications.ts';
import { liveStats, liveTotals, presenceFromEvents, type LiveStats, type LiveTab } from './live.ts';
import { buildDeals, dealsTab, type Deal, type DealsTab } from './deals.ts';
import { buyersTab, salesTab, type BuyersTab, type SalesTab } from './sales.ts';
import { apiTab, type ApiTab } from './api-leads.ts';
import { disparosTab, type DisparosTab } from './disparos.ts';
import { filterAds, fullFunnel, type FullFunnel } from './full-funnel.ts';
import {
  editionFunnel, webinarTable, type EditionFunnel, type WebinarTable,
} from './breakdowns.ts';
import { getMarketingSettings } from './settings.ts';
import { TAB_TITLES } from './sync.ts';
import {
  loadAdDays, loadDisparos, loadEditionOverrides, loadMetaWindows, loadSnapshotTimes, loadSnapshots,
} from './store.ts';
import { loadLive } from './sources/platform.ts';
```

2. Substituir a declaração de `PANEL_TABS` por:

```ts
export const PANEL_TABS = [
  'pesquisa', 'aplicacoes', 'aovivo', 'agendamentos', 'vendas', 'compradores', 'api', 'disparos', 'edicao',
] as const;
```

3. Logo antes de `export type TabData`, acrescentar:

```ts
export type EdicaoTab = { ticketApplies: boolean; funnel: EditionFunnel; webinars: WebinarTable; fullFunnel: FullFunnel };
```

4. Dentro de `export type TabData = { … }`, acrescentar ao fim:

```ts
  edicao: EdicaoTab;
```

5. Dentro de `const NEEDS = { … }`, acrescentar ao fim:

```ts
  edicao: ['capture', 'applications', 'schedule', 'sales', 'survey'],
```

6. Logo antes de `type Builder<K extends PanelTab>`, acrescentar:

```ts
const sheetChecks = (c: Ctx) => {
  const out: Record<number, OverviewCheck | null> = {};
  c.eds.forEach(e => { const ov = c.overview.filter(o => o.edition === e.number)[0]; out[e.number] = ov ? ov.check : null; });
  return out;
};
```

7. Dentro de `const BUILDERS = { … }`, acrescentar ao fim (antes do `};`):

```ts
  // Complementos da Edição: edição inteira (o período não se aplica), como o bloco "Fundo".
  edicao: async c => {
    const [live, meta, windows] = await Promise.all([liveByEdition(c), adsOf(c), loadMetaWindows(c.selected)]);
    const apps = applications(c).filter(a => inSel(c, a.edition));
    const ds = deals(c).filter(d => inSel(c, d.edition));
    const ss = typed(c.snap.sales, toSaleRows).filter(s => s.approved && inSel(c, s.edition));
    return {
      ticketApplies: c.selected.some(n => editionKind(n) === 'pago'),
      funnel: editionFunnel(apps, ds, ss),
      webinars: webinarTable(c.eds, c.captures.filter(x => inSel(c, x.edition)), ds, ss, apps, live, sheetChecks(c)),
      fullFunnel: fullFunnel(c.eds, meta.ads, c.captures, windows, meta.filter, c.today),
    };
  },
```

- [ ] **Step 6: Tabelas da Edição**

Criar `src/components/marketing/EditionExtras.tsx`:

```tsx
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { WebinarTable } from '@/lib/marketing/breakdowns';
import { FUNNEL_ROWS, type FullFunnel } from '@/lib/marketing/full-funnel';
import { brl, dec, dm, ed, int, pct, ratio } from './ui';

const NO_LIVE = 'Sem presença registrada na plataforma';

export function WebinarTableView({ data }: { data: WebinarTable }) {
  const rows = data.total ? data.rows.concat(data.total) : data.rows;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Webinário</TableHead><TableHead className="text-right">Leads</TableHead><TableHead className="text-right">Agendamentos</TableHead>
          <TableHead className="text-center" title="dia do agendamento × dia da live">Antes · no dia · depois</TableHead>
          <TableHead className="text-right" title="utm_content do negócio começa com api (ou 197) ou utm_source = api">Via API</TableHead>
          <TableHead className="text-right">Calls feitas</TableHead><TableHead className="text-right">Vendas</TableHead>
          <TableHead className="text-right" title="plataforma (oficial) · Visão Geral entre parênteses">Pico</TableHead>
          <TableHead className="text-right">Comparecimento</TableHead><TableHead className="text-right">Até o pitch</TableHead>
          <TableHead className="text-right" title="aplicações completas entre 20h da live e 6h do dia seguinte ÷ pessoas no pitch">Conversão ao vivo</TableHead>
          <TableHead className="text-right">Aplicações</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.edition ?? 'total'} className={r.edition === null ? 'font-semibold' : ''}>
              <TableCell>{r.edition === null ? 'Total' : ed(r.edition)}</TableCell>
              <TableCell className="text-right tabular-nums">{int(r.leads)}</TableCell>
              <TableCell className="text-right tabular-nums">{int(r.scheduled)} <span className="text-muted-foreground">{pct(ratio(r.scheduled, r.leads), 2)}</span></TableCell>
              <TableCell className="text-center tabular-nums"><span className="text-red-300">{r.before}</span> · <span className="text-amber-300">{r.onDay}</span> · <span className="text-emerald-300">{r.after}</span></TableCell>
              <TableCell className="text-right tabular-nums text-amber-300">{int(r.viaApi)}</TableCell>
              <TableCell className="text-right tabular-nums">{int(r.calls)} <span className="text-muted-foreground">{pct(ratio(r.calls, r.scheduled))}</span></TableCell>
              <TableCell className="text-right tabular-nums">{int(r.sales)}{r.revenue > 0 && <span className="text-muted-foreground"> {brl(r.revenue)}</span>}</TableCell>
              <TableCell className="text-right tabular-nums" title={r.peak === null ? (r.edition === null ? 'Pico não soma entre lives' : NO_LIVE) : undefined}>{int(r.peak)}{r.sheetPeak !== null && <span className="text-muted-foreground" title="Pico digitado na Visão Geral (referência)"> ({int(r.sheetPeak)})</span>}</TableCell>
              <TableCell className="text-right tabular-nums" title={r.attendance === null ? (r.edition === null ? 'Comparecimento não soma entre lives' : 'Sem Visão Geral nem presença') : r.attendanceFromSheet ? 'Visão Geral' : 'pico ÷ leads (Visão Geral vazia)'}>
                {r.attendance === null ? '—' : `${r.attendance.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
              </TableCell>
              <TableCell className="text-right tabular-nums" title={r.toPitch === null ? NO_LIVE : undefined}>{int(r.toPitch)}</TableCell>
              <TableCell className="text-right tabular-nums" title={r.liveConversion === null ? 'Sem pessoas no pitch para dividir' : undefined}>
                {r.liveConversion === null ? '—' : <>{pct(r.liveConversion)} <span className="text-muted-foreground">({r.liveApps})</span></>}
              </TableCell>
              <TableCell className="text-right tabular-nums">{int(r.applications)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function fmt(format: 'int' | 'money' | 'pct' | 'dec', n: number | null): string {
  if (n === null) return '—';
  return format === 'money' ? brl(n) : format === 'pct' ? pct(n, 2) : format === 'dec' ? dec(n) : int(n);
}

export function FullFunnelTable({ data }: { data: FullFunnel }) {
  const c = data.compare;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-muted-foreground">
        Campanhas com “{data.filter || 'qualquer nome'}” · coluna = edição inteira (inclui o dia da live)
        {c && ` · variação ${ed(c.prev)}→${ed(c.cur)} nos mesmos ${c.cutDays} dias de captação (${dm(c.prevRange.from)}–${dm(c.prevRange.to)} × ${dm(c.curRange.from)}–${dm(c.curRange.to)}): ${ed(c.prev)} ${c.prevSales} · ${ed(c.cur)} ${c.curSales} vendas`}
      </p>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Métrica</TableHead>
            {data.columns.map(col => (
              <TableHead key={col.edition} className="text-right">{ed(col.edition)} <span className="font-normal text-muted-foreground">{dm(col.from)}–{dm(col.to)}</span></TableHead>
            ))}
            <TableHead className="text-right">Variação</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {FUNNEL_ROWS.map(r => {
              const d = c ? c.deltas[r.key] ?? null : null;
              const why = !c ? 'Selecione duas edições (a mais recente com ao menos 1 dia de captação)'
                : (r.key === 'reach' || r.key === 'frequency') && !c.reachComparable ? 'Alcance não soma por dia: só compara edições encerradas com janelas de mesma duração'
                : 'Sem base para comparar';
              const good = d === null || d === 0 || r.better === null ? null : (r.better === 'up') === (d > 0);
              return (
                <TableRow key={r.key}>
                  <TableCell>{r.label}</TableCell>
                  {data.columns.map(col => {
                    const v = col.metrics[r.key];
                    return <TableCell key={col.edition} className="text-right tabular-nums" title={v === null ? 'Sem dado do Meta para esta janela' : undefined}>{fmt(r.format, v)}</TableCell>;
                  })}
                  <TableCell className={`text-right tabular-nums ${good === null ? '' : good ? 'text-emerald-400' : 'text-red-400'}`} title={d === null ? why : undefined}>
                    {d === null ? '—' : `${d > 0 ? '+' : ''}${(d * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: `LeadFunnel` — aplicação qualificada, Pipedrive e divisão Power | Start**

Em `src/components/marketing/LeadFunnel.tsx`:

1. Acrescentar o import `import type { EditionFunnel } from '@/lib/marketing/breakdowns';`.
2. Trocar a assinatura por `export default function LeadFunnel({ view, funnel, ticketApplies }: { view: MarketingView; funnel: EditionFunnel | null; ticketApplies: boolean }) {`.
3. Substituir a declaração `const stages: Stage[] = [ ... ];` inteira por (a etapa de vendas high ticket, com a lista de compradores, fica nos dois casos):

```tsx
  const top: Stage[] = [
    { key: 'tickets', label: 'Ingressos vendidos', sub: view.range ? 'no período' : 'frente paga', value: f.sales, cost: costOf(f.spend, f.sales), costLabel: 'por ingresso', people: tk },
    { key: 'entered', label: 'Entraram na live', sub: 'compradores presentes', value: entered.length, cost: costOf(f.spend, entered.length), costLabel: 'por presente', people: entered },
    { key: 'pitch', label: 'Ficaram até o pitch', sub: 'compradores no pitch', value: pitch.length, cost: costOf(f.spend, pitch.length), costLabel: 'por pitch', people: pitch },
  ];
  const htStage: Stage = { key: 'ht', label: 'Vendas high ticket', sub: brl(b.highTicketRevenue), value: b.highTicketSales, cost: costOf(view.fullSpend, b.highTicketSales), costLabel: 'por venda', people: ht };
  const rowsNote = 'Lista de pessoas nas abas Leads → Aplicações e Comercial → Agendamentos.';
  // Com o complemento: fundo pelas linhas (Typeform/Pipedrive). Sem ele (só se o complemento falhar): Visão Geral.
  // A etapa de vendas high ticket (com a lista de compradores) fica nos dois casos.
  const back: Stage[] = funnel ? [
    { key: 'apps', label: 'Aplicações', sub: `${whole} · Typeform`, value: funnel.applications, cost: costOf(view.fullSpend, funnel.applications), costLabel: 'por aplicação', people: null, note: rowsNote },
    { key: 'qualified', label: 'Aplicação qualificada', sub: 'Power ou Start', value: funnel.qualified, cost: costOf(view.fullSpend, funnel.qualified), costLabel: 'por qualificada', people: null, note: rowsNote },
    { key: 'scheduled', label: 'Calls agendadas', sub: `${whole} · Pipedrive`, value: funnel.scheduled, cost: costOf(view.fullSpend, funnel.scheduled), costLabel: 'por agendada', people: null, note: rowsNote },
    { key: 'done', label: 'Calls realizadas', sub: `${whole} · Pipedrive`, value: funnel.done, cost: costOf(view.fullSpend, funnel.done), costLabel: 'por realizada', people: null, note: rowsNote },
    htStage,
  ] : [
    { key: 'apps', label: 'Aplicações', sub: whole, value: b.applications, cost: costOf(view.fullSpend, b.applications), costLabel: 'por aplicação', people: null, note: sheetNote },
    { key: 'scheduled', label: 'Calls agendadas', sub: whole, value: b.scheduled, cost: b.costPerScheduled, costLabel: 'por agendada', people: null, note: sheetNote },
    { key: 'done', label: 'Calls realizadas', sub: whole, value: b.done, cost: b.costPerDone, costLabel: 'por realizada', people: null, note: sheetNote },
    htStage,
  ];
  // Edições NF10K não vendiam ingresso: o funil começa nas aplicações.
  const stages: Stage[] = (ticketApplies ? top : []).concat(back);
```

4. Dentro do `stages.map`, trocar `const BACK = 3; // índice de "Aplicações"` por `const BACK = ticketApplies ? 3 : 0; // índice de "Aplicações"`.
5. Logo depois do `</ol>` e antes de `<div id="funnel-detail" ...>`, acrescentar:

```tsx
      {funnel && (
        <div className="grid gap-4 border-t border-border p-3 sm:grid-cols-2">
          {([['Power', funnel.power, 'bg-amber-400'], ['Start', funnel.start, 'bg-sky-400']] as [string, EditionFunnel['power'], string][]).map(([name, s, dot]) => {
            const steps: [string, number][] = [['Qualificada', s.qualified], ['Agendada', s.scheduled], ['Realizada', s.done], ['Venda', s.sales]];
            return (
              <div key={name} className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold"><span aria-hidden className={`size-2 rounded-full ${dot}`} />{name}</p>
                {steps.map(([label, v], i) => (
                  <div key={label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span aria-hidden className="h-2 rounded-full bg-muted"><span className={`block h-full rounded-full ${dot}`} style={{ width: `${s.qualified ? Math.min(100, (v / s.qualified) * 100) : 0}%` }} /></span>
                    <span className="text-right tabular-nums"><b>{v}</b> <span className="text-muted-foreground">{i ? pct(ratio(v, steps[i - 1][1])) : ''}</span></span>
                  </div>
                ))}
              </div>
            );
          })}
          {funnel.desafioSales > 0 && (
            <p className="text-[11px] text-muted-foreground sm:col-span-2">Desafio: {funnel.desafioSales} {funnel.desafioSales > 1 ? 'vendas' : 'venda'} (downsell, fora do funil de calls)</p>
          )}
        </div>
      )}
```

- [ ] **Step 8: `EditionTab` — complemento, NF10K e tabelas novas**

Em `src/components/marketing/EditionTab.tsx`:

1. Acrescentar os imports:

```tsx
import type { EdicaoTab } from '@/lib/marketing/tabs';
import { editionKind } from '@/lib/marketing/editions';
import { FullFunnelTable, WebinarTableView } from './EditionExtras';
import { useTabData } from './useTabData';
```

2. Trocar a assinatura por `export default function EditionTab({ view, onSaved, query }: { view: MarketingView; onSaved: () => void; query: string }) {` e, depois do `useState` de `goals`, acrescentar:

```tsx
  const { data: extra, error: extraError } = useTabData<EdicaoTab>('edicao', query);
  // Edições NF10K (#015–#020) não vendiam ingresso: métricas só do pago mostram "não se aplica".
  const ticket = view.selected.some(n => editionKind(n) === 'pago');
  const na = 'não se aplica';
  const pending = <p role={extraError ? 'alert' : undefined} className={`text-xs ${extraError ? 'text-red-400' : 'text-muted-foreground'}`}>{extraError || 'Carregando…'}</p>;
```

3. Trocar `<LeadFunnel view={view} />` por (o funil espera o complemento para não trocar de etapas na frente da pessoa):

```tsx
      {/* O funil espera o complemento (linhas do Typeform/Pipedrive) para não trocar de etapas na frente da pessoa;
          se o complemento falhar, cai para os totais da Visão Geral. */}
      {extra || extraError
        ? <LeadFunnel view={view} funnel={extra ? extra.funnel : null} ticketApplies={ticket} />
        : <p className="py-6 text-center text-xs text-muted-foreground">Carregando funil…</p>}
```
4. Substituir o `<div className={grid}>` da seção "Frente — ingresso" por:

```tsx
        <div className={grid}>
          <Kpi label="Vendas" value={ticket ? String(f.sales) : na} hint={ticket ? brl(f.revenue) : 'edições NF10K não vendiam ingresso'} />
          <Kpi label="Investimento" value={f.spendSource === 'nenhum' ? '—' : brl(f.spend)} hint={f.spendSource === 'meta' ? 'fonte: Meta' : f.spendSource === 'planilha' ? 'fonte: planilha (sem Meta)' : 'sem dados de investimento'} />
          <Kpi label="ROAS" value={ticket ? dec(f.roas) : na} />
          <Kpi label="CPA da campanha" value={ticket ? brl(f.cpa) : na} hint={ticket ? `só anúncios que venderam: ${brl(f.cpaSellingAds)}` : undefined} />
          <Kpi label="IC (pixel)" value={ticket ? String(f.ic) : na} hint={ticket ? `${brl(f.costPerIc)} cada — sinal, não é venda` : undefined} />
          <Kpi label="Gasto sem venda" value={!ticket ? na : f.spendSource === 'meta' ? brl(f.spendNoSales) : '—'} hint={ticket && f.topNoSale ? `maior: ${f.topNoSale.family} (${brl(f.topNoSale.spend)})` : undefined} />
        </div>
```

5. Logo depois da `</section>` do bloco "Fundo — high ticket", acrescentar:

```tsx
      <section>
        <h2 className={sectionTitle}>Webinário a webinário <span className="font-normal normal-case tracking-normal">(edição inteira)</span></h2>
        {extra ? <WebinarTableView data={extra.webinars} /> : pending}
      </section>

      <section>
        <h2 className={sectionTitle}>Funil completo (Meta + planilha de UTMs)</h2>
        {extra ? <FullFunnelTable data={extra.fullFunnel} /> : pending}
      </section>
```

- [ ] **Step 9: Seletor de edições agrupado + passar `query`**

Em `src/components/marketing/MarketingDashboard.tsx`:

1. Acrescentar o import `import { editionKind } from '@/lib/marketing/editions';`.
2. Trocar o conteúdo de `<DropdownMenuContent className="w-56">…</DropdownMenuContent>` por:

```tsx
              <DropdownMenuContent className="w-56">
                {[
                  { label: 'Pago · mais recentes primeiro', list: editionsDesc.filter(e => editionKind(e.number) === 'pago') },
                  { label: 'Histórico NF10K', list: editionsDesc.filter(e => editionKind(e.number) === 'nf10k') },
                ].filter(g => g.list.length).map(g => (
                  <DropdownMenuGroup key={g.label}>
                    <DropdownMenuLabel>{g.label}</DropdownMenuLabel>
                    {g.list.map(e => (
                      <DropdownMenuCheckboxItem key={e.number} checked={selected.indexOf(e.number) >= 0} onCheckedChange={() => toggle(e.number)} className="tabular-nums">
                        {ed(e.number)} <span className="text-muted-foreground">· {dm(e.liveDate)}</span>
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuGroup>
                ))}
              </DropdownMenuContent>
```

3. Trocar `<EditionTab key={view.selected[0]} view={view} onSaved={() => load(selected, range)} />` por `<EditionTab key={view.selected[0]} view={view} query={query} onSaved={() => load(selected, range)} />`.

- [ ] **Step 10: Verificar**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: PASS.

Manual:
- Seletor de edição: grupo "Pago" (#021+) e "Histórico NF10K" (#015–#020); edições abaixo de #015 não aparecem.
- Edição com #022: "Carregando funil…" e, em seguida, o funil já completo (sem trocar de etapas): ingressos → entraram → pitch → Aplicações → Aplicação qualificada → Calls agendadas → Calls realizadas → Vendas high ticket (clicar mostra os compradores) e, abaixo, Power | Start (qualificada → agendada → realizada → venda). Tabela "Webinário a webinário" com Via API, Pico (Visão Geral entre parênteses), Comparecimento (hover diz a fonte) e Aplicações. "Funil completo" com a coluna #022 e os valores do Meta.
- Selecionar #021 e #022 depois da live de #022: a nota termina com **"#021 65 · #022 41 vendas"** nos mesmos 6 dias de captação (dia seguinte à live anterior → véspera da live; regra conferida em 13/10 com os dados reais). A coluna "Vendas (UTM)" de cada edição é a edição inteira (inclui o dia da live) e pode ser maior. Variação verde/vermelha; alcance "—" com explicação enquanto #022 não terminou.
- Tempo: no DevTools, `?tab=edicao` com 3 ou mais edições selecionadas, pedida pela segunda vez (instância "warm", depois de trocar de aba e voltar após um Atualizar) leva menos de 3 s.
- Selecionar só #018: blocos de ingresso mostram "não se aplica"; o funil começa em Aplicações; nada mostra 0 inventado.

- [ ] **Step 11: Commit**

```bash
git add src/lib/marketing/breakdowns.ts src/lib/marketing/breakdowns.test.ts src/lib/marketing/tabs.ts src/components/marketing/EditionExtras.tsx src/components/marketing/EditionTab.tsx src/components/marketing/LeadFunnel.tsx src/components/marketing/MarketingDashboard.tsx
git commit -m "feat(marketing): Edição funnel split, webinar table, Meta+UTM full funnel and NF10K history group"
```

---

### Task 18: Criativos (leads, qualificação, agendamentos, vendas por produto) e Validação (conferência entre fontes)

**Files:**
- Modify: `src/lib/marketing/tabs.ts`
- Modify: `src/components/marketing/CreativesTab.tsx` (substituir)
- Modify: `src/components/marketing/ValidationTab.tsx` (substituir)
- Modify: `src/components/marketing/MarketingDashboard.tsx`

**Interfaces:**
- Consumes: `creativeExtras`, `sortCreatives`, `CreativeExtra`, `CreativeSort` (Task 17); `saleValue` (Task 5); `dealDone` (Task 6); `reconcileEdition`, `ReconRow`, `OfficialNumbers` (Task 9); `loadAliases` (store); helpers `applications`, `liveByEdition`, `deals`, `adsOf`, `salesOf` (Tasks 13–15).
- Produces: abas `criativos` (`CreativeExtra[]`, **todas** as edições selecionadas no período) e `validacao` (`ReconRow[]`); `CreativesTab({ view, onSaved, query })` com ordenação do HTML e nota dizendo de onde vem cada coluna; `ValidationTab({ view, query })`.

- [ ] **Step 1: `tabs.ts` — criativos e validacao**

Em `src/lib/marketing/tabs.ts` (cada estado intermediário compila: o plano foi verificado aplicando as Tasks 12–18 em sequência):

1. Substituir o bloco de imports do topo (todas as linhas `import`) por:

```ts
import type { CaptureRow, DateRange, EditionConfig, MetaAdDay, OverviewCheck, OverviewRow, SaleRow, SurveyRow } from './types.ts';
import {
  toApplicationRows, toCaptureRows, toOverviewRows, toSaleRows, toScheduleRows, toSurveyRows, type TabKey,
} from './sheet-rows.ts';
import { buildEditions, cycleStartAt, editionKind, indexCaptures } from './editions.ts';
import { inRange } from './metrics.ts';
import { latestSurveys, surveyTab, type SurveyTab } from './survey.ts';
import { applicationsTab, buildApplications, type Application, type ApplicationsTab } from './applications.ts';
import { liveStats, liveTotals, presenceFromEvents, type LiveStats, type LiveTab } from './live.ts';
import { buildDeals, dealDone, dealsTab, type Deal, type DealsTab } from './deals.ts';
import { buyersTab, saleValue, salesTab, type BuyersTab, type SalesTab } from './sales.ts';
import { apiTab, type ApiTab } from './api-leads.ts';
import { disparosTab, type DisparosTab } from './disparos.ts';
import { filterAds, fullFunnel, type FullFunnel } from './full-funnel.ts';
import { reconcileEdition, type OfficialNumbers, type ReconRow } from './reconcile.ts';
import {
  creativeExtras, editionFunnel, webinarTable, type CreativeExtra, type EditionFunnel, type WebinarTable,
} from './breakdowns.ts';
import { getMarketingSettings } from './settings.ts';
import { TAB_TITLES } from './sync.ts';
import {
  loadAdDays, loadAliases, loadDisparos, loadEditionOverrides, loadMetaWindows, loadSnapshotTimes, loadSnapshots,
} from './store.ts';
import { loadLive } from './sources/platform.ts';
```

2. Substituir a declaração de `PANEL_TABS` por:

```ts
export const PANEL_TABS = [
  'pesquisa', 'aplicacoes', 'aovivo', 'agendamentos', 'vendas', 'compradores', 'api', 'disparos', 'edicao', 'criativos', 'validacao',
] as const;
```

3. Dentro de `export type TabData = { … }`, acrescentar ao fim:

```ts
  criativos: CreativeExtra[];
  validacao: ReconRow[];
```

4. Dentro de `const NEEDS = { … }`, acrescentar ao fim:

```ts
  criativos: ['capture', 'survey', 'schedule', 'sales'],
  validacao: ['capture', 'applications', 'schedule', 'sales', 'survey'],
```

5. Dentro de `const BUILDERS = { … }`, acrescentar ao fim (antes do `};`):

```ts
  // Todas as edições selecionadas, no período (como o dash antigo). As colunas do Meta seguem a 1ª edição.
  criativos: async c => creativeExtras(
    c.leads, c.surveys, deals(c).filter(d => inSel(c, d.edition) && inRange(d.scheduledAt, c.range)),
    salesOf(c), await loadAliases(),
  ),
  // Conferência por edição: oficial (plataforma, Meta, linhas da planilha) × números digitados na Visão Geral.
  validacao: async c => {
    const [live, meta] = await Promise.all([liveByEdition(c), adsOf(c)]);
    const apps = applications(c), ds = deals(c), ss = typed(c.snap.sales, toSaleRows);
    const checks = sheetChecks(c);
    const rows: ReconRow[] = [];
    c.eds.forEach(e => {
      const n = e.number, st = live[n] ?? null;
      const leadsN = c.captures.filter(x => x.edition === n).length;
      const win = meta.ads.filter(a => a.date >= e.windowStart && a.date <= e.windowEnd);
      const myDeals = ds.filter(d => d.edition === n);
      const mySales = ss.filter(s => s.approved && s.edition === n);
      const official: OfficialNumbers = {
        peak: st ? st.peak : null,
        attendance: st && leadsN ? (st.peak / leadsN) * 100 : null,
        metaSpend: win.length ? win.reduce((t, a) => t + a.spend, 0) : null,
        applications: apps.filter(a => a.complete && a.edition === n).length,
        scheduled: myDeals.length,
        done: myDeals.filter(dealDone).length,
        sales: mySales.length,
        revenue: mySales.reduce((t, s) => t + saleValue(s), 0),
      };
      reconcileEdition(n, official, checks[n]).forEach(r => rows.push(r));
    });
    return rows;
  },
```

- [ ] **Step 2: Criativos**

Substituir `src/components/marketing/CreativesTab.tsx` por:

```tsx
'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { MarketingView } from '@/lib/marketing/view';
import type { CreativeStats } from '@/lib/marketing/metrics';
import { sortCreatives, type CreativeExtra, type CreativeSort } from '@/lib/marketing/breakdowns';
import { useTabData } from './useTabData';

const brl = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`);
const BAND: Record<string, string> = { sonho: 'bg-emerald-500/20 text-emerald-300', bom: 'bg-lime-500/20 text-lime-300', limite: 'bg-amber-500/20 text-amber-300', acima: 'bg-red-500/20 text-red-300' };
// Ordem e desempates do dash antigo (vendas high ticket → agendamentos → leads etc.).
const SORTS: [CreativeSort, string][] = [['vendas', 'Vendas HT'], ['agend', 'Agendamentos'], ['leads', 'Leads'], ['qualif', 'Qualificação']];
type Row = { family: string; c: CreativeStats | null; x: CreativeExtra | null };
const NO_AD = 'Sem anúncio do Meta com este criativo na janela da 1ª edição selecionada';

export default function CreativesTab({ view, onSaved, query }: { view: MarketingView; onSaved: () => void; query: string }) {
  const [alias, setAlias] = useState({ raw: '', family: '' });
  const [saveError, setSaveError] = useState('');
  const [sort, setSort] = useState<CreativeSort>('vendas');
  const { data: extra } = useTabData<CreativeExtra[]>('criativos', query);

  const byFamily: Record<string, CreativeExtra> = {};
  (extra ?? []).forEach(x => { byFamily[x.family] = x; });
  const seen: Record<string, true> = {};
  const rows: Row[] = view.creatives.map(c => { seen[c.family] = true; return { family: c.family, c, x: byFamily[c.family] ?? null }; });
  (extra ?? []).forEach(x => { if (!seen[x.family]) rows.push({ family: x.family, c: null, x }); });
  const dash = (title: string) => <span className="text-muted-foreground" title={title}>—</span>;
  const loadingExtra = extra === null ? 'Carregando…' : 'Sem lead, agendamento ou venda deste criativo';

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label="Ordenar criativos" className="inline-flex h-8 w-fit items-center rounded-lg border border-border bg-input/20 p-0.5">
        {SORTS.map(([k, l]) => (
          <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}
            className={`h-7 rounded-md px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 ${sort === k ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{l}</button>
        ))}
      </div>

      <p className="-mt-3 text-[11px] text-muted-foreground">Vendas, gasto, CPA, IC e taxas: Meta + ingressos da 1ª edição selecionada. Leads, 5k+, agendamentos e vendas high ticket: todas as edições selecionadas.</p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Criativo</TableHead><TableHead className="text-right">Vendas</TableHead><TableHead className="text-right">Gasto</TableHead>
              <TableHead className="text-right">CPA</TableHead><TableHead className="text-right">IC</TableHead><TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">Hook</TableHead><TableHead className="text-right">Body</TableHead>
              <TableHead className="text-right">Leads</TableHead><TableHead className="text-right">5k+</TableHead><TableHead className="text-right">Agend.</TableHead>
              <TableHead className="text-center" title="vendas high ticket: Power · Start · Desafio">Pw · St · Des</TableHead><TableHead>Post</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortCreatives(rows, sort).map(({ family, c, x }) => (
              <TableRow key={family}>
                <TableCell className="font-medium">{family}</TableCell>
                <TableCell className="text-right tabular-nums">{c ? c.sales : dash(NO_AD)}</TableCell>
                <TableCell className="text-right tabular-nums">{c ? brl(c.spend) : dash(NO_AD)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {!c ? dash(NO_AD) : c.band ? <span className={`rounded px-1.5 py-0.5 ${BAND[c.band]}`}>{brl(c.cpa)}</span> : brl(c.cpa)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c ? c.ic : dash(NO_AD)}</TableCell>
                <TableCell className="text-right tabular-nums">{c ? pct(c.ctr) : dash(NO_AD)}</TableCell>
                <TableCell className="text-right tabular-nums">{c ? pct(c.hookRate) : dash(NO_AD)}</TableCell>
                <TableCell className="text-right tabular-nums">{c ? pct(c.bodyRate) : dash(NO_AD)}</TableCell>
                <TableCell className="text-right tabular-nums">{x ? x.leads : dash(loadingExtra)}</TableCell>
                <TableCell className="text-right tabular-nums" title={x && x.qualifiedRate === null ? 'Sem leads deste criativo' : undefined}>{x ? pct(x.qualifiedRate) : dash(loadingExtra)}</TableCell>
                <TableCell className="text-right tabular-nums">{x ? x.scheduled : dash(loadingExtra)}</TableCell>
                <TableCell className="text-center tabular-nums">{x ? <><span className="text-amber-300">{x.power}</span> · <span className="text-sky-300">{x.start}</span> · <span className="text-red-300">{x.desafio}</span></> : dash(loadingExtra)}</TableCell>
                <TableCell>{view.permalinks[family] ? <a className="underline" href={view.permalinks[family]} target="_blank" rel="noopener noreferrer">abrir</a> : '—'}</TableCell>
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
            setSaveError('');
            try {
              const res = await fetch('/api/marketing/config', { method: 'POST', body: JSON.stringify({ alias }) });
              if (res.ok) { setAlias({ raw: '', family: '' }); onSaved(); } else setSaveError('Não foi possível salvar');
            } catch { setSaveError('Não foi possível salvar'); }
          }}>Associar</Button>
          {saveError && <p role="alert" className="text-xs text-red-400">{saveError}</p>}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Validação**

Substituir `src/components/marketing/ValidationTab.tsx` por:

```tsx
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import type { MarketingView } from '@/lib/marketing/view';
import type { ReconRow } from '@/lib/marketing/reconcile';
import { useTabData } from './useTabData';

const MONEY = ['metaSpend', 'revenue'];
function fmt(key: string, n: number | null): string {
  if (n === null) return '—';
  if (MONEY.indexOf(key) >= 0) return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (key === 'attendance') return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  return n.toLocaleString('pt-BR');
}

function State({ r }: { r: ReconRow }) {
  if (r.state === 'ok') return <span className="font-medium text-emerald-400">✓ igual</span>;
  if (r.state === 'so_planilha') return <span className="text-muted-foreground" title="A plataforma não tem este número para a edição">só planilha</span>;
  if (r.state === 'so_plataforma') return <span className="text-muted-foreground" title="A Visão Geral está vazia para esta métrica">só plataforma</span>;
  const sign = (r.diff ?? 0) > 0 ? '+' : '';
  const pctTxt = r.diffPct === null ? '' : ` (${sign}${(r.diffPct * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)`;
  return <span className="font-medium text-amber-400">⚠ {sign}{fmt(r.key, r.diff)}{pctTxt}</span>;
}

export default function ValidationTab({ view, query }: { view: MarketingView; query: string }) {
  const { data: recon, error } = useTabData<ReconRow[]>('validacao', query);
  const ht = view.buyers.filter(b => b.product !== 'Ingresso');
  const tk = view.buyers.filter(b => b.product === 'Ingresso');
  const share = (list: typeof ht, pred: (b: (typeof ht)[number]) => boolean) =>
    list.length ? `${list.filter(pred).length} de ${list.length}` : '—';

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-medium">Conferência entre fontes <span className="text-xs font-normal text-muted-foreground">· oficial (plataforma, Meta, linhas da planilha) × números digitados na Visão Geral</span></h2>
        {!recon ? (
          <p role={error ? 'alert' : undefined} className={`text-xs ${error ? 'text-red-400' : 'text-muted-foreground'}`}>{error || 'Carregando…'}</p>
        ) : !recon.length ? (
          <p className="text-xs text-muted-foreground">Sem números para conferir nas edições selecionadas.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Edição</TableHead><TableHead>Métrica</TableHead><TableHead className="text-right">Oficial</TableHead>
                <TableHead className="text-right">Visão Geral</TableHead><TableHead>Conferência</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {recon.map(r => (
                  <TableRow key={`${r.edition}-${r.key}`}>
                    <TableCell>#{String(r.edition).padStart(3, '0')}</TableCell><TableCell>{r.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.key, r.official)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.key, r.sheet)}</TableCell>
                    <TableCell><State r={r} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

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

- [ ] **Step 4: Passar `query`**

Em `MarketingDashboard.tsx`, trocar `<CreativesTab view={view} onSaved={() => load(selected, range)} />` por `<CreativesTab view={view} query={query} onSaved={() => load(selected, range)} />` e `<ValidationTab view={view} />` por `<ValidationTab view={view} query={query} />`.

- [ ] **Step 5: Verificar**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: PASS.

Manual:
- Resultado → Criativos: colunas novas Leads, 5k+, Agend., Pw · St · Des; nota acima da tabela diz que Meta/ingressos são da 1ª edição e o resto soma todas as selecionadas; os botões Vendas HT / Agendamentos / Leads / Qualificação reordenam com os desempates do HTML; criativo só com leads aparece com "—" (hover explica) nas colunas do Meta. Selecionar #021 e #022: os leads de um criativo = soma das duas edições.
- Resultado → Validação: tabela "Conferência entre fontes" por edição; números iguais com ✓, divergentes com ⚠ e diferença, vazios na Visão Geral como "só plataforma".

- [ ] **Step 6: Commit**

```bash
git add src/lib/marketing/tabs.ts src/components/marketing/CreativesTab.tsx src/components/marketing/ValidationTab.tsx src/components/marketing/MarketingDashboard.tsx
git commit -m "feat(marketing): creative leads/qualification/schedules/sales and source reconciliation"
```

---

### Task 19: Import único dos disparos do HTML antigo (script fora do repositório)

**Files:**
- Create (fora do repo, nunca commitado): `C:\Projetos\Clientes\Mentoria Power\scratch\import-disparos.mjs`

**Interfaces:**
- Consumes: tabela `mkt_disparos` (Task 10); `dash-exemplo.md` local (fora do git); `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- Produces: linhas de convite e recuperação em `mkt_disparos`, **só se a tabela estiver vazia**. A lista de compradores do HTML (`DISPAROS.convite.vendas`, com nomes) **não** é lida para o banco.

- [ ] **Step 1: Escrever o script**

Criar `C:\Projetos\Clientes\Mentoria Power\scratch\import-disparos.mjs` (pasta irmã do repositório):

```js
// Import único dos disparos do dash HTML antigo para mkt_disparos. Só insere, e só se a tabela estiver vazia.
// Uso (na raiz do repo): node "../scratch/import-disparos.mjs" dash-exemplo.md .env.local
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const [htmlPath, envPath] = process.argv.slice(2);
if (!htmlPath || !envPath) { console.error('uso: node import-disparos.mjs <dash-exemplo.md> <.env.local>'); process.exit(1); }

const env = Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/)
  .filter(l => /^[A-Z_]+=/.test(l))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente no .env.local');

const src = readFileSync(htmlPath, 'utf8');
// Recorta o literal `const NOME = {...};` / `[...];` e avalia isolado (sem acesso a nada do processo).
function literal(start, end) {
  const i = src.indexOf(start);
  if (i < 0) throw new Error(`não achei "${start}"`);
  const j = src.indexOf(end, i);
  return vm.runInNewContext(`(${src.slice(i + start.length - 1, j + 2)})`, {}, { timeout: 1000 });
}
const D = literal('const DISPAROS = {', '\n};');
const T = literal('const DISPAROS_TEMPLATES = [', '\n];');

// Template = rótulo (V1/V2) + texto da versão que rodou + sequência pós-clique, quando existe no HTML.
function template(it) {
  const t = it.key && T.find(x => x.key === it.key);
  const v = t && t.versoes.find(x => x.v === it.template);
  if (!t || !v) return it.template || null;
  return `${it.template}\n\n${v.texto}\n\n— Mensagem 02 —\n${t.msg02}\n\n— Mensagem 03 —\n${t.msg03}`;
}
const row = (kind, it) => ({
  kind, ciclo: it.ciclo != null ? String(it.ciclo) : null, nome: it.nome, data: it.data || null,
  contatos: it.contatos ?? null, agendamentos: it.agend ?? null, vendas: it.vendas ?? null,
  faturamento: it.faturamento ?? null, custo: it.custo ?? null, template: template(it),
});
// Só convites e recuperação. D.convite.vendas (compradores, com nomes) fica de fora de propósito.
const rows = D.convite.itens.map(it => row('convite', it)).concat(D.recuperacao.itens.map(it => row('recuperacao', it)));

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const existing = await fetch(`${url}/rest/v1/mkt_disparos?select=id&limit=1`, { headers }).then(r => r.json());
if (!Array.isArray(existing)) throw new Error(`leitura falhou: ${JSON.stringify(existing)}`);
if (existing.length) { console.log('mkt_disparos já tem linhas: nada a fazer.'); process.exit(0); }

const res = await fetch(`${url}/rest/v1/mkt_disparos`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(rows) });
if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
console.log(`${rows.length} disparos importados (${D.convite.itens.length} convites, ${D.recuperacao.itens.length} de recuperação).`);
```

- [ ] **Step 2: Conferir que o script não está no repositório**

Run: `git status --porcelain | grep -i import-disparos || echo "fora do repo: ok"`
Expected: `fora do repo: ok`.

- [ ] **Step 3: Rodar uma vez**

Run (raiz do repo): `node "../scratch/import-disparos.mjs" dash-exemplo.md .env.local`
Expected: `19 disparos importados (7 convites, 12 de recuperação).` (contagem do HTML v11.9). Rodar de novo: `mkt_disparos já tem linhas: nada a fazer.`

- [ ] **Step 4: Conferir no painel**

Manual: Canais → Disparos sem período (valores do HTML v11.9, já somados):
- **Convites** (7 disparos): orçamento R$ 616,11 · 15.375 contatos · 35 agendamentos (0,23%) · custo por agend. R$ 17,60 · 2 vendas · R$ 60.120,00 · ROAS 97,58x.
- **Recuperação** (12 disparos): orçamento R$ 11,45 · 288 contatos · 4 agendamentos (1,39%) · custo por agend. R$ 2,86 · 0 vendas · ROAS 0x (sem faturamento).
- **Total** (19): R$ 627,56 · 15.663 contatos · 39 agendamentos · custo por agend. R$ 16,09 · 2 vendas · ROAS 95,80x.
- Ranking dos convites começa por "API AI 01" (13 agendamentos); clicar mostra o template (rótulo V2 + texto + mensagens 02 e 03).

Sem commit nesta task.

---

### Task 20: Verificação final

**Files:** nenhum novo.

- [ ] **Step 1: Testes, tipos e build**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: todos os testes passam (parse, sheet-rows, editions, survey, applications, sales, deals, api-leads, disparos, live, reconcile, full-funnel, breakdowns, metrics, matching, meta-map, report), sem erro de tipo, build ok.

- [ ] **Step 2: Segredos e dados pessoais fora do repositório**

Run:

```bash
git log -p origin/main..HEAD | grep -iE "docs.google.com/spreadsheets/d/[A-Za-z0-9_-]{20,}|SUPABASE_SERVICE_ROLE_KEY=|EAA[A-Za-z0-9]{20,}" || echo "limpo"
git status --porcelain
```

Expected: `limpo`; `dash-exemplo.md` e `scratch/` não aparecem como arquivos a commitar.

- [ ] **Step 3: Checklist manual (Preview ou `npm run dev`, logado como admin)**

- [ ] `/api/marketing/data` sem `tab` devolve o mesmo formato de antes; `?tab=xyz` → 400; deslogado → 401 em `data`, `disparos` (POST/PATCH/DELETE), `settings`.
- [ ] Atualizar: sem aviso novo; se algum aparecer, a mensagem diz a aba e as colunas que faltam.
- [ ] **Verificação do usuário** (o implementador não abre o HTML): #018, #019 e #020 (Histórico NF10K), considerando só registros com data até **06/10/2026** (véspera da live do #021), batem com o dash antigo em Pesquisa (taxa de resposta, qualificados, qualidade), Aplicações (completas, qualificadas), Agendamentos (total, realizadas, perdas, ganhos), Vendas (aprovadas, faturamento) e API (leads, qualificados). Diferenças **esperadas e documentadas** (não são bug):
  - atribuição de edição: o painel usa o ciclo inteiro (#015 em diante); o HTML só olhava #015–#020, então o #020 do HTML absorvia aplicações/negócios posteriores sem par, que aqui vão para #021+;
  - presença (pico, até o pitch, ao vivo) vem da plataforma, não dos CSVs do HTML;
  - o funil da Edição usa as linhas (Typeform, Pipedrive, Detalhamento Vendas), não os totais digitados na Visão Geral (esses só aparecem em Validação);
  - registros sem edição identificada aparecem como "sem edição" em vez de entrar em todas as seleções;
  - palavras-chave dos desafios comparam stopwords sem acento (ranking pode mudar um pouco);
  - Compradores excluem reembolsos;
  - venda com STATUS vazio ou diferente de "Aprovada" que não seja reembolso conta como venda; Ticket "16.788" vale 16.788.
- [ ] #021 e #022 selecionadas, depois da live de #022: a nota do Funil completo termina com **"#021 65 · #022 41 vendas"** (corte "dia seguinte à live anterior → véspera da live", filtro `WB PG`) e a variação de "Vendas (UTM)" é (41 − 65) ÷ 65 = **−36,9%**.
- [ ] Tempo: no DevTools, `?tab=edicao` com 3 ou mais edições, segunda chamada na mesma instância ("warm"), abaixo de **3 s**; voltar a uma aba já aberta não gera chamada nova.
- [ ] Fonte vazia: aba da planilha sem dados mostra "Fonte sem dados: … Clique em Atualizar.", nunca zeros.
- [ ] Ingresso em edição NF10K mostra "não se aplica"; nenhum número vazio aparece como 0.
- [ ] Listas de pessoas só aparecem ao abrir as seções recolhíveis (DevTools: chamadas com `lists=1` só nessa hora).
- [ ] Configurações → Integrações: 6 gids, filtro de campanha editável; token nunca aparece inteiro.
- [ ] Celular (360 px): grupos de abas, tabelas com rolagem horizontal, nada estoura a largura.
- [ ] `/ao-vivo`, `/espera` e cadastro continuam funcionando (não foram tocados).

- [ ] **Step 4: Commit (se algo foi ajustado no checklist)**

```bash
git status --porcelain
git add -A src supabase docs && git commit -m "fix(marketing): phase 3 final review adjustments"
```

(Se nada mudou, não há commit.)
