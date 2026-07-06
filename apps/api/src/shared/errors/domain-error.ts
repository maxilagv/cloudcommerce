export type IdentityDomainError =
  | { type: "INVALID_CREDENTIALS" }
  | { type: "MFA_REQUIRED" }
  | { type: "INVALID_MFA_CODE" }
  | { type: "SESSION_NOT_FOUND" }
  | { type: "REFRESH_REUSE_DETECTED" }
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "RATE_LIMITED"; retryAfterSeconds: number }
  | { type: "USER_ALREADY_EXISTS" }
  | { type: "USER_NOT_FOUND" }
  | { type: "INVALID_RESET_TOKEN" }
  | { type: "INACTIVE_USER" }
  | { type: "OWNER_ROLE_IMMUTABLE" };

export type CatalogDomainError =
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "CATEGORY_NOT_FOUND" }
  | { type: "CATEGORY_TREE_INVALID" }
  | { type: "BRAND_NOT_FOUND" }
  | { type: "PRODUCT_NOT_FOUND" }
  | { type: "PRODUCT_SLUG_CONFLICT" }
  | { type: "PRODUCT_STATUS_TRANSITION_INVALID" }
  | { type: "PRODUCT_NOT_PUBLISHABLE"; failures: string[] }
  | { type: "PRODUCT_MEDIA_CARDINALITY_INVALID" }
  | { type: "MEDIA_NOT_FOUND" };

export type MediaDomainError =
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "MEDIA_NOT_FOUND" }
  | { type: "MEDIA_UPLOAD_INVALID"; reason: string }
  | { type: "MEDIA_NOT_READY" };

export type PricingDomainError =
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "VARIANT_NOT_FOUND" }
  | { type: "PRICE_CHANGED" }
  | { type: "MARGIN_BELOW_MINIMUM"; minMarginBps: number }
  | { type: "NO_SUPPLIER_COST" }
  | { type: "CURRENCY_MISMATCH" }
  | { type: "DISCOUNT_INVALID" }
  | { type: "DISCOUNT_EXHAUSTED" }
  | { type: "NO_ACTIVE_MARKUP_RULE" }
  | { type: "PRICE_POLICY_VIOLATION" };

export type InventoryDomainError =
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "VARIANT_NOT_FOUND" }
  | { type: "STOCK_ITEM_NOT_FOUND" }
  | { type: "RESERVATION_NOT_FOUND" }
  | { type: "INSUFFICIENT_STOCK"; variantId: string }
  | { type: "STOCK_ADJUSTMENT_REASON_REQUIRED" };

export type CustomerDomainError =
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "CUSTOMER_NOT_FOUND" }
  | { type: "ADDRESS_NOT_FOUND" }
  | { type: "DUPLICATE_CUSTOMER_EMAIL" }
  | { type: "SENSITIVE_REASON_REQUIRED" }
  | { type: "PRIMARY_ADDRESS_REQUIRED" }
  | { type: "CUSTOMER_ALREADY_DELETED" }
  | { type: "UPSTREAM_UNAVAILABLE" };

export type OrderDomainError =
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "ORDER_NOT_FOUND" }
  | { type: "CUSTOMER_NOT_FOUND" }
  | { type: "PRODUCT_NOT_AVAILABLE"; variantId: string }
  | { type: "PRICING_UNAVAILABLE"; variantId: string }
  | { type: "INSUFFICIENT_STOCK"; variantId: string }
  | { type: "ADDRESS_NOT_DELIVERABLE" }
  | { type: "INVALID_ORDER_STATE" }
  | { type: "TRANSITION_REASON_REQUIRED" }
  | { type: "IDEMPOTENCY_CONFLICT" }
  | { type: "SHIPMENT_NOT_FOUND" }
  | { type: "SHIPMENT_TRACKING_UNAVAILABLE" }
  | { type: "SENSITIVE_REASON_REQUIRED" };

export type FinanceDomainError =
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "DOCUMENT_NOT_FOUND" }
  | { type: "ORDER_NOT_FOUND" }
  | { type: "INVALID_ORDER_STATE" }
  | { type: "DOCUMENT_ALREADY_ISSUED" }
  | { type: "DOCUMENT_NOT_READY" }
  | { type: "IDEMPOTENCY_CONFLICT" }
  | { type: "SENSITIVE_REASON_REQUIRED" }
  | { type: "UPSTREAM_UNAVAILABLE" };

