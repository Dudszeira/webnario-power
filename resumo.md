# Webnario Power — Resumo de Progresso

**Última atualização:** 01/06/2026  
**Stack:** Next.js 14 · TypeScript · Tailwind CSS · Supabase (PostgreSQL) · JWT (jose) · XLSX

---

## Estado atual

| Item | Status |
|------|--------|
| Build | ✅ 100% limpo — 0 erros TypeScript |
| Servidor dev | `npm run dev` → http://localhost:3000 |
| Rotas compiladas | 32 rotas (estáticas + dinâmicas) |
| Frontend visual | ✅ Tema cyber (dark) — identidade visual finalizada |
| Banco de dados | ✅ Migrado de SQLite → Supabase (PostgreSQL) |
| Acesso admin à `/ao-vivo` | ✅ Admin bypassa guards de horário |
| Sistema de comentários | ✅ Estável — 8 bugs corrigidos em review formal |
| Modo isolado (chat) | ✅ Corrigido via SSR pre-load (jun/2026) |

---

## Páginas implementadas

### Fluxo do participante

| Rota | Status | O que faz |
|------|--------|-----------|
| `/` | ✅ | Redirect imediato → `/espera` |
| `/imersao` | ✅ | Redirect imediato → `/espera` |
| `/espera` | ✅ | Sala de espera: modal de cadastro, countdown flip-card, redirect automático às 20h |
| `/ao-vivo` | ✅ | Player (YouTube ou upload) + chat ao vivo + viewer count simulado |
| `/bloqueado` | ✅ | Acesso bloqueado por IP/email duplicado; redireciona para página de vendas |

### Admin

| Rota | Status | O que faz |
|------|--------|-----------|
| `/admin/login` | ✅ | Autenticação por senha (JWT httpOnly, 12h) |
| `/admin` | ✅ | Dashboard: métricas reais, painel de todas as rotas, config resumida, registros, histórico perpétuo |
| `/admin/configuracoes` | ✅ | Vídeo (fonte + URL + duração), CTA, chat mode, viewer count, página de vendas |
| `/admin/importar` | ✅ | Upload .xlsx/.csv de roteiro simulado, validação, preview, substituição, limpeza |
| `/admin/comentarios` | ✅ | Moderação: ocultar, fixar (pin), enviar mensagens de staff em tempo real |

---

## Histórico de sessões

### Sessão 1 — Construção inicial da plataforma

**O que foi feito:**
- Criação do projeto Next.js 14 do zero (estrutura completa de arquivos)
- Schema do banco SQLite: `editions`, `registrations`, `comments`, `events`
- Sistema de sessões com JWT (user + admin, cookies httpOnly)
- Lógica de edição semanal (`edition.ts`) — ciclo quarta→terça, UTC-3 fixo
- Todas as rotas de API: cadastro, chat, click, admin (auth/config/import/metrics/comments/export)
- Páginas do fluxo completo: `/espera`, `/ao-vivo`, `/bloqueado`
- Painel admin completo com 4 seções
- Build 100% limpo na primeira tentativa (após fix de 2 avisos menores)

**Componentes criados:**
`EsperaContent`, `AoVivoContent`, `VideoPlayer`, `ChatPanel`, `ViewerCount`, `PurchaseNotifications`, `RegisterModal`, `Countdown`, `AdminLogin`, `AdminNav`, `AdminDashboard`, `AdminConfig`, `AdminImport`, `AdminComments`

---

### Sessão 2 — Painel de rotas no admin + arquivo de resumo

**O que foi feito:**
- `AdminDashboard` ganhou seção **"Páginas da plataforma"** com 8 cards (uma por rota), cada card mostrando: ícone, rota, descrição, badge de acesso (Público / Restrito por horário / Admin) e link "Abrir em nova aba"
- Dashboard ganhou **status ao vivo em tempo real** no header (pill: Aguardando / AO VIVO / Encerrada)
- Dashboard ganhou **resumo da config da edição** (vídeo, chat, CTA) inline
- API `metrics` atualizada para retornar `liveStatus`, `liveStartMs` e `editionConfig`
- Criação deste arquivo `resumo.md`

