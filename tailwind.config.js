/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#FDF8F5',
        primary: '#2C2C2C',
        secondary: '#6B6B6B',
        cta: '#E76F51',
      }
    }
  },
  plugins: []
}
