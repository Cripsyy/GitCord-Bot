/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Source Sans 3", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          900: "#0a0f0c",
          800: "#0e1712",
          700: "#132018",
        },
        moss: {
          500: "#66d19e",
          600: "#3fb481",
        },
        sand: {
          100: "#f4f2ec",
          200: "#d7dfd2",
        },
      },
      boxShadow: {
        glow: "0 24px 64px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
