import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

const baseEnv = {
  NODE_ENV: "production",
  PORT: "4000",
  HOST: "0.0.0.0",
  DATABASE_URL: "postgres://cloudcommerce:cloudcommerce@localhost:5432/cloudcommerce",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_SECRET: "change-me-change-me-change-me-change-me",
  COOKIE_SECRET: "change-me-cookie-secret-change-me-cookie",
  MFA_SECRET_KEY: "change-me-mfa-secret-change-me-mfa-secret",
  CORS_ALLOWED_ORIGINS: "http://localhost:3000",
  LOG_LEVEL: "info",
  AI_SERVICE_URL: "http://localhost:8000",
  AI_SERVICE_TOKEN: "local-ai-token-change-me",
  STRIPE_SECRET_KEY: "sk_test_change_me",
  STRIPE_WEBHOOK_SECRET: "whsec_change_me",
  RESEND_API_KEY: "re_change_me",
};

describe("loadConfig", () => {
  it("fails fast when NODE_ENV is missing", () => {
    const { NODE_ENV: _nodeEnv, ...env } = baseEnv;
    expect(() => loadConfig(env)).toThrow();
  });

  it("fails fast when MFA_SECRET_KEY is missing", () => {
    const { MFA_SECRET_KEY: _mfaSecretKey, ...env } = baseEnv;
    expect(() => loadConfig(env)).toThrow();
  });

  it("requires explicit production mode before enabling secure cookies", () => {
    expect(loadConfig(baseEnv).secureCookies).toBe(true);
    expect(loadConfig({ ...baseEnv, NODE_ENV: "test" }).secureCookies).toBe(false);
  });
});
