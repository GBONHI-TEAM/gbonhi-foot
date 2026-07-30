/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1E7A3A',
        'primary-medium': '#2E9E4F',
        accent: '#F7921E',
        'accent-gold': '#FFB830',
        sidebar: '#1A3D2B',
      },
    },
  },
  plugins: [],
};
