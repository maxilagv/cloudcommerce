import type { ApiErrorCode } from "@cloudcommerce/types";

export class AppError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;
  public readonly details: Array<{ path: string; message: string; code: string }> | undefined;

  public constructor(input: {
    code: ApiErrorCode;
    status: number;
    message: string;
    details?: Array<{ path: string; message: string; code: string }>;
  }) {
    super(input.message);
    this.name = "AppError";
    this.code = input.code;
    this.status = input.status;
    this.details = input.details;
  }
}

export const errorTitles: Record<ApiErrorCode, string> = {
  VALIDATION_FAILED: "Validation failed",
  UNAUTHENTICATED: "Unauthenticated",
  FORBIDDEN: "Forbidden",
  RESOURCE_NOT_FOUND: "Resource not found",
  CONFLICT: "Conflict",
  IDEMPOTENCY_CONFLICT: "Idempotency conflict",
  RATE_LIMITED: "Rate limited",
  UPSTREAM_UNAVAILABLE: "Upstream unavailable",
  INTERNAL_ERROR: "Internal error",
  PRODUCT_NOT_PUBLISHABLE: "Product not publishable",
  PRODUCT_STATUS_TRANSITION_INVALID: "Invalid product status transition",
  CATEGORY_TREE_INVALID: "Invalid category tree",
  MEDIA_UPLOAD_INVALID: "Invalid media upload",
  MEDIA_CARDINALITY_INVALID: "Invalid media cardinality",
  MEDIA_NOT_READY: "Media not ready",
  INSUFFICIENT_STOCK: "Insufficient stock",
  PRICE_CHANGED: "Price changed",
  MARGIN_BELOW_MINIMUM: "Margin below minimum",
  NO_SUPPLIER_COST: "No supplier cost",
  CURRENCY_MISMATCH: "Currency mismatch",
  DISCOUNT_INVALID: "Invalid discount",
  DISCOUNT_EXHAUSTED: "Discount exhausted",
  NO_ACTIVE_MARKUP_RULE: "No active markup rule",
  PRICE_POLICY_VIOLATION: "Price policy violation",
  INVALID_ORDER_STATE: "Invalid order state",
  PRODUCT_NOT_AVAILABLE: "Product not available",
  ADDRESS_NOT_DELIVERABLE: "Address not deliverable",
  SHIPMENT_TRACKING_UNAVAILABLE: "Shipment tracking unavailable",
  DOCUMENT_NOT_READY: "Document not ready",
  DOCUMENT_ALREADY_ISSUED: "Document already issued",
  CONFIG_SECRET_MISSING: "Configuration secret missing",
  AI_QUOTA_EXCEEDED: "AI quota exceeded",
  AI_RESPONSE_INVALID: "AI response invalid",
  AI_CONTENT_REJECTED: "AI content rejected",
  IMAGE_SOURCE_REQUIRED: "Image source required",
  SUPPLIER_REJECTED: "Supplier rejected the order",
  SSRF_BLOCKED: "URL not allowed",
  FEED_RUN_IN_PROGRESS: "Feed run already in progress",
  WEBHOOK_SIGNATURE_INVALID: "Webhook signature invalid",
};
