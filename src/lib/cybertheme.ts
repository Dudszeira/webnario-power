// src/lib/cybertheme.ts
export const cyber = {
  bg:               '#020810',
  surface:          '#040d1a',
  surfaceHover:     '#071428',
  accent:           '#00B4FF',
  accentDim:        '#0077aa',
  accentBorder:     'rgba(0,180,255,0.4)',
  accentBorderDim:  'rgba(0,180,255,0.2)',
  accentGlow:       'rgba(0,180,255,0.25)',
  accentGlowInset:  'rgba(0,180,255,0.05)',
  accentOverlay:    'rgba(0,180,255,0.06)',
  green:            '#00ff9d',
  greenGlow:        'rgba(0,255,157,0.4)',
  surfaceNav:       'rgba(4,13,26,0.8)',
  surfaceNavMobile: 'rgba(4,13,26,0.95)',
  textPrimary:      '#c8e4f4',
  textSupport:      '#8cb8d4',
  textLabel:        '#6a9ab8',
  textDecorative:   '#3a6b8a',
  white:            '#ffffff',
  black:            '#000000',
  error:            'rgba(255,68,102,0.9)',
} as const;

export const cyberFonts = {
  display: "'Orbitron', sans-serif",
  body:    "'Exo 2', sans-serif",
} as const;

export const cyberEffects = {
  scanLines: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.07) 0px, rgba(0,0,0,0.07) 1px, transparent 1px, transparent 3px)',
  grid40:    'linear-gradient(rgba(0,180,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,255,0.04) 1px, transparent 1px)',
  grid50:    'linear-gradient(rgba(0,180,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,255,0.03) 1px, transparent 1px)',
  radialGlow: 'radial-gradient(ellipse 70% 40% at 50% 20%, rgba(0,180,255,0.07) 0%, transparent 70%)',
} as const;

export const cyberCard = {
  base: {
    border:       `1px solid ${cyber.accentBorderDim}`,
    borderRadius: 4,
    background:   cyber.surface,
    position:     'relative' as const,
    overflow:     'hidden' as const,
    transition:   'all 0.2s ease',
  },
  hover: {
    border:       `1px solid ${cyber.accent}`,
    background:   cyber.surfaceHover,
    boxShadow:    `0 0 20px ${cyber.accentGlow}, inset 0 0 20px ${cyber.accentGlowInset}`,
    transform:    'translateY(-2px)',
  },
} as const;
