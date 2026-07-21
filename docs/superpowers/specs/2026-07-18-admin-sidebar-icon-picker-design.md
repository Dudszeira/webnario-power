# Admin sidebar icon picker

## Goal

Let the admin swap the "W" logo square in the sidebar header (`AdminSidebar.tsx`) for either a preset lucide-react icon or a custom uploaded image, via a modal opened by clicking the square. The choice persists server-side (Supabase) so it's the same across any device/login, not just the current browser.

## Scope

**In scope:**
- A tooltip on the sidebar logo square ("Clique para trocar o ícone") hinting it's clickable.
- A modal (shadcn `Dialog`, not yet installed — added as part of this work) with:
  - A grid of ~16 preset lucide-react icons, one click to apply.
  - An upload area (image file — png/jpg/webp/svg, max 2MB) with a preview before confirming.
  - A "Restaurar padrão" button reverting to the "W" letter square.
- A new Supabase table (`admin_settings`, single row) storing the current choice.
- A new Supabase Storage bucket (`branding`, public read) for uploaded images.
- Two new API routes: `GET`/`PUT /api/admin/branding`.
- `AdminSidebar.tsx` fetches the current setting on mount and renders accordingly.

**Out of scope:**
- Per-admin-user settings (there's only one shared admin password, no user accounts — this is a single global setting, not per-user).
- Editing/cropping the uploaded image (upload as-is, displayed via `object-cover` in a fixed square).
- Any other branding besides this one sidebar icon (e.g., page favicon, email templates).

## Data model

New table, single row (`id = 'default'`):

```sql
create table admin_settings (
  id text primary key default 'default',
  sidebar_icon_type text not null default 'letter', -- 'letter' | 'preset' | 'upload'
  sidebar_icon_value text,                            -- lucide icon name (preset) or public image URL (upload)
  updated_at timestamptz not null default now()
);
insert into admin_settings (id) values ('default');
```

New Storage bucket: `branding` — public bucket (public read, service-role write only). Must be created manually in the Supabase dashboard (Storage → New bucket → name `branding`, toggle "Public bucket" on) since this session has no network access to the project's Supabase instance to create it programmatically. The SQL above must also be run manually (SQL editor) for the same reason.

## API

- `GET /api/admin/branding` — returns `{ type, value }` from the single `admin_settings` row (defaults to `{ type: 'letter', value: null }` if the row is somehow missing).
- `PUT /api/admin/branding` — accepts multipart form data:
  - `type=letter` — resets to the default letter square, `value` cleared.
  - `type=preset&value=<lucide-icon-name>` — stores the icon name string directly (validated against the known preset list server-side, rejecting anything else).
  - `type=upload` + `file=<image>` — validates mime type (`image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`) and size (≤2MB), uploads to the `branding` bucket under a fixed key (e.g. `sidebar-icon`, overwritten each time so old uploads don't accumulate), stores the resulting public URL as `value`.
  - Both authenticated via the existing `verifyAdminFromRequest` guard (same pattern as `/api/admin/config`).

## UI

- **Preset icon set** (16 lucide-react icons covering common brand/product motifs): `Rocket`, `Zap`, `Tv`, `Video`, `Star`, `Radio`, `Sparkles`, `Flame`, `Globe`, `Shield`, `Award`, `Target`, `Gem`, `Crown`, `Compass`, `Bolt`. Cosmetic detail — swappable during implementation without re-approval.
- **Modal** — shadcn `Dialog`, added via `npx shadcn add dialog` (subject to the same Tailwind v3 compatibility fixes already applied project-wide: `-(--var)` shorthand → `-[var(--var)]`, `has-data-[...]` → `has-[[data-...]]`, etc. — verified against compiled CSS before considered done, same process used throughout this session).
- **AdminSidebar** — on mount, `fetch('/api/admin/branding')`; renders:
  - `type: 'upload'` → `<img src={value} className="size-6 rounded-md object-cover" />`
  - `type: 'preset'` → the matching lucide icon component, `size-3.5`, inside the existing `bg-primary` square
  - `type: 'letter'` (or fetch failure/loading) → today's "W" square (unchanged fallback, no flash of empty state)
  - The whole square becomes a `<button onClick={() => setModalOpen(true)}>`, wrapped in `Tooltip`.
- Saving in the modal calls `PUT /api/admin/branding`, updates local state optimistically, closes the modal.

## Error handling

- Upload API rejects (400) files over 2MB or with an unrecognized mime type, with a message surfaced in the modal.
- If the `branding` bucket or `admin_settings` table doesn't exist yet (not created per the manual step above), the API returns a 500 with a clear message ("execute o SQL/crie o bucket, veja a spec") rather than a silent failure — this is a one-time setup gap, not something to paper over with a fallback.
- `AdminSidebar`'s fetch failing (network/table missing) silently falls back to the "W" letter, matching how the rest of the dashboard already degrades when Supabase is unreachable (established pattern from earlier this session).

## Testing

No automated tests for this (matches the rest of the admin UI — manual/visual product). Manual verification: open the modal, pick a preset icon, confirm it renders in the sidebar and survives a page reload (proves server persistence); repeat with an uploaded image; use "Restaurar padrão" and confirm it reverts. Requires the manual Supabase setup step above to be completed first — cannot be verified in this session's sandboxed dev server since Supabase is unreachable here (confirmed earlier: `getaddrinfo ENOTFOUND` on every Supabase call in this environment).
