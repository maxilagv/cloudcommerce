import { TRPCError } from "@trpc/server";
import { AppError } from "./app-error.js";
import type {
  AiDomainError,
  CatalogDomainError,
  CustomerDomainError,
  DashboardDomainError,
  FinanceDomainError,
  IdentityDomainError,
  InventoryDomainError,
  MediaDomainError,
  OrderDomainError,
  PricingDomainError,
  SettingsDomainError,
  SupplierDomainError,
} from "./domain-error.js";

export const identityErrorToAppError = (error: IdentityDomainError): AppError => {
  switch (error.type) {
    case "INVALID_CREDENTIALS":
    case "INVALID_MFA_CODE":
    case "INVALID_RESET_TOKEN":
    case "USER_NOT_FOUND":
    case "SESSION_NOT_FOUND":
      return new AppError({ code: "UNAUTHENTICATED", status: 401, message: "No pudimos autenticar la solicitud." });
    case "MFA_REQUIRED":
      return new AppError({ code: "CONFLICT", status: 409, message: "Se requiere verificacion MFA." });
    case "UNAUTHENTICATED":
      return new AppError({ code: "UNAUTHENTICATED", status: 401, message: "Necesitas iniciar sesion." });
    case "FORBIDDEN":
    case "OWNER_ROLE_IMMUTABLE":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "No tenes permiso para realizar esta accion." });
    case "RATE_LIMITED":
      return new AppError({ code: "RATE_LIMITED", status: 429, message: "Demasiados intentos. Proba mas tarde." });
    case "USER_ALREADY_EXISTS":
      return new AppError({ code: "CONFLICT", status: 409, message: "No pudimos completar la operacion porque el recurso ya existe." });
    case "INACTIVE_USER":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "El usuario no esta activo." });
    case "REFRESH_REUSE_DETECTED":
      return new AppError({ code: "UNAUTHENTICATED", status: 401, message: "La sesion fue revocada por seguridad." });
  }
};

export const catalogErrorToAppError = (error: CatalogDomainError): AppError => {
  switch (error.type) {
    case "UNAUTHENTICATED":
      return new AppError({ code: "UNAUTHENTICATED", status: 401, message: "Necesitas iniciar sesion." });
    case "FORBIDDEN":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "No tenes permiso para realizar esta accion." });
    case "CATEGORY_NOT_FOUND":
    case "BRAND_NOT_FOUND":
    case "PRODUCT_NOT_FOUND":
    case "MEDIA_NOT_FOUND":
      return new AppError({ code: "RESOURCE_NOT_FOUND", status: 404, message: "No encontramos el recurso solicitado." });
    case "PRODUCT_SLUG_CONFLICT":
      return new AppError({ code: "CONFLICT", status: 409, message: "El slug ya esta en uso." });
    case "CATEGORY_TREE_INVALID":
      return new AppError({ code: "CATEGORY_TREE_INVALID", status: 409, message: "La jerarquia de categorias no es valida." });
    case "PRODUCT_STATUS_TRANSITION_INVALID":
      return new AppError({ code: "PRODUCT_STATUS_TRANSITION_INVALID", status: 409, message: "La transicion de estado no esta permitida." });
    case "PRODUCT_NOT_PUBLISHABLE":
      return new AppError({
        code: "PRODUCT_NOT_PUBLISHABLE",
        status: 409,
        message: `El producto no cumple los requisitos de publicacion: ${error.failures.join(", ")}.`,
      });
    case "PRODUCT_MEDIA_CARDINALITY_INVALID":
      return new AppError({ code: "MEDIA_CARDINALITY_INVALID", status: 409, message: "Un producto debe tener entre 1 y 6 imagenes." });
  }
};

