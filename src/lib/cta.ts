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