export type DashboardDomainError =
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "UPSTREAM_UNAVAILABLE" };

export type SupplierDomainError =
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "SUPPLIER_NOT_FOUND" }
  | { type: "FEED_NOT_FOUND" }
  | { type: "MAP_NOT_FOUND" }
  | { type: "ORDER_NOT_FOUND" }
  | { type: "ORDER_REF_NOT_FOUND" }
  | { type: "SLUG_CONFLICT" }
  | { type: "SSRF_BLOCKED"; reason: string }
  | { type: "FEED_SOURCE_REQUIRED" }
  | { type: "FEED_RUN_IN_PROGRESS" }
  | { type: "SUPPLIER_INACTIVE" }
  | { type: "SUPPLIER_API_NOT_CONFIGURED" }
  | { type: "VARIANT_ALREADY_MAPPED" }
  | { type: "FORWARD_ALREADY_SENT" }
  | { type: "SUPPLIER_REJECTED"; reason: string }
  | { type: "WEBHOOK_SIGNATURE_INVALID" }
  | { type: "WEBHOOK_REPLAYED" }
  | { type: "WEBHOOK_PAYLOAD_INVALID" }
  | { type: "WEBHOOK_UNMATCHED" }
  | { type: "UPSTREAM_UNAVAILABLE" };

export type AiDomainError =
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "TARGET_NOT_FOUND" }
  | { type: "GENERATION_NOT_FOUND" }
  | { type: "ALERT_NOT_FOUND" }
  | { type: "RATE_LIMITED"; retryAfterSeconds: number }
  | { type: "AI_QUOTA_EXCEEDED" }
  | { type: "AI_UPSTREAM_UNAVAILABLE" }
  | { type: "AI_RESPONSE_INVALID" }
  | { type: "AI_CONTENT_REJECTED" }
  | { type: "IMAGE_SOURCE_REQUIRED" };

export type StorefrontDomainError =
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "INVALID_CREDENTIALS" }
  | { type: "EMAIL_IN_USE" }
  | { type: "ACCOUNT_INACTIVE" }
  | { type: "ORDER_NOT_FOUND" }
  | { type: "ADDRESS_REQUIRED" }
  | { type: "PRODUCT_NOT_AVAILABLE"; productId: string }
  | { type: "PRICING_UNAVAILABLE"; productId: string }
  | { type: "INSUFFICIENT_STOCK"; productId: string }
  | { type: "IDEMPOTENCY_CONFLICT" };

export type LoyaltyDomainError =
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "PROGRAM_DISABLED" }
  | { type: "REWARD_NOT_FOUND" }
  | { type: "REWARD_NOT_AVAILABLE" }
  | { type: "OUT_OF_STOCK" }
  | { type: "INSUFFICIENT_POINTS"; balance: number }
  | { type: "REDEMPTION_NOT_FOUND" }
  | { type: "REDEMPTION_INVALID_STATE" }
  | { type: "CUSTOMER_NOT_FOUND" }
  | { type: "MEMBERSHIP_NOT_FOUND" };

export type EngagementDomainError =
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "CUSTOMER_NOT_FOUND" }
  | { type: "PROFILE_NOT_FOUND" }
  | { type: "CONVERSATION_NOT_FOUND" }
  | { type: "WHATSAPP_NOT_AVAILABLE" }
  | { type: "NO_CONSENT" }
  | { type: "AI_UPSTREAM_UNAVAILABLE" }
  | { type: "AI_RESPONSE_INVALID" };

export type SettingsDomainError =
  | { type: "UNAUTHENTICATED" }
  | { type: "FORBIDDEN" }
  | { type: "SETTING_NOT_FOUND" }
  | { type: "ADMIN_USER_NOT_FOUND" }
  | { type: "FEATURE_FLAG_NOT_FOUND" }
  | { type: "CONFIG_SECRET_MISSING"; provider: string }
  | { type: "SETTING_SECRET_NOT_ALLOWED" }
  | { type: "SETTINGS_INVARIANT_VIOLATION"; reason: string }
  | { type: "UPSTREAM_UNAVAILABLE" };
