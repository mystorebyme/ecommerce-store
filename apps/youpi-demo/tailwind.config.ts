import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0C1116",
          soft: "#1A222B",
          mute: "#4A5560",
        },
        paper: {
          DEFAULT: "#F7F4EE",
          deep: "#EFEAE1",
        },
        line: {
          DEFAULT: "#E2DCD1",
          strong: "#CFC7B8",
        },
        brand: {
          DEFAULT: "#0B5E4F",
          strong: "#073F35",
          soft: "#E4F1ED",
        },
        accent: {
          DEFAULT: "#D98A16",
          soft: "#FBF0DC",
        },
        ok: "#17795A",
        bad: "#B3322A",
        warn: "#A86413",
        info: "#28598C",
      },
      fontFamily: {
        display: ["Sora", "var(--font-display)", "system-ui", "sans-serif"],
        sans: ["DM Sans", "var(--font-body)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        ledger: "0 1px 0 0 rgba(12,17,22,0.04), 0 12px 32px -18px rgba(12,17,22,0.35)",
        card: "0 1px 0 0 rgba(12,17,22,0.05)",
        pop: "4px 4px 0 0 rgba(12,17,22,0.9)",
      },
      borderRadius: {
        xl2: "18px",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.85)", opacity: "0.9" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        sheen: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
      },
      animation: {
        rise: "rise 0.45s cubic-bezier(0.22,1,0.36,1) both",
        pulseRing: "pulseRing 1.8s ease-out infinite",
        sheen: "sheen 2.4s linear infinite",
        blink: "blink 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
