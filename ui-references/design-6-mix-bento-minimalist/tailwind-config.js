tailwind.config = {
  theme: {
    extend: {
      colors: {
        canvas: "#15161b",
        surface: "#1c1e25",
        raised: "#22242c",
        ink: "#e7e7ea",
        muted: "#8d8f99",
        line: "#2b2d35",
        amber: { DEFAULT: "#c9975a", soft: "rgba(201,151,90,.12)", ink: "#f0ddc4" },
        rose: { DEFAULT: "#d9726a", soft: "rgba(217,114,106,.12)" },
        sage: { DEFAULT: "#7fae8e", soft: "rgba(127,174,142,.12)" },
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.1rem",
      },
    },
  },
};
