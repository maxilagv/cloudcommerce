# 13 · Módulo Inventario (dominio `inventory`)

> Sostiene el **stock visible del catálogo** y **evita el overselling**. Es la fuente de verdad de cuántas
> unidades reales hay, cuántas están comprometidas y cuántas se pueden vender **ahora**. Todo lo que las
> cards del store muestran como "En stock / Pronto / Sin stock" se **deriva** de aquí, no se persiste en
> `product` ([../04-modelo-de-datos.md](../04-modelo-de-datos.md) §catalog, regla de oro).

Fundacionales que este documento da por sentados: [../02-arquitectura.md](../02-arquitectura.md),
[../04-modelo-de-datos.md](../04-modelo-de-datos.md), [../05-convenciones-api.md](../05-convenciones-api.md),
[../06-validaciones.md](../06-validaciones.md), [../07-auth-identidad.md](../07-auth-identidad.md).

---

## 1. Propósito y alcance

### En alcance

- Mantener, por **variante** (`product_variant`), el stock físico (`on_hand`) y el reservado (`reserved`),
  y derivar `available = on_hand - reserved`.
- **Reservas con TTL**: apartar unidades al iniciar checkout, **confirmarlas** al crear la orden y
  **liberarlas** al cancelar o al expirar. Es el mecanismo anti-overselling.
- **Movimientos auditables** (`stock_movement`): cada cambio de stock deja un asiento con signo y motivo
  (IMPORT, SALE, RETURN, ADJUSTMENT, RESERVATION, RELEASE).
- **Ajuste administrativo** manual de stock con **motivo obligatorio** y auditoría.
- **Derivación de `StockStatus`** (IN_STOCK / SOON / OUT_OF_STOCK) que consumen las cards y el detalle de producto.
- **Job periódico** de expiración de reservas vencidas ([../32-jobs-y-async.md](../32-jobs-y-async.md) §Reservas expiradas).
- **Eventos de dominio** consumidos por `orders` y `catalog`.

### Fuera de alcance (viven en otros módulos)

- Precio y márgenes → `pricing` ([./14-modulo-pricing.md](./14-modulo-pricing.md)).
- Carrito, checkout, orden y su máquina de estados → `orders` ([./15-modulo-ordenes.md](./15-modulo-ordenes.md)).
  Inventory **no** crea órdenes; expone reservas/confirmaciones que `orders` orquesta.
- Alta de productos/variantes y el read model de card → `catalog` ([./10-modulo-catalogo.md](./10-modulo-catalogo.md)).
- Ingesta de stock desde feeds de proveedor → `suppliers` ([./20-modulo-suppliers.md](./20-modulo-suppliers.md))
  **dispara** `ImportStock`, pero el asiento y las invariantes son de este módulo.
- Reposición automática / cálculo de `reorder_point` avanzado → futuro (aquí sólo se guarda y se usa para `SOON`).

### Principio rector

> El stock disponible es un **derivado calculado**, nunca un número que el frontend envía o adivina.
> Toda mutación de stock pasa por un caso de uso transaccional que deja un `stock_movement`. **Sin asiento
> no hay cambio de stock.** El invariante `available >= 0` y `on_hand >= 0` es irrompible.

---

## 2. Entidades y tablas (canon [04](../04-modelo-de-datos.md) §inventory)

Esquema Drizzle en `packages/database/src/schema/inventory.ts`. Se respeta el canon; abajo se ilustra el
shape con constraints e índices (DDL **ilustrativo**, no implementación).

### 2.1 `stock_item` — stock por variante

Una fila por variante (relación 1:1 con `product_variant`).

```
stock_item
  id             uuid PK
  variant_id     uuid FK → product_variant(id)  UNIQUE   -- 1:1
  on_hand        integer NOT NULL default 0               -- unidades físicas
  reserved       integer NOT NULL default 0               -- apartadas por reservas ACTIVE + CONFIRMED
  reorder_point  integer NULL                             -- umbral de reposición (habilita SOON)
  updated_at     timestamptz NOT NULL default now()
  -- available = on_hand - reserved  (columna generada o calculada en query; ver §5)
```

Invariantes en DB (además de la validación de app):

```sql
ALTER TABLE stock_item ADD CONSTRAINT chk_on_hand_nonneg   CHECK (on_hand  >= 0);
ALTER TABLE stock_item ADD CONSTRAINT chk_reserved_nonneg  CHECK (reserved >= 0);
ALTER TABLE stock_item ADD CONSTRAINT chk_reserved_le_on_hand CHECK (reserved <= on_hand); -- no comprometer más de lo que hay
```

