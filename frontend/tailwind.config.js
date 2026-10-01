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
        paper: '#FAF6EC',
        'paper-dim': '#EDE5D2',
        moss: {
          DEFAULT: '#3D5A40',
          light: '#E8EFE5',
        },
        ink: '#1B1B1B',
      },
      fontFamily: {
        sans: ['var(--font-sans)', '-apple-system', 'sans-serif'],
        serif: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}
