/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        skybrand: '#0EA5E9',
        tealbrand: '#14B8A6',
        vip: '#F59E0B',
        appbg: '#F8FAFF',
        ink: '#0F172A',
        muted: '#64748B',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 18px 45px rgba(15, 23, 42, 0.08)',
        glow: '0 18px 55px rgba(20, 184, 166, 0.24)',
      },
      animation: {
        float: 'float 4s ease-in-out infinite',
        fadeSlide: 'fadeSlide 220ms ease-out both',
        pop: 'pop 260ms ease-out both',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeSlide: {
          '0%': { opacity: 0, transform: 'translateX(16px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
        pop: {
          '0%': { opacity: 0, transform: 'scale(.96) translateY(8px)' },
          '100%': { opacity: 1, transform: 'scale(1) translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
