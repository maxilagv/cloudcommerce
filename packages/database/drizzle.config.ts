import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://cloudcommerce:cloudcommerce@localhost:5432/cloudcommerce",
  },
  strict: true,
  verbose: true,
});
