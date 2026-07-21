# CTA Auto/Manual Activation + YouTube Captions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable native YouTube captions on the live player, and rework the CTA activation logic so it has two independent, real-time-synced activation modes — automatic (via a configured `cta_start_seconds`/`cta_end_seconds` window) and manual (a staff override toggle) — with changes reflected to all viewers within ~3s, no page reload required.

**Architecture:** CTA activation state is computed, not stored as a single boolean. The DB persists three raw signals per edition: `cta_auto_enabled` (admin opt-in for the automatic window), `cta_override` (`'on' | 'off' | null` — the staff's manual override), and `cta_override_at` (timestamp of when the override was last set). A new shared pure-function module (`src/lib/cta.ts`) combines these with the viewer's current video offset to produce one effective boolean. The override is treated as *stale* (and the automatic window silently reclaims control) whenever the window's active/inactive status has flipped since the override was set — this is what lets a staff member cancel a manual activation before a scheduled window without permanently blocking that window from firing later, while still allowing a real kill-switch during an active window. All CTA-relevant fields are added to the existing 3s comment-polling response (`/api/chat`) so every connected client (staff and public) recomputes the effective state continuously, without needing a reload.

**Tech Stack:** Next.js App Router (TypeScript), Supabase (Postgres) via `@supabase/supabase-js`, React client components (no external state library).

## Global Constraints

- This project has no automated test runner configured (`package.json` only has `dev`/`build`/`start`/`lint` — no jest/vitest). Verification steps in this plan use `npx tsc --noEmit` for type safety and manual ad-hoc Node scripts / browser walkthroughs instead of a test framework. Do not add a test framework as part of this plan — out of scope.
- Preserve existing code style: inline `style={{...}}` objects in components under `src/components`, no CSS modules, no new dependencies.
- The Supabase schema has no migrations folder in this repo — schema changes are applied by hand via the Supabase SQL editor. Task 2 includes the exact SQL to run there; it is not executed by any script in this plan.
- Keep the existing `cta_enabled` column and its unrelated read sites untouched — it is being retired from the CTA-activation logic in this plan but dropping the column is out of scope (extra blast radius for no benefit).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/components/VideoPlayer.tsx` | Add `cc_load_policy: 0` to YouTube `playerVars` (Task 1) |
| `src/lib/db.ts` | `Edition` type gains `cta_auto_enabled`, `cta_override`, `cta_override_at` (Task 2) |
| `src/app/api/cadastro/route.ts` | New-edition-row defaults include the 3 new fields (Task 2) |
| `src/lib/cta.ts` **(new)** | Pure functions `isCtaWindowActive` / `computeEffectiveCta` — single source of truth for "is the CTA active right now" (Task 3) |
| `src/app/api/staff/settings/route.ts` | PATCH now writes `cta_override` + `cta_override_at` instead of `cta_enabled` (Task 4) |
| `src/app/api/chat/route.ts` | GET now returns all raw CTA fields needed by clients to compute effective state (Task 5) |
| `src/app/api/staff/metrics/route.ts` | GET returns the same raw CTA fields instead of `cta_enabled` (Task 6) |
| `src/app/api/admin/config/route.ts` | PUT/PATCH persist `cta_auto_enabled` (Task 7) |
| `src/components/AdminConfig.tsx` | Adds "Ativação automática" switch next to the start/end fields (Task 7) |
| `src/components/AdminDashboard.tsx` | CTA summary label reflects auto/override state instead of the retired `cta_enabled` (Task 8) |
| `src/app/ao-vivo/page.tsx` | Reads the 3 new fields from the edition row, passes them + `liveStartMs` down (Task 9) |
| `src/components/AoVivoContent.tsx` | Threads the new props to `ChatPanel`; computes correct initial `liveCta` (Task 10) |
| `src/components/ChatPanel.tsx` | Core rewrite: effective-state `useMemo`, poll now updates everyone (not just non-staff), toggle button computes desired override contextually (Task 11) |

---

### Task 1: Disable native YouTube captions

**Files:**
- Modify: `src/components/VideoPlayer.tsx:155-164`

- [ ] **Step 1: Add `cc_load_policy: 0` to the YouTube player's `playerVars`**

In `src/components/VideoPlayer.tsx`, find the `new window.YT.Player('yt-player', { ... })` call:

```tsx
      ytPlayerRef.current = new window.YT.Player('yt-player', {
        videoId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
          fs: 0,
          iv_load_policy: 3,
          autoplay: 0,
          start: initialOffset,
        },
```

Change it to:

```tsx
      ytPlayerRef.current = new window.YT.Player('yt-player', {
        videoId,
        playerVars: {
          controls: 0,
          disablekb: 1,
          rel: 0,
          modestbranding: 1,
          fs: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
          autoplay: 0,
          start: initialOffset,
        },
```

`cc_load_policy: 0` forces captions off on load regardless of the viewer's own YouTube account/browser accessibility preference (which is what can otherwise force them on even though there's no visible CC button in this player, since `controls: 0` already hides it).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

Manual check: run the dev server (`npm run dev`), open `/ao-vivo` (or `/espera` preview if that's where the YouTube player renders) with a YouTube video configured, and confirm no captions render at the bottom of the video on load.

- [ ] **Step 3: Commit**

```bash
git add src/components/VideoPlayer.tsx
git commit -m "fix: disable native YouTube captions on the live player"
```

---

### Task 2: Database migration + `Edition` type

**Files:**
- Modify: `src/lib/db.ts:17-36`
- Modify: `src/app/api/cadastro/route.ts:34-51`

**Interfaces:**
- Produces: `Edition.cta_auto_enabled: number`, `Edition.cta_override: 'on' | 'off' | null`, `Edition.cta_override_at: string | null` — consumed by every task from here on.

- [ ] **Step 1: Run this SQL in the Supabase SQL editor (manual — not run by this plan)**

```sql
ALTER TABLE editions
  ADD COLUMN IF NOT EXISTS cta_auto_enabled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cta_override text,
  ADD COLUMN IF NOT EXISTS cta_override_at timestamptz;

ALTER TABLE editions
  ADD CONSTRAINT editions_cta_override_check
  CHECK (cta_override IN ('on', 'off') OR cta_override IS NULL);
```

- [ ] **Step 2: Extend the `Edition` type**

In `src/lib/db.ts`, the current type:

```ts
export type Edition = {
  id: string;
  live_date: string;
  video_source: 'upload' | 'youtube';
  video_url: string;
  video_duration: number;
  sales_page_url: string;
  chat_enabled: number;
  chat_mode: 'general' | 'isolated';
  cta_enabled: number;
  cta_url: string;
  cta_text: string;
  cta_start_seconds: number;
  cta_end_seconds: number;
  viewer_min: number;
  viewer_max: number;
  created_at: string;
  test_mode?: number;
  test_time?: string | null;
};
```

Add the three new fields after `cta_end_seconds`:

```ts
export type Edition = {
  id: string;
  live_date: string;
  video_source: 'upload' | 'youtube';
  video_url: string;
  video_duration: number;
  sales_page_url: string;
  chat_enabled: number;
  chat_mode: 'general' | 'isolated';
  cta_enabled: number;
  cta_url: string;
  cta_text: string;
  cta_start_seconds: number;
  cta_end_seconds: number;
  cta_auto_enabled: number;
  cta_override: 'on' | 'off' | null;
  cta_override_at: string | null;
  viewer_min: number;
  viewer_max: number;
  created_at: string;
  test_mode?: number;
  test_time?: string | null;
};
```

- [ ] **Step 3: Set defaults when a brand-new edition row is created**

In `src/app/api/cadastro/route.ts`, find:

```ts
    await upsertEdition({
      id: editionId,
      live_date: editionId,
      video_source: 'youtube',
      video_url: '',
      video_duration: 7200,
      sales_page_url: '',
      chat_enabled: 1,
      chat_mode: 'general',
      cta_enabled: 0,
      cta_url: '',
      cta_text: '',
      cta_start_seconds: 0,
      cta_end_seconds: 3600,
      viewer_min: 210,
      viewer_max: 220
    });
```

Add the three new fields:

```ts
    await upsertEdition({
      id: editionId,
      live_date: editionId,
      video_source: 'youtube',
      video_url: '',
      video_duration: 7200,
      sales_page_url: '',
      chat_enabled: 1,
      chat_mode: 'general',
      cta_enabled: 0,
      cta_url: '',
      cta_text: '',
      cta_start_seconds: 0,
      cta_end_seconds: 3600,
      cta_auto_enabled: 0,
      cta_override: null,
      cta_override_at: null,
      viewer_min: 210,
      viewer_max: 220
    });
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors (existing `upsertEdition`/`updateEditionFields` already accept `Partial<Edition>`, so nothing else breaks yet).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/app/api/cadastro/route.ts
git commit -m "feat: add cta_auto_enabled/cta_override/cta_override_at to Edition schema"
```

---

### Task 3: Shared CTA effective-state logic

**Files:**
- Create: `src/lib/cta.ts`

**Interfaces:**
- Produces: `isCtaWindowActive(offsetSecs, autoEnabled, startSecs, endSecs): boolean`, `computeEffectiveCta(params): boolean`, `type CtaOverride = 'on' | 'off' | null` — consumed by `ChatPanel.tsx` and `AoVivoContent.tsx` (Tasks 10-11).

- [ ] **Step 1: Create the module**

```ts
// src/lib/cta.ts

export type CtaOverride = 'on' | 'off' | null;

/**
 * Whether the automatic CTA window is active at a given point in the video timeline.
 * `endSecs === 0` means "no upper bound" (matches the existing AdminConfig convention).
 */
export function isCtaWindowActive(
  offsetSecs: number,
  autoEnabled: boolean,
  startSecs: number,
  endSecs: number,
): boolean {
  if (!autoEnabled) return false;
  if (offsetSecs < startSecs) return false;
  if (endSecs > 0 && offsetSecs > endSecs) return false;
  return true;
}

type ComputeEffectiveCtaParams = {
  offsetSecs: number;
  overrideOffsetSecs: number | null;
  override: CtaOverride;
  autoEnabled: boolean;
  startSecs: number;
  endSecs: number;
};

/**
 * Combines the automatic window with the staff's manual override into one boolean.
 *
 * A manual override is only authoritative while the automatic window's active/inactive
 * status hasn't changed since the override was set. The moment that status flips (window
 * opens or closes), the override is treated as stale and the automatic window reclaims
 * control. This lets staff cancel a premature manual activation without permanently
 * blocking the scheduled window, while still allowing a real kill-switch during an
 * already-active window (it stays in effect until that window closes).
 */
export function computeEffectiveCta(params: ComputeEffectiveCtaParams): boolean {
  const { offsetSecs, overrideOffsetSecs, override, autoEnabled, startSecs, endSecs } = params;
  const windowActiveNow = isCtaWindowActive(offsetSecs, autoEnabled, startSecs, endSecs);

  if (override === null) return windowActiveNow;

  const windowActiveAtOverride = overrideOffsetSecs === null
    ? windowActiveNow
    : isCtaWindowActive(overrideOffsetSecs, autoEnabled, startSecs, endSecs);

  if (windowActiveNow !== windowActiveAtOverride) return windowActiveNow;

  return override === 'on';
}
```

- [ ] **Step 2: Verify with an ad-hoc script (no test framework in this repo)**

Create a throwaway file `/tmp/verify-cta.mts`:

```ts
import { computeEffectiveCta } from '/home/ubuntu/Projetos/Webnario Power/src/lib/cta.ts';

function check(name: string, actual: boolean, expected: boolean) {
  console.log(`${actual === expected ? 'PASS' : 'FAIL'} — ${name} (got ${actual}, want ${expected})`);
}

// 1. No override, outside auto window → inactive
check('auto-inactive-before-window', computeEffectiveCta({
  offsetSecs: 50, overrideOffsetSecs: null, override: null,
  autoEnabled: true, startSecs: 100, endSecs: 200,
}), false);

// 2. No override, inside auto window → active
check('auto-active-inside-window', computeEffectiveCta({
  offsetSecs: 150, overrideOffsetSecs: null, override: null,
  autoEnabled: true, startSecs: 100, endSecs: 200,
}), true);

// 3. Staff forces ON before the window starts, window hasn't opened yet → active (forced)
check('forced-on-before-window', computeEffectiveCta({
  offsetSecs: 50, overrideOffsetSecs: 40, override: 'on',
  autoEnabled: true, startSecs: 100, endSecs: 200,
}), true);

// 4. Staff forces ON before the window, window has since opened → still active (window agrees anyway)
check('forced-on-window-now-open', computeEffectiveCta({
  offsetSecs: 150, overrideOffsetSecs: 40, override: 'on',
  autoEnabled: true, startSecs: 100, endSecs: 200,
}), true);

// 5. Staff cancels (forces OFF) before the window starts, window hasn't opened yet → inactive
check('cancel-before-window', computeEffectiveCta({
  offsetSecs: 60, overrideOffsetSecs: 55, override: 'off',
  autoEnabled: true, startSecs: 100, endSecs: 200,
}), false);

// 6. THE KEY SCENARIO: staff cancelled before the window, window has since opened
//    → automatic reclaims control, CTA activates on schedule anyway.
check('cancel-before-window-then-window-opens', computeEffectiveCta({
  offsetSecs: 150, overrideOffsetSecs: 55, override: 'off',
  autoEnabled: true, startSecs: 100, endSecs: 200,
}), true);

// 7. Kill switch: staff forces OFF while window is active → stays inactive
check('kill-switch-during-window', computeEffectiveCta({
  offsetSecs: 160, overrideOffsetSecs: 150, override: 'off',
  autoEnabled: true, startSecs: 100, endSecs: 200,
}), false);

// 8. Kill switch persists for the rest of that window
check('kill-switch-persists', computeEffectiveCta({
  offsetSecs: 199, overrideOffsetSecs: 150, override: 'off',
  autoEnabled: true, startSecs: 100, endSecs: 200,
}), false);

// 9. After the window closes, a stale kill-switch expires and matches "window closed" (still inactive, consistent)
check('kill-switch-expires-after-window-closes', computeEffectiveCta({
  offsetSecs: 250, overrideOffsetSecs: 150, override: 'off',
  autoEnabled: true, startSecs: 100, endSecs: 200,
}), false);

// 10. Auto disabled entirely, no override → always inactive
check('auto-disabled-no-override', computeEffectiveCta({
  offsetSecs: 150, overrideOffsetSecs: null, override: null,
  autoEnabled: false, startSecs: 100, endSecs: 200,
}), false);

// 11. Auto disabled, staff forces ON → active regardless (pure manual mode)
check('auto-disabled-forced-on', computeEffectiveCta({
  offsetSecs: 5, overrideOffsetSecs: 5, override: 'on',
  autoEnabled: false, startSecs: 0, endSecs: 0,
}), true);
```

Run: `node --experimental-strip-types "/tmp/verify-cta.mts"`
Expected: all 11 lines print `PASS`. If any print `FAIL`, fix `computeEffectiveCta` before continuing — do not proceed to Task 4 with a failing case, especially case 6 (it's the scenario the whole redesign exists for).

Delete the scratch file when done: `rm "/tmp/verify-cta.mts"`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cta.ts
git commit -m "feat: add shared CTA effective-state computation"
```

---

### Task 4: Staff settings PATCH writes the override

**Files:**
- Modify: `src/app/api/staff/settings/route.ts`

**Interfaces:**
- Consumes: `updateEditionFields(id, fields)` from `src/lib/db.ts` (unchanged signature).
- Produces: PATCH `/api/staff/settings` now accepts `{ cta_override: 'on' | 'off' }` in the body (in addition to existing `chat_mode`) — consumed by `ChatPanel.tsx` (Task 11).

- [ ] **Step 1: Replace the `cta_enabled` handling with `cta_override`**

Current:

```ts
  if (body?.cta_enabled !== undefined) {
    updateData.cta_enabled = body.cta_enabled ? 1 : 0;
    hasUpdates = true;
  }
```

Replace with:

```ts
  if (body?.cta_override !== undefined) {
    if (body.cta_override !== 'on' && body.cta_override !== 'off') {
      return NextResponse.json({ error: 'cta_override inválido' }, { status: 400 });
    }
    updateData.cta_override = body.cta_override;
    updateData.cta_override_at = new Date().toISOString();
    hasUpdates = true;
  }
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/staff/settings/route.ts
git commit -m "feat: staff settings PATCH writes cta_override + cta_override_at"
```

---

### Task 5: `/api/chat` returns raw CTA fields

**Files:**
- Modify: `src/app/api/chat/route.ts:34-39,65`

**Interfaces:**
- Produces: GET `/api/chat` response gains `cta_auto_enabled: boolean`, `cta_override: 'on'|'off'|null`, `cta_override_at: string|null`, `cta_start_seconds: number`, `cta_end_seconds: number` (replacing the old `cta_enabled: number`) — consumed by `ChatPanel.tsx` (Task 11).

- [ ] **Step 1: Replace the CTA fields read from the edition**

Current:

```ts
  const edition = await getEdition(editionId);
  const chatMode: string = edition?.chat_mode || 'general';
  const ctaEnabled: number = edition?.cta_enabled ?? 1;
  const ctaUrl: string = edition?.cta_url || '';
  const ctaText: string = edition?.cta_text || '';
```

Replace with:

```ts
  const edition = await getEdition(editionId);
  const chatMode: string = edition?.chat_mode || 'general';
  const ctaAutoEnabled: boolean = !!edition?.cta_auto_enabled;
  const ctaOverride: 'on' | 'off' | null = (edition?.cta_override as 'on' | 'off' | null) ?? null;
  const ctaOverrideAt: string | null = edition?.cta_override_at ?? null;
  const ctaStartSeconds: number = edition?.cta_start_seconds ?? 0;
  const ctaEndSeconds: number = edition?.cta_end_seconds ?? 0;
  const ctaUrl: string = edition?.cta_url || '';
  const ctaText: string = edition?.cta_text || '';
```

- [ ] **Step 2: Update the response payload**

Current (end of `GET`):

```ts
  return NextResponse.json({ comments, sim_replied: simReplied, cta_enabled: ctaEnabled, cta_url: ctaUrl, cta_text: ctaText });
```

Replace with:

```ts
  return NextResponse.json({
    comments,
    sim_replied: simReplied,
    cta_auto_enabled: ctaAutoEnabled,
    cta_override: ctaOverride,
    cta_override_at: ctaOverrideAt,
    cta_start_seconds: ctaStartSeconds,
    cta_end_seconds: ctaEndSeconds,
    cta_url: ctaUrl,
    cta_text: ctaText,
  });
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: /api/chat returns raw CTA auto/override fields instead of cta_enabled"
```

---

### Task 6: `/api/staff/metrics` returns the same raw CTA fields

**Files:**
- Modify: `src/app/api/staff/metrics/route.ts`

- [ ] **Step 1: Replace the `cta_enabled` field in the response**

Current:

```ts
  return NextResponse.json({
    online: metrics.consumed,
    cta_clicks: metrics.ctaClicks,
    chat_mode: edition?.chat_mode || 'general',
    cta_enabled: edition?.cta_enabled ?? 1,
  });
```

Replace with:

```ts
  return NextResponse.json({
    online: metrics.consumed,
    cta_clicks: metrics.ctaClicks,
    chat_mode: edition?.chat_mode || 'general',
    cta_auto_enabled: !!edition?.cta_auto_enabled,
    cta_override: (edition?.cta_override as 'on' | 'off' | null) ?? null,
    cta_override_at: edition?.cta_override_at ?? null,
  });
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/staff/metrics/route.ts
git commit -m "feat: staff metrics returns raw CTA auto/override fields"
```

---

### Task 7: Admin config route + UI switch for automatic activation

**Files:**
- Modify: `src/app/api/admin/config/route.ts:52-82,84-109`
- Modify: `src/components/AdminConfig.tsx:27-34,85-92,311-326`

- [ ] **Step 1: Persist `cta_auto_enabled` on PUT**

In `src/app/api/admin/config/route.ts`, current `PUT` upsert body:

```ts
    cta_enabled: body.cta_enabled ? 1 : 0,
    cta_url: body.cta_url || '',
    cta_text: body.cta_text || '',
    cta_start_seconds: Number(body.cta_start_seconds) || 0,
    cta_end_seconds: Number(body.cta_end_seconds) || 3600,
```

Add `cta_auto_enabled` right after:

```ts
    cta_enabled: body.cta_enabled ? 1 : 0,
    cta_url: body.cta_url || '',
    cta_text: body.cta_text || '',
    cta_start_seconds: Number(body.cta_start_seconds) || 0,
    cta_end_seconds: Number(body.cta_end_seconds) || 3600,
    cta_auto_enabled: body.cta_auto_enabled ? 1 : 0,
```

- [ ] **Step 2: Extend the `PATCH` fallback base object**

Current:

```ts
  const base = existing || {
    id: editionId, live_date: editionId, video_source: 'youtube' as const,
    video_url: '', video_duration: 7200, sales_page_url: '',
    chat_enabled: 1, chat_mode: 'general' as const, cta_enabled: 0,
    cta_url: '', cta_text: '', cta_start_seconds: 0, cta_end_seconds: 3600,
    viewer_min: 210, viewer_max: 220,
  };
```

Replace with:

```ts
  const base = existing || {
    id: editionId, live_date: editionId, video_source: 'youtube' as const,
    video_url: '', video_duration: 7200, sales_page_url: '',
    chat_enabled: 1, chat_mode: 'general' as const, cta_enabled: 0,
    cta_url: '', cta_text: '', cta_start_seconds: 0, cta_end_seconds: 3600,
    cta_auto_enabled: 0, cta_override: null, cta_override_at: null,
    viewer_min: 210, viewer_max: 220,
  };
```

- [ ] **Step 3: Add the switch to `AdminConfig.tsx`**

In `src/components/AdminConfig.tsx`, current `defaultConfig`:

```ts
const defaultConfig = {
  video_source: 'youtube', video_url: '', video_duration: 7200,
  sales_page_url: '', chat_enabled: true, chat_mode: 'isolated',
  cta_enabled: false, cta_url: '', cta_text: '',
  cta_start_seconds: 0, cta_end_seconds: 3600,
  viewer_min: 210, viewer_max: 220,
  test_mode: false, test_time: '',
};
```

Add `cta_auto_enabled: false,`:

```ts
const defaultConfig = {
  video_source: 'youtube', video_url: '', video_duration: 7200,
  sales_page_url: '', chat_enabled: true, chat_mode: 'isolated',
  cta_enabled: false, cta_url: '', cta_text: '',
  cta_start_seconds: 0, cta_end_seconds: 3600, cta_auto_enabled: false,
  viewer_min: 210, viewer_max: 220,
  test_mode: false, test_time: '',
};
```

- [ ] **Step 4: Load it from the GET response**

Current load block:

```ts
          setConfig({
            ...defaultConfig,
            ...d.edition,
            chat_enabled: true, // always default to enabled; toggle off only if admin explicitly disables
            cta_enabled: !!d.edition.cta_enabled,
            test_mode: !!d.edition.test_mode,
            test_time: testTimeLocal,
          });
```

Add `cta_auto_enabled: !!d.edition.cta_auto_enabled,`:

```ts
          setConfig({
            ...defaultConfig,
            ...d.edition,
            chat_enabled: true, // always default to enabled; toggle off only if admin explicitly disables
            cta_enabled: !!d.edition.cta_enabled,
            cta_auto_enabled: !!d.edition.cta_auto_enabled,
            test_mode: !!d.edition.test_mode,
            test_time: testTimeLocal,
          });
```

- [ ] **Step 5: Add the switch UI in the "CTA / Oferta" card**

Current card:

```tsx
            <SectionCard title="CTA / Oferta" description="Banner de oferta no chat. Ativar/desativar é controlado pelo painel staff no chat.">
              <Field label="URL do CTA">
                <Input type="url" value={config.cta_url} onChange={e => set('cta_url', e.target.value)} placeholder="https://..." />
              </Field>
              <Field label="Texto do botão">
                <Input type="text" value={config.cta_text} onChange={e => set('cta_text', e.target.value)} placeholder="Garantir acesso →" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Início (segundos)">
                  <Input type="number" value={config.cta_start_seconds} onChange={e => set('cta_start_seconds', Number(e.target.value))} />
                </Field>
                <Field label="Fim (segundos)">
                  <Input type="number" value={config.cta_end_seconds} onChange={e => set('cta_end_seconds', Number(e.target.value))} />
                </Field>
              </div>
            </SectionCard>
```

Replace with:

```tsx
            <SectionCard title="CTA / Oferta" description="Banner de oferta no chat e notificações de compra. Pode ativar sozinho na janela abaixo, e a equipe pode forçar manualmente (ligar ou desligar) no painel do chat.">
              <Field label="URL do CTA">
                <Input type="url" value={config.cta_url} onChange={e => set('cta_url', e.target.value)} placeholder="https://..." />
              </Field>
              <Field label="Texto do botão">
                <Input type="text" value={config.cta_text} onChange={e => set('cta_text', e.target.value)} placeholder="Garantir acesso →" />
              </Field>
              <div className="flex items-center gap-2.5">
                <Switch id="cta_auto_enabled" checked={config.cta_auto_enabled as unknown as boolean} onCheckedChange={(v) => set('cta_auto_enabled', v)} />
                <Label htmlFor="cta_auto_enabled">Ativação automática habilitada</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Início (segundos)">
                  <Input type="number" value={config.cta_start_seconds} onChange={e => set('cta_start_seconds', Number(e.target.value))} disabled={!config.cta_auto_enabled} />
                </Field>
                <Field label="Fim (segundos)" hint="0 = sem limite de fim.">
                  <Input type="number" value={config.cta_end_seconds} onChange={e => set('cta_end_seconds', Number(e.target.value))} disabled={!config.cta_auto_enabled} />
                </Field>
              </div>
            </SectionCard>
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

Manual check: start `npm run dev`, log into `/admin`, open Configurações, confirm the new "Ativação automática habilitada" switch appears, toggling it enables/disables the Início/Fim inputs, and saving persists across a page reload.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/config/route.ts src/components/AdminConfig.tsx
git commit -m "feat: admin config UI for automatic CTA window activation"
```

---

### Task 8: Admin dashboard CTA summary label

**Files:**
- Modify: `src/components/AdminDashboard.tsx:201`

- [ ] **Step 1: Replace the stale `cta_enabled`-based label**

Current:

```tsx
                  { label: 'CTA', value: cfg.cta_enabled ? 'Ativo' : 'Inativo', muted: !cfg.cta_enabled, sub: cfg.cta_url || '—' },
```

Replace with:

```tsx
                  { label: 'CTA', value: cfg.cta_auto_enabled
                      ? 'Automático'
                      : cfg.cta_override === 'on' ? 'Forçado ligado'
                      : cfg.cta_override === 'off' ? 'Forçado desligado'
                      : 'Manual (staff)',
                    muted: !cfg.cta_auto_enabled && cfg.cta_override !== 'on',
                    sub: cfg.cta_url || '—' },
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors (`cfg` is typed `any`, so no type errors regardless).

- [ ] **Step 3: Commit**

```bash
git add src/components/AdminDashboard.tsx
git commit -m "fix: admin dashboard CTA label reflects auto/override state"
```

---

### Task 9: `ao-vivo/page.tsx` reads and forwards the new fields

**Files:**
- Modify: `src/app/ao-vivo/page.tsx:72-99`

**Interfaces:**
- Produces: `AoVivoContent` receives `ctaAutoEnabled: boolean`, `ctaOverride: 'on'|'off'|null`, `ctaOverrideAt: string|null` (replacing `ctaEnabled`) — consumed by Task 10.

- [ ] **Step 1: Replace the `ctaEnabled` read**

Current:

```ts
  const ctaEnabled = edition?.cta_enabled ?? 0;
  const ctaUrl = edition?.cta_url ?? '';
  const ctaText = edition?.cta_text ?? '';
  const ctaStartSecs = edition?.cta_start_seconds ?? 0;
  const ctaEndSecs = edition?.cta_end_seconds ?? 3600;
```

Replace with:

```ts
  const ctaAutoEnabled = !!(edition?.cta_auto_enabled ?? 0);
  const ctaOverride = (edition?.cta_override as 'on' | 'off' | null) ?? null;
  const ctaOverrideAt = edition?.cta_override_at ?? null;
  const ctaUrl = edition?.cta_url ?? '';
  const ctaText = edition?.cta_text ?? '';
  const ctaStartSecs = edition?.cta_start_seconds ?? 0;
  const ctaEndSecs = edition?.cta_end_seconds ?? 3600;
```

- [ ] **Step 2: Update the `<AoVivoContent>` call**

Current:

```tsx
      ctaEnabled={!!ctaEnabled}
      ctaUrl={ctaUrl}
      ctaText={ctaText}
      ctaStartSecs={ctaStartSecs}
      ctaEndSecs={ctaEndSecs}
```

Replace with:

```tsx
      ctaAutoEnabled={ctaAutoEnabled}
      ctaOverride={ctaOverride}
      ctaOverrideAt={ctaOverrideAt}
      ctaUrl={ctaUrl}
      ctaText={ctaText}
      ctaStartSecs={ctaStartSecs}
      ctaEndSecs={ctaEndSecs}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: errors in `AoVivoContent.tsx` about the missing/renamed props (`ctaEnabled` no longer exists on `Edition`-derived usage, `ctaAutoEnabled` etc. not yet in `AoVivoContent`'s `Props`) — this is expected until Task 10. Confirm the errors are exactly in `AoVivoContent.tsx`, not elsewhere.

- [ ] **Step 4: Commit**

```bash
git add src/app/ao-vivo/page.tsx
git commit -m "feat: ao-vivo page reads cta_auto_enabled/cta_override/cta_override_at"
```

---

### Task 10: `AoVivoContent.tsx` prop threading + correct initial state

**Files:**
- Modify: `src/components/AoVivoContent.tsx:1-63,188-266`

**Interfaces:**
- Consumes: `computeEffectiveCta` from `src/lib/cta.ts` (Task 3).
- Produces: `ChatPanel` receives `ctaAutoEnabled`, `ctaOverride`, `ctaOverrideAt`, `liveStartMs` props — consumed by Task 11.

- [ ] **Step 1: Import the shared CTA logic**

At the top of `src/components/AoVivoContent.tsx`, current imports:

```tsx
import VideoPlayer from './VideoPlayer';
import ChatPanel from './ChatPanel';
import PurchaseNotifications from './PurchaseNotifications';
```

Add:

```tsx
import VideoPlayer from './VideoPlayer';
import ChatPanel from './ChatPanel';
import PurchaseNotifications from './PurchaseNotifications';
import { computeEffectiveCta } from '@/lib/cta';
```

- [ ] **Step 2: Update the `Props` type**

Current:

```ts
type Props = {
  editionId: string;
  session: { registrationId: string; name: string; email: string };
  videoSource: 'upload' | 'youtube';
  videoUrl: string;
  videoDuration: number;
  initialOffset: number;
  liveStartMs: number;
  chatEnabled: boolean;
  chatMode: 'general' | 'isolated';
  ctaEnabled: boolean;
  ctaUrl: string;
  ctaText: string;
  ctaStartSecs: number;
  ctaEndSecs: number;
  viewerMin: number;
  viewerMax: number;
  simulatedComments: SimComment[];
  pinnedComments: SimComment[];
  salesUrl: string;
  isAdminPreview?: boolean;
  initialRealComments?: RealComment[];
};
```

Replace `ctaEnabled: boolean;` with the three new fields:

```ts
type Props = {
  editionId: string;
  session: { registrationId: string; name: string; email: string };
  videoSource: 'upload' | 'youtube';
  videoUrl: string;
  videoDuration: number;
  initialOffset: number;
  liveStartMs: number;
  chatEnabled: boolean;
  chatMode: 'general' | 'isolated';
  ctaAutoEnabled: boolean;
  ctaOverride: 'on' | 'off' | null;
  ctaOverrideAt: string | null;
  ctaUrl: string;
  ctaText: string;
  ctaStartSecs: number;
  ctaEndSecs: number;
  viewerMin: number;
  viewerMax: number;
  simulatedComments: SimComment[];
  pinnedComments: SimComment[];
  salesUrl: string;
  isAdminPreview?: boolean;
  initialRealComments?: RealComment[];
};
```

- [ ] **Step 3: Update the function signature destructuring**

Current:

```tsx
export default function AoVivoContent({
  editionId, session, videoSource, videoUrl, videoDuration, initialOffset, liveStartMs,
  chatEnabled, chatMode, ctaEnabled, ctaUrl, ctaText, ctaStartSecs, ctaEndSecs,
  viewerMin, viewerMax, simulatedComments, pinnedComments, salesUrl, isAdminPreview,
  initialRealComments,
}: Props) {
```

Replace with:

```tsx
export default function AoVivoContent({
  editionId, session, videoSource, videoUrl, videoDuration, initialOffset, liveStartMs,
  chatEnabled, chatMode, ctaAutoEnabled, ctaOverride, ctaOverrideAt, ctaUrl, ctaText, ctaStartSecs, ctaEndSecs,
  viewerMin, viewerMax, simulatedComments, pinnedComments, salesUrl, isAdminPreview,
  initialRealComments,
}: Props) {
```

- [ ] **Step 4: Compute the correct initial `liveCta` (no reload-time flash)**

Current:

```tsx
  const videoOffsetRef = useRef<number>(initialOffset);
  const [liveEnded, setLiveEnded] = useState(false);
  // Lifted so PurchaseNotifications reacts to CTA activation and survives minimize/maximize
  const [liveCta, setLiveCta] = useState(ctaEnabled);
```

Replace with:

```tsx
  const videoOffsetRef = useRef<number>(initialOffset);
  const [liveEnded, setLiveEnded] = useState(false);
  // Lifted so PurchaseNotifications reacts to CTA activation and survives minimize/maximize.
  // Computed the same way ChatPanel computes it, seeded with SSR data, so there's no
  // incorrect flash before ChatPanel's own effect confirms it on mount.
  const [liveCta, setLiveCta] = useState(() => computeEffectiveCta({
    offsetSecs: initialOffset,
    overrideOffsetSecs: ctaOverrideAt ? Math.floor((new Date(ctaOverrideAt).getTime() - liveStartMs) / 1000) : null,
    override: ctaOverride,
    autoEnabled: ctaAutoEnabled,
    startSecs: ctaStartSecs,
    endSecs: ctaEndSecs,
  }));
```

- [ ] **Step 5: Update both `<ChatPanel>` call sites**

There are two — the mobile one (~line 188) and the desktop one (~line 248). Both currently pass:

```tsx
              ctaEnabled={ctaEnabled}
              ctaUrl={ctaUrl}
              ctaText={ctaText}
              ctaStartSecs={ctaStartSecs}
              ctaEndSecs={ctaEndSecs}
```

Replace both occurrences with:

```tsx
              ctaAutoEnabled={ctaAutoEnabled}
              ctaOverride={ctaOverride}
              ctaOverrideAt={ctaOverrideAt}
              liveStartMs={liveStartMs}
              ctaUrl={ctaUrl}
              ctaText={ctaText}
              ctaStartSecs={ctaStartSecs}
              ctaEndSecs={ctaEndSecs}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: errors now only in `ChatPanel.tsx` (its `Props` type still expects the old `ctaEnabled` and doesn't yet accept the new props) — expected until Task 11.

- [ ] **Step 7: Commit**

```bash
git add src/components/AoVivoContent.tsx
git commit -m "feat: AoVivoContent threads cta_auto_enabled/cta_override to ChatPanel"
```

---

### Task 11: `ChatPanel.tsx` — effective-state computation, universal polling, contextual toggle

This is the core of the redesign. It replaces the AND-of-manual-and-window logic with the shared `computeEffectiveCta`, makes the 3s poll update everyone (not just non-staff viewers), and rewrites the staff toggle to compute the correct override value from the currently-visible effective state.

**Files:**
- Modify: `src/components/ChatPanel.tsx`

**Interfaces:**
- Consumes: `computeEffectiveCta`, `CtaOverride` from `src/lib/cta.ts` (Task 3). `/api/chat` response shape from Task 5. `/api/staff/settings` PATCH body shape from Task 4.

- [ ] **Step 1: Import `useMemo` and the shared CTA module**

Current:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
```

Replace with:

```tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { computeEffectiveCta, type CtaOverride } from '@/lib/cta';
```

- [ ] **Step 2: Update the `Props` type**

Current:

```ts
type Props = {
  editionId: string;
  sessionName: string;
  chatEnabled: boolean;
  chatMode: 'general' | 'isolated';
  simulatedComments: ChatComment[];
  pinnedComments: ChatComment[];
  videoOffsetRef: React.RefObject<number>;
  ctaEnabled: boolean;
  ctaUrl: string;
  ctaText: string;
  ctaStartSecs: number;
  ctaEndSecs: number;
  viewerMin: number;
  viewerMax: number;
  onMinimize?: () => void;
  onCtaChange?: (val: boolean) => void;
  initialRealComments?: ChatComment[];
};
```

Replace `ctaEnabled: boolean;` with the new fields:

```ts
type Props = {
  editionId: string;
  sessionName: string;
  chatEnabled: boolean;
  chatMode: 'general' | 'isolated';
  simulatedComments: ChatComment[];
  pinnedComments: ChatComment[];
  videoOffsetRef: React.RefObject<number>;
  ctaAutoEnabled: boolean;
  ctaOverride: CtaOverride;
  ctaOverrideAt: string | null;
  liveStartMs: number;
  ctaUrl: string;
  ctaText: string;
  ctaStartSecs: number;
  ctaEndSecs: number;
  viewerMin: number;
  viewerMax: number;
  onMinimize?: () => void;
  onCtaChange?: (val: boolean) => void;
  initialRealComments?: ChatComment[];
};
```

- [ ] **Step 3: Update the function signature destructuring**

Current:

```tsx
export default function ChatPanel({
  editionId, sessionName, chatEnabled, chatMode,
  simulatedComments, pinnedComments, videoOffsetRef,
  ctaEnabled, ctaUrl, ctaText, ctaStartSecs, ctaEndSecs,
  viewerMin, viewerMax, onMinimize, onCtaChange,
  initialRealComments,
}: Props) {
```

Replace with:

```tsx
export default function ChatPanel({
  editionId, sessionName, chatEnabled, chatMode,
  simulatedComments, pinnedComments, videoOffsetRef,
  ctaAutoEnabled, ctaOverride, ctaOverrideAt, liveStartMs,
  ctaUrl, ctaText, ctaStartSecs, ctaEndSecs,
  viewerMin, viewerMax, onMinimize, onCtaChange,
  initialRealComments,
}: Props) {
```

- [ ] **Step 4: Replace `serverCtaEnabled` state with the raw CTA signal states**

Current:

```tsx
  const [chatPublic, setChatPublic] = useState(chatMode === 'general');
  const [serverCtaEnabled, setServerCtaEnabled] = useState(ctaEnabled);
  const [liveCtaUrl, setLiveCtaUrl] = useState(ctaUrl);
  const [liveCtaText, setLiveCtaText] = useState(ctaText);
  const [staffMetrics, setStaffMetrics] = useState({ online: 0, cta_clicks: 0 });
```

Replace with:

```tsx
  const [chatPublic, setChatPublic] = useState(chatMode === 'general');
  const [liveCtaUrl, setLiveCtaUrl] = useState(ctaUrl);
  const [liveCtaText, setLiveCtaText] = useState(ctaText);
  const [ctaAutoEnabledState, setCtaAutoEnabledState] = useState(ctaAutoEnabled);
  const [ctaOverrideState, setCtaOverrideState] = useState<CtaOverride>(ctaOverride);
  const [ctaOverrideAtState, setCtaOverrideAtState] = useState<string | null>(ctaOverrideAt);
  const [ctaStartSecsState, setCtaStartSecsState] = useState(ctaStartSecs);
  const [ctaEndSecsState, setCtaEndSecsState] = useState(ctaEndSecs);
  const [staffMetrics, setStaffMetrics] = useState({ online: 0, cta_clicks: 0 });
```

- [ ] **Step 5: Remove the now-unneeded `serverCtaEnabledRef`**

Current:

```tsx
  // Refs so poll closures always see current values
  const staffTokenRef = useRef(staffToken);
  useEffect(() => { staffTokenRef.current = staffToken; }, [staffToken]);
  const serverCtaEnabledRef = useRef(serverCtaEnabled);
  useEffect(() => { serverCtaEnabledRef.current = serverCtaEnabled; }, [serverCtaEnabled]);
```

Replace with:

```tsx
  // Refs so poll closures always see current values
  const staffTokenRef = useRef(staffToken);
  useEffect(() => { staffTokenRef.current = staffToken; }, [staffToken]);
```

- [ ] **Step 6: Compute the effective CTA state, and propagate it (both the ChatPanel banner and `PurchaseNotifications` via `onCtaChange`)**

Current (the window/showCta computation, just above `displayComments`):

```tsx
  // CTA time-window: if cta_start_seconds > 0 configured, restrict display to that window for viewers.
  // Staff always sees CTA when enabled (ignores time window for manual control).
  const inCtaWindow = isStaff || ctaStartSecs === 0
    ? true
    : videoOffset >= ctaStartSecs && (ctaEndSecs === 0 || videoOffset <= ctaEndSecs);
  const showCta = serverCtaEnabled && liveCtaUrl && ctaVisible && inCtaWindow;
```

Replace with:

```tsx
  // Effective CTA state: automatic window OR staff override, recomputed continuously as
  // the video plays and whenever a poll brings fresh data from the server. See
  // src/lib/cta.ts for how override staleness lets the automatic window reclaim control.
  const ctaActive = useMemo(() => {
    const overrideOffsetSecs = ctaOverrideAtState
      ? Math.floor((new Date(ctaOverrideAtState).getTime() - liveStartMs) / 1000)
      : null;
    return computeEffectiveCta({
      offsetSecs: videoOffset,
      overrideOffsetSecs,
      override: ctaOverrideState,
      autoEnabled: ctaAutoEnabledState,
      startSecs: ctaStartSecsState,
      endSecs: ctaEndSecsState,
    });
  }, [videoOffset, ctaOverrideState, ctaOverrideAtState, ctaAutoEnabledState, ctaStartSecsState, ctaEndSecsState, liveStartMs]);

  const showCta = ctaActive && liveCtaUrl && ctaVisible;

  // Reset the dismissed banner + notify AoVivoContent (drives PurchaseNotifications)
  // every time the effective state changes — including from a poll, not just a local click.
  const prevCtaActiveRef = useRef(ctaActive);
  useEffect(() => {
    if (!prevCtaActiveRef.current && ctaActive) setCtaVisible(true);
    prevCtaActiveRef.current = ctaActive;
    onCtaChange?.(ctaActive);
  }, [ctaActive, onCtaChange]);
```

- [ ] **Step 7: Rewrite `toggleCta` to compute the override contextually**

Current:

```tsx
  async function toggleCta(val: boolean) {
    setServerCtaEnabled(val);
    onCtaChange?.(val);
    if (val) setCtaVisible(true); // restore if staff had previously dismissed the banner
    try {
      await fetch('/api/staff/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ cta_enabled: val ? 1 : 0 }),
      });
    } catch {}
  }
```

Replace with:

```tsx
  // The button just flips whatever is currently visible — the resulting override value
  // (force on / force off) is derived from the CURRENT effective state (ctaActive), not
  // from the raw stored override. computeEffectiveCta's staleness rule is what makes this
  // correct even when the automatic window later takes over (see src/lib/cta.ts).
  async function toggleCta() {
    const desired: CtaOverride = ctaActive ? 'off' : 'on';
    setCtaOverrideState(desired);
    setCtaOverrideAtState(new Date().toISOString());
    try {
      await fetch('/api/staff/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
        body: JSON.stringify({ cta_override: desired }),
      });
    } catch {}
  }
```

- [ ] **Step 8: Make the 3s poll update everyone (not just non-staff), with the new fields**

Current:

```tsx
        const res = await fetch(url, { headers });
        const data = await res.json();
        // Only sync CTA state from poll for non-staff — staff controls it directly via toggle
        if (!staffTokenRef.current) {
          if (data.cta_enabled !== undefined) {
            const nowEnabled = !!data.cta_enabled;
            // Reset ctaVisible when CTA transitions off→on (staff re-enabled it)
            if (!serverCtaEnabledRef.current && nowEnabled) setCtaVisible(true);
            setServerCtaEnabled(nowEnabled);
          }
          if (data.cta_url) setLiveCtaUrl(data.cta_url);
          if (data.cta_text !== undefined) setLiveCtaText(data.cta_text);
        }
```

Replace with:

```tsx
        const res = await fetch(url, { headers });
        const data = await res.json();
        // Sync CTA state from every poll, for staff and public alike — the optimistic
        // local update in toggleCta() already gives staff instant feedback, and this
        // poll simply reconciles a moment later (idempotent, no fighting).
        if (data.cta_auto_enabled !== undefined) setCtaAutoEnabledState(!!data.cta_auto_enabled);
        if (data.cta_override !== undefined) setCtaOverrideState(data.cta_override);
        if (data.cta_override_at !== undefined) setCtaOverrideAtState(data.cta_override_at);
        if (data.cta_start_seconds !== undefined) setCtaStartSecsState(data.cta_start_seconds);
        if (data.cta_end_seconds !== undefined) setCtaEndSecsState(data.cta_end_seconds);
        if (data.cta_url) setLiveCtaUrl(data.cta_url);
        if (data.cta_text !== undefined) setLiveCtaText(data.cta_text);
```

- [ ] **Step 9: Simplify the staff metrics poll (drop the stale `cta_enabled` sync)**

Current:

```tsx
  // Poll staff metrics every 10s (online count, cta clicks, chat mode)
  // Note: cta_enabled is NOT synced here — staff controls it directly via the toggle
  // and syncing from DB would overwrite the optimistic local state.
  useEffect(() => {
    if (!isStaff || !staffToken) return;
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/staff/metrics', { headers: { Authorization: `Bearer ${staffToken}` } });
        const data = await res.json();
        if (data.online !== undefined) setStaffMetrics({ online: data.online, cta_clicks: data.cta_clicks });
        if (data.chat_mode !== undefined) setChatPublic(data.chat_mode === 'general');
        if (data.cta_enabled !== undefined) setServerCtaEnabled(!!data.cta_enabled);
      } catch {}
    };
    fetchMetrics();
    const t = setInterval(fetchMetrics, 10000);
    return () => clearInterval(t);
  }, [isStaff, staffToken]);
```

Replace with:

```tsx
  // Poll staff metrics every 10s (online count, cta clicks, chat mode).
  // CTA state itself is kept in sync by the 3s /api/chat poll above (Step 8) — no need
  // to duplicate it here.
  useEffect(() => {
    if (!isStaff || !staffToken) return;
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/staff/metrics', { headers: { Authorization: `Bearer ${staffToken}` } });
        const data = await res.json();
        if (data.online !== undefined) setStaffMetrics({ online: data.online, cta_clicks: data.cta_clicks });
        if (data.chat_mode !== undefined) setChatPublic(data.chat_mode === 'general');
      } catch {}
    };
    fetchMetrics();
    const t = setInterval(fetchMetrics, 10000);
    return () => clearInterval(t);
  }, [isStaff, staffToken]);
```

- [ ] **Step 10: Update the staff toggle UI (button + status hint)**

Current:

```tsx
          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ToggleSwitch on={serverCtaEnabled} onChange={toggleCta} label="CTA ativo" T={T} />
            <ToggleSwitch on={filterRealOnly} onChange={setFilterRealOnly} label="Apenas comentários reais" T={T} />
          </div>
```

Replace with:

```tsx
          {/* Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ToggleSwitch on={ctaActive} onChange={toggleCta} label="CTA ativo" T={T} />
            <span style={{ fontSize: 9, color: T.textMuted, fontStyle: 'italic', marginLeft: 39, marginTop: -4 }}>
              {ctaOverrideState === null
                ? (ctaAutoEnabledState ? 'Modo automático (janela configurada)' : 'Automático desabilitado — controle manual')
                : ctaOverrideState === 'on' ? 'Forçado manualmente' : 'Desativado manualmente'}
            </span>
            <ToggleSwitch on={filterRealOnly} onChange={setFilterRealOnly} label="Apenas comentários reais" T={T} />
          </div>
```

- [ ] **Step 11: Verify**

Run: `npx tsc --noEmit`
Expected: no errors anywhere in the project — this was the last file with pending prop mismatches from Tasks 9-10.

- [ ] **Step 12: Commit**

```bash
git add src/components/ChatPanel.tsx
git commit -m "feat: ChatPanel computes effective CTA state, syncs override for all clients"
```

---

### Task 12: Manual end-to-end verification

No further code changes — this task confirms the whole feature works as specified before considering the plan done.

- [ ] **Step 1: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: zero new warnings/errors introduced by this plan's files.

- [ ] **Step 3: Start the dev server**

Run: `npm run dev`

- [ ] **Step 4: Configure a short test window**

In `/admin` → Configurações → Modo Teste, enable test mode with a `test_time` a few minutes in the past (so the simulated live is already in progress). In the CTA / Oferta card, set a CTA URL/text, enable "Ativação automática habilitada", and set `Início (segundos)` to something like `30` and `Fim (segundos)` to `90` relative to the video start.

- [ ] **Step 5: Automatic activation — no staff involved**

Open `/ao-vivo` in a normal (non-staff) browser tab. Wait until the video's elapsed time crosses 30s. Confirm the CTA banner appears in the chat panel and a purchase-notification toast can fire, without touching the staff controls and without reloading. Confirm it disappears again once elapsed time passes 90s (also without reload).

- [ ] **Step 6: Manual override before the window — the key scenario**

Reset the test (`test_time` a moment before 0s again, or reload with a fresh `test_time`). Open `/ao-vivo`, log in as staff (chat lock icon), and while the video is still before the 30s automatic window, click "CTA ativo" to force it ON. Confirm the CTA banner appears immediately in the staff tab. In parallel, open a second, non-staff browser/incognito tab on `/ao-vivo` — confirm the CTA appears there too within ~3s (no reload).

Now, still before 30s, click "CTA ativo" again in the staff tab to turn it OFF. Confirm it disappears in both tabs within ~3s. Then let the video reach 30s: confirm the CTA **activates again on its own** in both tabs, without any further staff action — this is the scenario from the original request.

- [ ] **Step 7: Kill switch during an active window**

With the video between 30s and 90s (window active, CTA showing automatically), click "CTA ativo" in the staff tab to force it OFF. Confirm it hides in both tabs within ~3s. Confirm it stays hidden for the rest of the window (up to 90s), then confirm nothing unexpected happens once the window closes at 90s (both tabs simply show no CTA, consistent with the window being over).

- [ ] **Step 8: Captions check**

On the same `/ao-vivo` page (YouTube source configured), confirm no captions render on the video at any point during playback.

- [ ] **Step 9: Report results**

Summarize pass/fail for steps 5-8. If any step fails, return to the relevant task above and re-diagnose — do not patch symptoms without identifying which part of `computeEffectiveCta` or the polling wiring is wrong.
