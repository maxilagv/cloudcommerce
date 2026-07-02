# 17 · Módulo IA Gateway (dominio `ai-gateway`)

> Cubre el pedido del dueño **ABM IA**: generar contenido de productos con IA (descripciones, specs, SEO,
> imágenes), obtener recomendaciones y análisis (trends, pricing), gestionar **alertas** (precio/stock/trend)
> y ver **uso y costos**. Todo desde el panel admin.

**Principio rector de este módulo (ADR-010).** El backend core TS **no implementa inteligencia**.
La inteligencia vive en `apps/ai` (Python/FastAPI/Pandas + Anthropic SDK). El backend expone un **puerto**
`AiGatewayPort` que **autentica**, **autoriza**, **reduce el contexto al mínimo permitido**, **llama** al
servicio IA por un contrato interno, **audita**, aplica **rate limit y tope de costo**, **normaliza errores**
y **cachea** respuestas seguras. Ni una regla de IA en TypeScript.

Fundacionales que este documento da por sentados: [modelo de datos](../04-modelo-de-datos.md) (tablas
`ai_generation`, `ai_alert`), [convenciones de API](../05-convenciones-api.md) (envelope, códigos de error,
idempotencia), [validaciones](../06-validaciones.md) (entrada, salida, terceros), [auth e identidad](../07-auth-identidad.md)
(RBAC, matriz de permisos) y [seguridad](../08-seguridad.md) (rate limiting, SSRF, secrets).

---

## 1. Propósito y alcance

### 1.1 En alcance

```txt
- Generar contenido de catálogo con IA: descripción, specs estructuradas, SEO (title/meta/keywords), imágenes.
- Obtener recomendaciones de producto verificables (score + reasonCodes + evidence).
- Disparar análisis: tendencias (trends) y optimización de precios (pricing) — sugerencias, no cambios directos.
- Registrar cada generación (ai_generation) con costo estimado, actor y trazabilidad.
- Generar y gestionar alertas (ai_alert) de tipo price/stock/trend, creadas por jobs que consultan a IA.
- Panel "ABM IA": listar generaciones/costos, ver uso, gestionar alertas, disparar generaciones manuales.
```

### 1.2 Fuera de alcance (límites duros)

```txt
- La lógica de IA (prompts, modelos, análisis Pandas). Vive en apps/ai. Ver .claude/Skills/backend/IA/IA.md.
- Aplicar automáticamente precios/markup sugeridos. La IA sugiere; el dueño decide y confirma en pricing
  ([14-modulo-pricing.md](./14-modulo-pricing.md)). Nunca escribir precio "confiable" desde la IA.
- Persistir imágenes/bytes. El gateway pide la imagen a IA y delega el almacenamiento a media/storage
  ([12-modulo-media-storage.md](./12-modulo-media-storage.md), `media_asset.source='ai'`).
```

### 1.3 PRÓXIMAMENTE — Seguimiento IA de clientes

El **CloudIA** visible al cliente (chat de compras, seguimiento de productos por cliente, curiosidades,
alertas personales) que describe la [Skill IA](../../../.claude/Skills/backend/IA/IA.md) es una **fase futura**.
En esta fase **admin-first** solo se construye el gateway para uso del **dueño/staff**. El gancho de dominio
(la asociación alerta↔cliente, la memoria de intereses) se reserva para cuando el store tenga login de cliente
— ver [11-modulo-clientes.md](./11-modulo-clientes.md) §PRÓXIMAMENTE. El shape `ChatMessage` del front
(`apps/store/src/lib/mock-ai.ts`) es el contrato de facto para esa fase, no se implementa acá todavía.

---

## 2. Separación de responsabilidades

```txt
┌──────────────┐   tRPC ai.*     ┌───────────────────────────────────────────┐   HTTP + service token   ┌────────────────┐
│ Panel admin  │ ──────────────► │  Backend core (apps/api) — AI GATEWAY      │ ───────────────────────► │  apps/ai       │
│ (Next.js)    │                 │  dominio ai-gateway                        │  POST /internal/ai/v1/*  │  Python/FastAPI │
└──────────────┘                 │                                            │ ◄─────────────────────── │  Pandas +       │
                                  │  1. autentica (Better Auth, adminProc)     │      respuesta validada   │  Anthropic SDK  │
┌──────────────┐   BullMQ jobs    │  2. autoriza (RBAC: "usar IA")             │                          └────────────────┘
│ apps/workers │ ──────────────► │  3. arma CONTEXTO MÍNIMO (whitelist)       │                                   ▲
│ (scheduled)  │                 │  4. rate limit + tope de costo (Redis)     │        NUNCA envía: password hash,│
└──────────────┘                 │  5. llama IA (timeout, retries acotados)   │        refresh tokens, PII de otro│
                                  │  6. valida respuesta (Zod) antes de usar   │        usuario, costo proveedor si│
                                  │  7. registra ai_generation + audit_log     │        el actor no puede verlo,   │
                                  │  8. cachea respuestas seguras              │        secretos.                  │
                                  │  9. normaliza errores (UPSTREAM→503)       │───────────────────────────────────┘
                                  └───────────────┬────────────────────────────┘
                                                  │ efectos de dominio (fuera del request path)
                                  ┌───────────────┴───────────────┐
                                  ▼                               ▼
                        catalog (descripción/specs)      media/storage (imagen source='ai')
                        pricing (sugerencia, no aplica)   ai_alert (panel resuelve)
```