---

### Sessão 3 — Acesso admin à sala ao vivo fora do horário

**O que foi feito:**
- `/ao-vivo/page.tsx` verifica `verifyAdminSession()` **antes** de qualquer guard de horário
- Admin logado acessa `/ao-vivo` a qualquer dia e hora, sem precisar de sessão de participante
- Offset inicial = `0` no preview (sem live ativa)
- `AoVivoContent` exibe **banner âmbar** no topo quando `isAdminPreview = true`, com aviso e link de volta ao admin
- Sessão de usuário ausente é substituída por objeto mock `{ name: 'Admin' }` para o admin preview

---

### Sessão 4 — Redesign visual completo (fidelidade às imagens de referência)

**O que foi feito:**

#### `/espera` — `EsperaContent.tsx`
- Fundo: preto puro `#000`
- Logo centralizada com label "Imersão Online" acima
- Countdown diretamente sobre o fundo — flip cards `#1a1a1a`, números 38px, separadores `:`
- **Card de conteúdo branco** (antes era escuro — corrigido para fidelidade ao modelo live5)
- Ícones dos bullets: chevron `›` cinza (igual ao modelo)
- Copy correta dos 4 bullets extraída das imagens
- Texto de redirect com negrito: *"você será redirecionado automaticamente para a Imersão ao vivo"*
- Rodapé: "Robison Kunz © 2024 · Todos os direitos reservados"
- Modal de sucesso: checkmark em círculo azul + "Redirecionando para o webinário em instantes..."

#### Modal de cadastro — `RegisterModal.tsx`
- Overlay com `backdropFilter: blur(6px)` (blurred background)
- Card `#1c1c1c` (fiel ao modelo live3)
- Copy correta: "Você está a um passo de descobrir os 3 pilares para faturar mais de 10 mil reais por mês!"
- Botão navy escuro `#1e3a8a` — "QUERO ENTRAR NA IMERSÃO"
- Labels uppercase com tracking

#### Chat — `ChatPanel.tsx`
- Fundo `#161616`
- Header: ponto vermelho pulsante + "COMENTÁRIOS AO VIVO" + ícone de relógio (fiel ao modelo)
- Avatares coloridos por tipo (azul = usuário real, roxo = staff, cinza = simulado)
- Badge HOST âmbar `#d97706`, STAFF roxo `#7c3aed`
- Campo de nome readonly cinza, campo de comentário + botão COMENTAR azul

#### Sala ao vivo — `AoVivoContent.tsx`
- Strip abaixo do vídeo com logo pequena + headline "Os **3 Pilares**... **10 Mil Reais**..." + viewer count à direita
- Layout limpo: vídeo ocupa toda a largura, chat fixo de 340px à direita (desktop)
- Background `#0d0d0d`

#### Viewer count — `ViewerCount.tsx`
- Ícone de pessoas SVG correto
- Tipografia: número branco em negrito + "assistindo" cinza

#### Global CSS — `globals.css`
- Limpeza completa: removidos estilos obsoletos
- Scrollbar minimalista (5px, sem track visível)
- `video-wrapper video { pointer-events: none }` para bloquear interação nativa
- Helpers `.label-admin` e `.input-admin` centralizados

---

## Funcionalidades do spec implementadas

### ✅ Concluídas

