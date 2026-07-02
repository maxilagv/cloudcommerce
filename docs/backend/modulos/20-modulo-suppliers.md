# 20 · Módulo Suppliers y Feeds (dominio `suppliers`)

> **Motor del dropshipping.** Este dominio conecta la tienda con los proveedores externos: importa su
> catálogo, fija precio con markup, mantiene stock sincronizado, reenvía cada pedido confirmado al
> proveedor correcto y recibe de vuelta el tracking del envío. Es el único módulo que, por diseño, habla
> con sistemas de terceros no confiables en ambas direcciones (salida: fetch de feeds y forward de pedidos;
> entrada: webhooks de fulfillment). Por eso la seguridad (SSRF, firma de webhooks, validación de
> respuestas) no es un anexo: es parte del contrato.

Documento de **diseño**, no de implementación. Los tipos y DDL son ilustrativos. La verdad de datos es
[../04-modelo-de-datos.md](../04-modelo-de-datos.md); las convenciones de API, [../05-convenciones-api.md](../05-convenciones-api.md);
validaciones, [../06-validaciones.md](../06-validaciones.md); auth/permisos, [../07-auth-identidad.md](../07-auth-identidad.md);
seguridad, [../08-seguridad.md](../08-seguridad.md).

---

## 1. Propósito y alcance

### 1.1 Rol en el flujo dropshipping

El dueño no fabrica ni almacena: **revende**. El proveedor tiene el producto, el precio de costo y la
capacidad de envío. Este módulo automatiza las tres uniones críticas con el proveedor:

1. **Entrada de catálogo** — el proveedor publica su catálogo (CSV o API). El módulo lo trae, lo mapea al
   catálogo interno ([./10-modulo-catalogo.md](./10-modulo-catalogo.md)), fija el precio con markup
   ([./14-modulo-pricing.md](./14-modulo-pricing.md)) y sincroniza stock ([./13-modulo-inventario.md](./13-modulo-inventario.md)).
2. **Salida de pedidos** — cuando una orden se **confirma** ([./15-modulo-ordenes.md](./15-modulo-ordenes.md)),
   el módulo reenvía las líneas correspondientes a la API del proveedor para que despache.
3. **Entrada de fulfillment** — el proveedor notifica preparación/despacho/tracking por webhook; el módulo
   actualiza el `shipment` de la orden.

Fronteras (qué **no** hace este módulo):

- No decide precio final: **delega** el cálculo a pricing (`supplier_cost` + `markup_rule`).
- No es dueño del stock: **emite movimientos** `IMPORT` hacia inventory; el saldo lo administra inventory.
- No crea productos "por su cuenta": propone/actualiza, respetando los **overrides manuales del dueño** (§6).
- No cobra ni paga: pagos al cliente (Stripe) viven en `payments`; la conciliación de costo es finanzas.
- No genera órdenes: consume el evento `OrderConfirmed` que emite el dominio `orders`.

### 1.2 Diagrama del flujo

```
                          ┌──────────────────────── PROVEEDOR (tercero, no confiable) ─────────────────────────┐
                          │  Feed CSV/API        API de pedidos            Webhook de fulfillment/tracking       │
                          └────┬───────────────────────▲─────────────────────────┬───────────────────────────── ┘
   IMPORT (pull, programado)   │                        │ forward (push)          │ fulfillment (push)
                               ▼                        │                         ▼
        ┌──────────────────────────────────┐   ┌────────┴─────────────┐  ┌──────────────────────────────────┐
        │  Feed pipeline (job)             │   │ ForwardOrderToSupplier│  │ HandleSupplierWebhook (REST)     │
        │  fetch → validate → map → upsert │   │ (job, idempotente)    │  │ verif. firma → anti-replay →     │
        └───────┬──────────┬──────────┬────┘   └────────▲─────────────┘  │ idempotencia eventId → schema    │
                │          │          │                 │                └──────────────┬───────────────────┘
      catálogo  │  pricing │ inventory│      OrderConfirmed (outbox)                    │ actualiza
                ▼          ▼          ▼                 │                                ▼
        ┌────────────┐ ┌────────┐ ┌──────────┐   ┌──────┴───────┐                 ┌──────────────┐
        │  product   │ │supplier│ │  stock   │   │   orders     │                 │  shipment    │
        │  variant   │ │ _cost  │ │ movement │   │ (dominio 15) │                 │ shipment_event│
        │            │ │+markup │ │ (IMPORT) │   └──────────────┘                 │ (dominio 15) │
        └────────────┘ └────────┘ └──────────┘                                    └──────────────┘
                ▲
        supplier_product_map  (external_id ↔ variant_id, raw jsonb, detección de cambios)
```

Todo lo que cruza la frontera del proveedor pasa por una **capa anticorrupción** (`infra/integrations/`):
la respuesta del proveedor se **valida con schema** antes de tocar el dominio ([../06-validaciones.md](../06-validaciones.md)
§Validación de terceros; [../08-seguridad.md](../08-seguridad.md) §Unsafe Consumption of APIs).

---

## 2. Entidades y tablas

