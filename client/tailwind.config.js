/** @type {import('tailwindcss').Config} */

// Every color is a CSS variable (space-separated RGB channels) defined in
// src/index.css, so light/dark themes swap in one place and opacity
// modifiers such as `bg-accent/10` still work.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: {
          DEFAULT: token('surface'),
          2: token('surface-2'),
          3: token('surface-3'),
        },
        line: {
          DEFAULT: token('line'),
          strong: token('line-strong'),
        },
        ink: {
          DEFAULT: token('ink'),
          2: token('ink-2'),
          3: token('ink-3'),
        },
        accent: {
          DEFAULT: token('accent'),
          hover: token('accent-hover'),
          ink: token('accent-ink'),
          soft: token('accent-soft'),
          fg: token('accent-fg'),
        },
        brass: {
          DEFAULT: token('brass'),
          soft: token('brass-soft'),
        },
        success: {
          DEFAULT: token('success'),
          soft: token('success-soft'),
          fg: token('success-fg'),
        },
        warning: {
          DEFAULT: token('warning'),
          soft: token('warning-soft'),
          fg: token('warning-fg'),
        },
        danger: {
          DEFAULT: token('danger'),
          soft: token('danger-soft'),
          fg: token('danger-fg'),
        },
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(var(--shadow) / 0.05), 0 1px 3px 0 rgb(var(--shadow) / 0.04)',
        raised: '0 8px 24px -8px rgb(var(--shadow) / 0.18), 0 2px 6px -2px rgb(var(--shadow) / 0.08)',
        inset: 'inset 0 1px 0 0 rgb(255 255 255 / 0.12)',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-down': { from: { opacity: '0', transform: 'translateY(-8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slide-down 240ms cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
