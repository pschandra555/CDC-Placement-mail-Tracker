import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#05060f", 900: "#0a0c1b", 800: "#11142a", 700: "#1a1e3a" },
        neon: { violet: "#8b5cf6", cyan: "#22d3ee", pink: "#ec4899", lime: "#a3e635" },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(139,92,246,0.55)",
        "glow-cyan": "0 0 40px -8px rgba(34,211,238,0.55)",
      },
      keyframes: {
        aurora: {
          "0%,100%": { transform: "translate(0,0) rotate(0deg) scale(1)" },
          "33%": { transform: "translate(6%,-4%) rotate(20deg) scale(1.1)" },
          "66%": { transform: "translate(-5%,5%) rotate(-15deg) scale(0.95)" },
        },
        shimmer: { "0%": { backgroundPosition: "0% 50%" }, "100%": { backgroundPosition: "200% 50%" } },
        pulseRing: { "0%": { transform: "scale(.8)", opacity: "1" }, "100%": { transform: "scale(2.2)", opacity: "0" } },
      },
      animation: {
        aurora: "aurora 18s ease-in-out infinite",
        shimmer: "shimmer 6s linear infinite",
        pulseRing: "pulseRing 1.8s ease-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