> `available` puede materializarse como columna generada `GENERATED ALWAYS AS (on_hand - reserved) STORED`
> para indexarla, o calcularse en la query de read model. El canon la define como derivada; se elige
> columna generada para poder ordenar/filtrar catálogo por disponibilidad sin recomputar.

### 2.2 `stock_reservation` — reservas con TTL

```
stock_reservation
  id           uuid PK
  variant_id   uuid FK → product_variant(id)
  order_id     uuid NULL FK → "order"(id)     -- se completa al confirmar
  cart_id      uuid NULL FK → cart(id)         -- origen (checkout iniciado); ver nota
  quantity     integer NOT NULL                -- > 0
  status       reservation_status NOT NULL     -- ACTIVE | CONFIRMED | RELEASED | EXPIRED
  expires_at   timestamptz NOT NULL            -- TTL; sólo relevante mientras ACTIVE
  created_at   timestamptz NOT NULL default now()
  updated_at   timestamptz NOT NULL default now()
```

```sql
ALTER TABLE stock_reservation ADD CONSTRAINT chk_res_qty_pos CHECK (quantity > 0);
CREATE INDEX idx_stock_reservation_expiry ON stock_reservation(status, expires_at); -- canon 04, para el job
CREATE INDEX idx_stock_reservation_variant ON stock_reservation(variant_id, status);
CREATE INDEX idx_stock_reservation_order   ON stock_reservation(order_id);
```

> `cart_id` no está en el canon estricto (que lista `variant_id, order_id?, quantity, status, expires_at`);
> se agrega como **columna opcional de trazabilidad** del origen del checkout. Si se prefiere no tocar el
> canon, el vínculo carrito↔reserva se guarda en el lado de `orders`. Aquí se documenta como nullable.

### 2.3 `stock_movement` — libro mayor auditable

Append-only. **Nunca** se actualiza ni se borra (documento histórico). Cada mutación de `on_hand`/`reserved`
produce uno o más asientos.

```
stock_movement
  id          uuid PK
  variant_id  uuid FK → product_variant(id)
  type        stock_movement_type NOT NULL   -- IMPORT|SALE|RETURN|ADJUSTMENT|RESERVATION|RELEASE
  quantity    integer NOT NULL               -- CON SIGNO (ver tabla §2.4)
  reason      text NULL                      -- OBLIGATORIO para ADJUSTMENT (validado en app)
  ref_type    text NULL                      -- 'order' | 'reservation' | 'supplier_feed' | 'return' ...
  ref_id      uuid NULL                       -- id del agregado que originó el movimiento
  created_by  uuid NULL                       -- admin_user o NULL si actor system (job/feed)
  created_at  timestamptz NOT NULL default now()
```

```sql
ALTER TABLE stock_movement ADD CONSTRAINT chk_mov_qty_nonzero CHECK (quantity <> 0);
CREATE INDEX idx_stock_movement_variant_created ON stock_movement(variant_id, created_at DESC);
CREATE INDEX idx_stock_movement_ref ON stock_movement(ref_type, ref_id);
```

### 2.4 Semántica de signo por tipo de movimiento

El signo del `quantity` refiere a su efecto sobre **`on_hand`** salvo RESERVATION/RELEASE, que afectan
**`reserved`** (movimiento de compromiso, no físico). `available` cambia en consecuencia.

| `type`        | Afecta       | Signo típico | Origen | Motivo obligatorio |
|---------------|--------------|:------------:|--------|:------------------:|
| `IMPORT`      | `on_hand +`  | `+`          | Alta desde proveedor / feed | no (recomendado `ref` al feed) |
| `SALE`        | `on_hand −`  | `−`          | Confirmación de orden (baja física) | no |
| `RETURN`      | `on_hand +`  | `+`          | Devolución (RETURNED en orders) | no (recomendado) |
| `ADJUSTMENT`  | `on_hand ±`  | `±`          | Corrección manual admin | **SÍ** |
| `RESERVATION` | `reserved +` | `+`          | Iniciar checkout (aparta) | no |
| `RELEASE`     | `reserved −` | `−`          | Cancelar / expirar reserva | no (recomendado motivo si es manual) |

> Confirmar una reserva al crear la orden es **doble asiento**: `RELEASE` del compromiso (`reserved −`) +
> `SALE` de la baja física (`on_hand −`). Ver §3 `ConfirmReservation` y §5 invariantes.

---

## 3. Casos de uso (`application/commands` y `queries`)

