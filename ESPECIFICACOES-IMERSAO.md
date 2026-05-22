# Especificações — Página da Imersão (Live gravada)

## Objetivo da plataforma (live simulada)

O **intuito** é **simular uma live ao vivo**: o conteúdo é gravado e reproduzido de forma **sincronizada** com o relógio do evento (não é interação real-time com quem aparece no vídeo), mas a interface, o timing dos comentários “da gravação”, os CTAs e as **restrições de controle** devem manter a sensação de **transmissão ao vivo dentro da sua plataforma** — não de um vídeo avulso estilo VOD com controle total pelo usuário.

Documento de requisitos funcionais e de produto. Horário padrão: **toda terça-feira, 20:00** (fuso horário a definir no deploy).

---

## 1. Acesso, URLs, bloqueio (IP + e-mail) e uma sessão por edição

### 1.1 Objetivo do bloqueio

O produto é um **perpétuo de live simulada**: a sensação deve ser de **ambiente exclusivo e ao vivo**. Se a mesma pessoa assistir **mais de uma vez** na mesma edição (ou voltar depois de consumir o acesso), corre risco de perceber que é **gravação**. Por isso, na **edição atual** (**4**):

**Regras fechadas (produto):**

1. **Limite por e-mail** — e-mail **normalizado** (minúsculas, trim). Cada e-mail tem **no máximo um** fluxo válido (espera liberada + direito à sala ao vivo) **por edição**.
2. **Limite por IP** — cada **endereço IP** tem **no máximo um** fluxo válido **por edição** (um cadastro / uma participação amarrada àquele IP).
3. **Mesmo e-mail, outro computador (outro IP)** — se o e-mail **já** foi utilizado no cadastro (ou já consumiu acesso) **vinculado a um IP**, tentativa de acesso com o **mesmo e-mail** a partir de **IP diferente** → **bloqueio** (mensagem amigável ou redirect **13**). Evita reabrir a sala em segundo dispositivo com a mesma identidade.

**Uma única janela de interação** na edição: após **consumir** o acesso à sala ao vivo, novas entradas na mesma semana seguem **13** ou bloqueio.

**Nota:** IP compartilhado (rede doméstica, escritório) implica **um único** fluxo por IP por edição; quem precisar de exceção operacional trata **fora** do escopo inicial (“restante vamos fazendo” — ajustes incrementais).

**Replay:** acontece **fora** desta plataforma (canal externo — site, e-mail, comunidade, etc.). **Não** há produto de replay embutido aqui; ver **7.3**.

### 1.2 Rotas e redirecionamentos obrigatórios

| Rota / comportamento | Regra |
|----------------------|--------|
| **`/imersao`** | **Sempre** redirecionar para **`/espera`** se o usuário **não** estiver em estado válido para ir direto à sala ao vivo (sessão elegível + terça ≥ 20:00 + dentro da duração do vídeo + não bloqueado). Ou seja: **não há “entrada direta”** na URL de imersão colada no navegador sem passar pelo funil e pelo relógio. |
| **`/espera`** | **Sala de espera**: countdown, conteúdo de antecipação, **sem** redirect automático para a sala ao vivo **até** a terça **20:00** (ver **4.4**). |
| **Sala ao vivo** (player + chat) | Slug final a definir na implementação (ex.: `/imersao/sala`, `/ao-vivo`). Só acessível via **redirect automático** terça 20h ou **entrada atrasada** válida (**2**), após cadastro na espera e checagens de bloqueio. |

Fluxo resumido: **`/imersao` → `/espera`** → popup nome + e-mail → submit → **espera liberada** (conteúdo completo da sala de espera) → **terça 20:00** → redirect automático para sala ao vivo.

### 1.3 Cadastro na sala de espera (popup)

- Na **`/espera`**, abre-se um **popup** para **nome** e **e-mail**; ao **submit**, o servidor valida **1.1**: e-mail já usado, IP já usado, ou **e-mail já vinculado a outro IP** na edição → **bloqueio**; se ok, **libera** a espera (countdown, textos, etc.).
- Se **e-mail ou IP** já tiverem **consumido** o acesso nesta edição, **não** liberar: exibir mensagem adequada ou redirect conforme **13**.
- Após **quarta-feira (início do novo ciclo pós-reset)** até **terça 19:59**, o usuário cadastrado permanece na **espera** — **sem** redirects para a sala ao vivo antes do horário (**4.4**).

### 1.4 Tabela rápida de requisitos legada

