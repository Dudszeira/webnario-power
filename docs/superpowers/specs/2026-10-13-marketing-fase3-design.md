# Dashboard de Marketing — Fase 3 (portar o dash antigo) — Design

Data: 2026-10-13 · Continua `2026-10-10-dashboard-marketing-design.md` (fases 1 e v2 no ar).

## Objetivo

Trazer para `/admin/marketing` tudo o que o dash HTML antigo mostrava (Pesquisa, Aplicações,
Ao vivo, Agendamentos, Vendas, Compradores, API, Disparos e o histórico NF10K), para
aposentar o HTML. **A plataforma passa a ser a visão principal e oficial; a planilha é backup
e fonte de conferência.** Tudo continua filtrável por edição e período.

Referência das regras: o HTML antigo (v11.9), lido na íntegra a partir de uma cópia local
fora do git (contém o link da planilha). As regras abaixo reproduzem o código dele, salvo onde
indicado.

## Regras invioláveis (herdadas)

- Só adição: nenhuma tabela existente muda; `mkt_*` novas só com `create … if not exists`.
- Nada roda em `/espera`, `/ao-vivo`, `/api/cadastro`; não mexer em `db.ts`, `auth.ts`, `edition.ts`.
- Planilha somente leitura. Token do Meta nunca vai ao navegador.
- Nenhum dado configurado (settings, metas, aliases) é apagado.
- Tudo dentro da página Marketing — nenhum item novo no menu lateral.

## Precedência de fontes

| Métrica | Oficial | Conferência |
|---|---|---|
| Presença, pico, até o pitch, CTA | Plataforma (`events`, `registrations`) | Visão Geral: Pico, Comparecimento |
| Gasto, entrega | Meta API, campanhas filtradas por nome | Visão Geral: Investimento Captação Meta / Total |
| Vendas | Linhas de Detalhamento Vendas (UTM) | Compras do pixel; Visão Geral: Vendas/Faturamento |
| Aplicações | Linhas do Typeform | Visão Geral: Aplicações |
| Agendamentos, calls | Linhas do Detalhamento Agendamentos | Visão Geral: Agendamentos/Realizadas PWR+PWS |
| Disparos | Tabela `mkt_disparos` | — |

Totais digitados da Visão Geral **nunca** são o número principal quando existe dado linha a
linha; aparecem só na conferência.

## Definições

- **Qualificado na pesquisa (5k+):** Renda Familiar Mensal ∈ {5a7k, 7a10k, 10a15k, 15a20k,
  20a30k, 30a50k, mais50k}. Pesquisa ligada ao lead por e-mail (minúsculo); vale a resposta
  mais recente; respostas anteriores ao início do ciclo (primeira captação do ciclo − 1 dia)
  são ignoradas. Usado em Pesquisa, Criativos, API, Compradores.
- **Aplicação qualificada:** coluna `produto` do Typeform ∈ {Power, Start}. Desafio = não
  qualificada. Usado em Aplicações e no funil.
- **Produto (vendas e negócios):** `power start` / começa com `start` / `pws` → Power Start;
  `power` sem `start` → Power; contém `desafio` → Desafio; senão Outro. Ticket vazio usa o
  padrão {Power Start 1997, Power 20040, Desafio 997}.
- **Reembolso:** STATUS casa `/reembol|estorno|cancel/i`; excluído de toda contagem de venda.
- **NF10K × Pago:** pelo número do webinário. #015–#020 = histórico NF10K; #021+ = Pago.
  O seletor de edições agrupa "Pago" e "Histórico NF10K". Em edições NF10K, métricas que só
  existem no pago (ingresso, CPA de ingresso, IC) mostram "não se aplica".
- **Filtro de campanha do Meta:** só entra gasto de campanhas cujo nome contém o valor de
  `meta_campaign_filter` (padrão `WB PG`, editável em Configurações → Integrações). Aplicado
  na leitura; nada é apagado do cache. Filtro vazio = todas as campanhas.

## Fontes e sync

O sync diário (e o botão Atualizar) passa a guardar em `mkt_sheet_snapshot`, além das abas
atuais:

| Chave | Aba | gid padrão |
|---|---|---|
| `survey` | Pesquisa [novo] | 503784201 |
| `applications` | Análise Individual (Typeform) | 336862755 |
| `overview` | Visão Geral (todas as colunas) | 214347056 |

E lê as colunas que hoje ficam de fora em Captação (`utm_term`, `nome`), Vendas (UTMs de
captação e venda, `Edição`) e Agendamentos (`Título`, `Valor`, `Renda Mensal`,
`Produto (certo)`, `utm_campaign`, `utm_medium`).

