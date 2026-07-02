# 04 · Modelo de datos

Fuente de verdad transaccional: **PostgreSQL**. Esquema con Drizzle en `packages/database/src/schema/`
(un archivo por dominio, re-exportados desde `index.ts`). Este documento define el **modelo canónico**:
reconcilia los shapes divergentes del frontend y fija tablas, tipos y relaciones que **todos** los módulos
dan por sentados.

## Convenciones globales de tabla

```txt
- PK:            id  uuid  (UUIDv7 generado en app), DEFAULT no secuencial
- Timestamps:    created_at timestamptz NOT NULL default now()
                 updated_at timestamptz NOT NULL default now() (trigger o app)
- Soft delete:   deleted_at timestamptz NULL  → solo donde el dominio lo requiere
- Integridad:    FK explícitas, ON DELETE definido (restrict por defecto)
- Invariantes:   UNIQUE + CHECK constraints en DB, no solo en app
- Dinero:        *_amount_minor integer + *_currency  (nunca float)  — ver ADR-007
- Enums:         pgEnum por estado de dominio (no strings libres)
- Naming:        snake_case en DB, camelCase en TS (Drizzle mapea)
- Índices:       todo filtro/orden frecuente tiene índice (ver cada dominio)
```

Tipo compartido de dinero (`packages/types`):

```ts
export type Currency = 'ARS' | 'USD';
export type Money = { amountMinor: number; currency: Currency };
```

## Enums de dominio (`packages/types/src/enums.ts`)

```ts
export enum ProductStatus { DRAFT, READY_FOR_REVIEW, PUBLISHED, PAUSED, ARCHIVED }
export enum StockStatus   { IN_STOCK, SOON, OUT_OF_STOCK }          // derivado, para cards
export enum OrderStatus {
  DRAFT, PENDING_CONFIRMATION, CONFIRMED, PREPARING,
  READY_TO_SHIP, SHIPPED, DELIVERED, CANCELLED, RETURN_REQUESTED, RETURNED
}
export enum ShipmentStatus {
  CREATED, PREPARED, DISPATCHED, IN_TRANSIT, OUT_FOR_DELIVERY,
  DELIVERED, DELAYED, FAILED_ATTEMPT
}
export enum ShippingMethod { STANDARD, EXPRESS, PICKUP }            // ← store constants.ts
export enum DocumentType   { REMITO, FACTURA, NOTA_CREDITO }        // ← store mock-account.ts
export enum DocumentStatus { PROCESSING, AVAILABLE }
export enum AdminRole      { OWNER, ADMIN, CATALOG_MANAGER, SUPPORT, FINANCE }
export enum ReservationStatus { ACTIVE, CONFIRMED, RELEASED, EXPIRED }
export enum StockMovementType { IMPORT, SALE, RETURN, ADJUSTMENT, RESERVATION, RELEASE }
```

---

## Reconciliación de `Product` (frontend → canon)

El front tiene dos shapes divergentes. **Canon del backend** (el front se ajusta):

| Concepto | `ProductCardData` (catálogo) | `types.ts` (aspiracional) | **Canon backend** |
|---|---|---|---|
| Precio actual | `price` | `price` | `price_amount_minor` |
| Precio tachado | `oldPrice?` | `originalPrice?` | `compare_at_amount_minor?` |
| Imagen | `image` + `imageAlt` | `images[]` | `product_media` (tabla) + `main_image_id` |
| Stock | `stockStatus` | `inStock` + `stockCount?` | derivado de `inventory` (no columna en product) |
| Envío | `shipping` | `freeShipping` | derivado de pricing/shipping, no en product |
| Nuevo | `badge.type = "new"` | `isNew` | derivado (`published_at` reciente) o badge manual |
| Categoría | `category: string` | `category`+`subcategory?` | FK `category_id` (+ denormalización `category_name` en read model) |
| Variantes | — | `variants{colors,sizes}` | `product_variant` + atributos |