| Funcionalidade | Seção do spec |
|----------------|---------------|
| Bloqueio por IP por edição | 1.1 |
| Bloqueio por e-mail por edição | 1.1 |
| Mesmo e-mail, IP diferente = bloqueado | 1.1 |
| Redirect para página de vendas em caso de bloqueio | 13 |
| `/imersao` e `/` → `/espera` sempre | 1.2 |
| Popup de cadastro nome + e-mail na espera | 1.3 |
| Ciclo semanal: quarta→terça 19:59 = espera | 4.1 |
| Redirect automático terça 20:00 → `/ao-vivo` | 4.2 |
| Reset do ciclo quarta 00:00 (novo edition_id) | 4.4 |
| Entrada atrasada sincronizada com minutagem | 2 |
| CTA no chat por período configurável | 3 |
| Modal "perdeu a live" pós-encerramento | 7.3 |
| Sessão de comentários ativar/desativar | 6.1 |
| 4 tipos de comentário (real_user, real_staff, simulated_user, simulated_staff) | 6.2 |
| Comentários simulados disparados por minutagem do vídeo | 6.2.1 |
| Chat modo geral (todos veem todos) | 6.4-A |
| Chat modo isolado (só próprio + staff) | 6.4-B |
| Import Excel/CSV com validação e preview | 6.6 |
| Comentários fixados (pin) com horário de início/fim | 6.7 |
| Viewer count simulado (210–220, tick 15–45s, delta ±1) | 6.8 |
| Viewer count real separado no dashboard | 6.8 |
| Compras simuladas como toasts (não entram no dashboard) | 9 |
| Player YouTube com controls bloqueados + seek para offset | 5.2 |
| Player upload com vídeo restrito | 5.2 |
| Dashboard com métricas reais por edição | 8 |
| Rastreio de cliques reais (cta_click, enter_live, register) | 8.2 |
| Histórico perpétuo entre edições | 8.3 |
| Exportação CSV das métricas | 8.3 |
| Acesso admin à `/ao-vivo` fora do horário | — |
| Painel de rotas no dashboard admin | — |

---

## Estrutura de arquivos

```
src/
├── app/
│   ├── page.tsx                    → redirect /espera
│   ├── imersao/page.tsx            → redirect /espera
│   ├── espera/page.tsx             → server component (verifica sessão + ciclo)
│   ├── ao-vivo/page.tsx            → server component (admin bypass + guards live)
│   ├── bloqueado/page.tsx          → página de bloqueio com link de vendas
│   ├── admin/
│   │   ├── page.tsx                → dashboard (auth guard)
│   │   ├── login/page.tsx          → login
│   │   ├── configuracoes/page.tsx  → config da edição
│   │   ├── importar/page.tsx       → import roteiro
│   │   └── comentarios/page.tsx    → moderação
│   └── api/
│       ├── cadastro/route.ts       → POST: registra (valida IP+email+edição)
│       ├── session/route.ts        → GET: verifica sessão corrente
│       ├── chat/route.ts           → GET: poll reais / POST: enviar comentário
│       ├── click/route.ts          → POST: evento rastreado (cta_click etc.)
│       └── admin/
│           ├── auth/route.ts       → POST: login / DELETE: logout
│           ├── config/route.ts     → GET/PUT: config da edição
│           ├── import/route.ts     → POST: xlsx/csv / GET: listar / DELETE: limpar
│           ├── metrics/route.ts    → GET: métricas + liveStatus + editionConfig
│           ├── comments/route.ts   → GET/POST/PATCH: moderação
│           └── export/route.ts     → GET: CSV da edição
├── components/
│   ├── EsperaContent.tsx           → countdown, modal, redirect (redesenhado)
│   ├── AoVivoContent.tsx           → player + chat + banner admin (redesenhado)
│   ├── VideoPlayer.tsx             → YouTube iframe API / <video> com seek
│   ├── ChatPanel.tsx               → polling, simulados, pin, CTA (redesenhado)
│   ├── ViewerCount.tsx             → oscilação 210–220 client-side (redesenhado)
│   ├── PurchaseNotifications.tsx   → toasts de compra simulada por timestamp
│   ├── RegisterModal.tsx           → popup nome + e-mail (redesenhado)
│   ├── Countdown.tsx               → flip cards DIAS:HRS:MIN:SEG (redesenhado)
│   ├── AdminLogin.tsx              → form de login
│   ├── AdminNav.tsx                → barra de navegação admin
│   ├── AdminDashboard.tsx          → dashboard + painel de rotas + status live
│   ├── AdminConfig.tsx             → formulário de configuração da edição
│   ├── AdminImport.tsx             → upload + preview do roteiro simulado
│   └── AdminComments.tsx           → moderação + envio de staff
└── lib/
    ├── db.ts                       → SQLite: init + schema + tipos
    ├── auth.ts                     → JWT: user session + admin session + getIP
    └── edition.ts                  → edição semanal, offset, isLiveActive, isLiveOver
data/
└── webnario.db                     → criado na 1ª execução (gitignore recomendado)
public/
└── logo.webp
.env.local                          → JWT_SECRET, ADMIN_PASSWORD, NEXT_PUBLIC_*
```

