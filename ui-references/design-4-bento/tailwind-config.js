tailwind.config = {
  theme: {
    extend: {
      colors: {
        ink: '#1b2420',
        muted: '#5b6b63',
        canvas: '#f5f6f2',
        surface: '#ffffff',
        line: '#e4e6e0',
        primary: { DEFAULT: '#0c6b4f', soft: '#e3f1ea', ink: '#07402f' },
        coral: { DEFAULT: '#e2503b', soft: '#fbe6e2' },
        amber: { DEFAULT: '#c6860f', soft: '#faf0da' },
      },
      fontFamily: {
        sans: ['"Figtree"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(27,36,32,.04), 0 10px 24px -14px rgba(27,36,32,.18)',
        pop: '0 2px 4px rgba(27,36,32,.05), 0 18px 34px -16px rgba(12,107,79,.28)',
      },
      borderRadius: { xl2: '1.25rem' },
    }
  }
}
