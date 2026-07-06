import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  MFA_SECRET_KEY: z.string().min(32),
  CORS_ALLOWED_ORIGINS: z.string().min(1),
  TRUST_PROXY: z.coerce.boolean().default(false),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  AI_SERVICE_URL: z.string().url(),
  AI_SERVICE_TOKEN: z.string().min(16),
  AI_OPERATION_COST_LIMIT_MINOR: z.coerce.number().int().min(0).default(50_000),
  AI_DAILY_ACTOR_COST_LIMIT_MINOR: z.coerce.number().int().min(0).default(500_000),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  STORE_NAME: z.string().min(1).default("CloudCommerce"),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  ENGAGEMENT_OUTREACH_COOLDOWN_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  STORAGE_LOCAL_ROOT: z.string().min(1).default(".cloudcommerce-media"),
  MEDIA_MAX_FILE_BYTES: z.coerce.number().int().min(1_024).max(25 * 1024 * 1024).default(5 * 1024 * 1024),
  MEDIA_MAX_REQUEST_BYTES: z.coerce.number().int().min(1_024).max(50 * 1024 * 1024).default(30 * 1024 * 1024),
  OWNER_EMAIL: z.string().email().optional(),
  OWNER_PASSWORD: z.string().min(12).optional(),
});

export type AppConfig = z.infer<typeof envSchema> & {
  corsAllowedOrigins: string[];
  secureCookies: boolean;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const parsed = envSchema.parse(env);
  return {
    ...parsed,
    corsAllowedOrigins: parsed.CORS_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    secureCookies: parsed.NODE_ENV !== "development" && parsed.NODE_ENV !== "test",
  };
};