---

## Banco de dados (SQLite — `data/webnario.db`)

| Tabela | Campos principais | Propósito |
|--------|------------------|-----------|
| `editions` | id (YYYY-MM-DD), video_source/url/duration, chat_enabled, chat_mode, cta_*, viewer_min/max, sales_page_url | Config semanal |
| `registrations` | id, edition_id, name, email, ip, consumed, consumed_at | Controle de acesso IP+email |
| `comments` | id, edition_id, type, author_name, text, video_timestamp, is_pinned, pin_start/end_seconds, visible | Reais e simulados |
| `events` | id, edition_id, registration_id, type, metadata, created_at | Cliques e eventos rastreados |

---

## Pendências incrementais (do spec)

| Item | Ref. spec | Prioridade |
|------|-----------|------------|
| Upload de vídeo via admin (pipeline, CDN/storage) | 11.4 | Alta |
| Fuso horário configurável (hoje hardcoded UTC-3) | 11.1 | Média |
| URL da página de vendas pré-configurada no deploy | 11.2 | Média |
| Overlay YouTube completo + compliance ToS | 11.5 | Média |
| Fila de aprovação prévia de comentários | 11.7 | Baixa |
| Refresh durante live sem contar como segundo acesso | 11.12 | Baixa |
| Troca de modo geral ↔ isolado em tempo real | 11.8 | Baixa |
| Disclaimer legal do viewer count simulado | 11.9 | Baixa |
| Colunas exatas de export + retenção de histórico | 11.10 | Baixa |
| Exceções de IP compartilhado (regra manual) | 11.14 | Baixa |

---

## Como usar

```bash
# Desenvolvimento
npm run dev          # http://localhost:3000

# Produção
npm run build && npm start

# Admin
# Acesso: /admin/login
# Senha padrão: admin123  →  alterar em .env.local (ADMIN_PASSWORD)
```

### Fluxo de configuração de uma edição
1. `/admin/login` → entrar com a senha
2. `/admin/configuracoes` → definir URL do vídeo (YouTube ou upload), duração, CTA, página de vendas
3. `/admin/importar` → subir o roteiro CSV com os comentários simulados
4. `/ao-vivo` → testar preview como admin (banner âmbar aparece fora do horário)
5. `/espera` → testar o popup de cadastro em aba anônima
6. Na terça às 20h → participantes são redirecionados automaticamente para `/ao-vivo`

### Template CSV para roteiro simulado
```
tipo;nome_exibido;texto;timestamp
usuario_simulado;João Silva;Que conteúdo incrível!;00:05:00
staff_simulado;Staff;Obrigado, João! Ótima pergunta.;00:05:30
compra_simulada;Maria Santos;Acabei de garantir minha vaga!;00:45:00
```

Tipos aceitos: `usuario_simulado` · `staff_simulado` · `compra_simulada`  
Timestamp: `HH:MM:SS`, `MM:SS` ou segundos inteiros

---

## Sessão 5 — Transição Mac M1 → Windows (Diagnóstico e Reparo)

**O que foi feito:**
- **Diagnóstico de Conflito:** Identificado que a biblioteca `better-sqlite3` possuía binários compilados para ARM64 (Mac M1), incompatíveis com o Windows x64.
- **Limpeza de Travas:** Removidas múltiplas instâncias de processos Node que bloqueavam a pasta `node_modules`.
- **Preparação de Mock:** Criado um "Database Mock" em `node_modules/better-sqlite3` para permitir que o Next.js inicie sem depender da compilação nativa do SQLite.
- **Tentativas de Instalação:** Executados comandos `npm install --ignore-scripts` para evitar falhas de compilação durante a reconstrução do ambiente no Windows.

