import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "InterVariable",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ],
        display: [
          "InterDisplay",
          "InterVariable",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif"
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "SF Mono",
          "Menlo",
          "monospace"
        ]
      },
      colors: {
        ink: "#0b1220",
        muted: "#64748b",
        panel: "#f6f8fc",
        line: "#e6ebf2",
        brand: {
          DEFAULT: "#4f46e5",
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81"
        },
        accent: {
          DEFAULT: "#06b6d4",
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2"
        },
        mint: "#0f9f6e",
        amber: "#b7791f"
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #6366f1 0%, #8b5cf6 45%, #06b6d4 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.10) 50%, rgba(6,182,212,0.10) 100%)",
        "panel-gradient":
          "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(246,248,252,1) 100%)",
        "panel-gradient-dark":
          "linear-gradient(180deg, rgba(15,23,42,0.95) 0%, rgba(2,6,23,1) 100%)",
        "grid-light":
          "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.06) 1px, transparent 0)",
        "grid-dark":
          "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.10) 1px, transparent 0)"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 28px rgba(15, 23, 42, 0.06)",
        lifted:
          "0 1px 2px rgba(15, 23, 42, 0.04), 0 24px 48px -16px rgba(79, 70, 229, 0.18)",
        ring: "0 0 0 1px rgba(99,102,241,0.18), 0 12px 32px rgba(99,102,241,0.18)",
        glow: "0 0 0 1px rgba(99,102,241,0.35), 0 0 36px rgba(99,102,241,0.35)"
      },
      borderRadius: {
        xl: "0.85rem",
        "2xl": "1.1rem",
        "3xl": "1.5rem"
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        "ping-slow": {
          "0%": { transform: "scale(1)", opacity: "0.7" },
          "75%, 100%": { transform: "scale(1.6)", opacity: "0" }
        }
      },
      animation: {
        "fade-in": "fade-in 240ms ease-out both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        "ping-slow": "ping-slow 1.8s cubic-bezier(0,0,0.2,1) infinite"
      }
    }
  },
  plugins: []
} satisfies Config;
