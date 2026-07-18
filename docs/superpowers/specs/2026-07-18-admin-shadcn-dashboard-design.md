# Admin shadcn/dashboard-01 redesign

## Goal

Replace the current admin panel's hand-rolled inline-style UI (cyberpunk theme via `src/lib/cybertheme.ts`, ~2100 lines of `style={{}}` objects across 7 files) with shadcn's component system, scaffolded from the `dashboard-01` block. Keep the current brand colors; change everything else (fonts, decorative effects, layout primitives).

## Scope

**In scope** — the entire `/admin` area (6 screens):
- `AdminLogin.tsx` (`/admin/login`)
- `AdminDashboard.tsx` (`/admin`)
- `AdminConfig.tsx` (`/admin/configuracoes`)
- `AdminImport.tsx` (`/admin/importar`)
- `AdminComments.tsx` (`/admin/comentarios`)
- `AdminLiveMonitor.tsx` (`/admin/live`)
- `AdminNav.tsx` → replaced by a shadcn `AppSidebar`

**Out of scope** — untouched:
- Public webinar pages (`/espera`, `/ao-vivo`, `/bloqueado`, `/imersao`) and their components (`AoVivoContent`, `ChatPanel`, `EsperaContent`, `PurchaseNotifications`, `Countdown`, `CyberDateTimePicker`, `RegisterModal`, `VideoPlayer`, `ViewerCount`)
- `src/lib/cybertheme.ts` itself — stays as-is, still imported by the public pages above
- All API routes, data fetching logic, and business logic (delete confirmations, CSV export links, edition filtering, etc.) — only presentation changes, behavior stays identical

## Color mapping

`cybertheme.ts` values are ported once into shadcn's CSS variables (dark theme only, no light/dark toggle — the product is always dark):

| shadcn variable | value | source |
|---|---|---|
| `--background` | `#020810` | `cyber.bg` |
| `--card` | `#040d1a` | `cyber.surface` |
| `--foreground` | `#c8e4f4` | `cyber.textPrimary` |
| `--muted-foreground` | `#6a9ab8` | `cyber.textLabel` |
| `--primary` | `#00B4FF` | `cyber.accent` |
| `--border` | `rgba(0,180,255,0.2)` | `cyber.accentBorderDim` |
| `--destructive` | `#ef4444` | existing red used for delete actions |
| success/live accent | `#00ff9d` | `cyber.green`, used for status badges only |

Fonts switch to the shadcn default (Inter / system-ui, already declared in `tailwind.config.ts`) — Orbitron/Exo 2 are dropped from the admin area.

## Technical setup

1. `npx shadcn@latest init` — creates `components.json`, `src/lib/utils.ts` (`cn()` helper), wires the CSS variables above into `globals.css`.
   - Risk: the current CLI defaults to Tailwind v4 conventions; the project is on Tailwind v3.4.1. If `init` proposes a v3→v4 migration, stop and confirm before proceeding — that upgrade is unrelated to this visual task and should be its own decision.
2. `npx shadcn@latest add dashboard-01` — pulls the block (collapsible sidebar, header, stat cards, data table, chart) plus its primitive dependencies (`button`, `card`, `table`, `badge`, `sidebar`, `dropdown-menu`, `avatar`, `separator`, `sheet`, `input`, `label`, `select`, `tabs`, `tooltip`, `chart`).
3. Additional primitives added on demand per screen: `switch` (config toggles), `textarea`, `alert-dialog` (delete confirmations — today a mini inline state), `form` (login, config).
4. Only the public shadcn registry is used — no private/custom registry configured.
5. The shadcn MCP server was registered in `.mcp.json` (`npx shadcn@latest mcp init --client claude`) for future sessions; this session still uses the CLI directly since the MCP tool isn't loaded until restart.

## Component architecture

- `AdminNav.tsx` is replaced by an `AppSidebar` component following the shadcn sidebar pattern: same 5 nav links (Dashboard, Monitor Live, Configurações, Importar, Comentários), icons swapped from inline SVG to `lucide-react`, logout and "ver ao vivo" actions preserved.
- Each admin screen keeps its existing state/fetch/handler logic unchanged; only the returned JSX is rewritten using shadcn primitives:
  - Stat tiles → `Card` (dashboard-01's stat-card pattern)
  - Tables (registrations, editions) → shadcn `Table`
  - Status pills (Público/Restrito/Admin, Ao Vivo/Aguardando/Encerrada) → `Badge`
  - Delete confirmation → `AlertDialog` instead of the current inline "Apagar?/Sim/Não" swap
  - Forms (login, config) → `Input`/`Label`/`Select`/`Switch`/`Button`

## Phasing

1. **Phase 1** — `shadcn init`, color theme wiring, `add dashboard-01`, new `AppSidebar`, rebuild `AdminDashboard.tsx`. Stop here for visual validation before continuing.
2. **Phase 2** — `AdminLogin.tsx`
3. **Phase 3** — `AdminConfig.tsx`
4. **Phase 4** — `AdminImport.tsx`
5. **Phase 5** — `AdminComments.tsx`
6. **Phase 6** — `AdminLiveMonitor.tsx`

Each phase is verified by logging into `/admin` locally (dev server already running) and clicking through the affected screen(s), checking that all existing behavior (CSV export, delete confirmations, edition filter, CSV/XLSX import, comment moderation actions) still works.

## Testing

No existing automated test suite covers the admin UI (visual/manual product). Verification is manual: run the dev server, exercise each screen's golden path and its destructive actions (delete registration, delete edition) after each phase.