Esquema canónico en [../04-modelo-de-datos.md](../04-modelo-de-datos.md) (`schema/suppliers.ts`). Se
respetan las convenciones globales: PK `uuid` (UUIDv7 en app), `created_at`/`updated_at timestamptz`,
enums por `pgEnum`, dinero en `*_amount_minor` + `*_currency`, FK con `ON DELETE` explícito, snake_case en
DB / camelCase en TS.

### 2.1 Tablas canónicas (04) — el mínimo que ya está fijado

```txt
supplier             id, name, slug(unique), contact?, api_config_enc?, is_active, created_at
supplier_feed        id, supplier_id(FK), kind(csv/api), source_url?, schedule?, last_run_at?, status
supplier_product_map id, supplier_id(FK), external_id, variant_id?(FK), raw(jsonb), synced_at
```

Y en el dominio **pricing** (fuente del margen):

```txt
supplier_cost        id, variant_id(FK), supplier_id(FK), cost_amount_minor, currency,
                     valid_from, valid_to?, created_at
```

### 2.2 Detalle de diseño por tabla

**`supplier`** — el proveedor.

| Campo | Tipo | Notas de diseño |
|---|---|---|
| `id` | uuid | UUIDv7. |
| `name` | text | Nombre comercial. |
| `slug` | text unique | Estable, para referencias y logs. |
| `contact` | jsonb? | Email/teléfono/persona. PII mínima; no exponer al store. |
| `api_config_enc` | bytea/text? | **Config de API cifrada** (§9.3): base URL, credenciales, esquema de auth, mapa de campos por defecto. Cifrado con clave gestionada (KMS/secret manager), **nunca** en claro en DB ni en logs. |
| `is_active` | bool | Activo/inactivo: un proveedor inactivo no corre feeds ni recibe forwards; sus productos se marcan (no se borran). |
| `default_markup_rule_id` | uuid? | (extensión) markup por defecto al importar de este proveedor; delega a pricing. |
| `created_at` | timestamptz | |

**`supplier_feed`** — la fuente de importación (un proveedor puede tener varios feeds).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `supplier_id` | uuid FK → supplier | `ON DELETE CASCADE` (feed no existe sin proveedor). |
| `kind` | enum `csv`\|`api` | CSV = archivo por `source_url`; API = endpoint paginado. |
| `source_url` | text? | URL del CSV o base del endpoint. **Sujeto a SSRF** (§9.1): validado contra allowlist. |
| `schedule` | text? | Cron (p. ej. `0 */6 * * *`). Vacío = solo manual. |
| `last_run_at` | timestamptz? | Última corrida (éxito o intento). |
| `status` | enum | `IDLE` \| `RUNNING` \| `OK` \| `PARTIAL` \| `FAILED` \| `DISABLED`. |
| `last_run_summary` | jsonb? | (extensión) contadores de la última corrida: leídos, creados, actualizados, saltados, errores. |
| `field_map` | jsonb? | (extensión) mapa declarativo columna-proveedor → campo-canónico (ver §5.3). |

**`supplier_product_map`** — el puente `external_id ↔ variant_id`. Corazón de la idempotencia de import.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `supplier_id` | uuid FK | |
| `external_id` | text | ID/SKU del producto en el sistema del proveedor. **UNIQUE(`supplier_id`, `external_id`)**. |
| `variant_id` | uuid? FK → product_variant | Nullable: puede existir el mapeo antes de resolver a qué variante interna corresponde (alta pendiente de revisión). |
| `raw` | jsonb | Última fila/objeto crudo del proveedor (normalizado, claves peligrosas bloqueadas — §9). Sirve para auditoría, detección de cambios y reproceso. |
| `content_hash` | text | (extensión) hash del `raw` relevante (precio+stock+estado) para **detección de cambios** barata (§2.3). |
| `last_seen_at` | timestamptz | (extensión) última vez que el feed lo trajo → detectar **discontinuados** (no vino en la última corrida). |
| `sync_status` | enum | (extensión) `LINKED` \| `PENDING_REVIEW` \| `CONFLICT` \| `DISCONTINUED`. |
| `synced_at` | timestamptz | Última sincronización efectiva. |

**`supplier_order_ref`** (extensión sugerida, dominio suppliers) — traza el reenvío de un pedido a un
proveedor. Evita duplicar forwards y permite correlacionar el webhook de tracking con la orden.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `order_id` | uuid FK → order | |
| `supplier_id` | uuid FK → supplier | Una orden con líneas de varios proveedores genera **varios** `supplier_order_ref`. |
| `external_order_id` | text? | ID que devuelve el proveedor al aceptar el pedido. |
| `status` | enum | `PENDING` \| `SENT` \| `ACCEPTED` \| `REJECTED` \| `FAILED`. |
| `idempotency_key` | text unique | Clave con la que se hizo el forward (§casos de uso 3.5). `UNIQUE(order_id, supplier_id)`. |
| `attempts` | int | Reintentos hechos. |
| `last_error` | text? | Motivo del último fallo (sin secretos). |
| `created_at`/`updated_at` | timestamptz | |

> `shipment` y `shipment_event` viven en `orders` ([./15-modulo-ordenes.md](./15-modulo-ordenes.md)); este
> módulo **no** define tabla de envío propia, solo la actualiza vía caso de uso del dominio orders.

