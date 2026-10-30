import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: "#eef6ff", 100: "#d9eaff", 200: "#b6d6ff", 400: "#4f9cf9", 500: "#2563eb", 600: "#1d4ed8", 700: "#1e40af", 900: "#0f1d4a" },
        cyan: { 400: "#22d3ee", 500: "#06b6d4" }, violet: { 500: "#7c3aed", 600: "#6d28d9" },
        ink: { 900: "#0b1220", 700: "#334155", 500: "#64748b", 300: "#cbd5e1", 100: "#f1f5f9", 50: "#f8fafc" },
      },
      fontFamily: { sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Noto Sans", "sans-serif"] },
    },
  },
} satisfies Config;
