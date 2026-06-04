/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        body: ["Manrope", "system-ui", "sans-serif"],
      },
      colors: {
        discord: {
          950: "#0f1012",
          900: "#1e1f22",
          850: "#242528",
          800: "#2b2d31",
          750: "#313338",
          700: "#3c3f45",
          500: "#b5bac1",
          200: "#f2f3f5",
          blurple: "#5865f2",
          green: "#57f287",
          yellow: "#fee75c",
          red: "#ed4245",
        },
      },
      boxShadow: {
        soft: "0 18px 40px rgba(0,0,0,0.28)",
      },
    },
  },
  plugins: [],
};
