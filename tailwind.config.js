/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './client/index.html',
    './client/src/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        navy: {
          800: '#1e293b',
          900: '#0f172a'
        }
      },
      fontSize: {
        'elder-base': '1.1875rem', // 19px
        'elder-lg': '1.375rem',    // 22px
        'elder-xl': '1.75rem',     // 28px
        'elder-2xl': '2.25rem'     // 36px
      }
    },
  },
  plugins: [],
}
