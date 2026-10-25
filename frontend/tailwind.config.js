/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'loc-green': 'var(--loc-green)',
        'loc-green-soft': 'var(--loc-green-soft)',
        'loc-bg': 'var(--loc-bg)',
        'loc-text': 'var(--loc-text)',
        'loc-muted': 'var(--loc-muted)',
      },
    },
  },
  plugins: [],
};