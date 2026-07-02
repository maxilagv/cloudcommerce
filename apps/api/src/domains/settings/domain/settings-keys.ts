import type { SettingKey, SettingScope } from "@cloudcommerce/types";

export const knownSettingKeys = [
  "store.identity",
  "store.currency",
  "store.billing",
  "store.legal.terms",
  "store.legal.privacy",
  "store.social",
  "shipping.options",
  "shipping.coverage",
  "payments.methods",
  "checkout.policy",
] as const satisfies readonly SettingKey[];

export const publicSettingKeys = new Set<SettingKey>([
  "store.identity",
  "store.currency",
  "store.legal.terms",
  "store.legal.privacy",
  "store.social",
  "shipping.options",
  "shipping.coverage",
]);

export const ownerOnlySettingKeys = new Set<SettingKey>(["store.currency", "store.billing"]);

export const settingScopeForKey = (key: SettingKey): SettingScope => publicSettingKeys.has(key) ? "public" : "business";

export const isOwnerOnlySettingKey = (key: SettingKey): boolean => ownerOnlySettingKeys.has(key);

export const secretLikeFieldNames = new Set(["secret", "token", "password", "apiKey", "accessToken", "webhookSecret"]);