| Requisito | Descrição |
|-----------|-----------|
| **Sem acesso direto por URL** | `/imersao` não entrega a sala; redireciona para **`/espera`**. Sala ao vivo só por fluxo autorizado + janela de tempo. |
| **Uma participação por edição** | **IP + e-mail**: uma única liberação para interagir com espera/sala ao vivo na **semana do ciclo** em que se cadastrou (detalhes em **13** para quem volta em outra semana). |
| **Janela da live** | Terça **20:00** até fim do vídeo (e regras pós-live — **7.3**). |

**Implementação:** validação **server-side** em toda rota sensível; cookie/JWT ou sessão após submit; armazenar `edition_id`, e-mail (ou hash), **IP do cadastro** e, se necessário, flag de **consumo** da sala; ao validar novo request, comparar **e-mail + IP** conforme **1.1** (incl. bloqueio **mesmo e-mail, IP novo**).

---

## 2. Entrada atrasada (sync com minutagem)

- A live **oficial** abre na **terça às 20:00** com **redirect automático** da `/espera` para a sala ao vivo (quem já passou pelo cadastro e não está bloqueado).
- Quando o usuário entra **atrasado**, entre **20:01** e o **fim do tempo corrido** do vídeo da live (duração configurada no admin), o vídeo **já está em reprodução** e o player deve **pular para a minutagem correspondente** ao relógio do evento — exemplos:
  - entrada às **20:20** → **20 minutos** de live já decorridos;
  - entrada às **20:45** → **45 minutos**;
  - generalizar: \( \text{offset} = t_\text{entrada} - 20{:}00 \) no mesmo dia, limitado ao fim do vídeo.
- Objetivo: sensação de **live sincronizada** (live simulada), mesmo sendo conteúdo gravado — vale para **upload** ou **YouTube** como fonte.

---

## 3. CTA (call to action)

- O CTA deve **aparecer às 20:00** (ou no instante configurado da abertura da janela), com **comentários / anotações de link** associados ao CTA (texto auxiliar, descrição do link, etc.).
- Detalhar em implementação: posição na página, texto, URL de destino, e se o CTA é único ou múltiplo ao longo da minutagem.
- **Comentários fixados na hora da oferta:** deve existir função de **fixar** um ou mais comentários (texto, link, destaque visual) **no período do CTA / oferta**, para todos os participantes verem no topo ou em área destacada do chat — ver **6.7**. Pode combinar conteúdo cadastrado no admin e/ou pin manual pela staff durante o evento (definir permissões).

---

## 4. Disponibilidade por dia e redirecionamento semanal

### 4.1 Ciclo “espera” (quarta → terça 19:59)

- **Da quarta-feira até a terça-feira às 19:59** (no ciclo que antecede a próxima live): o usuário que acessa **`/imersao`** ou **`/espera`** fica na **sala de espera** com o comportamento normal (countdown, conteúdo).
- **Neste intervalo não há redirect** da espera para a **sala ao vivo** — o usuário **aguarda** até a terça **20:00**.

### 4.2 Abertura da live (terça 20:00)

- Na **terça às 20:00**: **redirect automático** da **`/espera`** para a **sala ao vivo** (player + chat), para quem:
  - completou o cadastro (popup nome + e-mail) na edição corrente, e
  - **não** está bloqueado por **IP + e-mail** (ainda não consumiu o único acesso — **1**).

### 4.3 Janela da sala ao vivo (terça, durante o vídeo)

- Entre **20:00** e o **fim do tempo corrido** do vídeo (fim da “live” configurado): sala ao vivo acessível conforme **1** e **2** (incluindo entrada atrasada).

### 4.4 Após meia-noite (reset do ciclo)

- **Após 00:00** (quarta inicia): o estado do evento **reseta** para a **próxima imersão** — **próxima terça-feira, 20:00**; novo `edition_id` (ou equivalente) para controle de **IP + e-mail** (**1**).

### 4.5 Resumo visual do ciclo

```
Quarta 00:00 ───────────► Terça 19:59  →  Usuário na /espera (sem redirect para sala ao vivo)
Terça 20:00 ───────────► Fim do vídeo  →  Sala ao vivo + sync se atrasado (2)
Após fim do vídeo       →  Ver 7.3 (perdeu live; replay = externo)
Quarta 00:00            →  Reset da edição; novo ciclo de cadastro/bloqueio
```

*(Ajustar se o “fim oficial” for meia-noite de terça ou horário explícito de término do vídeo — configurável no admin.)*

---

## 5. Fonte do vídeo, player e retenção na plataforma

### 5.1 Duas formas de entrega do conteúdo