**Frontera de lenguaje (skill backend §0).** El backend core es 100% TS/Node. La IA analítica es 100% Python.
El único punto de contacto es el contrato interno HTTP de §4. El dominio `ai-gateway` **no conoce** a Anthropic,
ni prompts, ni Pandas: conoce `AiGatewayPort` y entidades de dominio.

**Reglas de dependencia (skill backend §3.2).** `ai-gateway` es un módulo consumido por `catalog`, `pricing`,
`dashboard` y por jobs. No accede a tablas de otros módulos salvo por read models autorizados; para escribir
en catálogo/media invoca **sus** casos de uso, no sus tablas.

---

## 3. Entidades y tablas (canon [04](../04-modelo-de-datos.md))

Esquema Drizzle en `packages/database/src/schema/ai.ts`. Canon (no re-inventar columnas):

```txt
ai_generation  id, kind(description/specs/seo/image/recommendation), target_type, target_id?,
               prompt_ref, status, cost_estimate_minor?, actor_id, created_at, completed_at
ai_alert       id, kind(price/stock/trend), payload(jsonb), status, created_at, resolved_at
```

Enums de dominio (`packages/types/src/enums.ts`, se agregan junto al canon existente):

```ts
export enum AiGenerationKind   { DESCRIPTION, SPECS, SEO, IMAGE, RECOMMENDATION, TRENDS, PRICING }
export enum AiGenerationStatus { QUEUED, RUNNING, SUCCEEDED, FAILED, PARTIAL, DEGRADED }
export enum AiAlertKind        { PRICE, STOCK, TREND }
export enum AiAlertStatus      { OPEN, ACKNOWLEDGED, RESOLVED, DISMISSED }
export enum AiTargetType       { PRODUCT, VARIANT, CATEGORY, SUPPLIER_FEED, NONE }
```

Notas de diseño sobre el canon (ilustrativo, no altera columnas):

- **`ai_generation` es el libro mayor de auditoría + costo.** Toda invocación de una capacidad de IA crea
  **una** fila, aun si falla (`status=FAILED`) o degrada (`status=DEGRADED`). Es la fuente del panel
  "uso y costos" y de los límites de cuota por actor (§8).
- `prompt_ref` es una **referencia** (hash/clave), no el prompt crudo con PII. El prompt reconstruible y su
  contexto mínimo se guardan fuera del alcance del cliente; nunca se exponen en responses. Ver §7 y §10.
- `cost_estimate_minor` en `{amountMinor:int, currency}` (ADR-007). Es **estimación** pre-llamada + ajuste
  post-llamada con el uso real que reporta `apps/ai` (tokens/imagen). Nunca `float`.
- `target_type`/`target_id` habilitan "todas las generaciones de este producto" en el detalle de catálogo.
- **`ai_alert.payload`** es `jsonb` saneado (bloquear `__proto__`/`prototype`/`constructor`, ver [06](../06-validaciones.md)
  §prototype pollution). En esta fase **no** tiene FK a `customer` (seguimiento por cliente = PRÓXIMAMENTE);
  referencia el recurso afectado (`productId`/`variantId`/`categoryId`) dentro del payload validado por schema.

Índices sugeridos (medir; siguen el criterio de [04](../04-modelo-de-datos.md) §índices):

```sql
CREATE INDEX idx_ai_generation_actor_created ON ai_generation(actor_id, created_at DESC);
CREATE INDEX idx_ai_generation_target        ON ai_generation(target_type, target_id);
CREATE INDEX idx_ai_generation_kind_status   ON ai_generation(kind, status);
CREATE INDEX idx_ai_alert_status_created     ON ai_alert(status, created_at DESC);
CREATE INDEX idx_ai_alert_kind               ON ai_alert(kind);
```