export const mediaErrorToAppError = (error: MediaDomainError): AppError => {
  switch (error.type) {
    case "UNAUTHENTICATED":
      return new AppError({ code: "UNAUTHENTICATED", status: 401, message: "Necesitas iniciar sesion." });
    case "FORBIDDEN":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "No tenes permiso para realizar esta accion." });
    case "MEDIA_NOT_FOUND":
      return new AppError({ code: "RESOURCE_NOT_FOUND", status: 404, message: "No encontramos el archivo solicitado." });
    case "MEDIA_UPLOAD_INVALID":
      return new AppError({ code: "MEDIA_UPLOAD_INVALID", status: 400, message: error.reason });
    case "MEDIA_NOT_READY":
      return new AppError({ code: "MEDIA_NOT_READY", status: 409, message: "El archivo todavia no esta listo." });
  }
};

export const pricingErrorToAppError = (error: PricingDomainError): AppError => {
  switch (error.type) {
    case "UNAUTHENTICATED":
      return new AppError({ code: "UNAUTHENTICATED", status: 401, message: "Necesitas iniciar sesion." });
    case "FORBIDDEN":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "No tenes permiso para ver o modificar precios." });
    case "VARIANT_NOT_FOUND":
      return new AppError({ code: "RESOURCE_NOT_FOUND", status: 404, message: "No encontramos la variante solicitada." });
    case "PRICE_CHANGED":
      return new AppError({ code: "PRICE_CHANGED", status: 409, message: "El precio cambio. Recalculalo antes de continuar." });
    case "MARGIN_BELOW_MINIMUM":
      return new AppError({ code: "MARGIN_BELOW_MINIMUM", status: 422, message: "El precio viola el margen minimo configurado." });
    case "NO_SUPPLIER_COST":
      return new AppError({ code: "NO_SUPPLIER_COST", status: 409, message: "La variante no tiene costo proveedor vigente." });
    case "CURRENCY_MISMATCH":
      return new AppError({ code: "CURRENCY_MISMATCH", status: 409, message: "La moneda no coincide con la lista de precios." });
    case "DISCOUNT_INVALID":
      return new AppError({ code: "DISCOUNT_INVALID", status: 422, message: "El descuento no es valido." });
    case "DISCOUNT_EXHAUSTED":
      return new AppError({ code: "DISCOUNT_EXHAUSTED", status: 409, message: "El descuento ya no tiene usos disponibles." });
    case "NO_ACTIVE_MARKUP_RULE":
      return new AppError({ code: "NO_ACTIVE_MARKUP_RULE", status: 409, message: "No hay regla de markup vigente para la variante." });
    case "PRICE_POLICY_VIOLATION":
      return new AppError({ code: "PRICE_POLICY_VIOLATION", status: 422, message: "La politica de precios no permite esta operacion." });
  }
};

export const inventoryErrorToAppError = (error: InventoryDomainError): AppError => {
  switch (error.type) {
    case "UNAUTHENTICATED":
      return new AppError({ code: "UNAUTHENTICATED", status: 401, message: "Necesitas iniciar sesion." });
    case "FORBIDDEN":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "No tenes permiso para modificar inventario." });
    case "VARIANT_NOT_FOUND":
    case "STOCK_ITEM_NOT_FOUND":
    case "RESERVATION_NOT_FOUND":
      return new AppError({ code: "RESOURCE_NOT_FOUND", status: 404, message: "No encontramos el recurso solicitado." });
    case "INSUFFICIENT_STOCK":
      return new AppError({ code: "INSUFFICIENT_STOCK", status: 409, message: "No hay stock suficiente para completar la operacion." });
    case "STOCK_ADJUSTMENT_REASON_REQUIRED":
      return new AppError({ code: "VALIDATION_FAILED", status: 400, message: "El ajuste de stock requiere motivo." });
  }
};