| Modo | Uso |
|------|-----|
| **Upload (principal)** | Vídeo enviado pela equipe e servido **dentro da plataforma** (player próprio / hospedagem + CDN — detalhar na implementação). |
| **YouTube (opcional)** | Mesmo evento pode usar **URL/embed do YouTube** como fonte, mantendo a **mesma experiência de “live simulada”** (sync, comentários por minutagem, CTAs). |

O administrador (ou configuração do evento) escolhe **uma fonte por sessão**: upload **ou** YouTube, conforme necessidade operacional.

### 5.2 Controles inacessíveis — usuário não sai da plataforma

Requisito de produto: o usuário **não deve conseguir usar o player para “escapar”** da experiência nem consumir o vídeo fora do fluxo da imersão.

- **Upload (player próprio):** sem barra de progresso clicável para pular livremente (se a regra for narrativa linear), sem menu que leve a abrir o arquivo em outro lugar, sem atalhos que quebrem o sync — alinhado à minutagem do evento.
- **YouTube:** **controles nativos bloqueados ou ocultos** na medida do possível (parâmetros de embed, `controls`, `disablekb`, evitar cliques que abram o YouTube em nova aba / sobreposição de UI que impeça interação com o iframe onde necessário). O objetivo é o mesmo: **não facilitar ida ao YouTube** nem controle “solto” que destrua a simulação de live.

**Nota técnica:** o iframe do YouTube impõe limites; pode ser necessário combinar embed + camada de UI/captura de eventos e aceitar restrições da ToS/API. Para **controle total**, o modo **upload + player próprio** é o mais previsível.

### 5.3 Alinhamento com a live simulada

Em ambos os modos, o comportamento deve reforçar: **uma única janela**, **um relógio de evento**, **comentários e CTAs no tempo certo** — coerente com a visão da seção *Objetivo da plataforma*.

---

## 6. Sessão de comentários — camadas, controles e visibilidade

### 6.1 Controles de ativar / desativar (staff / admin)

- A **sessão de comentários** (painel de chat + envio por participantes) deve poder ser **ligada ou desligada** por **controle administrativo** (dashboard, backoffice ou equivalente).
- Com a sessão **desativada**: definir UX — ex.: ocultar área de comentários ao vivo, bloquear novos envios, ou exibir apenas comentários “da gravação” e CTAs (decisão de produto).
- Com a sessão **ativada**: fluxo normal conforme **modo de visibilidade** ativo (6.4).
- **Moderadores da staff** mantêm acesso operacional conforme permissões (aprovar, ocultar, **respostas reais** a perguntas ao vivo, fixar CTA — ver **6.7** e moderação nas pendências). O **roteiro importado** cobre só as camadas **simuladas** (**6.2** e **6.6**).

### 6.2 Quatro tipos de comentário no produto

A sessão de comentários combina **duas origens reais** (usuários e staff) e **duas camadas simuladas** (roteiro alinhado à live gravada), todas convivendo no mesmo feed com regras de exibição e moderação.

| Tipo | Origem | Descrição |
|------|--------|-----------|
| **1. Comentários reais — usuários online** | Participante | Mensagens escritas **em tempo real** por quem está na imersão. Única camada totalmente **imprevisível** no roteiro do vídeo. |
| **2. Comentários reais — staff** | Equipe (moderador / suporte) | A staff **responde de verdade** no chat a **perguntas e interações ao vivo** dos usuários (quando a sessão permitir envio). Diferente do vídeo gravado: o apresentador no vídeo **não** lê esse chat na hora; quem responde é a **equipe operacional**. |
| **3. Comentários simulados — plateia / cenário** | Roteiro (Excel / admin) | **Horário, nome exibido e texto** programados para **coincidir** com o que acontece na **live gravada** (ex.: comentários de “plateia” e perguntas que o vídeo **parece** estar respondendo). Mantêm a ilusão de live sincronizada ao áudio/vídeo. |
| **4. Comentários simulados — staff** | Roteiro (Excel / admin) | Mensagens que **parecem** vindas da staff ou do apresentador, mas são **programadas** com **minutagem** igual à fala na gravação — reforçam o roteiro visual do chat sem ser digitação ao vivo da equipe. |

**Síntese:** usuários e staff **reais** geram diálogo autêntico; **simulados** (plateia + staff) reproduzem o **script** da gravação no tempo certo. Na interface, convém **diferenciar visualmente** (badge interno ou só no admin) o que é simulado vs. real para a equipe; no público, a decisão de mostrar rótulo “automático” é de produto/compliance.

### 6.2.1 Comentários “da gravação” no tempo (camada simulada)