---

## 4. Puerto `AiGatewayPort` y contrato interno con `apps/ai`

### 4.1 El puerto (interfaz de dominio, TS)

`apps/api/src/modules/ai-gateway/application/ports/ai-gateway.port.ts`. Es la **única** superficie que ven los
demás módulos. Cada método arma el **contexto mínimo permitido** (§7) y llama a un endpoint interno de `apps/ai`.
Devuelve `Result<T, AiGatewayError>` (ADR-012), no lanza excepciones para errores esperados.

```ts
export interface AiGatewayPort {
  generateProductDescription(ctx: AiCallContext, input: ProductContentInput): Promise<Result<AiText, AiGatewayError>>;
  generateProductSpecs      (ctx: AiCallContext, input: ProductContentInput): Promise<Result<AiSpecGroups, AiGatewayError>>;
  generateSeo               (ctx: AiCallContext, input: SeoInput):            Promise<Result<AiSeo, AiGatewayError>>;
  generateProductImage      (ctx: AiCallContext, input: ImageInput):          Promise<Result<AiImageRef, AiGatewayError>>;
  getRecommendations        (ctx: AiCallContext, input: RecommendInput):      Promise<Result<AiRecommendation[], AiGatewayError>>;
  analyzeTrends             (ctx: AiCallContext, input: TrendsInput):         Promise<Result<AiTrendSignal[], AiGatewayError>>;
  optimizePricing           (ctx: AiCallContext, input: PricingInput):        Promise<Result<AiPriceSuggestion[], AiGatewayError>>;
}

// Contexto de la llamada: actor + trazas + control de costo. Nunca el request HTTP crudo.
export type AiCallContext = {
  actor: Actor;                 // ver 07 §Actor (admin | system para jobs)
  requestId: string;            // propagado a IA y a audit_log
  traceId: string;              // OpenTelemetry (30)
  generationId: string;         // fila ai_generation ya creada (QUEUED)
  costBudgetMinor: number;      // tope duro para esta operación
};

// Tipos de salida (presenters de dominio, sin campos internos)
export type AiText  = { text: string; model: string; usage: AiUsage };
export type AiSeo   = { title: string; metaDescription: string; keywords: string[]; usage: AiUsage };
export type AiSpecGroups = { groups: { name: string; items: SpecItemDraft[] }[]; usage: AiUsage };
export type AiImageRef   = { bytesRef: string; mime: string; width: number; height: number; usage: AiUsage };
export type AiUsage = { costMinor: number; currency: Currency; unit: 'tokens' | 'image'; amount: number };

export type AiRecommendation = {
  productId: string;
  score: number;                       // 0..1
  reasonCodes: string[];               // p. ej. ["same_category","energy_saving","viewed_brand"]
  evidence: { matchedAttributes: string[]; basedOn: string[] };
};

export type AiTrendSignal    = { targetType: AiTargetType; targetId?: string; signal: string; score: number; window: string };
export type AiPriceSuggestion= { variantId: string; suggestedAmountMinor: number; currency: Currency;
                                 marginPct: number; rationale: string; withinMinMargin: boolean };
```

El adapter concreto (`infra/integrations/ai-http.adapter.ts`) implementa el puerto usando un cliente HTTP con
timeout, retries acotados y validación Zod de la respuesta. Un **segundo adapter** `ai-degraded.adapter.ts`
(o decorador) provee la degradación elegante (§9).

### 4.2 Contrato interno backend ↔ IA

Endpoints **internos** en `apps/ai` (no expuestos a internet; red privada + token de servicio). Mapean a los
endpoints públicos que CLAUDE.md/AGENTS.md definen para `apps/ai`:

| Método puerto | Endpoint interno `apps/ai` | Endpoint público equivalente (CLAUDE.md) |
|---|---|---|
| `generateProductDescription` | `POST /internal/ai/v1/products/generate-description` | `/products/generate-description` |
| `generateProductSpecs` | `POST /internal/ai/v1/products/generate-specs` | (deriva de description/specs) |
| `generateSeo` | `POST /internal/ai/v1/products/generate-seo` | `/products/generate-seo` |
| `generateProductImage` | `POST /internal/ai/v1/products/generate-image` | (media) |
| `getRecommendations` | `POST /internal/ai/v1/recommendations` | (recos) |
| `analyzeTrends` | `POST /internal/ai/v1/trends/analyze` | `/trends/analyze` |
| `optimizePricing` | `POST /internal/ai/v1/pricing/optimize` | `/pricing/optimize` |