Cada caso recibe un `Actor` tipado ([07](../07-auth-identidad.md) §Contexto de auth), input ya validado por
Zod ([06](../06-validaciones.md)) y decide autorización en la capa `application`/`domain`, no sólo en middleware.

### 3.1 `ReserveStock` (command)

Aparta unidades al **iniciar checkout**. Es el punto donde se previene el overselling.

| Aspecto | Detalle |
|---|---|
| **Actor** | `system` (invocado por `orders/checkout`) o `admin` (venta asistida, canal `admin_manual`). No expuesto al público directo. |
| **Input** | `{ items: [{ variantId, quantity }], ttlSeconds?, cartId?, orderId? }` — `ReserveStockSchema`. |
| **Permiso** | Interno. Si admin: `inventory.reserve` (implícito en flujo de orden). |
| **Transacción** | **Sí, obligatoria.** Por cada item: `SELECT ... FOR UPDATE` sobre `stock_item` de la variante (ver §10), verificar `available >= quantity`, `reserved += quantity`, insertar `stock_reservation(status=ACTIVE, expires_at=now()+ttl)` + `stock_movement(RESERVATION, +quantity)`. Todo o nada. |
| **Eventos** | `StockReserved` por cada reserva creada. |
| **Salida** | `{ reservations: [{ reservationId, variantId, quantity, expiresAt }] }`. |
| **Errores** | `INSUFFICIENT_STOCK` (409) si algún item no alcanza — **falla la reserva completa**; `RESOURCE_NOT_FOUND` (404) si la variante/`stock_item` no existe; `VALIDATION_FAILED` (400). |

TTL por defecto: **15 minutos** (configurable vía `setting` `inventory.reservation_ttl_seconds`). Debe cubrir
el tiempo de checkout + pago sin agotar stock de otros compradores.

### 3.2 `ConfirmReservation` (command)

Convierte reservas `ACTIVE` en venta **firme** al **crear la orden**. Consume compromiso y baja stock físico.

| Aspecto | Detalle |
|---|---|
| **Actor** | `system` (desde `orders` al confirmar la orden, dentro de la **misma transacción de checkout**). |
| **Input** | `{ orderId, reservationIds[] }` o `{ orderId, items:[{variantId, quantity}] }` — `ConfirmReservationSchema`. |
| **Permiso** | Interno / orquestado por `orders`. |
| **Transacción** | **Sí** (idealmente la tx del checkout de `orders`, [11.5](../05-convenciones-api.md)). Por reserva: bloquear `stock_item`, verificar reserva `ACTIVE` y no vencida, `reserved −= q`, `on_hand −= q`, `status=CONFIRMED`, `order_id=orderId`. Doble asiento `RELEASE(−q sobre reserved)` + `SALE(−q sobre on_hand)`. |
| **Eventos** | `StockReleased` (compromiso liberado) y baja registrada; opcionalmente `StockConfirmed`. Se apoya en `orders.OrderConfirmed`. |
| **Salida** | `{ confirmed: [{ reservationId, variantId, quantity }] }`. |
| **Errores** | `CONFLICT`/`INVALID_ORDER_STATE` (409) si la reserva ya está `EXPIRED`/`RELEASED`/`CONFIRMED`; `INSUFFICIENT_STOCK` (409) sólo en el caso borde de reserva expirada re-tomada sin stock (ver §11). |

> Regla clave: al confirmar, `on_hand` baja porque la venta consume unidad física, y `reserved` baja porque
> el compromiso deja de existir. `available` **no cambia** en la confirmación (ya estaba descontado por la
> reserva). Esto evita descontar dos veces.

### 3.3 `ReleaseReservation` (command)

Libera unidades apartadas al **cancelar** el checkout/orden o por **expiración**.

| Aspecto | Detalle |
|---|---|
| **Actor** | `system` (job de expiración, cancelación de orden) o `admin` (`orders.cancel`). |
| **Input** | `{ reservationId }` o `{ orderId }` (libera todas las de esa orden) + `reason?` — `ReleaseReservationSchema`. |
| **Permiso** | Interno; si admin, ligado a `orders.cancel`. |
| **Transacción** | **Sí.** Bloquear `stock_item`, verificar reserva `ACTIVE`, `reserved −= q`, `status=RELEASED`, asiento `stock_movement(RELEASE, −q)`. Idempotente: si ya está `RELEASED`/`EXPIRED`, no-op. |
| **Eventos** | `StockReleased`. |
| **Salida** | `{ released: [{ reservationId, variantId, quantity }] }`. |
| **Errores** | `RESOURCE_NOT_FOUND` (404); nunca `INSUFFICIENT_STOCK` (liberar sólo baja `reserved`). |

