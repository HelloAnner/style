/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Dark theme colors
        dark: {
          bg: '#0A0A0F',
          'bg-secondary': '#121218',
          'bg-tertiary': '#16161C',
          'bg-elevated': '#1A1A20',
          border: 'rgba(255, 255, 255, 0.04)',
          'border-muted': 'rgba(255, 255, 255, 0.03)',
        },
        // Light theme colors
        light: {
          bg: '#F7F7F8',
          'bg-secondary': '#FEFEFE',
          'bg-tertiary': '#F2F2F3',
          'bg-elevated': '#FFFFFF',
          border: 'rgba(0, 0, 0, 0.03)',
          'border-muted': 'rgba(0, 0, 0, 0.02)',
        },
        // Neutral colors (Zinc scale) - 保留旧版兼容
        surface: {
          DEFAULT: '#0A0A0F',
          50: '#121218',
          100: '#16161C',
          200: '#1A1A20',
          300: '#27272A',
        },
        // Zinc scale (完整色阶)
        zinc: {
          50: '#FAFAFA',
          100: '#F4F4F5',
          200: '#E4E4E7',
          300: '#D4D4D8',
          400: '#A1A1AA',
          500: '#71717A',
          600: '#52525B',
          700: '#3F3F46',
          800: '#27272A',
          900: '#18181B',
          950: '#0A0A0F',
        },
        // 主强调色 - 保留旧版兼容
        accent: {
          DEFAULT: '#f59e0b',
          light: '#fbbf24',
          dark: '#d97706',
          muted: 'rgba(245, 158, 11, 0.15)',
        },
        // 次级强调色 - 保留旧版兼容
        secondary: {
          DEFAULT: '#14b8a6',
          light: '#2dd4bf',
          dark: '#0d9488',
          muted: 'rgba(20, 184, 166, 0.15)',
        },
        // Semantic colors
        file: {
          csv: '#F59E0B',
          image: '#6366F1',
          markdown: '#22C55E',
          config: '#71717A',
        },
        // 语义色
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
      },
      borderRadius: {
        'sm': '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '2.5': '10px',
        '3': '12px',
        '3.5': '14px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '18': '72px',
      },
      backdropBlur: {
        'glass': '40px',
        'glass-lg': '48px',
      },
      boxShadow: {
        'glass-light': '0 2px 20px rgba(0, 0, 0, 0.04)',
        'glass-sm': '0 2px 16px rgba(0, 0, 0, 0.04)',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '200ms',
        'slow': '300ms',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
        'slide-in-right': 'slideInRight 200ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
