// Tailwind CSS v4 wiring. The PostCSS plugin is the dedicated
// `@tailwindcss/postcss` package — NOT `tailwindcss`, and v4 bundles
// autoprefixing so no `autoprefixer` entry is needed.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
