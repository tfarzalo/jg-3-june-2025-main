/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#F8FAFC',
          dark: '#0F172A'
        },
        surface: {
          DEFAULT: '#FFFFFF',
          dark: '#1E293B'
        },
        border: {
          DEFAULT: '#E2E8F0',
          dark: '#334155'
        },
        text: {
          base: {
            DEFAULT: '#1E293B',
            dark: '#F8FAFC'
          },
          muted: {
            DEFAULT: '#64748B',
            dark: '#94A3B8'
          }
        },
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A'
        },
        secondary: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12'
        },
        accent: {
          purple: {
            DEFAULT: '#A855F7',
            light: '#E9D5FF',
            dark: '#6B21A8'
          },
          teal: {
            DEFAULT: '#14B8A6',
            light: '#CCFBF1',
            dark: '#115E59'
          }
        },
        danger: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D'
        },
        neutral: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui']
      },
      keyframes: {
        'paint-stroke': {
          '0%': { 
            transform: 'translateX(-100%) scale(1)',
            opacity: '0.8'
          },
          '50%': {
            transform: 'translateX(0%) scale(1.2)',
            opacity: '1'
          },
          '100%': { 
            transform: 'translateX(100%) scale(1)',
            opacity: '0.8'
          }
        }
      },
      animation: {
        'paint-stroke': 'paint-stroke 1.5s ease-in-out infinite'
      }
    }
  },
  future: {
    hoverOnlyWhenSupported: true
  },
  plugins: []
};