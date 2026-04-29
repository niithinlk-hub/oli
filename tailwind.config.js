/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        oli: {
          navy: '#071A33',
          blue: '#2563EB',
          azure: '#38BDF8',
          teal: '#14B8A6',
          violet: '#7C3AED',
          amber: '#F59E0B',
          coral: '#FB7185'
        },
        ink: {
          primary: '#0F172A',
          secondary: '#475569',
          muted: '#94A3B8'
        },
        surface: {
          DEFAULT: '#FFFFFF',
          cloud: '#F8FAFC',
          ice: '#EFF6FF',
          softViolet: '#F5F3FF',
          softTeal: '#F0FDFA',
          amberSoft: '#FFFBEB'
        },
        line: {
          DEFAULT: '#E2E8F0'
        },
        dark: {
          bg: '#020617',
          surface: '#0F172A',
          elevated: '#111827',
          border: '#1E293B',
          text: '#F8FAFC',
          textSecondary: '#CBD5E1',
          textMuted: '#64748B'
        }
      },
      backgroundImage: {
        'oli-primary': 'linear-gradient(135deg, #2563EB 0%, #38BDF8 45%, #14B8A6 100%)',
        'oli-memory': 'linear-gradient(135deg, #2563EB 0%, #7C3AED 55%, #FB7185 100%)',
        'oli-insight': 'linear-gradient(135deg, #38BDF8 0%, #7C3AED 60%, #F59E0B 100%)',
        'oli-app-icon': 'linear-gradient(135deg, #2563EB 0%, #38BDF8 35%, #7C3AED 75%, #F59E0B 100%)',
        'oli-dark-premium': 'linear-gradient(135deg, #020617 0%, #071A33 45%, #1E1B4B 100%)',
        'oli-soft-bg': 'linear-gradient(180deg, #F8FAFC 0%, #EFF6FF 45%, #F5F3FF 100%)'
      },
      boxShadow: {
        card: '0 8px 30px rgba(15, 23, 42, 0.08)',
        floating: '0 20px 60px rgba(37, 99, 235, 0.16)',
        'logo-glow': '0 18px 45px rgba(37, 99, 235, 0.28)',
        'amber-glow': '0 8px 20px rgba(245, 158, 11, 0.28)',
        'dark-card': '0 16px 45px rgba(0, 0, 0, 0.35)'
      },
      borderRadius: {
        xs: '6px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        button: '14px',
        card: '20px'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Inter Tight"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace']
      },
      fontSize: {
        'display-xl': ['56px', { lineHeight: '64px', letterSpacing: '-0.04em', fontWeight: '750' }],
        'display-lg': ['44px', { lineHeight: '52px', letterSpacing: '-0.035em', fontWeight: '725' }],
        'h1': ['36px', { lineHeight: '44px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'h2': ['30px', { lineHeight: '38px', letterSpacing: '-0.025em', fontWeight: '675' }],
        'h3': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '650' }],
        'h4': ['20px', { lineHeight: '28px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '30px', fontWeight: '400' }],
        'body': ['16px', { lineHeight: '26px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '22px', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '18px', fontWeight: '500' }],
        'btn': ['14px', { lineHeight: '20px', fontWeight: '650' }]
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
        '3xl': '48px',
        '4xl': '64px'
      }
    }
  },
  plugins: []
};
