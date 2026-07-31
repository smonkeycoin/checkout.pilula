import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        pilula: {
          black: "#080808",
          charcoal: "#171717",
          burgundy: "#660033",
          gold: "#C4A64A",
          ivory: "#F8F4EA",
          white: "#FFFFFF"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        gold: "0 0 0 1px rgba(196, 166, 74, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
