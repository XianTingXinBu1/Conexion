/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      safeArea: {
        top: 'env(safe-area-inset-top, 20px)',
        bottom: 'max(env(safe-area-inset-bottom), 12px)',
      },
    },
  },
  plugins: [],
}