export const customerErrorToAppError = (error: CustomerDomainError): AppError => {
  switch (error.type) {
    case "UNAUTHENTICATED":
      return new AppError({ code: "UNAUTHENTICATED", status: 401, message: "Necesitas iniciar sesion." });
    case "FORBIDDEN":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "No tenes permiso para operar sobre clientes." });
    case "CUSTOMER_NOT_FOUND":
    case "ADDRESS_NOT_FOUND":
      return new AppError({ code: "RESOURCE_NOT_FOUND", status: 404, message: "No encontramos el recurso solicitado." });
    case "DUPLICATE_CUSTOMER_EMAIL":
      return new AppError({ code: "CONFLICT", status: 409, message: "Ya existe un cliente activo con ese email." });
    case "SENSITIVE_REASON_REQUIRED":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "El acceso a datos sensibles requiere motivo." });
    case "PRIMARY_ADDRESS_REQUIRED":
      return new AppError({ code: "CONFLICT", status: 409, message: "El cliente debe conservar una direccion primaria." });
    case "CUSTOMER_ALREADY_DELETED":
      return new AppError({ code: "CONFLICT", status: 409, message: "El cliente ya fue desactivado." });
    case "UPSTREAM_UNAVAILABLE":
      return new AppError({ code: "UPSTREAM_UNAVAILABLE", status: 503, message: "No pudimos obtener analytics del cliente." });
  }
};

export const orderErrorToAppError = (error: OrderDomainError): AppError => {
  switch (error.type) {
    case "UNAUTHENTICATED":
      return new AppError({ code: "UNAUTHENTICATED", status: 401, message: "Necesitas iniciar sesion." });
    case "FORBIDDEN":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "No tenes permiso para operar sobre pedidos." });
    case "SENSITIVE_REASON_REQUIRED":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "El acceso a datos sensibles del pedido requiere motivo." });
    case "ORDER_NOT_FOUND":
    case "CUSTOMER_NOT_FOUND":
    case "SHIPMENT_NOT_FOUND":
      return new AppError({ code: "RESOURCE_NOT_FOUND", status: 404, message: "No encontramos el recurso solicitado." });
    case "PRODUCT_NOT_AVAILABLE":
      return new AppError({
        code: "PRODUCT_NOT_AVAILABLE",
        status: 409,
        message: "Uno de los productos ya no esta disponible para la venta.",
      });
    case "PRICING_UNAVAILABLE":
      return new AppError({
        code: "PRODUCT_NOT_AVAILABLE",
        status: 409,
        message: "No hay un precio vigente para uno de los productos.",
      });
    case "INSUFFICIENT_STOCK":
      return new AppError({ code: "INSUFFICIENT_STOCK", status: 409, message: "No hay stock suficiente para completar el pedido." });
    case "ADDRESS_NOT_DELIVERABLE":
      return new AppError({ code: "ADDRESS_NOT_DELIVERABLE", status: 422, message: "La direccion de envio no es valida o no es entregable." });
    case "INVALID_ORDER_STATE":
      return new AppError({ code: "INVALID_ORDER_STATE", status: 409, message: "La transicion de estado no esta permitida." });
    case "TRANSITION_REASON_REQUIRED":
      return new AppError({ code: "VALIDATION_FAILED", status: 400, message: "Esta transicion requiere un motivo." });
    case "IDEMPOTENCY_CONFLICT":
      return new AppError({ code: "IDEMPOTENCY_CONFLICT", status: 409, message: "La operacion se repitio con datos distintos." });
    case "SHIPMENT_TRACKING_UNAVAILABLE":
      return new AppError({
        code: "SHIPMENT_TRACKING_UNAVAILABLE",
        status: 503,
        message: "El seguimiento del envio no esta disponible por ahora.",
      });
  }
};

export const financeErrorToAppError = (error: FinanceDomainError): AppError => {
  switch (error.type) {
    case "UNAUTHENTICATED":
      return new AppError({ code: "UNAUTHENTICATED", status: 401, message: "Necesitas iniciar sesion." });
    case "FORBIDDEN":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "No tenes permiso para ver o emitir documentos financieros." });
    case "SENSITIVE_REASON_REQUIRED":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "El acceso a este documento requiere motivo." });
    case "DOCUMENT_NOT_FOUND":
    case "ORDER_NOT_FOUND":
      return new AppError({ code: "RESOURCE_NOT_FOUND", status: 404, message: "No encontramos el recurso solicitado." });
    case "INVALID_ORDER_STATE":
      return new AppError({ code: "INVALID_ORDER_STATE", status: 409, message: "No se puede emitir un documento para este pedido." });
    case "DOCUMENT_ALREADY_ISSUED":
      return new AppError({ code: "DOCUMENT_ALREADY_ISSUED", status: 409, message: "Ya existe un documento emitido de ese tipo para el pedido." });
    case "DOCUMENT_NOT_READY":
      return new AppError({ code: "DOCUMENT_NOT_READY", status: 409, message: "El documento todavia se esta generando." });
    case "IDEMPOTENCY_CONFLICT":
      return new AppError({ code: "IDEMPOTENCY_CONFLICT", status: 409, message: "La operacion se repitio con datos distintos." });
    case "UPSTREAM_UNAVAILABLE":
      return new AppError({ code: "UPSTREAM_UNAVAILABLE", status: 503, message: "No pudimos generar o almacenar el documento." });
  }
};

