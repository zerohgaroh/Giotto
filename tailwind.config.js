/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        giotto: {
          navy: "#0a1f4a",
          "navy-deep": "#061230",
          "navy-soft": "#143a7a",
          gold: "#b8924a",
          "gold-soft": "#d4b87a",
          paper: "#f3efe6",
          cream: "#faf8f4",
          ink: "#0f172a",
          muted: "#64748b",
          line: "#e2ddd4",
          danger: "#b42318",
          success: "#1d6f4a",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        serif: [
          "ui-serif",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "Times",
          "serif",
        ],
      },
      maxWidth: { guest: "28rem" },
      borderRadius: {
        giotto: "1rem",
        "giotto-lg": "1.25rem",
        "giotto-xl": "1.75rem",
      },
      boxShadow: {
        lift: "0 4px 24px rgba(8, 29, 54, 0.08)",
        card: "0 1px 0 rgba(8, 29, 54, 0.06), 0 12px 40px rgba(8, 29, 54, 0.07)",
      },
      keyframes: {
        "giotto-pulse-ring": {
          "0%, 100%": { transform: "scale(0.92)", opacity: "0.45" },
          "50%": { transform: "scale(1.06)", opacity: "0.12" },
        },
        "giotto-bell-sway": {
          "0%, 100%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(4deg)" },
        },
      },
      animation: {
        "giotto-pulse-ring": "giotto-pulse-ring 2.4s ease-in-out infinite",
        "giotto-bell-sway": "giotto-bell-sway 2.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
