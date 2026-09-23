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
          50:  '#fef2f4',
          100: '#fde6ea',
          500: '#e11d48',
          600: '#d11149',
          700: '#b30d3f',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'Helvetica Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
