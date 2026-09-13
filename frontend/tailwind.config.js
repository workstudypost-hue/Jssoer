/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // هوية المنصة: كحلي أكاديمي عميق + لمسة ذهبية للإنجاز، بعيدًا عن قوالب
        // SaaS الجاهزة (لا كريمي/تراكوتا، لا بطاقات رمادية بظل ناعم موحّد).
        navy: {
          50: '#EEF1F7',
          200: '#C3CCE0',
          700: '#26365C',
          800: '#1B2748',
          900: '#141D38',
          950: '#0D1327',
        },
        gold: {
          500: '#C79A3E',
          600: '#AD8331',
        },
        paper: '#FAFAF8',
        ink: '#14171F',
      },
      fontFamily: {
        arabic: ['var(--font-tajawal)', 'system-ui', 'sans-serif'],
        latin: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