**Autenticación del contrato interno (skill backend §27.3, [08](../08-seguridad.md)):**

```txt
- Token de servicio dedicado: header  Authorization: Bearer <AI_SERVICE_TOKEN>  (validado con zod-env al boot).
- Red privada / mTLS si aplica; apps/ai NO se publica en el ingress público.
- IP allowlist del backend en apps/ai.
- X-Request-Id y traceparent propagados para trazabilidad extremo a extremo (30).
- Idempotency-Key por generationId: reintentar la misma generación no duplica costo/efecto en apps/ai.
```

**Timeouts y resiliencia (skill backend §10.2, §17.6):**

```txt
- upstream timeout por capacidad: texto ~8s, specs ~10s, seo ~6s, imagen ~25s, recos/trends/pricing ~6s.
- retries: máx 1 reintento con backoff SOLO en errores idempotentes de red (ECONNRESET/504); nunca en 4xx.
- circuit breaker por endpoint: si supera umbral de fallos, abre y responde degradado (§9) sin llamar.
- body size limit de la respuesta; validación de tamaño de imagen antes de pasar a media/storage.
```

**Forma del request/response interno (ilustrativo).** La request lleva **solo** el contexto de whitelist (§7):

```jsonc
// POST /internal/ai/v1/products/generate-description
{
  "generationId": "0192...uuidv7",
  "locale": "es-AR",
  "product": {                       // whitelist: NADA de costo/proveedor/PII
    "title": "Lavadora LG 22kg AI DD",
    "categoryName": "Lavadoras",
    "brandName": "LG",
    "specs": [{ "key": "capacidad", "label": "Capacidad", "value": 22, "unit": "kg" }],
    "attributes": { "color": "acero" }
  },
  "constraints": { "maxChars": 1200, "tone": "asesor premium, claro, sin exageración" }
}
```

Respuesta validada con Zod **antes** de confiar en ella ([06](../06-validaciones.md) §terceros):

```jsonc
{
  "text": "Esta lavadora está pensada para una casa con ritmo intenso...",
  "model": "claude-...", "usage": { "unit": "tokens", "amount": 1840, "costMinor": 350, "currency": "ARS" }
}
```

---

## 5. Casos de uso (por capacidad)

Formato skill backend §3.4: **actor · input · permiso · contexto permitido · costo · errores**. Todos crean una
fila `ai_generation` (QUEUED→…) y un `audit_log`. Todos corren fuera del request caliente cuando el costo/latencia
lo justifica (imagen, trends, pricing → BullMQ, [32](../32-jobs-y-async.md)); texto/specs/seo pueden ser síncronos
con el timeout de §4.2.

### 5.1 `GenerateProductDescription`

```txt
Actor        : admin con permiso "usar IA" (OWNER, ADMIN, CATALOG_MANAGER).
Input        : { productId, locale?, tone?, maxChars? }  (Zod GenerateDescriptionSchema).
Permiso      : puede editar ese producto (application layer, no solo middleware).
Contexto→IA  : title, subtitle, categoryName, brandName, specs (spec_item estructurados), attributes de variantes.
               PROHIBIDO: supplier_cost, supplierId, sku interno si no visible, notas internas, PII.
Costo        : estimado por longitud pedida; tope por operación (§8). Persistido en cost_estimate_minor.
Efecto       : devuelve borrador; NO publica. El texto va a product.description como DRAFT sujeto a revisión
               del dueño ([10-modulo-catalogo.md](./10-modulo-catalogo.md) §Publicación). HTML saneado ([06](../06-validaciones.md)).
Errores      : FORBIDDEN, RESOURCE_NOT_FOUND, RATE_LIMITED, AI_QUOTA_EXCEEDED, UPSTREAM_UNAVAILABLE(503),
               AI_RESPONSE_INVALID(502).
```

### 5.2 `GenerateProductSpecs`

```txt
Actor/Permiso: igual que 5.1.
Input        : { productId, sourceHints? }.
Contexto→IA  : title, categoryName, brandName, specs existentes, texto de ficha del feed del proveedor
               (solo campos técnicos, sin costo).
Salida       : spec_group + spec_item estructurados (value_num + unit cuando aplica) → borrador para catálogo.
               El dueño revisa antes de persistir; se valida contra el schema de specs de catálogo.
Errores      : idem 5.1 + AI_RESPONSE_INVALID si el shape de specs no valida.
```

### 5.3 `GenerateSeo`

```txt
Input        : { productId | categoryId }.
Contexto→IA  : title/subtitle/description pública, categoryName, atributos SEO-relevantes. Sin datos sensibles.
Salida       : { seoTitle, seoDescription, keywords[] } → campos seo_* de product/category (borrador).
Costo        : bajo. Errores: idem 5.1.
```

