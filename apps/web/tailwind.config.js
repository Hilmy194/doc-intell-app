/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#141627',
        sidebar: '#1a1e35',
        card: '#1e2340',
        'card-hover': '#252a50',
        row: '#1a1e35',
        'row-hover': '#1f2444',
        border: '#2a3060',
        primary: '#e8eaf6',
        secondary: '#8b92b8',
        muted: '#5c6290',
        blue: { DEFAULT: '#4f7cff', 500: '#4f7cff', 600: '#3b63e6' },
        cyan: { DEFAULT: '#38bdf8' },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease',
        'slide-up': 'slideUp 0.25s ease',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(16px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};

