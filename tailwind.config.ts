import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: { DEFAULT: '#F8F8F6' },
        surface: { DEFAULT: '#FFFFFF' },
        'surface-2': { DEFAULT: '#F2F2EF' },
        border: { DEFAULT: '#E5E5E0' },
        'text-primary': { DEFAULT: '#1C1C1A' },
        'text-secondary': { DEFAULT: '#6B6B68' },
        'text-tertiary': { DEFAULT: '#9A9A97' },
        primary: {
          DEFAULT: '#2D7A4F',
          hover: '#246040',
          light: '#E8F5EE',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#C9A84C',
          hover: '#B8963E',
          light: '#FBF5E6',
          foreground: '#FFFFFF',
        },
        'status-red': {
          DEFAULT: '#DC2626',
          bg: '#FEF2F2',
        },
        'status-yellow': {
          DEFAULT: '#D97706',
          bg: '#FFFBEB',
        },
        'status-green': {
          DEFAULT: '#16A34A',
          bg: '#F0FDF4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