### 2.3 Detección de cambios

Por cada fila del feed se compara contra `supplier_product_map`:

- **precio** cambió (`cost_amount_minor`) → nueva fila `supplier_cost` con `valid_from = now`, cierra la
  anterior (`valid_to`); recalcular precio de venta vía pricing.
- **stock** cambió → `stock_movement` tipo `IMPORT` con el delta hacia inventory.
- **baja/discontinuado** → el `external_id` **no** apareció en la corrida (comparar `last_seen_at`) o vino
  con flag de baja → marcar `sync_status = DISCONTINUED` y accionar según política (§11).

`content_hash` permite saltar filas sin cambios (idempotencia + performance): si el hash coincide, solo se
actualiza `last_seen_at`.

---

## 3. Casos de uso (application)

Cada caso de uso declara, según [.claude/Skills/backend/backend.md](../../../.claude/Skills/backend/backend.md)
§3.4: **actor**, **input validado**, **permiso**, **transacción**, **eventos**, **errores**. Recibe un
`Actor` tipado ([../07-auth-identidad.md](../07-auth-identidad.md) §Contexto de auth), nunca el request crudo.

### 3.1 `CreateSupplier`

- **Actor**: `admin` con rol `OWNER`/`ADMIN`.
- **Input**: `{ name, slug?, contact?, apiConfig? }` (schema Zod `CreateSupplierSchema`). `apiConfig` = base
  URL (validada SSRF), esquema de auth (`api_key`|`bearer`|`hmac`), credenciales.
- **Permiso**: `supplier.create` (solo OWNER/ADMIN — §7).
- **Transacción**: insert `supplier`; `api_config_enc` se **cifra antes** de persistir; nunca se loggea.
- **Eventos**: `SupplierCreated` (outbox, sin secretos en payload).
- **Errores**: `VALIDATION_FAILED`, `CONFLICT` (slug duplicado), `FORBIDDEN`, `SSRF_BLOCKED` (base URL en red
  privada → mapea a `VALIDATION_FAILED` con detalle).

### 3.2 `ConfigureFeed`

- **Actor**: `admin` `OWNER`/`ADMIN`.
- **Input**: `{ supplierId, kind: 'csv'|'api', sourceUrl?, schedule?, fieldMap? }`. `sourceUrl` obligatorio si
  `kind` lo requiere; `schedule` = cron válido u opcional.
- **Permiso**: `supplier.feed.configure`.
- **Transacción**: upsert `supplier_feed`. Valida `sourceUrl` **en el momento de guardar** (SSRF) y de nuevo
  **en cada corrida** (una URL puede resolver distinto en el tiempo — rebind DNS). Registra `schedule` en el
  scheduler de jobs ([../32-jobs-y-async.md](../32-jobs-y-async.md)).
- **Eventos**: `SupplierFeedConfigured`.
- **Errores**: `VALIDATION_FAILED` (cron inválido, URL inválida), `SSRF_BLOCKED`, `RESOURCE_NOT_FOUND`
  (supplier inexistente), `FORBIDDEN`.

### 3.3 `RunFeedImport`

El caso de uso central de la entrada de catálogo. Puede dispararlo el scheduler (actor `system`) o el dueño
manualmente (actor `admin`).

- **Actor**: `system` (job programado) o `admin` `OWNER`/`ADMIN`/`CATALOG_MANAGER` (corrida manual).
- **Input**: `{ feedId, mode?: 'full'|'incremental', dryRun?: boolean }`.
- **Permiso**: `supplier.feed.run` (manual). El scheduler corre como `system`.
- **Transacción**: **no** es una única transacción gigante. Se procesa **por lotes** (chunking) para no
  bloquear el event loop ni tomar locks largos; cada lote de N filas es su propia transacción (upsert map +
  supplier_cost + stock_movement + product/variant). Ver pipeline en §5. `dryRun` valida y reporta sin
  persistir.
- **Concurrencia**: lock por `feedId` (Redis) — una sola corrida por feed a la vez; si ya corre, `CONFLICT`.
- **Eventos**: por cada producto afectado `SupplierProductImported`; al terminar, `SupplierFeedRunCompleted`
  con contadores. Cambios de precio/stock emiten los eventos de pricing/inventory correspondientes.
- **Errores**: `RESOURCE_NOT_FOUND` (feed), `CONFLICT` (corrida en curso), `UPSTREAM_UNAVAILABLE` (fetch
  falla), `VALIDATION_FAILED` (feed con formato inesperado → corrida `FAILED`), `PARTIAL` (algunas filas
  fallan → `status = PARTIAL`, ver §11.1).

### 3.4 `MapSupplierProduct`

Resuelve manualmente un `external_id` sin `variant_id` o corrige un mapeo (el import puede dejar altas en
`PENDING_REVIEW` cuando no puede resolver la correspondencia automáticamente).

- **Actor**: `admin` `OWNER`/`ADMIN`/`CATALOG_MANAGER`.
- **Input**: `{ supplierId, externalId, variantId }` (crear vínculo) o `{ mapId, variantId }` (recolocar).
- **Permiso**: `supplier.map.link`.
- **Transacción**: update `supplier_product_map.variant_id`, `sync_status = LINKED`. Revalida invariante:
  una `variant_id` **no** puede quedar mapeada a dos `external_id` **del mismo proveedor** (conflicto, §11.3).
