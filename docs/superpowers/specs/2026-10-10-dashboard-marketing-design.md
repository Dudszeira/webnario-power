# Dashboard de Marketing integrado — Design

Data: 2026-10-10 · Prazo da fase 1: call da semana de 2026-10-12

## Objetivo

Levar para dentro da plataforma do webinário o relatório de marketing que hoje vive no
`app.mentoriapower.com.br/dash-marketing` (HTML que lê a planilha do Google) e nos reports
escritos à mão, automatizando a coleta e cruzando as fontes. O Meta não é fonte de verdade
para vendas: vendas vêm das UTMs da Guru; o Meta entra com investimento, IC, CTR e entrega.

Tudo precisa ser **filtrável por edição do webinário** (#021, #022…). Esse é o eixo do painel.

## Funil (perpétuo semanal)

```
Anúncio (Meta) → Ingresso R$9,90 (Guru) → Webinário ao vivo (esta plataforma)
  → Aplicação (Typeform) → Call (Pipedrive) → Venda Power / Start (Guru)
```

- **Frente:** investimento → ingressos → CPA, ROAS, IC.
- **Fundo:** comprador do ingresso → entrou na live → ficou até o pitch → aplicou → agendou
  → call realizada → venda high ticket. Daí: custo por call agendada/realizada e ROAS real.
- **NF10K** (webinário gratuito anterior) fica como histórico. **Disparos API** continua manual.

## Regra inviolável: não afetar o que funciona

- Só adição: rotas `/admin/marketing`, `/api/marketing/*`, tabelas `mkt_*`. Nenhuma tabela
  existente (`registrations`, `events`, `editions`, `comments`) muda de estrutura; o painel
  apenas **lê** presença e cadastros.
- Nada roda em `/espera`, `/ao-vivo` ou `/api/cadastro`. Consultas pesadas só no refresh
  do painel ou no cron.
- Falha de fonte externa mostra "fonte indisponível" só no painel de marketing.
- Planilha: somente leitura. O dash atual da Ellen continua funcionando em paralelo.
- Única mudança no admin atual: um item "Marketing" no menu lateral.
- Desenvolvimento em branch, validado em Preview da Vercel, merge fora de dia de live.

## Fontes e conectores

Cada conector é um módulo em `src/lib/marketing/sources/` com uma função `fetch…()` que
devolve linhas normalizadas. Trocar uma fonte (ex.: planilha → API do Pipedrive) não mexe
no painel.

| Conector | Origem | Dados |
|---|---|---|
| `sheet` | Export CSV do Google Sheets (mesma planilha do dash atual) | Captação, Pesquisa, Aplicações (Typeform), Detalhamento Agendamentos (Pipedrive), Detalhamento Vendas (Guru, ingresso e high ticket), Visão Geral, Detalhamento API |
| `meta` | Meta Marketing API (Graph API, `ads_read`) | Por anúncio × dia: gasto, impressões, cliques, CTR, `initiate_checkout`, landing page views, vídeo (3s e ThruPlay p/ hook/body rate), nome do anúncio/conjunto/campanha, link do post; histórico de orçamento dos conjuntos (activity log) |
| `platform` | Supabase desta plataforma | Cadastros, `enter_live`, `heartbeat` (tempo assistido), `cta_click`, marcador de pitch da edição |

Os nomes das abas ficam configuráveis (como no dash atual), não fixos no código.

## Cache e atualização

- Tabelas `mkt_meta_ad_daily`, `mkt_meta_budget_changes`, `mkt_sheet_snapshot` (JSON por aba)
  e `mkt_sync_runs` (quando rodou, sucesso/erro por fonte).
- **Plano Hobby da Vercel só permite cron diário.** Então:
  - cron diário de madrugada sincroniza tudo;
  - ao abrir o painel, se a última sincronização tiver mais de 30 min, dispara em segundo plano;
  - botão "Atualizar agora".
- Meta: busca incremental dos últimos 7 dias a cada sync (o Meta revisa números retroativos)
  e o histórico completo só na primeira carga.

## Edição como eixo

- O ID da edição na plataforma é a data da live (`YYYY-MM-DD`); a planilha usa número (#022).
- Tabela `mkt_editions`: número, data da live, início e fim da janela de captação, metas de
  CPA (dos sonhos / bom / limite). Preenchida automaticamente pela aba Visão Geral
  (número + data); janelas e metas editáveis numa tela de configuração.
- Atribuição à edição:
  - vendas de ingresso, aplicações e agendamentos: pela coluna de webinário/UTM da planilha,
    como o dash atual já faz; sem isso, pela data dentro da janela da edição;
  - gasto do Meta: pelo dia, dentro da janela de captação da edição.
- Filtro global no topo: uma ou várias edições, mais período livre (data inicial/final).

## Criativos

- Ligação lead/venda ↔ anúncio: `utm_content` = nome do anúncio no Meta.
- **Família de criativo:** agrupamento automático por prefixo (`img_01`, `img_01.2`,
  `img_01.3` → `img_01`; remove "cópia de…"), com ajuste manual salvo em `mkt_creative_alias`.
- Lista "sem correspondência": `utm_content` sem anúncio e anúncios com gasto sem UTM,
  para associar uma vez.

## Painel `/admin/marketing` — fase 1 (para a call)

1. **Edição:** frente (vendas, investimento, ROAS, CPA da campanha e dos anúncios que
   venderam, IC e custo por IC) e fundo (entraram na live, até o pitch, aplicações,
   agendamentos, calls realizadas, vendas Power/Start, custo por call agendada/realizada).
2. **Criativos:** por família — vendas, gasto, CPA com cor pelas metas, IC, CTR, link do post;
   janelas 1/3/7 dias com rótulo (estável, caindo, caindo forte, sem entrega); "gastando sem vender".
3. **Validação:**
   - compradores (Guru) × plataforma: cadastrou, entrou, tempo assistido, ficou até o pitch,
     clicou no CTA. Casamento por e-mail; fallback por telefone via Captação; o resto aparece
     como "sem vínculo"; casos de IP compartilhado sinalizados;
   - IC do pixel × vendas por UTM, por criativo e por dia.
4. **Copiar report:** fechamento do dia, report da edição e análise 1-3-7, em texto pronto
   para WhatsApp, no formato dos reports atuais.

## Fase 2

- Interpretação por IA: recebe só números agregados (nunca nome, e-mail ou telefone),
  gera a seção de análise marcada como "sugestão da IA", sob demanda (botão). Via Vercel AI
  Gateway com modelo Claude configurável por variável de ambiente.
- Desgaste: CTR do início × últimos dias por criativo.
- Comparação com a edição anterior no mesmo ponto (ex.: 37h após a abertura).
- Histórico de orçamento por conjunto com alerta de aumento acima de 20% ao dia.

## Fase 3

Portar as abas restantes do dash atual: Pesquisa, Compradores, Agendamentos, Aplicações,
Ao Vivo (já nativo), API e histórico NF10K. Depois disso o dash HTML pode ser aposentado.

## Variáveis de ambiente novas

`META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `MKT_SHEET_ID`, `CRON_SECRET`;
fase 2: `AI_GATEWAY_API_KEY`, `MKT_AI_MODEL`.

## Acesso ao Meta (passo a passo para um admin do Business Manager)

1. Configurações do negócio → Usuários → Usuários do sistema → Adicionar (função: Funcionário).
2. Atribuir ativos → Contas de anúncios → a conta do webinário → permissão "Ver desempenho".
3. Gerar token → app do negócio → permissão `ads_read` (e `read_insights`) → validade "Nunca".
4. Enviar o token e o ID da conta (`act_…`) por canal privado; vão direto para a Vercel.

## Testes

- Cálculos (CPA, ROAS, janelas 1/3/7, famílias, atribuição por edição, casamento comprador ×
  presença) em funções puras, com um arquivo de teste usando a edição #022 dos reports como
  caso real: os números do painel precisam bater com os reports de 08/10.
- Conferência lado a lado com o dash atual para as mesmas edições antes de anunciar.
- Build e Preview da Vercel antes do merge; nenhum arquivo do fluxo da live alterado no diff.

## Riscos

- A planilha é pública por link e contém e-mails; o conector usa o mesmo acesso de hoje.
  Migrar para conta de serviço do Google fica como melhoria.
- Mudança de nome de aba/coluna na planilha quebra o conector: o sync registra o erro e o
  painel mostra qual aba falhou.
- Limites da API do Meta: mitigados pelo cache e pela busca incremental.