### 5.4 `GenerateProductImage`

```txt
Actor/Permiso: admin con "usar IA" + permiso de media.
Input        : { productId, prompt?, style?, aspectRatio }.
Contexto→IA  : title, categoryName, atributos visuales (color, material). Sin PII ni costo.
Flujo        : gateway pide imagen a IA → recibe bytesRef → valida MIME real por magic bytes, tamaño y
               dimensiones ([06](../06-validaciones.md) §archivos) → delega a MediaStoragePort
               ([12-modulo-media-storage.md](./12-modulo-media-storage.md)) que crea media_asset con source='ai'.
               El gateway NUNCA persiste bytes ni decide storage.
Costo        : el más alto (por imagen). Cuota específica más estricta (§8). Corre por job (BullMQ).
Errores      : idem 5.1 + UNSUPPORTED_MEDIA_TYPE(422) si la imagen no pasa validación.
```

### 5.5 `GetRecommendations`

```txt
Actor        : admin (panel) o system (job de home/precompute). Cliente = PRÓXIMAMENTE ([11](./11-modulo-clientes.md)).
Input        : { seedProductId? | categoryId?, limit<=12 }.
Contexto→IA  : catálogo público relevante (productos PUBLISHED, atributos, categoría). Sin PII de clientes en
               esta fase (no hay comportamiento de cliente logueado todavía).
Salida       : AiRecommendation[] con score + reasonCodes + evidence (skill §15.3). El backend PUEDE ocultar
               o transformar evidence antes de mostrar, pero CONSERVA la trazabilidad en ai_generation.
Uso          : alimenta el bloque de recomendaciones del home del store (contrato ChatMessage.productIds del
               front, apps/store/src/lib/mock-ai.ts) vía read model precomputado.
Errores      : RATE_LIMITED, AI_QUOTA_EXCEEDED, UPSTREAM_UNAVAILABLE(503 con fallback precomputado, §9).
```

### 5.6 `AnalyzeTrends`

```txt
Actor        : OWNER/ADMIN, o system (job programado).
Input        : { scope: category|supplierFeed, scopeId?, window }.
Contexto→IA  : catálogo + señales de feed de proveedores ([20-modulo-suppliers.md](./20-modulo-suppliers.md)),
               sin costo proveedor si el actor no lo puede ver.
Salida       : AiTrendSignal[] → genera ai_alert kind='trend' para el panel (§ jobs, más abajo).
Errores      : idem 5.5.
```

### 5.7 `OptimizePricing`

```txt
Actor        : OWNER/ADMIN/FINANCE (quienes ven costo/margen — ver matriz 07). CATALOG_MANAGER NO.
Input        : { variantId | categoryId }.
Contexto→IA  : para este caso SÍ viaja supplier_cost/margen PORQUE el actor puede verlo (whitelist condicional,
               §7.3). Competidor/mercado si existe. Nunca datos de clientes.
Salida       : AiPriceSuggestion[] con marginPct y withinMinMargin. Es SUGERENCIA. NO cambia precios.
               El dueño aplica manualmente en pricing ([14-modulo-pricing.md](./14-modulo-pricing.md)),
               que revalida min_margin_pct. Puede generar ai_alert kind='price'.
Errores      : FORBIDDEN (rol sin acceso a costo), idem 5.5.
```

**Máquina de estados de `ai_generation`:** `QUEUED → RUNNING → SUCCEEDED | FAILED | PARTIAL | DEGRADED`.
`completed_at` se setea en cualquier estado terminal. `cost_estimate_minor` se ajusta con `usage` real al cerrar.

---

## 6. Endpoints tRPC `ai.*` (admin)

Router `ai` compuesto en `appRouter` ([05](../05-convenciones-api.md) §convención tRPC). **Todos** `adminProcedure`
+ verificación de permiso "usar IA" en el caso de uso. Input siempre schema Zod de `packages/validators/src/ai.ts`.

