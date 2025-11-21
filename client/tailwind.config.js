/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "#f8f1e5",
        ink: "#2f1a0a",
        arcane: "#5c6ac4",
      },
      fontFamily: {
        display: ["'Cinzel'", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
      boxShadow: {
        sheet: "0 20px 45px rgba(15, 23, 42, 0.2)",
      },
    },
  },
  plugins: [],
};

