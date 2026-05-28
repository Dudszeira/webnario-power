# Cyber Redesign — Admin Panel & Página de Espera

**Data:** 2026-05-28  
**Escopo:** Admin panel completo (`/admin/*`) + Página de espera (`/espera`)  
**Fora do escopo:** `/ao-vivo`, API routes, lógica de negócio

---

## 1. Identidade Visual

### Paleta de cores

| Token | Valor | Uso |
|---|---|---|
| `bg` | `#020810` | Background de página |
| `surface` | `#040d1a` | Cards, sidebars, modais |
| `surfaceHover` | `#071428` | Estado hover de cards |
| `accent` | `#00B4FF` | Cyan — bordas ativas, títulos, glows |
| `accentDim` | `#0077aa` | Cyan escuro — gradientes, botões |
| `accentBorder` | `rgba(0,180,255,0.4)` | Bordas padrão |
| `accentBorderDim` | `rgba(0,180,255,0.2)` | Bordas secundárias |
| `accentGlow` | `rgba(0,180,255,0.25)` | Box-shadow glow |
| `green` | `#00ff9d` | Status online, dot piscante |
| `textPrimary` | `#c8e4f4` | Texto principal legível |
| `textSupport` | `#8cb8d4` | Texto de suporte, subtítulos |
| `textLabel` | `#6a9ab8` | Labels, unidades, metadados |
| `textDecorative` | `#3a6b8a` | Separadores, elementos decorativos |
| `white` | `#ffffff` | Títulos em destaque máximo |

### Tipografia

| Uso | Fonte | Peso | Observação |
|---|---|---|---|
| Títulos, botões, nav principal | `Orbitron` | 700 / 900 | Google Fonts |
| Corpo, labels, inputs, parágrafos | `Exo 2` | 300 / 400 / 600 / 700 | Google Fonts |

Carregamento via `<link>` no `layout.tsx` raiz (ambas as páginas precisam).

### Efeitos de fundo

**Admin (full cyberpunk):**
- Scan lines: `repeating-linear-gradient(0deg, rgba(0,0,0,0.07) 0px, rgba(0,0,0,0.07) 1px, transparent 1px, transparent 3px)`
- Grid: `linear-gradient(rgba(0,180,255,0.04) 1px, transparent 1px)` em 40×40px
- Ambos aplicados via `::before` / `::after` no wrapper do admin layout

**Espera (cyber clean):**
- Grid sutil: `rgba(0,180,255,0.03)` em 50×50px — sem scan lines
- Glow radial no centro: `radial-gradient(ellipse 70% 40% at 50% 20%, rgba(0,180,255,0.07)...)`

---

## 2. Arquivo de Tokens Centralizados

**Arquivo:** `src/lib/cybertheme.ts`

Exporta objeto `cyber` com todos os tokens de cor e `cyberFonts` com as famílias. Todos os componentes importam deste arquivo — nenhum valor de cor hard-coded nos componentes.

```ts
export const cyber = {
  bg: '#020810',
  surface: '#040d1a',
  surfaceHover: '#071428',
  accent: '#00B4FF',
  accentDim: '#0077aa',
  accentBorder: 'rgba(0,180,255,0.4)',
  accentBorderDim: 'rgba(0,180,255,0.2)',
  accentGlow: 'rgba(0,180,255,0.25)',
  green: '#00ff9d',
  greenGlow: 'rgba(0,255,157,0.4)',
  textPrimary: '#c8e4f4',
  textSupport: '#8cb8d4',
  textLabel: '#6a9ab8',
  textDecorative: '#3a6b8a',
  white: '#ffffff',
} as const;

export const cyberFonts = {
  display: "'Orbitron', sans-serif",
  body: "'Exo 2', sans-serif",
} as const;
```

---

## 3. Admin Panel

### Layout geral

- Sidebar fixa à esquerda (220px), conteúdo principal à direita
- Fundo com scan lines + grid (aplicados no admin layout wrapper)
- Sidebar: `background: rgba(4,13,26,0.8)`, `border-right: 1px solid rgba(0,180,255,0.3)`

### AdminNav (`src/components/AdminNav.tsx`)

- Logo no topo: prefix `// SISTEMA` em `textDecorative`, nome `WEBNARIO` em Orbitron + `accent` com text-shadow glow
- Seção de links: label `NAVEGAÇÃO` em `textLabel` + letter-spacing 4px
- Item de nav: cor `textDecorative` → `textPrimary` no hover, `border-left: 2px solid accent` quando ativo
- Footer da sidebar: dot verde piscante + texto `ONLINE` em `textLabel`
- Animação `blink`: `opacity 1 → 0.2 → 1` em 1.8s ease-in-out infinite

### AdminDashboard (`src/components/AdminDashboard.tsx`)

- Page header: título em Orbitron 900 + `accent` + text-shadow, badge de status com dot verde
- Métricas: grid 4 colunas, cada card com `surface`, `border: 1px solid accentBorderDim`, corner accent triangle (CSS border trick), valor em Orbitron `accent`
- Acesso rápido: cards com `[01]` index em `textDecorative`, nome em `textPrimary`, hover com `surfaceHover` + glow + `translateY(-2px)`
- Section label com linha gradiente à direita

### AdminLogin (`src/components/AdminLogin.tsx`)