- **Eventos**: `SupplierProductMapped`.
- **Errores**: `VALIDATION_FAILED`, `CONFLICT` (variante ya mapeada / mapeo ambiguo), `RESOURCE_NOT_FOUND`.

### 3.5 `ForwardOrderToSupplier`

Reenvío automático del pedido al proveedor. **Nunca** lo dispara HTTP directo: lo dispara el worker que
consume `OrderConfirmed` desde el outbox.

- **Actor**: `system` (worker de fulfillment).
- **Input**: `{ orderId, supplierId }` (una orden con líneas de varios proveedores genera **un forward por
  proveedor**; se agrupan las `order_line` por proveedor vía `supplier_product_map`/`supplier_cost`).
- **Permiso**: interno; no expuesto a usuarios.
- **Transacción/idempotencia**: se crea/lee `supplier_order_ref` con `idempotency_key` determinística
  (`hash(orderId + supplierId)`). Si ya está `SENT`/`ACCEPTED`, **no** se reenvía (idempotente ante
  reintentos de cola). La llamada saliente usa la config cifrada del proveedor y **valida la respuesta con
  schema** antes de confiar. Al aceptar, guarda `external_order_id` y `status = ACCEPTED`.
- **Eventos**: `SupplierOrderForwarded` (éxito) o registro de fallo para reintento con backoff.
- **Errores**: `UPSTREAM_UNAVAILABLE` (proveedor caído → reintento), `VALIDATION_FAILED` (respuesta del
  proveedor no cumple schema), `SUPPLIER_REJECTED` (rechazo de negocio → alerta al dueño, no reintentar en
  loop), `CONFLICT` (ya forwardeado). Datos que impiden el envío (dirección inválida, línea sin proveedor) →
  no se fuerza; se marca la orden para revisión manual.

### 3.6 `HandleSupplierWebhook`

Entrada de fulfillment/tracking. Vive en `interfaces/webhooks/` (REST), verifica **antes** de tocar el
dominio ([../08-seguridad.md](../08-seguridad.md) §Webhooks).

- **Actor**: `system` (identidad del proveedor probada por firma).
- **Input**: cuerpo crudo del webhook + headers de firma/timestamp. Se valida: **firma HMAC** (o mecanismo
  oficial), **timestamp anti-replay** (ventana p. ej. 5 min), **idempotencia por `eventId`**, **schema** del
  payload, IP allowlist si el proveedor la ofrece.
- **Permiso**: n/a (autenticación por firma, no por rol).
- **Transacción**: mapea `external_order_id` → `order`/`shipment` (vía `supplier_order_ref`) y delega en el
  dominio orders la actualización de `shipment`/`shipment_event` (crear guía, carrier, tracking_code, cambio
  de `ShipmentStatus`). Registra el `eventId` procesado para rechazar duplicados.
- **Eventos**: `SupplierShipmentUpdated` → orders emite a su vez `ShipmentStatusChanged` (dispara email de
  tracking vía [../32-jobs-y-async.md](../32-jobs-y-async.md)).
- **Errores** (respuesta HTTP al proveedor): `401`/`403` firma inválida; `409`/`200` idempotente si `eventId`
  ya visto (responder 200 para que no reintente); `422` schema inválido; `404` si no correlaciona con
  ninguna orden (loggear, no filtrar detalle). Nunca devolver 5xx por error de negocio recuperable si eso
  provoca reintentos infinitos del proveedor.

---

## 4. Endpoints

### 4.1 tRPC `suppliers.*` (panel admin)

Sobre el router raíz `appRouter.suppliers` ([../05-convenciones-api.md](../05-convenciones-api.md)). Todos
`adminProcedure`; la autorización fina vive en el caso de uso. Input siempre Zod de `packages/validators`.

```txt
# Proveedores
suppliers.list({ cursor?, limit?, isActive? })            → query   (OWNER/ADMIN/CATALOG_MANAGER lectura)
suppliers.get({ supplierId })                             → query
suppliers.create(CreateSupplierSchema)                    → mutation (OWNER/ADMIN)
suppliers.update({ supplierId, ...patch })                → mutation (OWNER/ADMIN)
suppliers.setActive({ supplierId, isActive })             → mutation (OWNER/ADMIN)
suppliers.setApiConfig({ supplierId, apiConfig })         → mutation (OWNER/ADMIN)  # cifra; nunca devuelve secreto

# Feeds
suppliers.feeds.list({ supplierId })                      → query
suppliers.feeds.configure(ConfigureFeedSchema)            → mutation (OWNER/ADMIN)
suppliers.feeds.run({ feedId, mode?, dryRun? })           → mutation (OWNER/ADMIN/CATALOG_MANAGER)
suppliers.feeds.runs({ feedId, cursor?, limit? })         → query   # historial de corridas + contadores

# Mapeo
suppliers.map.list({ supplierId, status?, cursor?, limit? }) → query
suppliers.map.link(MapSupplierProductSchema)              → mutation (OWNER/ADMIN/CATALOG_MANAGER)
suppliers.map.resolveConflict({ mapId, resolution })      → mutation

# Pedidos a proveedor (observabilidad; el forward real es automático)
suppliers.orders.refs({ orderId })                        → query   # estado de reenvío por proveedor
suppliers.orders.retryForward({ orderId, supplierId })    → mutation (OWNER/ADMIN)  # Idempotency-Key
```

