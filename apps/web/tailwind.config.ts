import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0a0e14",
        foreground: "#e6e6e6",
        accent: "#22d3ee",
      },
    },
  },
  plugins: [],
};

export default config;