- Página centralizada, sem sidebar
- Card de login com `surface`, border `accentBorder`, corner accent, box-shadow glow
- Título em Orbitron, campos com estilo cyber (border `accentBorderDim`, focus → `accent`)
- Botão submit com gradiente `accent → accentDim`

### AdminConfig, AdminComments, AdminImport, AdminLiveMonitor

- Mesma estrutura de page header (Orbitron título + subtítulo em `textLabel`)
- Tabelas: header em `surface`, linhas alternadas com leve diferença de fundo, bordas em `accentBorderDim`
- Inputs e selects: estilo cyber padrão (dark bg, border `accentBorderDim`, focus `accent`)
- Botões de ação: gradiente `accent → accentDim` (primário) ou outline `accentBorder` (secundário)
- Status badges: verde `green` para ativo, `textLabel` para inativo

### Admin Layout (`src/app/admin/layout.tsx`)

- Wrapper com `display: flex`, background `bg`
- Efeitos scan lines + grid aplicados aqui via `position: fixed` (não em globals.css)
- Renderiza `<AdminNav>` + `<main>` com o conteúdo da página

---

## 4. Página de Espera

### Preservação de conteúdo

**Zero conteúdo removido.** Apenas estilo visual alterado:

| Elemento | Status |
|---|---|
| Logo `/logo.webp` | Mantido — mesmo `<Image>` |
| `<Countdown>` com Dias/Hrs/Min/Seg | Mantido — lógica intacta, só visual dos blocos |
| 4 bullets de conteúdo | Mantidos integralmente |
| Aviso de redirecionamento automático | Mantido |
| Footer com copyright | Mantido |
| `<RegisterModal>` com Nome + Email | Mantido — mesma API, mesmo fluxo |
| Success overlay | Mantido — resestilizado |
| Live Over Modal | Mantido — resestilizado |
| Lógica de redirect automático | Mantida intacta |

### EsperaContent (`src/components/EsperaContent.tsx`)

- Background `bg` com grid sutil + glow radial (inline style no wrapper principal)
- Logo mantida no topo, abaixo badge "Evento ao Vivo" com dot verde piscante
- Countdown centralizado com os blocos resestilizados
- Card de bullets: `surface` com border `accentBorderDim`, border-radius 10px, corner accent; título em Orbitron `accent`; bullets com ícone `›` cyan e texto `textPrimary`
- Redirect notice: border `accentBorderDim` sutil, texto `textSupport`, bold em `#d8eef8`
- Footer: texto `textLabel`

### Countdown (`src/components/Countdown.tsx`)

- Lógica de cálculo (Dias/Hrs/Min/Seg) sem alteração
- Visual dos blocos: border `accentBorderDim`, border-radius 8px, background `rgba(0,180,255,0.05)`, corner accent triangle
- Número em Orbitron 700 + `accent` + text-shadow glow
- Label de unidade em `textLabel` + letter-spacing

### RegisterModal (`src/components/RegisterModal.tsx`)

- Overlay: `rgba(2,8,16,0.88)` + `backdrop-filter: blur(6px)`
- Modal: `surface`, border `accentBorder`, border-radius 10px, box-shadow glow, corner accent
- Logo mantida no topo do modal
- Título "Você está a um passo!" em Orbitron branco
- Subtítulo em `textSupport` (`#8cb8d4`), bold em branco
- Espaço generoso entre título e subtítulo (margin-bottom 16px)
- Campos: background `bg`, border `accentBorderDim`, focus → `accent` + glow sutil, texto `textPrimary`
- Labels: `textLabel` + letter-spacing 3px + uppercase
- Botão submit: gradiente `accent → accentDim`, Orbitron bold, cor texto `#000`

### Success overlay e Live Over Modal (em EsperaContent)

- Mesmo overlay pattern: `rgba(2,8,16,0.88)` + blur
- Card com `surface`, border `accentBorder`, corner accent
- Textos ajustados para escala de contraste definida
- Botão de ação com gradiente cyber; botão fechar em `textLabel`

---

## 5. Abordagem de Implementação

**Abordagem B + tokens centralizados:**
- Criar `src/lib/cybertheme.ts` com todos os tokens
- Atualizar componentes com `style={{}}` inline usando os tokens importados
- Não alterar `tailwind.config.ts` nem `globals.css` (zero risco de afetar `/ao-vivo` ou outras páginas)
- Fontes Orbitron + Exo 2 adicionadas via `<link>` no `src/app/layout.tsx` raiz

---

## 6. Ordem de Implementação

1. `src/lib/cybertheme.ts` — tokens e fontes
2. `src/app/layout.tsx` — adicionar Google Fonts link
3. `src/app/admin/layout.tsx` — wrapper com sidebar + efeitos de fundo
4. `src/components/AdminNav.tsx` — sidebar cyberpunk
5. `src/components/AdminLogin.tsx` — página de login
6. `src/components/AdminDashboard.tsx` — dashboard com métricas
7. `src/components/AdminConfig.tsx`, `AdminComments.tsx`, `AdminImport.tsx`, `AdminLiveMonitor.tsx`
8. `src/components/Countdown.tsx` — visual dos blocos
9. `src/components/RegisterModal.tsx` — modal de cadastro
10. `src/components/EsperaContent.tsx` — página de espera completa