### 3.4 `AdjustStock` (command)

Corrección **manual** del stock físico por el admin (recuento, rotura, merma, error de carga).

| Aspecto | Detalle |
|---|---|
| **Actor** | `admin` con rol `OWNER`/`ADMIN`/`CATALOG_MANAGER`. |
| **Input** | `{ variantId, delta, reason }` (o `{ variantId, newOnHand, reason }` que se convierte a delta) — `AdjustStockSchema`. `reason` **obligatorio** (`min(1)`). |
| **Permiso** | `inventory.adjust`. |
| **Transacción** | **Sí.** Bloquear `stock_item`, aplicar `on_hand += delta`, validar invariante `on_hand >= 0` y `reserved <= on_hand` (un ajuste negativo no puede dejar menos que lo ya reservado → error), asiento `stock_movement(ADJUSTMENT, ±delta, reason, created_by=actor.userId)` + `audit_log`. |
| **Eventos** | `StockAdjusted`. |
| **Salida** | `{ variantId, onHand, reserved, available }`. |
| **Errores** | `CONFLICT` (409) si el delta negativo violaría `reserved <= on_hand` (hay reservas activas que impiden bajar tanto); `VALIDATION_FAILED` (400) si falta `reason`; `RESOURCE_NOT_FOUND` (404). |

> El motivo es **obligatorio a nivel dominio** (no sólo Zod): la entidad rechaza un `ADJUSTMENT` sin motivo.
> Queda doble rastro: `stock_movement.reason` + `audit_log` con `before/after` ([04](../04-modelo-de-datos.md) §shared).

### 3.5 `ImportStock` (command)

Alta de unidades desde proveedor (feed CSV/API) o carga inicial. Suele venir de `suppliers`.

| Aspecto | Detalle |
|---|---|
| **Actor** | `system` (procesador de feed) o `admin` (`CATALOG_MANAGER`) en carga manual. |
| **Input** | `{ variantId, quantity, ref?: { type:'supplier_feed', id } }` — `ImportStockSchema`. `quantity > 0`. |
| **Permiso** | `inventory.import`. |
| **Transacción** | **Sí.** Upsert de `stock_item` (crea la fila con `on_hand=0` si es la primera vez), `on_hand += quantity`, asiento `stock_movement(IMPORT, +quantity, ref_type, ref_id)`. Idempotente por `ref` si el feed reintenta (ver §11). |
| **Eventos** | `StockAdjusted` (kind derivado `import`) o `StockImported`; `catalog` puede re-materializar la card si pasó de OUT_OF_STOCK a IN_STOCK. |
| **Salida** | `{ variantId, onHand, available }`. |
| **Errores** | `RESOURCE_NOT_FOUND` (404) si la variante no existe; `VALIDATION_FAILED` (400). |

### 3.6 `GetAvailability` (query)

Lectura de disponibilidad para el store (card/detalle) y el admin. **Read-only, sin lock.**

| Aspecto | Detalle |
|---|---|
| **Actor** | `public` (store), `admin` (panel). |
| **Input** | `{ variantIds: string[] }` (batch, whitelist, `max 100`) — `GetAvailabilitySchema`. |
| **Permiso** | Público para `{ stockStatus, available? }`; el número exacto de `on_hand`/`reserved` sólo a admin (presenter distinto). |
| **Transacción** | No. Lectura desde `stock_item` (o read model de card en `dashboard`). |
| **Eventos** | — |
| **Salida (público)** | `[{ variantId, stockStatus, available }]` — `available` opcional/capado para no filtrar inventario exacto de negocio. |
| **Salida (admin)** | `[{ variantId, onHand, reserved, available, reorderPoint, stockStatus }]`. |
| **Errores** | `VALIDATION_FAILED` (400). Variantes inexistentes se omiten o devuelven `OUT_OF_STOCK`. |

> El store consume principalmente el **read model de card** ([18](./18-modulo-dashboard-analytics.md) §read models),
> que ya trae `stockStatus` materializado; `GetAvailability` es el fallback puntual y la fuente para revalidar
> stock en el carrito antes del checkout ([15](./15-modulo-ordenes.md) §revalidación).

---

## 4. Endpoints tRPC `inventory.*`

Router `inventory` en el `appRouter` ([05](../05-convenciones-api.md) §Convención tRPC). Mayormente
**admin/interno**; sólo `getAvailability` es de lectura pública. Naming: query = `get*`/`list*`,
mutation = verbo.