- Listados con **cursor pagination** (default 24 / 50 máx export controlado) y **filtros por whitelist**.
- Presenters tipados: **nunca** exponen `api_config_enc`, credenciales ni `cost_amount_minor` crudo a roles
  sin permiso de costo (BOPLA — [../06-validaciones.md](../06-validaciones.md) §salida).
- `retryForward` usa `Idempotency-Key` ([../05-convenciones-api.md](../05-convenciones-api.md) §Idempotencia).

### 4.2 Webhook REST del proveedor

```txt
POST /api/v1/webhooks/suppliers/:supplierSlug/fulfillment
```

- **No autenticado por sesión**: autenticado por **firma** del proveedor (HMAC del cuerpo crudo con el
  secreto compartido guardado cifrado en `supplier.api_config_enc`).
- Requiere **cuerpo crudo** (no parseado) para verificar la firma antes de deserializar.
- Rate limit por `proveedor + firma + IP allowlist` ([../08-seguridad.md](../08-seguridad.md) §Rate limiting).
- Respuestas: `2xx` procesado/idempotente; `401/403` firma; `422` schema; nunca detalle interno.
- Documentado en OpenAPI (endpoint público REST → contrato vivo, §Improper Inventory Management).

---

## 5. Procesamiento de feed (pipeline)

`RunFeedImport` ejecuta una tubería determinística. Trabajo pesado en **worker/cola**, no en request path
([../08-seguridad.md](../08-seguridad.md) §Node runtime; [../32-jobs-y-async.md](../32-jobs-y-async.md)).

```
fetch ─▶ parse ─▶ validate ─▶ normalize ─▶ map ─▶ diff ─▶ upsert(catálogo · precio · stock) ─▶ report
```

### 5.1 `fetch`

- **CSV**: descarga desde `source_url`. **SSRF-safe** (§9.1): allowlist de host, bloqueo de redes privadas,
  validación de la IP resuelta, bloqueo de redirects a rangos privados, solo `http/https`, límite de tamaño
  y timeout. Streaming a disco/temp (no cargar archivo gigante entero en memoria).
- **API**: llamada paginada con la config cifrada; cursor/offset del proveedor; timeout y reintentos con
  backoff por página. Respeta rate limit del proveedor.

### 5.2 `parse`

- CSV con parser en streaming (por fila), no acumulando todo. Delimitador/encoding declarados en `field_map`.
- API: JSON por página. Claves peligrosas (`__proto__`, `prototype`, `constructor`) **descartadas** al
  construir objetos ([../08-seguridad.md](../08-seguridad.md) §Prototype pollution).

### 5.3 `validate` + `normalize`

- Cada fila pasa por un **schema Zod de fila de proveedor** (en `packages/validators`) — la respuesta del
  tercero **no se confía** hasta validarse. Filas que no cumplen → se **saltan** y se cuentan (no abortan la
  corrida entera; ver `PARTIAL`, §11.1).
- Normalización: trim, dinero a `amountMinor` (nunca float), unidades, mapeo de columnas del proveedor a
  campos canónicos según `field_map` declarativo. El costo del proveedor **siempre** entra como `Money`
  entero.

### 5.4 `map`

- Buscar `supplier_product_map` por `(supplier_id, external_id)`.
  - Existe con `variant_id` → actualizar.
  - Existe sin `variant_id` → queda `PENDING_REVIEW` (requiere `MapSupplierProduct`).
  - No existe → **alta**: crear map + (según política del proveedor/feed) crear producto/variante en
    `DRAFT` en el catálogo, o dejar `PENDING_REVIEW` para curaduría manual del dueño. El alta automática de
    productos publicables **no** ocurre sin revisión: entran como borrador.
- `raw` jsonb se guarda para auditoría; `content_hash` se calcula sobre los campos relevantes.

### 5.5 `diff` + `upsert` (catálogo · precio · stock)

Por cada fila mapeada, dentro de la transacción del lote:

- **Catálogo** ([./10-modulo-catalogo.md](./10-modulo-catalogo.md)): actualizar campos que el proveedor
  gobierna (título base, specs de origen, media si aplica) **respetando overrides manuales del dueño** (§6).
- **Pricing** ([./14-modulo-pricing.md](./14-modulo-pricing.md)): si el costo cambió, crear `supplier_cost`
  nuevo (cierra el anterior con `valid_to`) y **delegar** el recálculo del precio de venta a la
  `markup_rule` aplicable, respetando `min_margin_pct`. Este módulo **no** fija PVP: pide a pricing que lo
  derive.
- **Inventario** ([./13-modulo-inventario.md](./13-modulo-inventario.md)): si el stock cambió, emitir
  `stock_movement` tipo `IMPORT` con el delta. Inventory administra el saldo (`on_hand`), previene overselling
  y deriva `StockStatus`.
