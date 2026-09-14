import type { Config } from 'tailwindcss';

/**
 * Design tokens. The CSS custom properties in `globals.css` (`--ink`, `--primary`, …)
 * mirror these values so hand-written component classes and utilities agree.
 *
 * - `primary` is the single colour for actions (buttons, links, focus, active nav).
 *   The legacy names `blue` and `purple` are kept as aliases so existing markup
 *   converges on the same palette instead of three competing ones.
 * - `muted` must stay ≥ 4.5:1 on white: it carries most small labels.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#121a42',
        navy: '#121a42',
        primary: { DEFAULT: '#4f46e5', hover: '#4338ca', soft: '#eef0ff', ring: 'rgba(79,70,229,.18)' },
        accent: '#7654f6',
        blue: '#4f46e5',
        purple: '#6d4ff0',
        violet: '#9a77ff',
        lavender: '#f1efff',
        canvas: '#f7f8fc',
        ivory: '#f7f8fc',
        lime: '#9a77ff',
        line: '#e6e9f2',
        muted: '#5b6478',
        subtle: '#8a91a5',
        success: { DEFAULT: '#15803d', soft: '#ecfdf3' },
        warning: { DEFAULT: '#b45309', soft: '#fffbeb' },
        danger: { DEFAULT: '#b91c1c', soft: '#fef2f2' },
        info: { DEFAULT: '#4338ca', soft: '#eef2ff' },
      },
      backgroundImage: { brand: 'linear-gradient(110deg,#4f46e5,#7654f6)' },
      boxShadow: {
        soft: '0 1px 2px rgba(18,26,66,.04), 0 8px 24px rgba(18,26,66,.05)',
        pop: '0 12px 40px rgba(18,26,66,.14)',
        brand: '0 14px 36px rgba(79,70,229,.22)',
      },
      borderRadius: { '4xl': '1.5rem' },
      fontFamily: { sans: ['Vazirmatn Variable', 'Vazirmatn', 'Tahoma', 'sans-serif'] },
      // Type scale tuned for Vazirmatn: Persian needs taller line boxes than Latin.
      fontSize: {
        caption: ['0.75rem', { lineHeight: '1.25rem' }],
        display: ['2.5rem', { lineHeight: '3.25rem', fontWeight: '800' }],
        h1: ['1.875rem', { lineHeight: '2.625rem', fontWeight: '800' }],
        h2: ['1.5rem', { lineHeight: '2.25rem', fontWeight: '700' }],
        h3: ['1.125rem', { lineHeight: '1.875rem', fontWeight: '700' }],
      },
      // Black (900) smudges Persian letterforms at UI sizes; the whole app leans on font-black, so soften it here.
      fontWeight: { black: '800', extrabold: '750' },
      minHeight: { 11: '2.75rem', 13: '3.25rem' },
      keyframes: {
        'toast-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'sheet-in': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
      },
      animation: { 'toast-in': 'toast-in .2s ease-out', 'sheet-in': 'sheet-in .25s ease-out' },
    },
  },
  plugins: [],
} satisfies Config;