```txt
# Generación (mutations — verbo generate*/optimize*)
ai.generateDescription({ productId, tone?, maxChars? })     → { generationId, status, text? }
ai.generateSpecs({ productId })                             → { generationId, status, specs? }
ai.generateSeo({ productId | categoryId })                  → { generationId, status, seo? }
ai.generateImage({ productId, prompt?, style?, aspectRatio })→ { generationId, status }  (async → job)
ai.getRecommendations({ seedProductId?, categoryId?, limit })→ AiRecommendation[]
ai.analyzeTrends({ scope, scopeId?, window })               → { generationId, status }
ai.optimizePricing({ variantId | categoryId })             → AiPriceSuggestion[]

# Uso y costos (queries — get*/list*)
ai.listGenerations({ cursor?, limit<=50, filter:{ kind?, status?, actorId?, targetId?, dateFrom?, dateTo? } })
                                                            → paginado cursor de ai_generation (presenter sin prompt crudo)
ai.getGeneration({ generationId })                         → detalle (sin contexto crudo enviado a IA)
ai.getUsageSummary({ period })                             → { period, byKind[], byActor[], totalCostMinor, count }

# Alertas (ABM)
ai.listAlerts({ cursor?, limit, filter:{ kind?, status? } }) → paginado de ai_alert
ai.acknowledgeAlert({ alertId })                            → alerta ACKNOWLEDGED (auditado)
ai.resolveAlert({ alertId, note? })                        → alerta RESOLVED (resolved_at, auditado)
ai.dismissAlert({ alertId, reason })                       → alerta DISMISSED (motivo obligatorio, auditado)
```

Reglas transversales de estos endpoints:

- **Idempotencia** ([05](../05-convenciones-api.md) §idempotencia): mutations de generación aceptan `Idempotency-Key`;
  misma key ⇒ misma `generationId`, no se duplica costo. Key distinta con mismo payload en ventana corta ⇒ dedup por hash.
- **Paginación**: `listGenerations`/`listAlerts` con cursor firmado, límite máx 50 (export admin controlado aparte).
- **Presenters** ([06](../06-validaciones.md) §salida): nunca exponen `prompt_ref` reconstruible con PII, ni el
  contexto crudo, ni tokens del servicio. `getGeneration` muestra metadatos + costo + resultado, no el prompt.
- No hay `publicProcedure` ni `protectedProcedure` de cliente en esta fase (CloudIA de cliente = PRÓXIMAMENTE).

---

## 7. Reglas de seguridad de datos (whitelist y minimización)

Núcleo del gateway (skill backend §15.1, §25.1; [06](../06-validaciones.md)). **El backend decide qué viaja a IA.**

### 7.1 Nunca viaja a `apps/ai` (denylist dura)

```txt
- password_hash, mfa_secret_enc, cualquier credencial.
- refresh_token_hash, cookies de sesión, tokens de servicio.
- PII de clientes: nombre/apellido, whatsapp, email, domicilios, notas, contact_log.
- datos de OTRO usuario/tenant.
- secretos internos, api_config_enc de proveedores, connection strings.
- supplier_cost / margen / costo proveedor CUANDO el actor no puede verlo (matriz 07).
- documentos completos (remitos/facturas) — a lo sumo un id si fuera imprescindible.
- IDs secuenciales internos que faciliten enumeración (se usan UUIDv7 públicos, ADR-008).
```

### 7.2 Whitelist de contexto por capacidad (allowlist explícita)

```txt
description/specs/seo : title, subtitle, categoryName, brandName, specs estructurados, attributes de variante,
                        descripción pública existente. NADA de costo/PII.
image                 : title, categoryName, atributos visuales (color, material). Sin PII/costo.
recommendations       : catálogo público (PUBLISHED), atributos, categoría. Sin comportamiento de cliente (fase futura).
trends                : catálogo + señales de feed (sin costo si el actor no lo ve).
pricing               : title, categoryName, y — solo si el actor puede verlo — supplier_cost, margen, min_margin_pct.
```

### 7.3 Whitelist condicional (por permiso del actor)

`optimizePricing` es el único caso donde **puede** viajar costo/margen, y **solo** si el actor tiene el permiso
"ver costo proveelor / margen" (OWNER/ADMIN/FINANCE, matriz [07](../07-auth-identidad.md)). El armado del contexto
lo hace un **ContextBuilder** por capacidad que aplica la denylist, luego la allowlist, y luego filtra los campos
condicionales según `actor.role`. Si el actor no califica, el campo simplemente no existe en el request a IA.

### 7.4 Minimización y saneo

```txt
- Enviar el MÍNIMO de campos que la capacidad necesita, no "el producto entero".
- Truncar textos a límites; normalizar Unicode; strip de HTML peligroso.
- jsonb de payload/attributes: bloquear __proto__/prototype/constructor ([06] §prototype pollution).
- No duplicar PII en prompt_ref ni en logs (30, §10). prompt_ref = hash/clave, no texto con PII.
```

---

## 8. Rate limit y costos

Rate limit **específico de IA** (skill backend §9.2, §9.3; [08](../08-seguridad.md)). No usar el límite global.