- Actualizar `supplier_product_map`: `last_seen_at = now`, `synced_at = now`, `content_hash`, `sync_status`.

### 5.6 `report`

- Contadores: leídos, creados, actualizados, sin cambios, saltados (con motivo), discontinuados, errores.
- Persistir en `supplier_feed.last_run_summary` + `status` (`OK`/`PARTIAL`/`FAILED`), `last_run_at`.
- Emitir `SupplierFeedRunCompleted`; si hubo discontinuados o conflictos, generar `ai_alert`/notificación al
  dueño para curaduría.

---

## 6. Reglas e invariantes

1. **No pisar overrides manuales del dueño.** Si el dueño editó un campo en el panel (título, descripción,
   precio manual, imagen principal, estado de publicación), el import **no** lo sobrescribe. Se implementa
   con un registro de "campos gobernados por proveedor vs. campos con override manual" (flag/columna
   `manual_override` por campo o un set de campos bloqueados por producto). El proveedor manda costo y stock;
   el dueño manda presentación y decisión de publicar. Ante conflicto, **gana el override manual** y se
   registra la divergencia como alerta, nunca se descarta silenciosamente el dato del proveedor (se guarda en
   `raw`).
2. **Markup mínimo garantizado.** El precio de venta derivado **nunca** puede violar `min_margin_pct` de la
   `markup_rule` ([./14-modulo-pricing.md](./14-modulo-pricing.md)). Si un costo nuevo del proveedor haría el
   margen menor al mínimo, pricing **no** publica ese precio: marca el producto para revisión / lo pausa y
   alerta. No se vende a pérdida por un feed.
3. **Idempotencia de import.** Reprocesar el mismo feed no duplica productos ni movimientos: la unicidad
   `(supplier_id, external_id)` y el `content_hash` garantizan upsert idempotente. Un `stock_movement IMPORT`
   se emite solo por el **delta** real, no por cada corrida.
4. **El backend recalcula precio; el proveedor no lo dicta como PVP.** El costo del proveedor es insumo, no
   precio final ([../06-validaciones.md](../06-validaciones.md) §Dinero).
5. **Forward idempotente.** Una orden se reenvía **una sola vez por proveedor** (`supplier_order_ref` +
   idempotency key). Reintentos de cola no generan pedidos duplicados al proveedor.
6. **Webhook nunca confiado sin verificar.** Sin firma válida + anti-replay + idempotencia por `eventId`, el
   evento no toca el dominio.
7. **Proveedor inactivo = congelado.** `is_active=false`: no corre feeds, no recibe forwards; sus productos no
   se borran (histórico de órdenes lo referencia) sino que se pausan/marcan.
8. **Costo es dato sensible.** `supplier_cost`/`api_config_enc` no se filtran a roles sin permiso ni a la IA
   sin autorización ([../07-auth-identidad.md](../07-auth-identidad.md); [../08-seguridad.md](../08-seguridad.md)).

---

## 7. Permisos

Matriz específica del módulo (extracto de [../07-auth-identidad.md](../07-auth-identidad.md), versionada en
`permission_grant`). El forward y el webhook son flujos `system`, no accesibles por rol de usuario.

| Acción | OWNER | ADMIN | CATALOG_MANAGER | FINANCE | SUPPORT |
|---|:--:|:--:|:--:|:--:|:--:|
| Ver proveedores / feeds | ✔ | ✔ | ✔ | lectura | ✖ |
| Crear/editar proveedor | ✔ | ✔ | ✖ | ✖ | ✖ |
| Configurar API/secretos del proveedor | ✔ | ✔ | ✖ | ✖ | ✖ |
| Configurar / correr feed | ✔ | ✔ | ✔ | ✖ | ✖ |
| Mapear producto de proveedor | ✔ | ✔ | ✔ | ✖ | ✖ |
| Ver costo de proveedor (`supplier_cost`) | ✔ | ✔ | ✖ (o restringido) | ✔ | ✖ |
| Reintentar reenvío de pedido | ✔ | ✔ | ✖ | ✖ | ✖ |
| Ver estado de reenvío / tracking de la orden | ✔ | ✔ | ✖ | ✔ | con motivo |

- El middleware `adminProcedure` verifica autenticación + rol grueso; el caso de uso decide el permiso fino y
  registra motivo cuando aplica ([../07-auth-identidad.md](../07-auth-identidad.md) §Motivos de acceso).

---

## 8. Eventos

Emitidos vía **outbox transaccional** ([../04-modelo-de-datos.md](../04-modelo-de-datos.md) `outbox`;
patrón en la skill §11.7). Payload mínimo (IDs, no datos completos ni secretos).

