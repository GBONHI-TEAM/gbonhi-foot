/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1E7A3A',
        'primary-medium': '#2E9E4F',
        'primary-dark': '#0F3D1E',
        accent: '#F7921E',
        'accent-gold': '#FFB830',
        sidebar: '#1E7A3A',
      },
    },
  },
  plugins: [],
};
