import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0414',
          raised: '#10071e',
          panel: '#160a26',
          line: '#241338',
        },
        neon: {
          magenta: '#ff2d95',
          cyan: '#00f0ff',
          purple: '#a855f7',
          amber: '#fbbf24',
          rose: '#ff5d8f',
        },
        ink: {
          DEFAULT: '#f4eef9',
          muted: '#b6a8c9',
          dim: '#7d6e91',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk Variable"', 'system-ui', 'sans-serif'],
        body: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-magenta': '0 0 24px rgba(255, 45, 149, 0.35), 0 0 64px rgba(255, 45, 149, 0.15)',
        'glow-cyan': '0 0 24px rgba(0, 240, 255, 0.35), 0 0 64px rgba(0, 240, 255, 0.15)',
        'glow-purple': '0 0 24px rgba(168, 85, 247, 0.35), 0 0 64px rgba(168, 85, 247, 0.15)',
      },
      animation: {
        'cursor-blink': 'blink 1s steps(2, end) infinite',
        'glow-pulse': 'glow 3s ease-in-out infinite',
        'grid-drift': 'grid-drift 16s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        glow: {
          '0%, 100%': { opacity: '0.9', filter: 'brightness(1)' },
          '50%': { opacity: '1', filter: 'brightness(1.1)' },
        },
        'grid-drift': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(40px)' },
        },
      },
    },
  },
  plugins: [typography],
};