**Regla de oro**: `stockStatus`, `shipping`, `rating`, `badge` y `oldPrice` **no** se persisten en `product`
como verdad; se **derivan** (de inventory, pricing, reviews) y se materializan en el **read model de card**
([18](./modulos/18-modulo-dashboard-analytics.md) §read models). Así se evita la duplicación que hoy tiene el front.

---

## Esquema por dominio

### identity (`schema/identity.ts`)

```
admin_user       id, email(unique, lower), password_hash(argon2), full_name,
                 role(AdminRole), is_active, mfa_enabled, mfa_secret_enc,
                 last_login_at, created_at, updated_at
admin_session    id, admin_user_id(FK), refresh_token_hash, family_id, device_label,
                 ip, user_agent, expires_at, revoked_at, created_at
permission_grant id, role(AdminRole), resource, action        # matriz RBAC versionada
access_log       id, actor_id, resource_type, resource_id, action, reason,
                 ip, user_agent, created_at                    # accesos a datos sensibles
```

> Los **clientes** de la tienda (compradores) son `customer` (dominio customers), **no** `admin_user`.
> Cuando el store tenga login de cliente, se agrega `customer_auth` (fuera de esta fase).

### customers (`schema/customers.ts`)

Refleja el pedido del dueño: alta con nombre/apellido, WSP opcional, domicilios AR.

```
customer          id, first_name, last_name, display_name(gen), email?(unique nullable, lower),
                  whatsapp?(e164), notes?, tier?(CloudBase/Plus/Prime), created_at, updated_at, deleted_at?
customer_address  id, customer_id(FK), label?, recipient_name?,
                  province, city, street, street_number?, between_streets?,
                  postal_code?, is_primary(bool), created_at, updated_at
customer_consent  id, customer_id(FK), kind, granted(bool), granted_at, source
customer_contact_log id, customer_id(FK), channel(call/whatsapp/email/other),
                  direction(in/out), note?, occurred_at, created_by(admin_user_id)
```

- `customer_contact_log` sostiene el KPI **"veces que llamó"** del detalle de cliente.
- Analytics (cuánto gastó / cuánto se invirtió / gráfico de compras) **no** son columnas: se **calculan**
  desde `order` + `finance` y se sirven por read model. Ver [11](./modulos/11-modulo-clientes.md).
- Direcciones AR: `province`, `city`, `street`, `street_number` (opcional, "si aplica"),
  `between_streets` ("entre calles"), `postal_code`.

### catalog (`schema/catalog.ts`)

```
category          id, parent_id?(FK self → subcategorías), name, slug(unique per parent),
                  description?, image_id?(FK media_asset), position(int), is_active,
                  seo_title?, seo_description?, created_at, updated_at
brand             id, name, slug(unique), logo_id?(FK media_asset), is_active
product           id, slug(unique), title, subtitle?, description(text),
                  brand_id?(FK), category_id(FK), status(ProductStatus),
                  main_image_id?(FK media_asset), sku?(unique),
                  seo_title?, seo_description?, published_at?, created_at, updated_at, deleted_at?
product_media     id, product_id(FK), media_asset_id(FK), position(int 0..5), alt_text
                  # CHECK: máx 6 filas por product (1..6 imágenes) — validado en app + índice
product_variant   id, product_id(FK), sku(unique), title, is_active,
                  attributes(jsonb: {color, capacity, ...}), position, created_at, updated_at
spec_group        id, product_id(FK), name, position
spec_item         id, spec_group_id(FK), key, label, value_text?, value_num?, unit?, position
media_asset       id, storage_key, mime, byte_size, width?, height?,
                  dominant_color?, blur_placeholder?, alt_text?, source(upload/ai/import),
                  checksum, created_by, created_at
product_slug_history id, product_id(FK), old_slug, created_at   # redirects 301 SEO
```