```txt
// Lectura
inventory.getAvailability(input: { variantIds })        publicProcedure  → StockStatus + available (capado)
inventory.getStockItem({ variantId })                   adminProcedure   → on_hand/reserved/available/reorderPoint
inventory.listMovements({ variantId, cursor, limit })   adminProcedure   → libro mayor paginado (cursor)
inventory.listReservations({ variantId?, status?, cursor }) adminProcedure → reservas (debug/soporte)

// Mutaciones admin
inventory.adjustStock({ variantId, delta, reason })     adminProcedure   → AdjustStock   (reason obligatorio)
inventory.importStock({ variantId, quantity, ref? })    adminProcedure   → ImportStock

// Internas (no expuestas como procedure público; invocadas por orders vía ports)
inventory.reserveStock(...)        internal   → ReserveStock       (desde orders/checkout)
inventory.confirmReservation(...)  internal   → ConfirmReservation (desde orders al confirmar)
inventory.releaseReservation(...)  internal   → ReleaseReservation (desde orders/cancel o job)
```

- `reserve`/`confirm`/`release` se consumen vía **port** (`InventoryPort`) que `orders` inyecta desde el
  `container` ([02](../02-arquitectura.md) §Comunicación entre módulos), no como procedure tRPC del cliente.
  Así el overselling se resuelve dentro de la transacción de checkout, sin round-trip HTTP.
- Todas las mutaciones admin listas para `Idempotency-Key` cuando se expongan por REST; en tRPC interno la
  idempotencia se maneja por `ref` del movimiento (feed) o por la tx de la orden.
- Listados con **cursor pagination** y `limit` validado (default 50, máx 50 salvo export controlado).
- REST: no se expone superficie pública de escritura de inventario. Ingreso de stock por feed va por el
  webhook/proceso de `suppliers`, que internamente llama `ImportStock`.

---

## 5. Reglas e invariantes

```txt
INV-1  on_hand >= 0                          -- nunca stock físico negativo (CHECK + dominio)
INV-2  reserved >= 0                          -- nunca compromiso negativo
INV-3  reserved <= on_hand                    -- no se compromete más de lo que existe (anti-overselling raíz)
INV-4  available = on_hand - reserved         -- derivado, única fórmula
INV-5  reservar requiere available >= quantity ANTES de incrementar reserved (bajo lock)
INV-6  toda mutación de on_hand/reserved deja >=1 stock_movement (sin asiento no hay cambio)
INV-7  ADJUSTMENT exige reason no vacío (dominio, no sólo Zod)
INV-8  una reservation ACTIVE con expires_at < now() es candidata a EXPIRED (job); no cuenta como disponible
INV-9  transiciones de reservation: ACTIVE → {CONFIRMED | RELEASED | EXPIRED}; estados finales no transicionan
INV-10 confirmar NO cambia available (ya descontado al reservar); sólo mueve reserved→on_hand hacia abajo
```

### Derivación de `StockStatus` (para cards del store)

`StockStatus` es **derivado**, no columna en `product` ([04](../04-modelo-de-datos.md) regla de oro):

```ts
function deriveStockStatus(s: { onHand: number; reserved: number; reorderPoint: number | null }): StockStatus {
  const available = s.onHand - s.reserved;
  if (available > 0) return StockStatus.IN_STOCK;
  // available === 0
  const reorderPending = s.reorderPoint != null && s.onHand <= s.reorderPoint;
  return reorderPending ? StockStatus.SOON : StockStatus.OUT_OF_STOCK;
}
```

- `available > 0` → **IN_STOCK**.
- `available === 0` **y** hay reposición pendiente (`reorder_point` configurado y alcanzado) → **SOON**
  ("pronto", el proveedor repone).
- `available === 0` y sin reposición esperada → **OUT_OF_STOCK**.

El valor se materializa en el read model de card ([18](./18-modulo-dashboard-analytics.md)) y se **invalida**
al recibir `StockReserved`/`StockReleased`/`StockAdjusted`/`StockReservationExpired`.

---

## 6. Permisos ([07](../07-auth-identidad.md))

| Acción | Permiso | OWNER | ADMIN | CATALOG_MANAGER | FINANCE | SUPPORT |
|---|---|:--:|:--:|:--:|:--:|:--:|
| Ver `available`/`stockStatus` (público capado) | — | ✔ | ✔ | ✔ | ✔ | ✔ |
| Ver `on_hand`/`reserved` exactos + libro mayor | `inventory.read` | ✔ | ✔ | ✔ | lectura | lectura |
| Ajuste manual (`AdjustStock`) | `inventory.adjust` | ✔ | ✔ | ✔ | ✖ | ✖ |
| Importar stock (`ImportStock`) | `inventory.import` | ✔ | ✔ | ✔ | ✖ | ✖ |
| Reservar/confirmar/liberar | interno | system/orders | system/orders | — | — | — |