export const dashboardErrorToAppError = (error: DashboardDomainError): AppError => {
  switch (error.type) {
    case "UNAUTHENTICATED":
      return new AppError({ code: "UNAUTHENTICATED", status: 401, message: "Necesitas iniciar sesion." });
    case "FORBIDDEN":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "No tenes permiso para ver este dashboard." });
    case "UPSTREAM_UNAVAILABLE":
      return new AppError({ code: "UPSTREAM_UNAVAILABLE", status: 503, message: "No pudimos cargar los datos del dashboard." });
  }
};

export const settingsErrorToAppError = (error: SettingsDomainError): AppError => {
  switch (error.type) {
    case "UNAUTHENTICATED":
      return new AppError({ code: "UNAUTHENTICATED", status: 401, message: "Necesitas iniciar sesion." });
    case "FORBIDDEN":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "No tenes permiso para gestionar configuracion." });
    case "SETTING_NOT_FOUND":
    case "ADMIN_USER_NOT_FOUND":
    case "FEATURE_FLAG_NOT_FOUND":
      return new AppError({ code: "RESOURCE_NOT_FOUND", status: 404, message: "No encontramos el recurso solicitado." });
    case "CONFIG_SECRET_MISSING":
      return new AppError({
        code: "CONFIG_SECRET_MISSING",
        status: 422,
        message: `Falta configurar el secreto requerido para ${error.provider}.`,
      });
    case "SETTING_SECRET_NOT_ALLOWED":
      return new AppError({ code: "VALIDATION_FAILED", status: 400, message: "Los secretos no pueden guardarse como configuracion." });
    case "SETTINGS_INVARIANT_VIOLATION":
      return new AppError({ code: "CONFLICT", status: 409, message: error.reason });
    case "UPSTREAM_UNAVAILABLE":
      return new AppError({ code: "UPSTREAM_UNAVAILABLE", status: 503, message: "No pudimos aplicar la configuracion." });
  }
};