| Evento | Cuándo | Payload (resumen) | Consumidores |
|---|---|---|---|
| `SupplierCreated` / `SupplierFeedConfigured` | ABM proveedor/feed | `supplierId`, `feedId` | auditoría |
| `SupplierProductImported` | producto creado/actualizado por feed | `supplierId`, `externalId`, `variantId?`, `changes[]` (price/stock/status) | catálogo, search index, dashboard |
| `SupplierFeedRunCompleted` | fin de corrida | `feedId`, `status`, contadores | dashboard, alertas |
| `SupplierOrderForwarded` | pedido aceptado por proveedor | `orderId`, `supplierId`, `externalOrderId` | orders, notificaciones internas |
| `SupplierShipmentUpdated` | webhook de fulfillment procesado | `orderId`, `shipmentId`, `status`, `trackingCode?` | orders → `ShipmentStatusChanged` → email tracking |

Eventos relacionados que emiten **otros** dominios y que este consume/genera indirectamente: `OrderConfirmed`
(orders → dispara forward), `PriceChanged`/`StockReserved` (pricing/inventory, tras el upsert del feed).

---

## 9. Seguridad

Este es el módulo con mayor superficie de ataque (habla con terceros). Aplica de forma reforzada
[../08-seguridad.md](../08-seguridad.md).

### 9.1 SSRF (salida)

Toda URL externa (`supplier_feed.source_url`, base de API del proveedor, import de imágenes por URL) pasa por
el guard SSRF ([../08-seguridad.md](../08-seguridad.md) §SSRF):

```txt
- allowlist de hosts/dominios por proveedor (preferido) — no cualquier URL arbitraria
- bloquear: localhost, 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16,
  link-local, 169.254.169.254 (metadata cloud)
- solo http/https; ningún otro protocolo (file://, gopher://, etc.)
- resolver DNS y validar la IP resultante (no solo el hostname) — anti DNS-rebinding
- re-validar en cada corrida y en cada redirect; bloquear redirects hacia rangos privados
- límite de tamaño de descarga y timeout; streaming, no todo en memoria
```

Nunca se permite que el dueño (o un proveedor comprometido) fuerce al backend a leer recursos internos.

### 9.2 Webhooks (entrada)

`HandleSupplierWebhook` verifica **en orden**, antes de tocar el dominio
([../08-seguridad.md](../08-seguridad.md) §Webhooks):

```txt
1. firma HMAC del cuerpo crudo con el secreto del proveedor (o mecanismo oficial)
2. timestamp anti-replay (ventana corta; rechazar viejos/futuros)
3. idempotencia por eventId (tabla de eventos vistos; duplicado → 200 sin re-procesar)
4. schema del payload (Zod) — no confiar en el terceo
5. IP allowlist si el proveedor la publica
6. orden de eventos si importa (no asumir orden; reconciliar por estado)
```

### 9.3 Secretos de API del proveedor

- `api_config_enc` **cifrado en reposo** (clave en secret manager/KMS, no en el repo ni en DB en claro).
- Descifrado solo en memoria, en el momento de la llamada; **nunca** se loggea, ni se devuelve por API, ni se
  envía a la IA.
- Rotación documentada (runbook); secretos separados por ambiente.
- Presenters **jamás** incluyen credenciales (BOPLA). `setApiConfig` acepta pero nunca retorna el secreto.

### 9.4 Validar respuestas del proveedor

Feed, respuesta de forward y webhook: **todo** se valida con schema antes de confiar
([../08-seguridad.md](../08-seguridad.md) §Unsafe Consumption; [../06-validaciones.md](../06-validaciones.md)
§terceros). Capa anticorrupción en `infra/integrations/` traduce el formato del proveedor al modelo interno;
el dominio nunca ve tipos crudos del tercero.

### 9.5 Rate limiting y abuso

- Feeds: cuota de corridas por feed; lock por `feedId` (una a la vez).
- Webhook: rate limit por proveedor+firma+IP; anti-replay ya limita.
- Forward: reintentos con backoff + tope; DLQ para fallos persistentes ([../32-jobs-y-async.md](../32-jobs-y-async.md)).

---

## 10. Jobs (procesos async)

Todos idempotentes, con reintentos limitados, backoff, DLQ, timeout, logs por `jobId` y métricas
([../32-jobs-y-async.md](../32-jobs-y-async.md); skill §19).

| Job | Disparo | Qué hace | Idempotencia |
|---|---|---|---|
| **`feed.scheduled-import`** | cron de `supplier_feed.schedule` | Ejecuta `RunFeedImport` por feed vencido | lock por `feedId`; upsert por `(supplier_id, external_id)` |
| **`feed.manual-import`** | `suppliers.feeds.run` | Igual, en background; devuelve `runId` para seguir progreso | igual |
| **`order.forward-to-supplier`** | consume `OrderConfirmed` del outbox | Agrupa líneas por proveedor y ejecuta `ForwardOrderToSupplier` | `supplier_order_ref` + idempotency key |
| **`order.forward-retry`** | fallo de forward (backoff) | Reintenta forwards `FAILED`/`PENDING` hasta tope; luego DLQ + alerta | idem key; no duplica |
| **`tracking.sync`** | cron (fallback si no hay webhook) o `refresh-tracking` | Poll de estado de envío al proveedor y actualiza `shipment` | por `external_order_id`; solo aplica cambios de estado |
| **`feed.stale-detect`** | cron | Marca `DISCONTINUED` los `external_id` con `last_seen_at` viejo | idempotente por comparación de fecha |