- El número **exacto** de inventario es dato de negocio: el presenter público no lo revela sin capar
  ([06](../06-validaciones.md) §Validación de salida — no filtrar campos internos).
- `SUPPORT`/`FINANCE` sólo lectura; no ajustan stock.
- La autorización de negocio se valida en el caso de uso, no sólo en el `adminProcedure`.

---

## 7. Validaciones (`packages/validators/src/inventory.ts`)

```ts
export const GetAvailabilitySchema = z.object({
  variantIds: z.array(z.string().uuid()).min(1).max(100),
});

export const AdjustStockSchema = z.object({
  variantId: z.string().uuid(),
  delta:     z.number().int().refine((n) => n !== 0, 'El ajuste no puede ser 0'),
  reason:    z.string().trim().min(3).max(500),          // OBLIGATORIO
});

export const ImportStockSchema = z.object({
  variantId: z.string().uuid(),
  quantity:  z.number().int().min(1).max(100_000),
  ref:       z.object({ type: z.literal('supplier_feed'), id: z.string().uuid() }).optional(),
});

export const ReserveStockSchema = z.object({
  items:      z.array(z.object({
                variantId: z.string().uuid(),
                quantity:  z.number().int().min(1).max(20),   // límite por línea, coherente con carrito
              })).min(1).max(50),
  ttlSeconds: z.number().int().min(60).max(3600).optional(), // default por setting
  cartId:     z.string().uuid().optional(),
  orderId:    z.string().uuid().optional(),
});

export const ReleaseReservationSchema = z.object({
  reservationId: z.string().uuid().optional(),
  orderId:       z.string().uuid().optional(),
  reason:        z.string().trim().max(500).optional(),
}).refine((v) => v.reservationId || v.orderId, 'Se requiere reservationId u orderId');
```

Capas ([06](../06-validaciones.md)): **transporte** (Zod arriba) → **aplicación** (permiso + existencia de
variante) → **dominio** (INV-1..INV-10, motivo de ADJUSTMENT) → **persistencia** (CHECK/UNIQUE/FK).
Nada de mass assignment: el request nunca se mapea directo a `stock_item`.

---

## 8. Eventos de dominio

Emitidos vía `event-bus` in-process y persistidos por **Outbox** cuando cruzan el límite transaccional
([02](../02-arquitectura.md) §Event bus y Outbox). Payload mínimo, sin PII.

| Evento | Emitido por | Payload | Consumidores |
|---|---|---|---|
| `StockReserved` | `ReserveStock` | `{ reservationId, variantId, quantity, expiresAt }` | `catalog` (invalida card), `dashboard` |
| `StockReleased` | `ReleaseReservation`, `ConfirmReservation` | `{ reservationId, variantId, quantity, cause: 'cancel'|'confirm'|'expire' }` | `catalog`, `orders`, `dashboard` |
| `StockReservationExpired` | Job de expiración (§ [../32-jobs-y-async.md](../32-jobs-y-async.md)) | `{ reservationId, variantId, quantity }` | `orders` (invalida checkout abandonado), `catalog`, `dashboard` |
| `StockAdjusted` | `AdjustStock`, `ImportStock` | `{ variantId, delta, onHand, reserved, reason?, source: 'admin'|'import' }` | `catalog` (re-deriva StockStatus), `dashboard` |

- **`orders`** escucha `StockReservationExpired` para saber que un checkout quedó sin stock apartado y debe
  revalidar antes de crear la orden; y `StockReleased(cause=confirm)` como parte del cierre de la venta.
- **`catalog`** escucha todos para **re-materializar** el `stockStatus` de la card afectada (no hay columna
  de stock en `product`; la verdad vive aquí).
- Los eventos se emiten **después** del commit de la transacción (o vía Outbox) para no publicar cambios que
  luego hagan rollback.

---

## 9. Errores ([05](../05-convenciones-api.md) §Catálogo de códigos)

