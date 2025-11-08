export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "rgba(255, 255, 255, 0.1)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      typography: {
        invert: {
          css: {
            "--tw-prose-body": "rgba(255, 255, 255, 0.9)",
            "--tw-prose-headings": "white",
            "--tw-prose-links": "#a78bfa",
            "--tw-prose-bold": "white",
            "--tw-prose-code": "white",
            "--tw-prose-quotes": "rgba(255, 255, 255, 0.7)",
          },
        },
      },
    },
  },
  plugins: [],
};