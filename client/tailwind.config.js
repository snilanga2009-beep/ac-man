/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0284c7',
          600: '#0369a1',
          700: '#075985',
          800: '#0c4a6e',
          900: '#082f49',
        },
        breeze: {
          purple: '#423A8E',
          'purple-dark': '#342c74',
          'purple-light': '#564eb0',
          cyan: '#00CCCD',
          'cyan-dark': '#00b3b4',
          'cyan-light': '#33d7d8',
          yellow: '#FFC107',
          'yellow-dark': '#e0a800',
          red: '#DC3545',
          'red-dark': '#bd2130',
          green: '#22C55E',
          'green-dark': '#16A34A',
          blue: '#0D6EFD',
          'blue-dark': '#0b5ed7',
          slate: '#F4F5F7',
        },
        service: {
          primary: '#22C55E',
          'primary-dark': '#16A34A',
          'primary-deep': '#15803D',
          'primary-light': '#86EFAC',
          mint: '#F0FDF4',
          'mint-dark': '#DCFCE7',
          amber: '#F59E0B',
          'amber-light': '#FEF3C7',
          orange: '#FF9800',
          sky: '#0EA5E9',
          'sky-light': '#E0F2FE'
        }
      }
    },
  },
  plugins: [],
}