- El worker de fulfillment prefiere **webhook** (push); `tracking.sync` es degradación elegante si el
  proveedor no notifica o el webhook falla ([../08-seguridad.md](../08-seguridad.md) §degradación).

---

## 11. Casos borde

### 11.1 Feed parcial

Algunas filas válidas, otras corruptas / con costo faltante / con `external_id` vacío:

- La corrida **no** aborta por filas malas: las salta, las cuenta y sigue.
- `supplier_feed.status = PARTIAL`; `last_run_summary` detalla motivos de descarte.
- Descarga cortada a mitad (timeout/red): la corrida es `FAILED`, **no** se marcan discontinuados (evita
  borrar catálogo por un fetch incompleto — invariante clave: **nunca discontinuar por ausencia si la corrida
  no completó**). Reintento con backoff.

### 11.2 Producto discontinuado

`external_id` deja de aparecer (o viene con flag de baja):

- Marcar `sync_status = DISCONTINUED`; **no** borrar (órdenes históricas lo referencian por snapshot en
  `order_line`).
- Política configurable: pausar el producto en catálogo (`PAUSED`), poner stock 0 (movimiento `IMPORT` a 0),
  o solo alertar al dueño para decisión. Por defecto: **pausar + alertar**, nunca borrar.
- Pedidos en vuelo hacia ese producto se resuelven manualmente si el proveedor ya no lo despacha.

### 11.3 Conflicto de mapeo

- Mismo `external_id` que resolvería a **dos** variantes internas, o una `variant_id` reclamada por **dos**
  `external_id` del mismo proveedor: el import **no** adivina → deja `sync_status = CONFLICT` y alerta. Se
  resuelve con `suppliers.map.resolveConflict` / `MapSupplierProduct`.
- Un mismo producto ofrecido por **varios proveedores** (multi-sourcing): permitido; cada proveedor tiene su
  `supplier_product_map` y su `supplier_cost`. La selección de proveedor para el forward se decide por regla
  (costo/stock/prioridad) — decisión de negocio, documentada, no silenciosa.

### 11.4 Bordes de forward / webhook

- **Orden multi-proveedor**: se generan varios `supplier_order_ref`; el fulfillment es parcial hasta que
  todos despachan; cada webhook actualiza su porción.
- **Webhook antes del forward confirmado** (evento fuera de orden): se reconcilia por `external_order_id`; si
  aún no existe el ref, se guarda el evento (por `eventId`) y se reintenta la correlación (no se pierde).
- **Reintento del proveedor** del mismo webhook: idempotencia por `eventId` → 200 sin reprocesar.
- **Proveedor rechaza el pedido** (`SUPPLIER_REJECTED`): no reintentar en loop; alertar al dueño para
  resolución (reasignar proveedor, cancelar, reembolsar vía payments/orders).

---

## 12. Definition of Done

Basado en la skill §28 y el checklist de [../05-convenciones-api.md](../05-convenciones-api.md).

```txt
[ ] Reglas (markup mínimo, no pisar overrides, idempotencia de import/forward) viven en
    application/domain, no en controllers ni en el parser del feed.
[ ] Toda entrada externa validada con Zod: input tRPC, filas de feed, respuesta de forward, payload de
    webhook (schema + firma + anti-replay + idempotencia por eventId).
[ ] SSRF guard aplicado a source_url y a la API del proveedor (allowlist, bloqueo de redes privadas,
    validación de IP resuelta, control de redirects). Probado con URLs internas maliciosas.
[ ] api_config_enc cifrado en reposo; nunca se loggea, devuelve ni se envía a IA. Presenters ocultan
    credenciales y costo a roles sin permiso (BOPLA).
[ ] Forward idempotente por (order_id, supplier_id): reintentos de cola no duplican pedidos al proveedor.
[ ] Import idempotente por (supplier_id, external_id) + content_hash: reprocesar no duplica productos ni
    movimientos; stock_movement solo por delta real.
[ ] Delegación correcta: precio → pricing (supplier_cost + markup_rule, min_margin_pct respetado);
    stock → inventory (movement IMPORT). El módulo no fija PVP ni administra saldo directamente.
[ ] Discontinuados nunca se borran; nunca se discontinúa por corrida incompleta (feed parcial/FAILED).
[ ] Eventos por outbox (SupplierProductImported, SupplierOrderForwarded, SupplierShipmentUpdated) con
    payload mínimo (IDs, sin secretos).
[ ] Jobs idempotentes con reintentos, backoff, DLQ, timeout, logs por jobId y métricas.
[ ] Errores tipados mapeados al catálogo de códigos (05). Webhook nunca provoca reintentos infinitos por
    error de negocio recuperable.
[ ] Permisos testeados incluyendo autorización negativa (rol sin permiso ve 403; costo/secretos no se
    filtran). Motivo de acceso registrado donde aplica.
[ ] OpenAPI del webhook REST vivo; tipos tRPC de suppliers.* actualizados.
[ ] Migraciones corren desde cero; smoke test en staging (feed demo → import → orden → forward simulado →
    webhook simulado → tracking actualizado).
[ ] Runbooks: "feed proveedor fallando", "forward al proveedor caído", "webhooks con firma inválida en alza".
```
