import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#080b0f",
        foreground: "#eef2f7",
        panel: "#10161f",
        border: "#243140",
        muted: "#8ea0b5",
        accent: "#2dd4bf"
      }
    }
  },
  plugins: []
}

export default config