- Tudo que entra por **minutagem** para espelhar a gravação — **simulados tipo plateia** e **simulados tipo staff** — deve ser carregado preferencialmente via **importação Excel** (seção **6.6**), com `tipo` adequado.
- Exibição **só no timestamp** correspondente ao vídeo/evento.
- **Independente** do modo de visibilidade 6.4 para o que for “público simulado”: todos os participantes elegíveis veem essas linhas no timing certo (salvo sessão de comentários desligada — ver política de produto).

### 6.4 Modos de visibilidade do chat ao vivo (alternáveis por controle admin)

O administrador escolhe **um modo por evento** ou **troca durante a live** (definir se a troca é permitida em tempo real e com qual delay), conforme necessidade operacional.

#### Modo A — Visibilidade geral (público entre participantes)

- Cada participante vê:
  - comentários **de todos os usuários reais** (aprovados / publicados conforme regras de moderação);
  - **staff real** (respostas da equipe ao vivo);
  - **comentários simulados** (plateia + staff simulada do roteiro — **6.2** e **6.6**);
  - **notificações de compra simulada** (somente UI de notificação — **9**; **não** entram no dashboard como conversão);
  - **comentários fixados** quando ativos (**6.7**).

#### Modo B — Comentários isolados (visão por usuário)

- Cada participante vê **apenas**:
  - **os próprios** comentários (enviados por ele);
  - **staff real** (respostas da equipe, inclusive as dirigidas a ele quando aplicável);
  - **comentários simulados** (plateia + staff simulada);
  - **notificações de compra simulada** (**9**);
  - **comentários fixados** quando ativos (**6.7**).
- O participante **não vê** comentários de **outros usuários reais** (isolamento social — sensação de privacidade ou redução de ruído, conforme objetivo de marketing).

#### Resumo

| Conteúdo no feed | Modo geral | Modo isolado |
|------------------|------------|----------------|
| Simulados por minutagem (plateia + staff simulada) | Todos | Todos |
| Notificações de compra simulada (sem métrica no painel) | Todos | Todos |
| **Staff real** (respostas ao vivo) | Todos | Todos |
| Comentários fixados (CTA / oferta) | Todos | Todos |
| Comentários de **outros** usuários reais | Visível | **Oculto** |
| Próprios comentários | Visível | Visível |

### 6.5 Consistência com staff e dashboard

- Moderadores precisam ver **todos** os comentários **reais** de usuários (fila de perguntas, moderação), independentemente do modo **isolado** exibido ao público — salvo perfis restritos definidos depois.
- O **roteiro importado** (Excel) deve ser **visualizável e editável** no admin (preview por timeline, reimportação).
- O **dashboard administrativo** reflete **métricas reais** (ver **seção 8**): não usar a contagem **simulada** exibida ao público como fonte de verdade operacional.

### 6.6 Sistema de importação de comentários em Excel

Requisito: permitir **subir o roteiro** das camadas **simuladas** — comentários de **plateia** e **staff simulada** com **horário, nome e texto** alinhados à live gravada, além de tipos auxiliares (ex.: **compra simulada**, texto de CTA se unificado na planilha) — em formato **planilha**, sem cadastro manual linha a linha.

#### Formatos aceitos

- **`.xlsx`** (preferencial) e/ou **`.csv`** (export universal).
- Encoding UTF-8 no CSV; documentar separador (`;` ou `,`) conforme padrão brasileiro.

#### Fluxo sugerido

1. **Template oficial** disponível para download no painel (cabeçalhos fixos + linha de exemplo).
2. **Upload** do arquivo vinculado a uma **imersão / versão de vídeo** (cada corte do vídeo pode exigir nova planilha ou coluna `versao_video`).
3. **Validação automática**: tipos permitidos, minutagem dentro da duração do vídeo, campos obrigatórios, nomes não vazios, ordenação por `timestamp`.
4. **Preview** antes de publicar: lista ou timeline com horário + autor exibido + texto.
5. **Publicar / substituir**: versão ativa da planilha; histórico opcional (rollback).

#### Colunas mínimas sugeridas (ajustáveis na implementação)

| Coluna | Descrição |
|--------|-----------|
| `timestamp` ou `minutagem` | Tempo no vídeo em que o item **entra no feed** e coincide com a fala (ex.: `00:12:34`, ou segundos `754`). Deve bater com o momento em que o texto é **falado** na gravação. |
| `tipo` | Ex.: `usuario_simulado` (plateia / pergunta no roteiro), `staff_simulado` (fala “da equipe” no roteiro), `compra_simulada` (dispara **notificação** na UI — ver **9**; não gera linha de conversão no dashboard), `cta_texto` (opcional se CTA não for só pin no admin). |
| `nome_exibido` | Nome que aparece no chat (pode ser “Staff”, nome fictício de plateia, etc.). |
| `texto` | Conteúdo da mensagem. |
| `id_linha` (opcional) | Identificador estável para reimportação e diff. |
| `reply_to_id_linha` (opcional) | Se no futuro for necessário encadear visualmente “pergunta simulada → resposta simulada” (não obriga vínculo com usuário real). |