| Código | HTTP | Cuándo |
|---|:--:|---|
| `INSUFFICIENT_STOCK` | **409** | `available < quantity` al reservar/confirmar. Mensaje público: "No hay stock suficiente para completar la operación." |
| `CONFLICT` | 409 | Reserva en estado no operable (ya CONFIRMED/RELEASED/EXPIRED); ajuste que violaría `reserved <= on_hand`. |
| `RESOURCE_NOT_FOUND` | 404 | Variante o `stock_item`/reserva inexistente (o no visible para el actor). |
| `VALIDATION_FAILED` | 400 | Falla de schema: `reason` faltante, `delta=0`, `quantity<=0`, más de 100 variantes, etc. |
| `FORBIDDEN` | 403 | Autenticado sin permiso `inventory.adjust`/`import`. |
| `UNAUTHENTICATED` | 401 | Sin sesión admin en endpoints admin. |

Prohibido exponer SQL, nombres de tabla, o el número exacto de stock en el mensaje de `INSUFFICIENT_STOCK`.
En tRPC se mapea a `TRPCError` con `code: 'CONFLICT'` + `cause` interno loggeado.

---

## 10. Concurrencia y transacciones (detalle del lock)

El overselling es un problema de **concurrencia**: dos checkouts simultáneos sobre la última unidad. Dos
compradores no pueden ambos reservar la misma unidad. Estrategia por defecto: **lock pesimista por fila**.

### 10.1 Lock pesimista (`SELECT ... FOR UPDATE`)

Dentro de la transacción de `ReserveStock`/`ConfirmReservation`/`AdjustStock`, se bloquea la fila de
`stock_item` de la variante **antes** de leer `available` y **antes** de mutar:

```sql
BEGIN;                                             -- READ COMMITTED alcanza con FOR UPDATE
  SELECT on_hand, reserved
    FROM stock_item
   WHERE variant_id = $1
   FOR UPDATE;                                     -- serializa a los concurrentes sobre esta variante

  -- en app: if (on_hand - reserved) < qty  → ROLLBACK + INSUFFICIENT_STOCK
  UPDATE stock_item
     SET reserved = reserved + $qty, updated_at = now()
   WHERE variant_id = $1;

  INSERT INTO stock_reservation (...) VALUES (...); -- ACTIVE, expires_at
  INSERT INTO stock_movement    (...) VALUES (...); -- RESERVATION, +qty
COMMIT;                                             -- recién aquí se libera el lock
```

- El segundo checkout que pide la misma variante **espera** en el `FOR UPDATE` hasta el commit del primero;
  al continuar ve `reserved` ya incrementado y, si no queda `available`, recibe `INSUFFICIENT_STOCK`.
- **Orden de locking determinístico** al reservar múltiples variantes: bloquear en orden de `variant_id`
  ascendente para evitar **deadlocks** entre transacciones que tomen las mismas variantes en orden distinto.
- Timeout de lock (`lock_timeout`) configurado para no colgar requests; si expira → reintento acotado o
  `CONFLICT`.

### 10.2 Alternativa: decremento atómico condicional (optimista)

Para caminos de muy alta contención se puede evitar el `FOR UPDATE` explícito con un `UPDATE` guardado por
`WHERE` que sólo aplica si hay disponibilidad, y verificar filas afectadas:

```sql
UPDATE stock_item
   SET reserved = reserved + $qty, updated_at = now()
 WHERE variant_id = $1
   AND on_hand - reserved >= $qty;        -- condición atómica: si 0 filas → INSUFFICIENT_STOCK
```

Si `rowCount = 0`, no había disponible → `INSUFFICIENT_STOCK` (no se insertó reserva ni movimiento). El
CHECK `reserved <= on_hand` en DB es la **última red**: aún si la app fallara, la constraint aborta el
overselling. Se prefiere `FOR UPDATE` por claridad y porque necesitamos insertar reserva+movimiento en el
mismo bloque; el decremento atómico queda como optimización medida.

### 10.3 Alcance transaccional

- `ReserveStock`, `ConfirmReservation`, `ReleaseReservation`, `AdjustStock`, `ImportStock` corren **cada uno
  en transacción** ([11.5](../05-convenciones-api.md), skill §11.5).
- `ConfirmReservation` idealmente participa de la **misma transacción del checkout** de `orders` (unit-of-work
  compartido) para que orden + baja de stock + documento sean atómicos.
- Eventos se publican **post-commit** / vía Outbox.

---

## 11. Casos borde

