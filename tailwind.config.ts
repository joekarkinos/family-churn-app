import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-syne)', 'system-ui', 'sans-serif'],
      },
      colors: {
        teal: {
          DEFAULT: '#00897b',
          dark: '#00695c',
          bg: '#e0f2f1',
        },
        amber: {
          DEFAULT: '#e6920a',
          light: '#f9a825',
          bg: '#fff8e1',
        },
        ink: {
          DEFAULT: '#1a1714',
          2: '#3d3830',
          3: '#7a7168',
        },
        surface: '#faf8f5',
        border: '#e2dbd2',
      },
      borderRadius: {
        app: '14px',
        'app-sm': '8px',
      },
      boxShadow: {
        card: '0 1px 4px rgba(26,23,20,.07), 0 4px 12px rgba(26,23,20,.06)',
        lift: '0 4px 20px rgba(26,23,20,.1), 0 1px 6px rgba(26,23,20,.06)',
      },
    },
  },
  plugins: [],
}

export default config
