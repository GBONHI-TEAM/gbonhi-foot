/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1E7A3A',
          medium: '#2E9E4F',
          dark: '#0F3D1E',
          deep: '#0D1F0D',
        },
        accent: {
          DEFAULT: '#F7921E',
          gold: '#FFB830',
        },
        surface: {
          DEFAULT: 'rgba(255,255,255,0.08)',
          card: 'rgba(255,255,255,0.06)',
        },
      },
      borderRadius: {
        card: '16px',
        btn: '12px',
        input: '10px',
      },
    },
  },
  plugins: [],
};
