# 05 · Convenciones de API

Dos transportes sobre el **mismo** dominio (ADR-002):

- **tRPC v11** — interfaz principal para **store** y **admin** (type-safe, sin cliente generado).
- **REST + OpenAPI** — para **webhooks**, terceros y futura API partner. Todo endpoint REST público tiene OpenAPI.

Ninguno contiene lógica de negocio: ambos invocan el mismo caso de uso de `application/`.

## Versionado

- REST: prefijo `/api/v1` desde el inicio. Breaking → `/v2`. No versionar por header salvo razón fuerte.
- tRPC: versionado por router namespace cuando haga falta (`catalog.v1.*`). Cambios backward-compatible no suben versión.
- Reglas: mantener changelog; marcar campos `deprecated`; no borrar campos públicos sin ventana de migración.

## Convención tRPC

```txt
router raíz: appRouter = { identity, catalog, customers, inventory, pricing,
                            orders, finance, suppliers, ai, dashboard, settings }
procedimientos:
  publicProcedure    → sin auth (catálogo público del store)
  protectedProcedure → requiere sesión (cliente store, futuro)
  adminProcedure     → requiere admin_user + rol (todo el panel)
naming: query = get*/list*/search*   ;   mutation = create*/update*/delete*/publish*/cancel*
input:  SIEMPRE un schema Zod de packages/validators (nunca input libre)
```

- La **autorización de negocio** (ownership, rol por recurso) vive en el caso de uso, no solo en el
  `adminProcedure` middleware. Ver [07](./07-auth-identidad.md).

## Estándar REST (recursos)

```txt
GET    /api/v1/catalog/categories
GET    /api/v1/catalog/products
GET    /api/v1/catalog/products/:productId
POST   /api/v1/cart/items
PATCH  /api/v1/cart/items/:itemId
DELETE /api/v1/cart/items/:itemId
POST   /api/v1/checkout/orders
GET    /api/v1/orders/:orderId
GET    /api/v1/shipments/:shipmentId/tracking
```

Acciones que no son recursos, nombradas con claridad:

```txt
POST /api/v1/orders/:orderId/cancel
POST /api/v1/shipments/:shipmentId/refresh-tracking
POST /api/v1/documents/:documentId/regenerate
```

## Envelope de respuesta

**Éxito** (REST):

```json
{ "data": { }, "meta": { "requestId": "req_01H..." } }
```

Listas con **cursor pagination**:

```json
{
  "data": [],
  "pageInfo": { "nextCursor": "eyJpZCI6...", "hasNextPage": true, "limit": 24 },
  "meta": { "requestId": "req_..." }
}
```

- En tRPC el `data` es el valor de retorno tipado; `requestId` viaja en header/context.
- Nunca listas sin límite. Default: 24 catálogo, 20 pedidos, 50 máx (salvo export admin controlado).
- `cursor` firmado/codificado (no manipulable); `limit` validado.

## Formato de error (uniforme)

```json
{
  "type": "https://api.cloudcommerce.local/errors/validation_failed",
  "title": "Validation failed",
  "status": 400,
  "code": "VALIDATION_FAILED",
  "message": "Algunos campos no son válidos.",
  "requestId": "req_01H...",
  "details": [
    { "path": "items.0.quantity", "message": "La cantidad debe ser mayor a 0.", "code": "too_small" }
  ]
}
```

Prohibido exponer: stack traces, SQL, secrets, nombres internos de tabla, mensajes crudos del ORM.
En tRPC se mapea a `TRPCError` con `code` + `cause` interno (loggeado, no enviado).

### Catálogo de códigos

| code | HTTP | Uso |
|------|------|-----|
| `VALIDATION_FAILED` | 400 | Falla de schema de entrada |
| `UNAUTHENTICATED` | 401 | Sin sesión válida |
| `FORBIDDEN` | 403 | Autenticado sin permiso |
| `RESOURCE_NOT_FOUND` | 404 | No existe o no es del actor (anti-enumeración) |
| `CONFLICT` | 409 | Estado conflictivo |
| `IDEMPOTENCY_CONFLICT` | 409 | Misma key, payload distinto |
| `RATE_LIMITED` | 429 | Límite superado (incluye `Retry-After`) |
| `UPSTREAM_UNAVAILABLE` | 502/503 | Proveedor/IA caído |
| `INTERNAL_ERROR` | 500 | No esperado (nunca detalle al cliente) |

Errores de negocio:

| code | HTTP |
|------|------|
| `INSUFFICIENT_STOCK` | 409 |
| `PRICE_CHANGED` | 409 |
| `PRODUCT_NOT_AVAILABLE` | 409 |
| `INVALID_ORDER_STATE` | 409 |
| `ADDRESS_NOT_DELIVERABLE` | 422 |
| `DOCUMENT_NOT_READY` | 409 |
| `SHIPMENT_TRACKING_UNAVAILABLE` | 503 (con fallback a último estado) |
| `PRODUCT_NOT_PUBLISHABLE` | 422 |

Mensajes públicos claros, no técnicos: `"No pudimos completar la operación porque el recurso ya existe."`
(no `"Prisma/Drizzle error 23505"`).

## Idempotencia

Header `Idempotency-Key` obligatorio en operaciones críticas:

```txt
POST /checkout/orders
POST /payments/intents
POST /orders/:id/cancel
POST /documents/:id/regenerate
POST /shipments/:id/refresh-tracking
```

Se persiste (`idempotency_key` en [04](./04-modelo-de-datos.md)): `key, actorId, route, requestHash,
responseStatus, responseRef, createdAt, expiresAt`. Misma key + mismo payload → misma respuesta.
Misma key + payload distinto → `IDEMPOTENCY_CONFLICT`.

## Paginación, filtros y orden

- **Cursor pagination** para listados grandes (catálogo, clientes, pedidos).
- **Filtros contra whitelist**. Nunca query param → SQL directo. Ejemplo catálogo:
  `category, brand, priceMin, priceMax, ratingMin, availability, attributes[color], sort`.
- **`sort` mapeado** a columnas permitidas (`relevance|price-asc|price-desc|rating|newest`), nunca nombre de
  columna libre. (El store ya usa exactamente estos `SortKey`.)

## Headers y límites

- `Content-Type: application/json`; body size limit por ruta (uploads aparte, ver [12](./modulos/12-modulo-media-storage.md)).
- `X-Request-Id` propagado (entra o se genera) y devuelto en `meta.requestId`.
- Timeouts de servidor y upstream configurados (ver [30](./30-observabilidad.md)/[08](./08-seguridad.md)).

## Checklist de endpoint (resumen; completo en [40](./40-roadmap-y-fases.md))

```txt
[ ] Auth definida: pública / cliente / admin / interna
[ ] Rate limit definido        [ ] Body size limit
[ ] Params/query/body validados con Zod
[ ] Ownership/permiso validado en el caso de uso
[ ] Response por presenter tipado (sin campos internos)
[ ] Error mapping definido      [ ] requestId propagado
[ ] Logs sin PII                [ ] Tests éxito + error + auth negativa
[ ] OpenAPI (si REST) / tipo tRPC actualizado
```