| # | Caso | Resolución |
|---|---|---|
| 1 | **Reserva expira durante el pago** | El job la marca `EXPIRED` y libera `reserved`. Al `ConfirmReservation`, si la reserva ya no está `ACTIVE`, se re-intenta reservar bajo lock; si no hay stock → `INSUFFICIENT_STOCK` y el checkout falla limpio (orders informa al cliente). |
| 2 | **Doble confirmación** (retry de orden) | `ConfirmReservation` es idempotente por `reservationId`/`orderId`: si ya `CONFIRMED`, no re-descuenta. La idempotencia del checkout (`Idempotency-Key`) evita doble orden. |
| 3 | **Cancelación tras confirmar** | No es un RELEASE (ya se hizo SALE): se registra `RETURN` (`on_hand +`) al procesar la devolución/cancelación con reposición, vía `orders` RETURNED. |
| 4 | **Ajuste negativo mayor que lo disponible** | Rechazado: violaría `reserved <= on_hand` o `on_hand >= 0`. Devuelve `CONFLICT`; el admin debe liberar reservas o ajustar menos. |
| 5 | **Feed reimporta el mismo lote** | `ImportStock` idempotente por `ref (supplier_feed, id)`: si ya existe un `stock_movement` con ese `ref`, no re-suma. |
| 6 | **Variante sin `stock_item`** | Primera importación crea la fila (`on_hand=0` inicial). `GetAvailability` de variante sin fila → `OUT_OF_STOCK`. |
| 7 | **Reserva huérfana** (checkout abandonado sin cart) | El TTL + job la limpian; no queda `reserved` colgado indefinidamente. |
| 8 | **`reorder_point` no configurado** | `SOON` nunca se dispara; `available=0` → directamente `OUT_OF_STOCK`. |
| 9 | **Reserva de múltiples variantes con una sin stock** | Toda la operación falla (atómica): no se aparta parcialmente. `INSUFFICIENT_STOCK` con la variante culpable en `details`. |
| 10 | **Concurrencia en el mismo `stock_item`** | Serializada por `FOR UPDATE`; el perdedor ve el estado ya actualizado (§10). |
| 11 | **Devolución de unidad con calidad dañada** | `RETURN` puede ir a `on_hand` o a un ajuste posterior `ADJUSTMENT(-, reason='merma')`; decisión de `orders`/admin. |

---

## 12. Definition of Done

```txt
[ ] schema/inventory.ts con stock_item (1:1 variante), stock_reservation, stock_movement + CHECKs
    (on_hand>=0, reserved>=0, reserved<=on_hand, qty movement<>0) e índices de canon 04.
[ ] Enums ReservationStatus y StockMovementType en packages/types alineados a canon.
[ ] available como columna generada (o derivación única documentada); deriveStockStatus implementado y
    usado por el read model de card.
[ ] Casos de uso ReserveStock / ConfirmReservation / ReleaseReservation / AdjustStock / ImportStock /
    GetAvailability, cada uno con actor tipado, Zod input, permiso en application, tx y eventos.
[ ] InventoryPort expuesto e inyectado en orders (reserve/confirm/release) — sin round-trip HTTP en checkout.
[ ] Lock pesimista (SELECT ... FOR UPDATE) con orden determinístico por variant_id; lock_timeout configurado.
[ ] CHECK reserved<=on_hand verificado como última red anti-overselling (test de concurrencia).
[ ] ADJUSTMENT rechaza motivo vacío en dominio; deja stock_movement.reason + audit_log(before/after).
[ ] ImportStock idempotente por ref de feed.
[ ] Job de expiración (../32-jobs-y-async.md): busca ACTIVE con expires_at<now, marca EXPIRED, libera
    reserved, emite StockReservationExpired, procesa por lotes; con métricas e idempotencia.
[ ] Eventos StockReserved / StockReleased / StockReservationExpired / StockAdjusted emitidos post-commit
    y consumidos por catalog (re-deriva card) y orders.
[ ] Presenter público capa el número exacto de inventario (sin fuga de on_hand/reserved).
[ ] Errores mapeados: INSUFFICIENT_STOCK→409, CONFLICT→409, VALIDATION_FAILED→400, FORBIDDEN→403.
[ ] Tests: unit (invariantes/deriveStockStatus), application (use cases), integration con Testcontainers
    (concurrencia/overselling, expiración), auth negativa. Ver ../31-testing.md.
[ ] Índices verificados: idx_stock_reservation_expiry, idx_stock_movement_variant_created.
```

---

**Ver también:** [10 Catálogo](./10-modulo-catalogo.md) · [14 Pricing](./14-modulo-pricing.md) ·
[15 Órdenes](./15-modulo-ordenes.md) · [20 Suppliers](./20-modulo-suppliers.md) ·
[18 Dashboard](./18-modulo-dashboard-analytics.md) · [../32 Jobs y async](../32-jobs-y-async.md) ·
[../04 Modelo de datos](../04-modelo-de-datos.md) · [../05 Convenciones API](../05-convenciones-api.md)
