import tailwindcssPreset from "@tailwindcss/preset";

export default {
  presets: [tailwindcssPreset()],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
