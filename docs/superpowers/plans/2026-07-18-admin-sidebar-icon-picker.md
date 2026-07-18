# Admin Sidebar Icon Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin click the "W" logo square in the sidebar header to open a modal, pick a preset lucide icon or upload a custom image, and have that choice persist server-side (Supabase) across devices/logins.

**Architecture:** A single-row Supabase table (`admin_settings`, already created) and a public Storage bucket (`branding`, already created) hold the current choice. A new `GET`/`PUT /api/admin/branding` route reads/writes it, following the existing `db.ts` helper-function convention. A new `AdminIconPicker` dialog component (shadcn `Dialog`, already pulled) lets the admin pick a preset icon or upload an image; `AdminSidebar` fetches the current setting on mount, renders it, and opens the picker on click.

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + Storage), shadcn `Dialog`/`Tooltip` (already installed and Tailwind-v3-compatible — verified, no `-(--var)`/`has-data-[...]`/`--spacing()` v4-only syntax in either file), lucide-react.

## Global Constraints

- Single global setting, not per-user (one shared admin password, no user accounts) — table has exactly one row, `id = 'default'`.
- Upload accepts only `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml`, max 2MB — enforced both by the Storage bucket's own config (already set) and again in the API route (defense in depth, and to return a friendly error before attempting the upload).
- The uploaded file always overwrites the same Storage object path (`sidebar-icon`, no extension) so old uploads never accumulate in the bucket.
- No automated test suite exists for the admin UI (established project convention — see `docs/superpowers/specs/2026-07-18-admin-shadcn-dashboard-design.md`). Verification here is manual: `curl` for the API, browser click-through for the UI.
- Already done (do not redo): `admin_settings` table created and seeded (`id='default', sidebar_icon_type='letter', sidebar_icon_value=null`); `branding` Storage bucket created (public, 2MB limit, the four mime types above); `src/components/ui/dialog.tsx` pulled via `npx shadcn add dialog` and confirmed to need no v3-compat fixes.

---

### Task 1: Branding persistence — DB helpers + API route

**Files:**
- Modify: `src/lib/db.ts` (add two functions, following the existing `getEdition`/`upsertEdition` pattern already in the file)
- Create: `src/app/api/admin/branding/route.ts`

**Interfaces:**
- Produces: `getBrandingSettings(): Promise<{ type: 'letter' | 'preset' | 'upload'; value: string | null }>` and `updateBrandingSettings(type: string, value: string | null): Promise<void>` from `src/lib/db.ts`, imported by the route in this task and by nothing else yet.
- Produces: `GET /api/admin/branding` → `200 { type, value }`. `PUT /api/admin/branding` (multipart `FormData`, field `type` = `'letter' | 'preset' | 'upload'`, plus `value` for `preset` or `file` for `upload`) → `200 { type, value }` on success, `400`/`401`/`500` with `{ error: string }` otherwise.

- [ ] **Step 1: Add the two helper functions to `src/lib/db.ts`**

Add this block after the `getEditionMetrics` function at the end of the file (the file currently ends around line 522+ per the existing `export async function getEditionMetrics` — append after its closing brace):

```typescript
export async function getBrandingSettings(): Promise<{ type: 'letter' | 'preset' | 'upload'; value: string | null }> {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('sidebar_icon_type, sidebar_icon_value')
    .eq('id', 'default')
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('getBrandingSettings error:', error);
    return { type: 'letter', value: null };
  }
  return { type: data.sidebar_icon_type as 'letter' | 'preset' | 'upload', value: data.sidebar_icon_value };
}

export async function updateBrandingSettings(type: string, value: string | null): Promise<void> {
  const { error } = await supabase
    .from('admin_settings')
    .update({ sidebar_icon_type: type, sidebar_icon_value: value, updated_at: new Date().toISOString() })
    .eq('id', 'default');

  if (error) console.error('updateBrandingSettings error:', error);
}
```

- [ ] **Step 2: Create the API route**

Create `src/app/api/admin/branding/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase, getBrandingSettings, updateBrandingSettings } from '@/lib/db';
import { verifyAdminFromRequest } from '@/lib/auth';

const ICON_NAMES = [
  'Rocket', 'Zap', 'Tv', 'Video', 'Star', 'Radio', 'Sparkles', 'Flame',
  'Globe', 'Shield', 'Award', 'Target', 'Gem', 'Crown', 'Compass', 'Bolt',
];
const MAX_SIZE = 2 * 1024 * 1024;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export async function GET(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const settings = await getBrandingSettings();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  if (!(await verifyAdminFromRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData();
  const type = form.get('type');

  if (type === 'letter') {
    await updateBrandingSettings('letter', null);
    return NextResponse.json({ type: 'letter', value: null });
  }

  if (type === 'preset') {
    const value = form.get('value');
    if (typeof value !== 'string' || !ICON_NAMES.includes(value)) {
      return NextResponse.json({ error: 'Ícone inválido' }, { status: 400 });
    }
    await updateBrandingSettings('preset', value);
    return NextResponse.json({ type: 'preset', value });
  }

  if (type === 'upload') {
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: 'Formato de imagem não suportado' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Imagem maior que 2MB' }, { status: 400 });
    }

    const { error: uploadError } = await supabase.storage
      .from('branding')
      .upload('sidebar-icon', file, { upsert: true, contentType: file.type });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('branding').getPublicUrl('sidebar-icon');
    const value = `${urlData.publicUrl}?t=${Date.now()}`;
    await updateBrandingSettings('upload', value);
    return NextResponse.json({ type: 'upload', value });
  }

  return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
}
```

