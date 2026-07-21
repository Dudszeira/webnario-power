import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          light: '#3b82f6',
        },
        surface: {
          DEFAULT: '#111827',
          raised: '#1f2937',
          input: '#0f1623',
        },
        // oklch(var(--x) / <alpha-value>) lets Tailwind substitute /opacity modifiers (bg-primary/10 etc.)
        // — a plain var(--x) reference to an already-composed oklch(...) value can't be modified this way.
        background: 'oklch(var(--background) / <alpha-value>)',
        foreground: 'oklch(var(--foreground) / <alpha-value>)',
        card: { DEFAULT: 'oklch(var(--card) / <alpha-value>)', foreground: 'oklch(var(--card-foreground) / <alpha-value>)' },
        popover: { DEFAULT: 'oklch(var(--popover) / <alpha-value>)', foreground: 'oklch(var(--popover-foreground) / <alpha-value>)' },
        primary: { DEFAULT: 'oklch(var(--primary) / <alpha-value>)', foreground: 'oklch(var(--primary-foreground) / <alpha-value>)' },
        secondary: { DEFAULT: 'oklch(var(--secondary) / <alpha-value>)', foreground: 'oklch(var(--secondary-foreground) / <alpha-value>)' },
        muted: { DEFAULT: 'oklch(var(--muted) / <alpha-value>)', foreground: 'oklch(var(--muted-foreground) / <alpha-value>)' },
        accent: { DEFAULT: 'oklch(var(--accent) / <alpha-value>)', foreground: 'oklch(var(--accent-foreground) / <alpha-value>)' },
        destructive: { DEFAULT: 'oklch(var(--destructive) / <alpha-value>)' },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'oklch(var(--ring) / <alpha-value>)',
        chart: {
          1: 'oklch(var(--chart-1) / <alpha-value>)',
          2: 'oklch(var(--chart-2) / <alpha-value>)',
          3: 'oklch(var(--chart-3) / <alpha-value>)',
          4: 'oklch(var(--chart-4) / <alpha-value>)',
          5: 'oklch(var(--chart-5) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT: 'oklch(var(--sidebar) / <alpha-value>)',
          foreground: 'oklch(var(--sidebar-foreground) / <alpha-value>)',
          primary: 'oklch(var(--sidebar-primary) / <alpha-value>)',
          'primary-foreground': 'oklch(var(--sidebar-primary-foreground) / <alpha-value>)',
          accent: 'oklch(var(--sidebar-accent) / <alpha-value>)',
          'accent-foreground': 'oklch(var(--sidebar-accent-foreground) / <alpha-value>)',
          border: 'var(--sidebar-border)',
          ring: 'oklch(var(--sidebar-ring) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'var(--radius-md)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    // ponytail: hand-ported from shadcn's v4-only `@custom-variant` rules (node_modules/shadcn/dist/tailwind.css)
    // since Tailwind v3 has no @custom-variant at-rule. Matches @base-ui/react's data-state/data-* attributes.
    plugin(({ addVariant }) => {
      addVariant('data-open', '&:where([data-state="open"], [data-open]:not([data-open="false"]))');
      addVariant('data-closed', '&:where([data-state="closed"], [data-closed]:not([data-closed="false"]))');
      addVariant('data-checked', '&:where([data-state="checked"], [data-checked]:not([data-checked="false"]))');
      addVariant('data-unchecked', '&:where([data-state="unchecked"], [data-unchecked]:not([data-unchecked="false"]))');
      addVariant('data-selected', '&[data-selected="true"]');
      addVariant('data-disabled', '&:where([data-disabled="true"], [data-disabled]:not([data-disabled="false"]))');
      addVariant('data-active', '&:where([data-state="active"], [data-active]:not([data-active="false"]))');
      addVariant('data-horizontal', '&[data-orientation="horizontal"]');
      addVariant('data-vertical', '&[data-orientation="vertical"]');
    }),
  ],
};

export default config;