#### Observações

- Comentários **reais** (usuários **e** staff operacional) **não** vêm do Excel; nascem no chat durante o evento.
- Linhas do Excel = **somente camadas simuladas** (plateia + staff simulada + **compra simulada** → notificação — **9**), com minutagem alinhada à gravação.
- Tratar erros de import com relatório legível (linha X: minutagem inválida, tipo desconhecido, etc.).

### 6.7 Comentários fixados (pin) — CTA / oferta

- Função para **fixar** um ou mais blocos de comentário (texto, opcional link, autor exibido se desejado) na **janela do CTA / oferta**.
- Comportamento sugerido: área **sempre visível** acima do scroll do chat ou banner destacado; **horário de início/fim** configurável (minutagem do vídeo ou relógio do evento) ou ativação manual pela staff.
- Pode haver **mais de um** pin sequencial durante a oferta (ex.: link principal + urgência).
- Desafixar automático ao fim do bloco de CTA ou comando manual no painel.

### 6.8 Contagem de “usuários ao vivo” — simulada no público, real no admin

| Onde | O que mostra |
|------|----------------|
| **Página da imersão (participante)** | Indicador **simulado** de pessoas ao vivo, com **ritmo natural de evento real**: o número **oscila** ao longo do tempo (às vezes **saem** alguns “espectadores”, às vezes **entram** mais), sem ficar estático; a faixa-alvo é manter o valor **entre ~210 e ~220** (configurável como mín/máx suaves, com pequenos incrementos/decrementos aleatórios ou semi-aleatórios respeitando esse corredor). Picos ou quedas bruscas devem ser evitados para não parecer robótico. |
| **Dashboard administrativo** | **Dados reais** apenas: conexões/sessões, usuários únicos, comentários reais, **cliques e conversão** (ver **seção 8**), etc., **separados por semana** (cada **terça / ciclo de imersão** ou intervalo definido no produto). |

#### Parâmetros técnicos sugeridos (ritmo “humano”)

Implementação de referência para o número simulado **não parecer robótico**:

| Parâmetro | Sugestão inicial | Notas |
|-----------|------------------|--------|
| **Intervalo entre atualizações** | **15 s a 45 s** por tick (valor aleatório ou alternância dentro dessa faixa a cada ciclo) | Evita pulos no mesmo segundo; parece flutuação de plateia. |
| **Delta máximo por tick** | **±1** (ocasionalmente **±2** com baixa probabilidade, ex.: 10–15%) | Impede saltos de dezenas; mantém curva suave. |
| **Faixa-alvo** | **210–220** | Se o valor sair do corredor (por arredondamento ou bug), **corrigir** no próximo tick com passo pequeno em direção ao intervalo. |
| **Tendência suave** | Opcional: “viés” leve para subir nos primeiros minutos do evento e estabilizar no corredor | Reforça sensação de sala enchendo sem violar o teto. |

- A equipe **nunca** deve confundir o número **simulado** do front com o relatório **real** do painel.
- Definir em implementação: se o simulado precisa de **disclaimer** legal/ético em rodapé ou termos (opcional de produto).

---

## 7. Tela de espera e acesso

| Elemento | Requisito |
|----------|-----------|
| **Rota `/espera`** | Sala de espera principal; recebe redirects de **`/imersao`** (**1.2**). |
| **Popup de cadastro** | Nome + e-mail; submit libera o conteúdo completo da espera (countdown, bullets, etc.) — **1.3**. |
| **Cronômetro** | Conta até a **próxima terça 20:00** do ciclo atual; **reseta** após o reset semanal (**4**). |
| **Redirect terça 20:00** | Automático para a sala ao vivo, se elegível (**4.2**). |

### 7.1 Ajustes solicitados no fluxo

- **Duplicar a página** (provavelmente versão de desenvolvimento / staging ou cópia do template para não quebrar produção).
- **Formulário desacoplado da “lista de espera”** antiga: o popup na **`/espera`** é **acesso à edição**, não fila de produto separada.

### 7.3 Pós-live: quem não entrou no tempo corrido (replay fora da plataforma)