- [ ] **Step 3: Verify it compiles**

The dev server should already be running on port 3000 (started earlier this session). Confirm no compile errors:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/branding
```

Expected: `401` (no auth cookie sent — proves the route compiled and the auth guard runs; a 500 here means a syntax/import error, check the dev server log).

- [ ] **Step 4: Manual verification — GET default, PUT preset, GET reflects it**

```bash
curl -s -c cookies.txt -X POST http://localhost:3000/api/admin/auth-session -H "Content-Type: application/json" -d '{"password":"admin123"}'
curl -s -b cookies.txt http://localhost:3000/api/admin/branding
```

Expected: `{"type":"letter","value":null}` (the seeded default row).

```bash
curl -s -b cookies.txt -X PUT http://localhost:3000/api/admin/branding -F "type=preset" -F "value=Rocket"
curl -s -b cookies.txt http://localhost:3000/api/admin/branding
```

Expected: both calls return `{"type":"preset","value":"Rocket"}` — the second call proves the write actually persisted (not just echoed).

```bash
curl -s -b cookies.txt -X PUT http://localhost:3000/api/admin/branding -F "type=letter"
curl -s -b cookies.txt http://localhost:3000/api/admin/branding
```

Expected: both return `{"type":"letter","value":null}` — resets cleanly, leaving the table in its default state for Task 2's testing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/app/api/admin/branding/route.ts
git commit -m "feat: add branding settings persistence API"
```

---

### Task 2: Icon picker modal + sidebar wiring

**Files:**
- Create: `src/components/AdminIconPicker.tsx`
- Modify: `src/components/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `GET`/`PUT /api/admin/branding` from Task 1.
- Produces: `ICON_OPTIONS: { name: string; Icon: React.ComponentType<{ className?: string }> }[]` and `type BrandingIcon = { type: 'letter' | 'preset' | 'upload'; value: string | null }`, exported from `AdminIconPicker.tsx` (consumed by `AdminSidebar.tsx` in this same task — no other consumers).

- [ ] **Step 1: Create the picker modal**

Create `src/components/AdminIconPicker.tsx`:

```tsx
'use client';

import { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Rocket, Zap, Tv, Video, Star, Radio, Sparkles, Flame,
  Globe, Shield, Award, Target, Gem, Crown, Compass, Bolt,
  Upload, Loader2,
} from 'lucide-react';

export const ICON_OPTIONS: { name: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { name: 'Rocket', Icon: Rocket },
  { name: 'Zap', Icon: Zap },
  { name: 'Tv', Icon: Tv },
  { name: 'Video', Icon: Video },
  { name: 'Star', Icon: Star },
  { name: 'Radio', Icon: Radio },
  { name: 'Sparkles', Icon: Sparkles },
  { name: 'Flame', Icon: Flame },
  { name: 'Globe', Icon: Globe },
  { name: 'Shield', Icon: Shield },
  { name: 'Award', Icon: Award },
  { name: 'Target', Icon: Target },
  { name: 'Gem', Icon: Gem },
  { name: 'Crown', Icon: Crown },
  { name: 'Compass', Icon: Compass },
  { name: 'Bolt', Icon: Bolt },
];

export type BrandingIcon = { type: 'letter' | 'preset' | 'upload'; value: string | null };