```txt
Clave de límite : actor (userId) + kind de operación   (para jobs: service + kind).
Almacén         : Redis (sliding window / token bucket), igual que el resto de rate limits.
Ejemplos (ajustar por medición):
  - texto (description/specs/seo) : 30/min y 300/día por actor.
  - imagen                        : 5/min y 40/día por actor (más caro).
  - recommendations/trends/pricing: 20/min por actor.
Exceso ⇒ RATE_LIMITED (429) con Retry-After.
```

**Cuota de costo (tope económico), lo que hace única a la IA:**

```txt
- Cada operación estima costMinor ANTES de llamar (por longitud/tipo). Si el estimado supera el tope por
  operación ⇒ rechaza con AI_QUOTA_EXCEEDED (no se llama a IA).
- Cuota acumulada por actor y por período (día/mes) sobre SUM(cost_estimate_minor) de ai_generation.
  Al superarla ⇒ AI_QUOTA_EXCEEDED hasta el reset. Configurable en settings/feature_flag ([19](./19-modulo-configuracion.md)).
- Cuota global de la tienda (presupuesto mensual de IA) como cortacircuitos de gasto.
- Post-llamada: se reconcilia cost_estimate_minor con usage real que reporta apps/ai.
```

Códigos nuevos que este módulo agrega al catálogo de [05](../05-convenciones-api.md):

| code | HTTP | Uso |
|------|------|-----|
| `AI_QUOTA_EXCEEDED` | 429 | Tope de costo por operación/actor/tienda superado |
| `AI_RESPONSE_INVALID` | 502 | La respuesta de `apps/ai` no valida contra schema |
| `AI_CONTENT_REJECTED` | 422 | Contenido generado no pasa moderación/reglas de negocio |

`UPSTREAM_UNAVAILABLE` (502/503) y `RATE_LIMITED` (429) ya existen en el canon y se reutilizan.

---

## 9. Degradación elegante y errores

`apps/ai` puede estar caído o lento. El gateway **nunca** rompe el panel por eso (skill backend §17.6).

```txt
UPSTREAM_UNAVAILABLE (503):
  - Se dispara ante timeout, circuito abierto o 5xx de apps/ai.
  - La generación queda ai_generation.status=FAILED o DEGRADED con completed_at; el panel muestra "reintentar".
  - Efecto por capacidad:
      description/specs/seo/image : NO hay fallback inventado (jamás inventar contenido). Se informa
                                    "IA no disponible, reintentá" y el borrador queda vacío/pendiente.
      recommendations             : fallback a recomendaciones PRECOMPUTADAS (read model) o reglas simples
                                    (misma categoría / más vendidos). status=DEGRADED, evidence marca "fallback".
      trends/pricing              : la operación queda pending; el job reintenta con backoff.
  - Nunca se mezclan datos reales con suposiciones sin marcarlo (skill IA §2).

AI_RESPONSE_INVALID (502): la respuesta no valida ⇒ se descarta, se registra, no se persiste nada.
Mapeo de errores (ADR-012 + [05] §errores): errores de dominio tipados → code público + HTTP; nunca stack/SQL/
prompt crudo al cliente. En tRPC → TRPCError con cause interno logueado, no enviado.
```

Tabla de errores del módulo:

| Situación | Error de dominio | code | HTTP |
|---|---|---|---|
| Actor sin permiso "usar IA" | `AiToolNotAllowed` | `FORBIDDEN` | 403 |
| Producto/categoría inexistente o ajeno | `TargetNotFound` | `RESOURCE_NOT_FOUND` | 404 |
| Límite de tasa IA | `AiRateLimited` | `RATE_LIMITED` | 429 |
| Tope de costo superado | `AiQuotaExceeded` | `AI_QUOTA_EXCEEDED` | 429 |
| `apps/ai` caído/lento | `AiUpstreamUnavailable` | `UPSTREAM_UNAVAILABLE` | 503 |
| Respuesta IA no valida | `AiResponseInvalid` | `AI_RESPONSE_INVALID` | 502 |
| Contenido rechazado por reglas | `AiContentRejected` | `AI_CONTENT_REJECTED` | 422 |
| Imagen no pasa validación de archivo | `InvalidMediaUpload` | `UNSUPPORTED_MEDIA_TYPE` | 422 |

---

## 10. Auditoría

Toda operación de IA es auditable (skill backend §8.4, §11.8; [07](../07-auth-identidad.md) §motivos de acceso).

