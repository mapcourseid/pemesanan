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
          50: '#f6f1fd',
          100: '#eee5fb',
          200: '#decbf7',
          300: '#c5a3f2',
          400: '#a773eb',
          500: '#7d3feb', // Main theme color requested by user
          600: '#6f2cdb',
          700: '#5e23be',
          800: '#4e1e9c',
          900: '#411a7f',
          950: '#270c56',
        }
      }
    },
  },
  plugins: [],
}
