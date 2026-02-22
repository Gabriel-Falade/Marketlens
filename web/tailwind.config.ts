import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:        '#0F172A',
        surface:   '#1E293B',
        raised:    '#263348',
        border:    '#334155',
        accent:    '#F59E0B',
        stable:    '#22C55E',
        alert:     '#EF4444',
        watch:     '#F59E0B',
        cyan:      '#22D3EE',
        primary:   '#F8FAFC',
        secondary: '#CBD5E1',
        muted:     '#64748B',
        dim:       '#475569',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'Helvetica Neue', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
