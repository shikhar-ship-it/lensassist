/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EEF4FF",
          100: "#D1E0FF",
          500: "#2F58CD",
          600: "#1E40AF",
          700: "#1A3691",
          900: "#0B1F3A",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 4px 16px rgba(11, 31, 58, 0.08)",
        pop: "0 6px 24px rgba(47, 88, 205, 0.25)",
      },
      animation: {
        "pulse-mic": "pulse-mic 1.3s ease-in-out infinite",
      },
      keyframes: {
        "pulse-mic": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(217, 45, 32, 0.6)" },
          "50%": { boxShadow: "0 0 0 12px rgba(217, 45, 32, 0)" },
        },
      },
    },
  },
  plugins: [],
};