- Se a **live encerrar** (fim do vídeo / janela configurada) e o usuário **não** tiver entrado na sala ao vivo durante esse período: exibir um **modal** informando que **perdeu a live ao vivo** e orientando a ficar atento aos **canais externos** em que o **replay** será comunicado (e-mail, página de vendas, grupo, etc.).
- **Não** implementar player de replay nem hospedagem de replay **dentro** deste produto — o replay é **100% externo**; o modal só **comunica** a expectativa, sem URL técnica obrigatória na plataforma.
- Objetivo: manter narrativa de exclusividade da transmissão síncrona e próximo passo comercial, sem escopo de VOD interno.

---

## 13. Retorno, nova semana e página de vendas

- Tentativas **fora da regra** em **1.1** (IP ou e-mail já usados; **mesmo e-mail com IP diferente**; segundo acesso após consumo na edição): **bloqueio** com mensagem ou **redirecionar** para **página de vendas** (URL configurável no admin — **placeholder** até definição do link final).
- Se a **mesma pessoa** (cadastro **consumido** na edição anterior, conforme política comercial) tentar o funil grátis de novo em **nova semana**: pode seguir a mesma **URL de vendas** ou fluxo próprio — **11** item 2.
- Objetivo: **perpétuo** com sensação de evento único; quem já passou pelo funil naquela edição **não** revê a mesma “live exclusiva” gratuitamente na mesma semana; em ciclo novo, política de re-cadastro pode exigir novo opt-in ou compra — **alinhamento comercial a fechar** (**11**).
- Distinção útil para implementação:
  - **Bloqueio na mesma edição:** segundo acesso na mesma terça/semana após já ter consumido sala ao vivo.
  - **Nova edição (outra semana):** usuário que já participou antes pode ser mandado direto para **vendas** em vez de nova espera “grátis”, conforme regra de negócio (marcar explicitamente no admin).

---

## 8. Dashboard administrativo, cliques, conversão e exportação

### 8.1 Princípio: o que entra e o que não entra no painel

- O painel trabalha com **métricas reais** de comportamento e negócio.
- **Não contabilizar no dashboard:** contagem **simulada** de “ao vivo” (**6.8**), nem **compras / notificações simuladas** (**9**) — essas existem só para efeito de interface e reforço social, **sem** inflar conversão ou vendas no relatório.

### 8.2 Métricas operacionais e “perpétuo”

- **Cliques (e eventos associados):** registrar **cliques reais** em CTAs, botões da oferta, links do pin, elementos rastreados — com **timestamp**, identificador de sessão/usuário quando houver, **edição da imersão** (semana) e, se aplicável, **origem** (ex.: área do vídeo, chat, notificação real vs. simulada só como contexto de exibição, sem contar simulado como clique).
- **Conversão:** definir **objetivo** (ex.: clique no checkout, lead, página de obrigado) e taxas **edição a edição** e **visão histórica** (“perpétuo”): série ao longo das semanas, comparativo entre terças, tendência — para acompanhar evolução contínua do funil, não só um evento isolado.
- Outras métricas importantes (a fechar): tempo médio na página, abandono no vídeo, comentários reais por hora, respostas da staff, etc.

### 8.3 Corte semanal e exportação

- **Corte por semana:** cada edição da imersão (ex.: cada **terça** ou janela 20:00–23:59) constitui um **período** com **dados isolados** — filtros e totais **não misturam** semanas inadvertidamente.
- **Download / exportação:** relatórios **baixáveis** (ex.: **CSV** e/ou **.xlsx**) com dados **reais** do período (cliques, conversões, participação, mensagens reais, funil). Incluir metadados: intervalo de datas, fuso, versão do evento.
- Expor também o **estado da sessão de comentários** (ligada/desligada), **modo de visibilidade** (geral vs. isolado), status do **último import** Excel e **parâmetros de referência** da contagem simulada (faixa 210–220, ritmo — apenas documentação operacional; **não** como KPI).
- Fonte dos dados: backend próprio, analytics, integrações existentes do projeto.
- Ver **6.8** para contraste entre contagem **simulada** (UI pública) e **real** (dashboard).

---

## 9. Pitch — compras simuladas como notificações (sem métrica no dashboard)