export const supplierErrorToAppError = (error: SupplierDomainError): AppError => {
  switch (error.type) {
    case "UNAUTHENTICATED":
      return new AppError({ code: "UNAUTHENTICATED", status: 401, message: "Necesitas iniciar sesion." });
    case "FORBIDDEN":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "No tenes permiso para gestionar proveedores." });
    case "SUPPLIER_NOT_FOUND":
    case "FEED_NOT_FOUND":
    case "MAP_NOT_FOUND":
    case "ORDER_NOT_FOUND":
    case "ORDER_REF_NOT_FOUND":
      return new AppError({ code: "RESOURCE_NOT_FOUND", status: 404, message: "No encontramos el recurso solicitado." });
    case "SLUG_CONFLICT":
      return new AppError({ code: "CONFLICT", status: 409, message: "El slug del proveedor ya esta en uso." });
    case "SSRF_BLOCKED":
      return new AppError({ code: "SSRF_BLOCKED", status: 400, message: `La URL no esta permitida: ${error.reason}.` });
    case "FEED_SOURCE_REQUIRED":
      return new AppError({ code: "VALIDATION_FAILED", status: 400, message: "El feed requiere una URL de origen." });
    case "FEED_RUN_IN_PROGRESS":
      return new AppError({ code: "FEED_RUN_IN_PROGRESS", status: 409, message: "Ya hay una corrida en curso para este feed." });
    case "SUPPLIER_INACTIVE":
      return new AppError({ code: "CONFLICT", status: 409, message: "El proveedor esta inactivo." });
    case "SUPPLIER_API_NOT_CONFIGURED":
      return new AppError({ code: "CONFLICT", status: 409, message: "El proveedor no tiene API configurada." });
    case "VARIANT_ALREADY_MAPPED":
      return new AppError({ code: "CONFLICT", status: 409, message: "La variante ya esta mapeada a otro producto del proveedor." });
    case "FORWARD_ALREADY_SENT":
      return new AppError({ code: "CONFLICT", status: 409, message: "El pedido ya fue reenviado a este proveedor." });
    case "SUPPLIER_REJECTED":
      return new AppError({ code: "SUPPLIER_REJECTED", status: 409, message: "El proveedor rechazo el pedido." });
    case "WEBHOOK_SIGNATURE_INVALID":
      return new AppError({ code: "WEBHOOK_SIGNATURE_INVALID", status: 401, message: "Firma de webhook invalida." });
    case "WEBHOOK_REPLAYED":
      return new AppError({ code: "CONFLICT", status: 409, message: "Evento fuera de la ventana de tiempo permitida." });
    case "WEBHOOK_PAYLOAD_INVALID":
      return new AppError({ code: "VALIDATION_FAILED", status: 422, message: "El payload del webhook no es valido." });
    case "WEBHOOK_UNMATCHED":
      return new AppError({ code: "RESOURCE_NOT_FOUND", status: 404, message: "El evento no corresponde a ninguna orden conocida." });
    case "UPSTREAM_UNAVAILABLE":
      return new AppError({ code: "UPSTREAM_UNAVAILABLE", status: 503, message: "El proveedor no esta disponible. Reintenta mas tarde." });
  }
};

export const aiErrorToAppError = (error: AiDomainError): AppError => {
  switch (error.type) {
    case "UNAUTHENTICATED":
      return new AppError({ code: "UNAUTHENTICATED", status: 401, message: "Necesitas iniciar sesion." });
    case "FORBIDDEN":
      return new AppError({ code: "FORBIDDEN", status: 403, message: "No tenes permiso para usar herramientas de IA." });
    case "TARGET_NOT_FOUND":
    case "GENERATION_NOT_FOUND":
    case "ALERT_NOT_FOUND":
      return new AppError({ code: "RESOURCE_NOT_FOUND", status: 404, message: "No encontramos el recurso solicitado." });
    case "RATE_LIMITED":
      return new AppError({ code: "RATE_LIMITED", status: 429, message: "Demasiadas solicitudes de IA. Proba mas tarde." });
    case "AI_QUOTA_EXCEEDED":
      return new AppError({ code: "AI_QUOTA_EXCEEDED", status: 429, message: "Se supero el presupuesto de IA disponible." });
    case "AI_UPSTREAM_UNAVAILABLE":
      return new AppError({ code: "UPSTREAM_UNAVAILABLE", status: 503, message: "El servicio de IA no esta disponible. Reintenta mas tarde." });
    case "AI_RESPONSE_INVALID":
      return new AppError({ code: "AI_RESPONSE_INVALID", status: 502, message: "La respuesta del servicio de IA no es valida." });
    case "AI_CONTENT_REJECTED":
      return new AppError({ code: "AI_CONTENT_REJECTED", status: 422, message: "El contenido generado no cumple las reglas de la tienda." });
  }
};

export const appErrorToTrpcError = (error: AppError): TRPCError => {
  const code =
    error.status === 400
      ? "BAD_REQUEST"
      : error.status === 401
        ? "UNAUTHORIZED"
        : error.status === 403
          ? "FORBIDDEN"
          : error.status === 404
            ? "NOT_FOUND"
            : error.status === 429
              ? "TOO_MANY_REQUESTS"
              : error.status === 409
                ? "CONFLICT"
                : error.status === 422
                  ? "BAD_REQUEST"
                  : "INTERNAL_SERVER_ERROR";
  return new TRPCError({ code, message: error.message, cause: error });
};