- **Categorías/subcategorías con imagen**: `category.parent_id` (auto-relación) + `category.image_id`.
- **1–6 imágenes por producto**: `product_media` con `position 0..5` y CHECK de cardinalidad.
- **Specs estructuradas** (no texto libre): `spec_group` + `spec_item` (`value_num`+`unit` habilita filtros/comparación).
- `media_asset.source = 'ai'` marca imágenes generadas por IA ([17](./modulos/17-modulo-ia-gateway.md)).
- Reglas de publicación (qué falta para pasar a `PUBLISHED`): ver [10](./modulos/10-modulo-catalogo.md) §Publicación.

### inventory (`schema/inventory.ts`)

```
stock_item        id, variant_id(FK unique), on_hand(int), reserved(int),
                  reorder_point?(int), updated_at        # available = on_hand - reserved
stock_reservation id, variant_id(FK), order_id?(FK), quantity(int),
                  status(ReservationStatus), expires_at, created_at
stock_movement    id, variant_id(FK), type(StockMovementType), quantity(int, signo),
                  reason?, ref_type?, ref_id?, created_by, created_at
```

- `stockStatus` de las cards se deriva: `available>0 → IN_STOCK`, `=0 && reorder pendiente → SOON`, `else OUT_OF_STOCK`.
- Reservas con TTL + job de expiración ([13](./modulos/13-modulo-inventario.md), [32](./32-jobs-y-async.md)).

### pricing (`schema/pricing.ts`)

```
price               id, variant_id(FK), list_id(FK), amount_minor, currency,
                     valid_from, valid_to?, created_by, created_at
price_list          id, name, is_default, currency
supplier_cost       id, variant_id(FK), supplier_id(FK), cost_amount_minor, currency,
                     valid_from, valid_to?, created_at     # costo proveedor (dropshipping) → margen
markup_rule         id, scope(global/category/product), scope_id?, kind(percent/fixed),
                     value, min_margin_pct?, is_active, created_by, created_at
discount            id, code?, kind(percent/fixed), value, scope, scope_id?,
                     valid_from, valid_to?, max_uses?, used_count, is_active
```

- El **precio final lo calcula el backend** a partir de `supplier_cost` + `markup_rule` (o precio manual),
  respetando `min_margin_pct`. El frontend nunca envía precio confiable. Ver [14](./modulos/14-modulo-pricing.md).
- `compare_at_amount_minor` del producto = `price` vigente de una lista "PVP" o precio previo (para tachado).

### orders (`schema/orders.ts`)

```
cart              id, customer_id?(FK nullable=anónimo), status, currency, created_at, updated_at, expires_at?
cart_item         id, cart_id(FK), variant_id(FK), quantity, unit_price_snapshot_minor, added_at
order             id, order_number(unique, human), customer_id(FK), status(OrderStatus),
                  channel(store/admin_manual), currency,
                  subtotal_minor, shipping_minor, discount_minor, tax_minor, total_minor,
                  shipping_method(ShippingMethod), shipping_address_id?(FK customer_address),
                  placed_by?(admin_user_id si manual), notes?, created_at, updated_at
order_line        id, order_id(FK), variant_id(FK), product_title_snapshot, sku_snapshot,
                  quantity, unit_price_minor, line_total_minor, supplier_cost_snapshot_minor?
order_status_event id, order_id(FK), from_status, to_status, reason?, actor_id, created_at
shipment          id, order_id(FK), carrier?, tracking_code?, status(ShipmentStatus),
                  eta?, created_at, updated_at
shipment_event    id, shipment_id(FK), status(ShipmentStatus), description?, occurred_at
idempotency_key   id, key(unique), actor_id, route, request_hash,
                  response_status, response_ref, created_at, expires_at
```

- **Snapshots** en `order_line` (título, sku, precio, costo): la orden es un documento histórico inmutable;
  cambios futuros en catálogo/pricing no la alteran. Esto habilita finanzas correctas.
- `channel = admin_manual` soporta la **venta asistida** que crea el dueño desde el panel.
- `supplier_cost_snapshot_minor` por línea = base del **margen** que consume finanzas.

### finance (`schema/finance.ts`)

