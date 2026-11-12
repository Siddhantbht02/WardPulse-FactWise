import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        primary: {
          DEFAULT: "#0284c7", // sky-600
          foreground: "#ffffff",
          dark: "#0369a1",
        },
        pipeline: {
          needsTemp: "#f59e0b", // amber-500
          readyDoc: "#0284c7",  // sky-600
          seen: "#10b981",      // emerald-500
          discharge: "#8b5cf6", // purple-500
          overdue: "#ef4444",   // red-500
        }
      },
      animation: {
        "pulse-fast": "pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      }
    },
  },
  plugins: [],
};
export default config;

