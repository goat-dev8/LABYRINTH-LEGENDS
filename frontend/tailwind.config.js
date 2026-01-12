/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dungeon/Labyrinth color palette
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        stone: {
          850: '#1a1814',
          900: '#0f0e0c',
          950: '#080807',
        },
        torch: {
          orange: '#ff6b35',
          red: '#ff4444',
          yellow: '#ffb347',
        },
        // Keep neon for UI accents
        neon: {
          cyan: '#00f5ff',
          magenta: '#ff00ff',
          yellow: '#ffff00',
          green: '#00ff00',
          red: '#ff0044',
          orange: '#ff8800',
          purple: '#8800ff',
          pink: '#ff0088',
        },
        // Dark dungeon theme
        dungeon: {
          darker: '#050504',
          dark: '#0a0908',
          mid: '#151412',
          light: '#1f1d1a',
          lighter: '#2a2723',
        },
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Crimson Text', 'serif'],
        accent: ['MedievalSharp', 'cursive'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'torch-flicker': 'torch-flicker 0.5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.5s ease-out',
        'slide-down': 'slide-down 0.5s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
        'spin-slow': 'spin 8s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
      },
      keyframes: {
        'torch-flicker': {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.8', filter: 'brightness(1.2)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px currentColor, 0 0 10px currentColor' },
          '50%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-30px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 10px #fbbf24, 0 0 20px #f59e0b' },
          '50%': { boxShadow: '0 0 20px #fbbf24, 0 0 40px #f59e0b, 0 0 60px #d97706' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gold-shimmer': 'linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)',
        'dungeon-gradient': 'linear-gradient(180deg, #0a0908 0%, #151412 50%, #0a0908 100%)',
        'torch-glow': 'radial-gradient(ellipse at center, rgba(255,107,53,0.3) 0%, transparent 70%)',
      },
      boxShadow: {
        'gold': '0 0 15px rgba(251,191,36,0.5), 0 0 30px rgba(245,158,11,0.3)',
        'gold-lg': '0 0 30px rgba(251,191,36,0.6), 0 0 60px rgba(245,158,11,0.4)',
        'torch': '0 0 20px rgba(255,107,53,0.6), 0 0 40px rgba(255,68,68,0.3)',
        'inner-gold': 'inset 0 0 20px rgba(251,191,36,0.2)',
      },
    },
  },
  plugins: [],
};