- Na **hora do pitch** (ou minutagens configuradas), exibir **compras simuladas** **somente como notificações** na interface (ex.: toasts, fila lateral, banners leves) — textos tipo “Acabei de garantir”, “Comprei”, etc., para reforço social.
- **Não** tratá-las como eventos de conversão: **não** incrementam vendas, **não** entram em totais de “compras” nem distorcem **taxa de conversão** no **dashboard** (**8.1**). Continua valendo o rastreio de **cliques e conversões reais** dos usuários (**8.2**).
- Programação preferencial via **planilha** (tipo `compra_simulada` na seção **6.6**), com **minutagem** alinhada ao vídeo — o motor pode ser o mesmo do roteiro; apenas o **canal de exibição** é o de **notificação**, não o feed principal de chat (salvo decisão explícita de produto de duplicar em dois lugares).
- **Visibilidade:** notificações simuladas seguem a lógica de quem está na sala (em geral **todos** os participantes nos modos geral e isolado — ajustar se necessário).
- Compliance/ética: deixar claro se são **fictícios** (decisão de produto/legal).

---

## 10. Checklist rápido de entrega

- [ ] **`/imersao` → `/espera`**; sala ao vivo só com sessão + horário; **bloqueio IP + e-mail** (1 acesso por edição)  
- [ ] Popup nome/e-mail na espera; **quarta–terça 19:59** sem redirect para sala; **terça 20:00** redirect automático  
- [ ] **Modal “perdeu a live”** + texto de replay **externo** (**7.3**); retorno bloqueado → **URL página de vendas** (**13**)  
- [ ] Bloqueio: **limite por IP** + **limite por e-mail** + **mesmo e-mail, IP diferente** = bloqueado (**1.1**)  
- [ ] Sync de entrada atrasada com minutagem do vídeo  
- [ ] CTA às 20:00 com links/comentários associados  
- [ ] Ciclo **4** (espera quarta→terça 19:59; live até fim do vídeo; reset quarta) coerente com redirects  
- [ ] Vídeo por **upload** (principal) + opção **YouTube**; controles **inacessíveis**; usuário **retido na plataforma** (sem fuga para player externo)  
- [ ] Sessão de comentários: **ativar/desativar**; modos **geral** vs **isolado**; **quatro tipos**: usuários reais, **staff real** (perguntas ao vivo), simulados plateia, **simulados staff**  
- [ ] **Import Excel** (.xlsx/CSV): só camadas simuladas; tipos `usuario_simulado`, `staff_simulado`, `compra_simulada`; validação + preview + publicar  
- [ ] **Comentários fixados** na janela de **CTA/oferta** (tempo configurável ou pin manual)  
- [ ] **Contagem “ao vivo” simulada**: faixa **210–220**, tick **15–45 s**, delta típico **±1** (±2 raro); **métricas reais** só no dashboard (**6.8**)  
- [ ] UI alinhada ao **baseline visual** da raiz (`modelo live*.png` — **12**)  
- [ ] Página duplicada para testes (staging)  
- [ ] Dashboard: métricas **reais** **por semana** + visão **perpétua** (histórico entre edições); **cliques** e **conversão** rastreados; **exportação** (CSV/XLSX)  
- [ ] **Compras simuladas** só como **notificações**; **excluídas** de totais/conversão no painel (**9**, **8.1**)  

---

## 11. Pendências para refinamento

*Itens abaixo seguem **entrega incremental** (“restante vamos fazendo”), exceto onde o time priorizar.*

1. **Fuso horário** oficial (Brasil único ou multi-região).  
2. **URL exata da página de vendas** (config admin — **13**); política para **nova edição**: novo cadastro grátis vs. só vendas.  
3. ~~**Replay**~~ — **fora do escopo** da plataforma (**7.3**); comunicação só por copy do modal / canais externos.  
4. **Pipeline de upload** (formatos, tamanho máximo, transcoding, CDN, URL assinada se privado).  
5. Especificação do **embed** (YouTube: parâmetros `controls`, `disablekb`, etc.), **overlay** anti-clique se necessário, e limitações da API/ToS.  
6. **Template Excel** final (nomes exatos das colunas, valores de `tipo`, limite de linhas) e persistência no banco após import.  
7. Regras de **moderação** do chat ao vivo (fila, aprovação prévia opcional, ocultar mensagem).  
8. **Troca em tempo real** entre modo geral e isolado (permitida ou só antes do evento?) e comportamento ao **desligar** a sessão (ocultar só ao vivo ou também simulados).  
9. **Algoritmo da contagem simulada**: intervalo **15–45 s**, delta **±1** (±2 ocasional), faixa **210–220**, seed; **disclaimer** legal se necessário.  
10. **Exportação:** colunas exatas dos relatórios semanais + série **perpétua**, permissões de download, retenção de histórico.  
11. **Definição de conversão** (evento-alvo) e **mapa de cliques** (quais elementos são rastreados); garantir que **notificações simuladas** não disparem eventos de compra.  
12. **Slug final** da sala ao vivo e se **refresh durante a live** reabre com o mesmo token (sessão) sem contar como “segundo acesso”.  
13. Ajustes finos de **copy** do modal pós-live (texto genérico vs. link público de replay externo, se quiserem citar URL fixa de marketing).  
14. **Exceções** de IP compartilhado (evento, empresa): fila manual ou regra futura — só se surgir necessidade operacional.  

