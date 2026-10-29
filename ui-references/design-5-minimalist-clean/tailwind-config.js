tailwind.config = {
  theme: {
    extend: {
      colors: {
        canvas: "#fafafa",
        surface: "#ffffff",
        ink: "#18181b",
        muted: "#71717a",
        line: "#e7e7ea",
        accent: { DEFAULT: "#2f5fa3", soft: "#e9f0fa", ink: "#1f3f6e" },
        danger: { DEFAULT: "#b91c1c", soft: "#fbe9e9" },
        warn: { DEFAULT: "#92650b", soft: "#f8f0dd" },
        ok: { DEFAULT: "#1f7a4d", soft: "#e7f3ec" },
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
      },
      borderRadius: {
        sm2: "0.5rem",
      },
    },
  },
};