**Estado Atual:**
- O código-fonte em `src/` está intacto e correto.
- A pasta `node_modules` está em processo de reconstrução. O Windows está apresentando lentidão e bloqueios de arquivos (EPERM) durante a instalação.
- As versões antigas da `node_modules` foram movidas/renomeadas para liberar o terreno.

**Recomendações para Finalizar:**
1. **Reiniciar o Computador:** Para garantir que qualquer trava de arquivo remanescente no Windows seja liberada.
2. **Node Version:** O Node v24 é muito recente. Recomendado usar **Node v20 LTS** ou **v22** via [nvm-windows](https://github.com/coreybutler/nvm-windows).
3. **Instalar Ferramentas de Build:** Se desejar usar o SQLite nativo, rode `npm install --global --production windows-build-tools` em um terminal como Administrador.
4. **Comando de Emergência:** Para ver o projeto sem esperar o banco de dados compilar:
   ```bash
   npm install --ignore-scripts
   npx next dev
   ```

---

### Sessão 6 — Migração SQLite → Supabase + estabilização do sistema

**O que foi feito:**
- **Migração completa do banco** de SQLite (`better-sqlite3`) para **Supabase** (PostgreSQL). `db.ts` reescrito com cliente Supabase, todas as queries convertidas para a API fluente do Supabase. Schema migrado para o dashboard do Supabase.
- **Tema visual "Cyber"** aplicado em toda a plataforma (`cybertheme.ts`): paleta dark com accent azul-ciano, fontes Orbitron + Montserrat, bordas dim e glows.
- **Badge de modo Teste** no admin (roxo, além de Aguardando/Ao Vivo/Encerrada).
- **Review formal do sistema de comentários** — 8 bugs identificados e corrigidos (ver `ESPECIFICACOES-IMERSAO.md` seção 14.3).
- **Build local fixado no Windows** com Node 22+ via `patch-readlink.cjs`.

---

### Sessão 7 — Correções de bugs e melhorias (junho 2026)

**Cadastro e sessão:**
- Modal de cadastro volta a aparecer após admin deletar registros — `/espera` valida existência do registro no banco antes de aceitar JWT.
- Bloqueio por IP substituído por **soft-limit**: mesmo IP + e-mail diferente re-emite sessão do slot existente sem redirect para página de vendas. Elimina falsos positivos em redes domésticas.
- Mesmo e-mail em qualquer IP re-emite sessão (usuário pode alternar dispositivos).

**Player de vídeo:**
- YouTube não pausa mais sozinho — `userPausedRef` distingue pausa intencional de auto-pause do player. Pausas involuntárias são retomadas automaticamente.

**Notificações de compra:**
- Intervalos entre toasts agora aleatórios: entrada tardias 5–12 s, burst CTA 20–45 s, jitter 0–5 s por timestamp.

**Chat — modo isolado:**
- **Bug identificado e corrigido via SSR pre-load**: comentários `real_user` de outros participantes apareciam em modo isolado porque o merge do poll nunca removia itens do estado. Solução: `/ao-vivo/page.tsx` agora carrega os comentários reais já filtrados no SSR (`getIsolatedComments` ou `getRealComments`) e os passa como `initialRealComments` para o `ChatPanel`. O componente monta com estado correto e `lastPoll` apontando para o comentário mais recente — primeiro poll é genuinamente incremental.
- **Decisão de arquitetura**: modo chat é configuração pré-live (toggle só na página admin, nunca no painel staff durante a live).

---

## Pendências incrementais (atualizadas em jun/2026)

| Item | Ref. spec | Prioridade |
|------|-----------|------------|
| Upload de vídeo via admin (pipeline, CDN/storage) | 11.4 | Alta |
| Fuso horário configurável (hoje hardcoded UTC-3) | 11.1 | Média |
| URL da página de vendas pré-configurada no deploy | 11.2 | Média |
| Overlay YouTube completo + compliance ToS | 11.5 | Média |
| Fila de aprovação prévia de comentários | 11.7 | Baixa |
| Refresh durante live sem contar como segundo acesso | 11.12 | Baixa |
| Disclaimer legal do viewer count simulado | 11.9 | Baixa |

---

*Atualizado em 01/06/2026*