```txt
ai_generation : registro funcional + costo (fuente del panel de uso). Una fila por invocación, incl. fallos.
audit_log     : actorId, actorType, action(ai.generate_description|...), resourceType, resourceId(target),
                before/after(borrador si aplica, SIN PII cruda), ip, userAgent, requestId, reason?, created_at.
access_log    : si una capacidad tocara datos sensibles del actor bajo acceso restringido (p. ej. pricing con
                costo por SUPPORT — que NO puede — se bloquea antes; si un rol con "motivo" accediera, se loguea).
Trazabilidad IA (skill §15.3): la evidence/reasonCodes de recomendaciones se conservan en ai_generation aunque
el panel muestre una versión transformada.
NO se loggea: prompt crudo con PII, token de servicio, respuesta binaria de imagen, secretos.
Retención (skill §25.2): definir retención de ai_generation/prompts como "conversaciones IA".
```

Observabilidad ([30](../30-observabilidad.md)): métricas `ai_requests_total`, `ai_request_duration_seconds`,
`ai_cost_minor_total`, `ai_quota_rejections_total`, `ai_upstream_errors_total`; traces propagados a `apps/ai`.

---

## 11. Casos borde

```txt
- Doble clic en "Generar": Idempotency-Key ⇒ misma generationId, un solo costo.
- apps/ai responde 200 con shape inválido: AI_RESPONSE_INVALID, no se persiste, se audita.
- apps/ai devuelve texto vacío o placeholder: AI_CONTENT_REJECTED; borrador no se aplica.
- Timeout tras haber consumido costo en apps/ai: idempotency por generationId evita re-cobro al reintentar.
- Actor pierde el permiso a mitad de un job async: se revalida el permiso al ejecutar, no solo al encolar.
- Producto se archiva mientras corre la generación: al persistir borrador se valida estado; si ARCHIVED, se descarta.
- Imagen IA con MIME falsificado: magic bytes la rechazan antes de llegar a media/storage.
- Cuota de costo agotada a mitad de lote (trends): el job corta y encola el resto para el próximo período.
- Alerta duplicada (mismo product+kind ya OPEN): el job hace upsert/dedup, no crea otra ai_alert.
- Pricing sugiere precio bajo min_margin_pct: withinMinMargin=false; pricing bloquea aplicarlo ([14](./14-modulo-pricing.md)).
- Rol CATALOG_MANAGER pide optimizePricing: FORBIDDEN (no ve costo). No se arma contexto con costo.
- Circuito abierto: recomendaciones sirven fallback precomputado; generación de texto informa indisponibilidad.
- Payload de alerta con __proto__: saneo lo rechaza (prototype pollution).
```

---

## 12. Definition of Done

Alineado con la DoD global (skill backend §28) y el checklist de endpoint ([05](../05-convenciones-api.md)):

```txt
[ ] AiGatewayPort es la ÚNICA superficie de IA; ningún módulo llama a apps/ai directo.
[ ] Cero lógica de IA en TS (ADR-010): prompts/modelos/análisis viven en apps/ai.
[ ] Contexto mínimo por capacidad vía ContextBuilder con denylist + allowlist + filtro condicional por rol.
[ ] Denylist verificada por tests: password/refresh/PII/costo-no-visible NUNCA salen del backend.
[ ] Token de servicio validado al boot (zod-env); apps/ai no expuesto públicamente; IP allowlist.
[ ] Timeouts, retries acotados y circuit breaker por capacidad; degradación elegante probada.
[ ] Toda invocación crea ai_generation (incl. fallos) con costo estimado y reconciliado; audit_log escrito.
[ ] Rate limit específico de IA (actor+kind) y cuota de costo (operación/actor/tienda) aplicados y testeados.
[ ] Respuesta de apps/ai validada con Zod antes de confiar en ella; AI_RESPONSE_INVALID mapeado.
[ ] Recomendaciones con score+reasonCodes+evidence; trazabilidad conservada en ai_generation.
[ ] Generación de imagen delega a MediaStoragePort con media_asset.source='ai'; nunca persiste bytes el gateway.
[ ] Generación de contenido produce BORRADOR; publicación/pricing quedan a decisión del dueño.
[ ] Panel ABM IA: listGenerations, getUsageSummary y ABM de alertas funcionando con presenters sin PII.
[ ] Errores de negocio tipados (ADR-012) → code público + HTTP; sin stack/SQL/prompt crudo al cliente.
[ ] Tests: éxito, upstream caído (503+fallback), respuesta inválida (502), cuota (429), permiso negativo (403).
[ ] Gancho "seguimiento IA de clientes" documentado como PRÓXIMAMENTE (ver 11-modulo-clientes.md).
```