export function AdminIconPicker({
  open,
  onOpenChange,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (next: BrandingIcon) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function save(form: FormData, key: string) {
    setSaving(key);
    setError(null);
    try {
      const res = await fetch('/api/admin/branding', { method: 'PUT', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar');
      onChange({ type: data.type, value: data.value });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setSaving(null);
    }
  }

  function pickPreset(name: string) {
    const form = new FormData();
    form.set('type', 'preset');
    form.set('value', name);
    save(form, name);
  }

  function resetToLetter() {
    const form = new FormData();
    form.set('type', 'letter');
    save(form, 'letter');
  }

  function handleFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setError('Imagem maior que 2MB');
      return;
    }
    const form = new FormData();
    form.set('type', 'upload');
    form.set('file', file);
    save(form, 'upload');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ícone da sidebar</DialogTitle>
          <DialogDescription>Escolha um ícone pronto ou envie uma imagem.</DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid grid-cols-4 gap-2">
          {ICON_OPTIONS.map(({ name, Icon }) => (
            <button
              key={name}
              type="button"
              onClick={() => pickPreset(name)}
              disabled={saving !== null}
              className="flex aspect-square items-center justify-center rounded-lg border border-border bg-muted/50 text-foreground hover:bg-accent disabled:opacity-50"
            >
              {saving === name ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
            </button>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={saving !== null}
          onClick={() => fileInputRef.current?.click()}
        >
          {saving === 'upload' ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Enviar imagem
        </Button>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={saving !== null} onClick={resetToLetter}>
            Restaurar padrão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire it into `AdminSidebar.tsx`**

Read the current file first — it was last modified earlier this session (nav gap, collapse-to-icon fixes). Apply these changes on top of what's there:

Add to the imports at the top:

```tsx
import { useEffect, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AdminIconPicker, ICON_OPTIONS, type BrandingIcon } from './AdminIconPicker';
```

Inside the `AdminSidebar` function, before the `return`, add:

```tsx
const [branding, setBranding] = useState<BrandingIcon>({ type: 'letter', value: null });
const [pickerOpen, setPickerOpen] = useState(false);

useEffect(() => {
  fetch('/api/admin/branding')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d) setBranding(d); })
    .catch(() => {/* keep the default letter fallback */});
}, []);

const PresetIcon = branding.type === 'preset'
  ? ICON_OPTIONS.find((o) => o.name === branding.value)?.Icon
  : null;
```

Replace the existing `SidebarHeader` block (the one with `SidebarMenuButton size="lg" className="pointer-events-none"` and the "W" square) with:

```tsx
<SidebarHeader>
  <SidebarMenu>
    <SidebarMenuItem>
      <Tooltip>
        <TooltipTrigger render={<SidebarMenuButton size="lg" onClick={() => setPickerOpen(true)} />}>
          <div className="flex aspect-square size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary text-[10px] font-black text-primary-foreground">
            {branding.type === 'upload' && branding.value ? (
              <img src={branding.value} alt="" className="size-full object-cover" />
            ) : PresetIcon ? (
              <PresetIcon className="size-3.5" />
            ) : (
              'W'
            )}
          </div>
          <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[9px] tracking-[0.2em] text-muted-foreground">SISTEMA</span>
            <span className="truncate text-sm font-black tracking-[0.1em]">WEBNARIO</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">Clique para trocar o ícone</TooltipContent>
      </Tooltip>
    </SidebarMenuItem>
  </SidebarMenu>
</SidebarHeader>
```

Add the picker as the last child of `<Sidebar>`, right before its closing tag (after `</SidebarFooter>`):

```tsx
<AdminIconPicker open={pickerOpen} onOpenChange={setPickerOpen} onChange={setBranding} />
```

- [ ] **Step 3: Verify it compiles**

```bash
curl -s -c cookies.txt -X POST http://localhost:3000/api/admin/auth-session -H "Content-Type: application/json" -d '{"password":"admin123"}'
curl -s -o /dev/null -w "%{http_code}\n" -b cookies.txt http://localhost:3000/admin
```

Expected: `200`. If it's `500`, check the dev server log for a syntax/import error before continuing.

- [ ] **Step 4: Manual browser verification**

Open `http://localhost:3000/admin` in a browser (logged in). Confirm:
1. Hovering the logo square shows the "Clique para trocar o ícone" tooltip.
2. Clicking it opens the modal with the 16-icon grid, an "Enviar imagem" button, and "Restaurar padrão".
3. Clicking a preset icon closes the modal and the sidebar square now shows that icon.
4. Reloading the page (`F5`) — the picked icon is still there (proves server persistence, not just local state).
5. Uploading a small PNG/JPG shows it in the square after saving, and survives reload too.
6. "Restaurar padrão" brings back the "W" letter.
7. Collapse the sidebar (icon-only mode) — the square (now showing whatever icon/image is picked) stays visible and centered, matching the earlier collapse-mode fixes from this session.

- [ ] **Step 5: Commit**

```bash
git add src/components/AdminIconPicker.tsx src/components/AdminSidebar.tsx
git commit -m "feat: add sidebar icon picker modal"
```

---

## Self-Review Notes

- **Spec coverage:** Tooltip (Task 2 Step 2) ✓, modal with preset grid + upload + reset (Task 2 Step 1) ✓, server persistence via the already-created table/bucket (Task 1) ✓, `AdminSidebar` renders the fetched setting with a "W" fallback (Task 2 Step 2) ✓, 2MB/mime validation (Task 1 Step 2, both bucket-level from earlier setup and route-level here) ✓, fixed overwritten Storage path (Task 1 Step 2, `'sidebar-icon'` with `upsert: true`) ✓.
- **Type consistency:** `BrandingIcon`/`getBrandingSettings`/`updateBrandingSettings` return shapes match exactly what the route reads/writes and what `AdminSidebar` consumes across both tasks.
- **No placeholders:** every step above has complete, runnable code — no TBDs.