---

## 12. Referência visual — baseline simplificado (imagens na raiz)

Na raiz do projeto existem capturas de uma **versão mais simples** do fluxo que já roda hoje. Elas servem como **base de layout, hierarquia e identidade visual** para o que será construído; o produto final incorpora as regras deste documento (comentários reais/simulados, Excel, pin de CTA, contador 210–220 com ritmo natural, notificações de compra simulada, dashboard real, etc.).

### 12.1 Arquivos

| Arquivo | Papel no fluxo (resumo) |
|---------|-------------------------|
| `modelo live.png` | Sala da imersão **escura**: player grande à esquerda (play central “Clique para assistir ao vivo”), faixa com logo + headline; **sidebar** “COMENTÁRIOS AO VIVO” com ponto vermelho, HOST (Robison Kunz), usuário, campos nome/comentário, botão COMENTAR, **“250 assistindo”** (referência ao contador — hoje fixo; no novo produto: **210–220** com oscilação — **6.8**). Alternância claro/escuro (ícone lua). |
| `modelo live2.png` | Mesmo layout em variante **chat em card branco** sobre fundo preto; mais comentários de exemplo; **“255 assistindo”**. Útil como referência de **modo claro** do painel de chat e hierarquia nome + badge HOST. |
| `modelo live3.png` | **Modal de captura** (“Você está a um passo!”): primeiro nome + e-mail, CTA “QUERO ENTRAR NA IMERSÃO”. Fundo com blur (countdown/texto). Equivale ao **formulário de acesso** (**7**), desacoplado de lista de espera. |
| `modelo live4.png` | **Pós-cadastro**: “Cadastro realizado!” + “Redirecionando para o webinário em instantes…”. Transição antes da sala ao vivo ou countdown. |
| `modelo live5.png` | **Tela de espera** com logo “IMERSÃO ONLINE / NEGÓCIO DE FOTOGRAFIA 10K”, **countdown** (DIAS | HRS | MIN | SEG), card com bullets do que será visto, texto de **redirect automático às 20h** para a imersão ao vivo, watermark “POWER”, rodapé. Alinha-se à **janela terça 20:00** e cronômetro semanal (**4**, **7**). |

### 12.2 O que reaproveitar como base

- **Grid em duas colunas:** vídeo + faixa informativa à esquerda; **comentários ao vivo** à direita (fixo ou responsivo empilhado em mobile — a definir).
- **Player:** estado inicial com CTA de play central; no produto novo: sync por minutagem, **sem** controles que levem para fora (**5**).
- **Chat:** cabeçalho “ao vivo”, distinção visual **HOST / staff** vs. participante (cores, badge); mapear para **staff real**, **staff simulada** (Excel) e **usuários reais** (**6**).
- **Contador “assistindo”:** posição (canto inferior do bloco de chat) e ícone de pessoas — trocar valor estático por **motor simulado** (**6.8** + tabela de intervalo/delta).
- **Identidade:** dark mode predominante, azul em CTAs, cantos arredondados, tipografia sans limpa — manter **coerência** com dashboard admin quando possível.
- **Fluxo:** **`/imersao` → `/espera`** → popup lead → conteúdo da espera → terça 20h redirect → sala ao vivo; encaixa **1**, **4**, **7** e **13**.

### 12.3 O que o modelo atual não cobre (evoluir no novo build)

- **Notificações** de compra simulada (fora do feed) — **9**.
- **Comentários fixados** no CTA — **6.7**.
- **Import Excel** e tipos `usuario_simulado` / `staff_simulado` — **6.6**.
- **Modos** geral vs. isolado — **6.4**.
- **Métricas reais**, cliques, conversão perpétua e **export** — **8**; contador simulado **não** entra no painel.
- **Upload** vs. **YouTube**, bloqueio de controles — **5**.
- **Bloqueio IP + e-mail**, **uma participação por edição**, página de vendas em retorno — **1**, **13**.

### 12.4 Uso no desenvolvimento

- Tratar as imagens como **mock de produto**: mesma ordem emocional (antecipação → dado → confirmação → sala), com **escopo ampliado** nas camadas de dados e moderação descritas nas seções anteriores.

---

*Última atualização: bloqueio por IP + e-mail, mesmo e-mail com IP diferente bloqueado; replay externo (7.3); pendências em modo incremental (11).*