```
commercial_document id, type(DocumentType), number(unique per type/serie), order_id?(FK),
                    customer_id?(FK), status(DocumentStatus), issued_at?,
                    total_minor, currency, pdf_storage_key?, created_by, created_at
document_download   id, document_id(FK), actor_id, ip, created_at     # auditoría de descarga
finance_period_snapshot id, period(YYYY-MM), revenue_minor, cost_minor, margin_minor,
                    orders_count, computed_at        # cache de reportes (recomputable)
```

- Documentos: numeración correlativa, PDF determinístico, descarga autorizada por URL firmada. Ver [16](./modulos/16-modulo-finanzas.md).
- Los reportes se **derivan** de `order`/`order_line`; `finance_period_snapshot` es cache invalidable.

### suppliers (`schema/suppliers.ts`)

```
supplier          id, name, slug(unique), contact?, api_config_enc?, is_active, created_at
supplier_feed     id, supplier_id(FK), kind(csv/api), source_url?, schedule?, last_run_at?, status
supplier_product_map id, supplier_id(FK), external_id, variant_id?(FK), raw(jsonb), synced_at
```

Ver [20](./modulos/20-modulo-suppliers.md).

### ai-gateway (`schema/ai.ts`)

```
ai_generation     id, kind(description/specs/seo/image/recommendation), target_type, target_id?,
                  prompt_ref, status, cost_estimate_minor?, actor_id, created_at, completed_at
ai_alert          id, kind(price/stock/trend), payload(jsonb), status, created_at, resolved_at
```

Ver [17](./modulos/17-modulo-ia-gateway.md).

### shared / infra (`schema/shared.ts`)

```
outbox            id, aggregate_type, aggregate_id, event_type, payload(jsonb),
                  status(pending/processed/failed), attempts, available_at, created_at, processed_at
audit_log         id, actor_id, actor_type, action, resource_type, resource_id,
                  before(jsonb), after(jsonb), ip, user_agent, request_id, reason?, created_at
setting           id, key(unique), value(jsonb), updated_by, updated_at   # configuración de tienda
feature_flag      id, key(unique), enabled(bool), owner, review_at?, description
```

---

## Índices mínimos (medir y ajustar)

```sql
CREATE INDEX idx_products_status_category   ON product(status, category_id);
CREATE INDEX idx_products_slug              ON product(slug);
CREATE INDEX idx_variants_product_active    ON product_variant(product_id, is_active);
CREATE INDEX idx_product_media_product_pos  ON product_media(product_id, position);
CREATE INDEX idx_categories_parent_pos      ON category(parent_id, position);
CREATE INDEX idx_customers_name             ON customer USING gin (to_tsvector('spanish', first_name||' '||last_name));
CREATE INDEX idx_customers_whatsapp         ON customer(whatsapp);
CREATE INDEX idx_orders_customer_created    ON "order"(customer_id, created_at DESC);
CREATE INDEX idx_orders_status              ON "order"(status);
CREATE INDEX idx_order_lines_order          ON order_line(order_id);
CREATE INDEX idx_shipments_order            ON shipment(order_id);
CREATE INDEX idx_stock_reservation_expiry   ON stock_reservation(status, expires_at);
CREATE INDEX idx_outbox_pending             ON outbox(status, available_at);
-- Búsqueda de catálogo: pg_trgm sobre product.title para autocomplete tolerante
CREATE INDEX idx_product_title_trgm         ON product USING gin (title gin_trgm_ops);
```

## Migraciones

- Versionadas con Drizzle. Nombre claro por cambio.
- Cambios destructivos: patrón **expand/contract** (agregar → backfill por lotes → migrar lectura → contraer).
- Índices grandes: `CREATE INDEX CONCURRENTLY`.
- Toda migración debe poder correr **desde cero** (test de migración en CI, ver [31](./31-testing.md)).

## Semillas (`packages/database/src/seeds`)

Seed de desarrollo que replica el mock del store (categorías reales: Refrigeradores, Computadoras,
Lavadoras, Celulares, Electrodomésticos, Imagen, Aspiradoras, Audio y Video; ~productos demo con specs,
6 imágenes, variantes color/capacidad) para que el admin y el store tengan datos coherentes desde el día 1.