- gids editáveis em Configurações → Integrações → Avançado (como os atuais).
- Conferência de cabeçalho passa a normalizar espaços e quebras de linha antes de comparar
  (a Visão Geral tem `"Investimento Total \nAPI"` e espaços duplos). Coluna obrigatória
  ausente → aviso da fonte no painel; colunas opcionais ausentes → métrica "—".
- Abas paradas (Detalhamento API até #008, Ligue Lead, aba "Ao vivo") **não** são lidas.
  Custo de disparo vem de `mkt_disparos`.

## Banco (novo)

```sql
create table if not exists mkt_disparos (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('convite','recuperacao')),
  ciclo text, nome text not null, data date,
  contatos int, agendamentos int, vendas int,
  faturamento numeric, custo numeric, template text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table mkt_disparos enable row level security;
```

`mkt_settings` ganha a chave `meta_campaign_filter` (linha nova, sem alterar a tabela).

Import único dos disparos que estão no HTML antigo (convites e recuperação), **sem** a lista
de compradores. Feito por script local que só insere; não vai para o repositório.

## Cálculo — módulos puros (`src/lib/marketing/`, com testes)

Seguem o padrão atual: imports relativos `.ts`, sem `@/`, sem I/O.

- **`survey.ts`** — junção Pesquisa × Captação; `qualified5k`; distribuições em ordem fixa
  (renda, faturamento, tempo, serviço, conhece) com rótulos; filtro de renda (faixas simples
  e 3k+/5k+/7k+/10k+/20k+); desafios: frases normalizadas (minúsculas, espaços colapsados,
  pontuação final removida) com contagem, e palavras-chave por pares de palavras (ignora
  palavras < 4 letras, stopwords e pares só de verbos vagos; top 15, até 3 exemplos).
- **`applications.ts`** — `Submitted At` − 3h (UTC → Brasília); `01/01/0001` = nulo;
  completa = tem produto, renda ou faturamento; deduplicação por telefone (dígitos), senão
  e-mail, senão nome: das completas fica a mais recente e conta repetições; incompletas caem
  se a pessoa completou depois. Webinário: e-mail → captação mais recente do ciclo até a
  submissão; senão última live até a data (marcada `*`). Origem: plataforma+botao "Botão da
  plataforma", plataforma+comentarios "Comentários", whats+grupo "Grupo WhatsApp · msg N",
  whats+replay "Replay WhatsApp · msg N", api "API {campanha} · msg N", vazio "(sem utm)".
- **`deals.ts`** — uma linha = um negócio. Nome sem prefixo `SE - `/`WB - `; tipo pelo
  prefixo; via: "comercial" → Comercial, "autom" → Automático; produto: `Produto (certo)`,
  senão WB → Power, SE → Start. Venda casada por e-mail (senão nome normalizado). Status:

  ```
  ganho/venda → ganho (ou reembolsado)
  motivo da perda → perdido
  Realizada começa com "sim" → realizada
  /reagend/ → reagendada · /cancel/ → cancelada · /no show/ → nao_realizada
  /^n[aã]o/ → call futura ? agendada : nao_realizada
  vazio → call passada ? sem_registro : agendada
  ```
  `realizada` guardado à parte (perdido depois de call = perdido && realizada).
  "Hoje" = data de Brasília, passado como parâmetro (testável).
  Webinário: coluna WEBNÁRIO → e-mail na captação (inscrição mais recente até agendamento + 1
  dia) → última live até a data do agendamento. Momento: dia do agendamento − dia da live
  (<0 antes, 0 no dia, >0 depois); categoria exclusiva ganho / perdeu depois da call /
  perdeu sem call (nao_realizada, perdido sem call, cancelada) / em andamento / aberto.
  Criativos que perdem: chave utm_content do negócio (senão do lead); perda = não
  compareceu + cancelada + perdido sem call; só n ≥ 3; cores ≥60% vermelho, ≥40% amarelo.
  Custo por call: gasto oficial da edição ÷ negócios da edição (Power/Start por produto);
  edição sem gasto = "n/d", fora do total. Alertas: call > 14 dias após agendar, call antes do
  agendamento, sem_registro, sem closer.
- **`sales.ts`** — público pela UTM de captação, nesta ordem: api (source api ou content
  `^apiweb`) · e-mail (source email, medium contém base-geral) · frio (campanha contém frio) ·
  quente (campanha ou medium contém quente) · bio (bio, linktr, `pwr_perpetuo`) · Instagram
  orgânico (`web_01_26` ou medium manychat) · outros (oculto). Origem normalizada: ig, fb,
  an, th, msgr, metaads… = Meta Ads, salvo orgânico (stories, manychat, bio, linktr).
  Compradores × Pesquisa por e-mail.
- **`api-leads.ts`** — captação com `utm_source = api`: base = medium, versão = term,
  tipo = campaign, disparo = content; leads e qualificados 5k+ por base, versão, disparo,
  matriz base × versão, por dia; vendas com source de captação api.
- **`disparos.ts`** — agregados de `mkt_disparos`: orçamento, agendamentos (% contatos),
  custo por agendamento, vendas, ROAS = faturamento ÷ custo; blocos convite/recuperação/total.
- **`live.ts`** — a partir de presença da plataforma (entrada, heartbeats): curva por minuto
  desde 20:00 (até 240 min, corta a cauda abaixo de max(2, 5% do pico)), pico e minuto,
  média e mediana (só quem assistiu > 0), até o pitch, 30+ e 60+ min, CTA, histograma
  (≤5, 5–15, 15–30, 30–45, 45–60, 60–75, 75+).
- **`reconcile.ts`** — por edição e métrica: oficial, planilha, diferença absoluta e %;
  estado `ok` (igual), `diverge`, `so_planilha`, `so_plataforma`.

Todos os cálculos ficam em funções puras testadas com casos anonimizados das regras acima.
Conferência manual: números de #018–#020 batem com o HTML antigo.

## API

- `GET /api/marketing/data?tab=<edicao|criativos|validacao|pesquisa|aplicacoes|aovivo|agendamentos|vendas|compradores|api|disparos>`
  + filtros atuais (edições, período). Calcula só aquela aba. Admin only. Listas de pessoas
  só com `&lists=1` (pedido ao abrir a seção recolhível).
- `GET/POST/PATCH/DELETE /api/marketing/disparos` — admin only, entrada validada; DELETE
  remove uma linha por id (só disparos; nada mais é apagado).
- `/api/marketing/settings` aceita `meta_campaign_filter`.

## Interface (`/admin/marketing`)

Barra de controles atual (edições, período, atualizar, avisos) continua no topo. Abaixo,
abas em dois níveis:

| Grupo | Abas |
|---|---|
| Resultado | Edição · Criativos · Validação |
| Leads | Pesquisa · Aplicações · Ao vivo |
| Comercial | Agendamentos · Vendas · Compradores |
| Canais | API · Disparos |

Mesma identidade visual (cards, KPIs compactos, recharts, cores das metas). Número sem fonte
= "—" com explicação no hover, nunca 0.

- **Edição:** funil ganha "Aplicação qualificada" e se divide em Power | Start (qualificada →
  agendada → realizada → venda); nova tabela "Webinário a webinário" (leads, agendamentos
  antes/no dia/depois, calls feitas, vendas, pico, até o pitch, conversão ao vivo =
  aplicações completas das 20h às 6h ÷ pessoas no pitch).
- **Criativos:** + leads, % qualificados 5k+, agendamentos, vendas por produto; ordenar por
  vendas / agendamentos / leads / qualificação.
- **Validação:** + "Conferência entre fontes" por edição (✓ / ⚠ com diferença / só planilha /
  só plataforma).
- **Pesquisa:** filtro de renda; KPIs taxa de resposta, qualificados 5k+, qualidade;
  gráficos renda (verde = qualificado), faturamento, tempo, serviço, conhece; desafios
  (palavras-chave + frases recolhíveis).
- **Aplicações:** KPIs completas (repetidas, não terminaram), qualificadas, não
  qualificadas, agendaram; origem com qualificados; por webinário; perfil; lista recolhível.
- **Ao vivo:** KPIs; curva por minuto, uma linha por edição, marcador do pitch; histograma.
- **Agendamentos:** KPIs (Power/Start, automático/comercial, realizadas e comparecimento,
  não compareceram, aguardando, perdas por motivo, ganhos); alertas; quando agendaram ×
  resultado; criativos que mais perdem; custo por call por webinário; origem/via/closer;
  tabela recolhível.
- **Vendas:** KPIs; cards por público; por produto, por dia, origem do lead, origem da compra.
- **Compradores:** filtro por produto; KPIs; perfil; desafios; lista.
- **API:** KPIs; por base, versão, disparo; matriz; leads por dia.
- **Disparos:** blocos convite / recuperação / total; ranking com template ao clicar; tabela
  editável (adicionar, editar, remover com confirmação).

Dados pessoais só em listas recolhíveis, só para admin.

## Fora do escopo (fase 2)

Interpretação por IA e notas de reunião, desgaste de CTR, comparação com a edição anterior,
alertas de orçamento, radar semanal.

## Riscos

- Mudança de nome de coluna na planilha: aviso por fonte, métrica "—".
- Volume (Pesquisa ~6 mil, Captação ~8 mil linhas): cálculo por aba no servidor; se ficar
  lento, cachear o resultado por aba no snapshot.
- Regra de status de agendamento depende de "hoje": calculada em horário de Brasília.
