// Tailwind CSS v4 wiring (mirrors apps/store). The PostCSS plugin is the
// dedicated `@tailwindcss/postcss` package; v4 bundles autoprefixing.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
