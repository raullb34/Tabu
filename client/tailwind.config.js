/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        hacker: {
          bg: '#0d1117',
          orange: '#FF8800',
          'orange-dim': '#CC6600',
          'orange-bright': '#FF5500',
        },
        paper: {
          bg: '#F5EEDA',
          'bg-dark': '#E8DCC8',
          ink: '#2C2416',
          'ink-light': '#5C4A32',
          sepia: '#8B7355',
        },
      },
      fontFamily: {
        mono: ['"Fira Code"', '"Roboto Mono"', 'ui-monospace', 'monospace'],
        sketch: ['"Patrick Hand"', '"Caveat"', 'cursive'],
      },
      boxShadow: {
        neon: '0 0 8px #FF8800, 0 0 20px rgba(255,136,0,0.3)',
        'neon-sm': '0 0 4px #FF8800, 0 0 10px rgba(255,136,0,0.2)',
        'paper-sm': '2px 2px 4px rgba(0,0,0,0.1)',
        paper: '3px 3px 8px rgba(0,0,0,0.15)',
      },
      animation: {
        'pulse-neon': 'pulseNeon 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        pulseNeon: {
          '0%, 100%': { boxShadow: '0 0 8px #FF8800, 0 0 20px rgba(255,136,0,0.3)' },
          '50%': { boxShadow: '0 0 16px #FF8800, 0 0 40px rgba(255,136,0,0.5)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
