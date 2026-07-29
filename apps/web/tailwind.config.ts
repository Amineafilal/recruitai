import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Thème « Maruncy » — crème chaud + corail, cohérent avec la landing.
        paper: "#F6F2EB", // fond de page (crème)
        "paper-2": "#EFE9DE", // survols
        card: "#FFFFFF",
        ink: "#20223D", // navy foncé
        "ink-soft": "#5A5C72",
        "ink-faint": "#9A9CB0",
        line: "#E7E1D5",
        "line-strong": "#D6CFC0",
        accent: "#FB6D4C", // corail (primaire)
        "accent-ink": "#E85835",
        "accent-soft": "#FFF0EB",
        blue: "#0EA5A0", // teal secondaire
        indigo: "#7C6BF0",
        emerald: "#16A34A",
        "emerald-soft": "#DCF5E4",
        amber: "#D97706",
        "amber-soft": "#FCEFD2",
        danger: "#DC2626",
        "danger-soft": "#FBE3E3",
        violet: "#7C3AED",
        "violet-soft": "#EDE7FB",
      },
      fontFamily: {
        display: ["var(--font-body)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(20,20,40,0.04), 0 6px 20px -12px rgba(20,20,40,0.18)",
        "card-hover": "0 10px 30px -12px rgba(20,20,40,0.20)",
      },
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
      },
      animation: {
        "rise-in": "rise-in 0.4s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.4s ease both",
      },
    },
  },
  plugins: [],
} satisfies Config;
