import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Large, readable fonts for student accessibility
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        saffron: "#FF9933",
        india: {
          green: "#138808",
          blue: "#000080",
        },
      },
    },
  },
  plugins: [],
};
export default config;

