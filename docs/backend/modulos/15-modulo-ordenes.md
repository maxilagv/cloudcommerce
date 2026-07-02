# 15 · Módulo Órdenes (dominio `orders`)

> Diseño del dominio que convierte intención de compra en un **documento histórico inmutable** y lo
> lleva desde el carrito hasta la entrega. Cubre cuatro sub-dominios: **cart**, **checkout**, **order**
> (fulfillment) y **shipping**. Es diseño, no implementación: los tipos y DDL son ilustrativos y se
> ajustan al canon de [../04-modelo-de-datos.md](../04-modelo-de-datos.md).

Fundacionales que este documento da por sentados: [arquitectura](../02-arquitectura.md),
[modelo de datos](../04-modelo-de-datos.md), [convenciones de API](../05-convenciones-api.md),
[validaciones](../06-validaciones.md), [auth e identidad](../07-auth-identidad.md).
Colaboradores: [inventario](./13-modulo-inventario.md), [pricing](./14-modulo-pricing.md),
[finanzas](./16-modulo-finanzas.md), [suppliers](./20-modulo-suppliers.md),
[jobs y async](../32-jobs-y-async.md), [testing](../31-testing.md).

---

## 1. Propósito y alcance

### 1.1 Qué resuelve

El dominio `orders` es la **autoridad transaccional de la venta**. Su responsabilidad es:

- **Carrito** (`cart`): estructura de trabajo mutable, anónima o de usuario, que junta líneas antes de
  comprar. No es una orden. Se revalida (precio/stock/estado) cada vez que se muestra.
- **Checkout** (`checkout`): operación **idempotente** y **transaccional** que congela precios, reserva y
  confirma stock, y materializa la orden. Blindada contra doble-submit y contra precios del cliente.
- **Órdenes** (`order`): documento histórico **inmutable** con snapshots (título, sku, precio, costo
  proveedor). Su ciclo de vida se gobierna por una **máquina de estados** centralizada.
- **Fulfillment**: reenvío del pedido al proveedor (dropshipping) vía **outbox + worker**.
- **Envíos** (`shipping`): `shipment` con carrier, tracking, ETA, eventos y estados propios; endpoint de
  tracking con ownership estricto y fallback a último estado conocido.

### 1.2 Decisión clave del proyecto — pedidos manuales

El **ADMIN puede crear pedidos manuales** (`channel = admin_manual`): venta asistida por WhatsApp/teléfono,
patrón típico del dropshipping local. Esta es la fase **actual** (admin-first). El checkout público del
store (`channel = store`) se diseña **acá** pero se activa en la fase del portal de clientes.

Ambos caminos desembocan en la **misma entidad `order`** y alimentan finanzas y el KPI de cliente
"cuánto gastó" ([../04-modelo-de-datos.md](../04-modelo-de-datos.md) §customers, [./16-modulo-finanzas.md](./16-modulo-finanzas.md)).
La diferencia es el punto de entrada, el actor y el estado inicial — no el modelo de datos.

| Aspecto | Checkout store (futuro) | Alta manual (esta fase) |
|---|---|---|
| Actor | `customer` (o sesión anónima que se resuelve a cliente) | `admin` (`OWNER`/`ADMIN`/`SUPPORT`) |
| Entrada | Carrito revalidado + `Idempotency-Key` | Formulario del panel + `Idempotency-Key` |
| Pago | Stripe (fase pagos) | Registrado como acordado (efectivo/transferencia/WSP) |
| Estado inicial | `PENDING_CONFIRMATION` (o `CONFIRMED` si pago capturado) | `CONFIRMED` o `PENDING_CONFIRMATION` según `setting` |
| `placed_by` | `null` | `admin_user_id` que lo cargó |

### 1.3 Fuera de alcance (referencias)

- Cálculo de precio/markup/descuento vigente → [pricing](./14-modulo-pricing.md) (este módulo lo **invoca**, no lo decide).
- Reserva/confirmación/liberación de stock → [inventario](./13-modulo-inventario.md) (este módulo **orquesta** en la misma tx).
- Emisión de remito/factura/NC → [finanzas](./16-modulo-finanzas.md) (reacciona a `OrderConfirmed`).
- Reenvío al proveedor y feeds → [suppliers](./20-modulo-suppliers.md).
- Ejecución de outbox, reintentos, jobs periódicos → [jobs y async](../32-jobs-y-async.md).
- Login de cliente / sesión anónima → [auth](../07-auth-identidad.md) (gancho `customer`, futuro).

---

## 2. Entidades y tablas (canon de [04](../04-modelo-de-datos.md))

Todas las tablas siguen las convenciones globales: PK `uuid` (UUIDv7 en app), `created_at`/`updated_at`
`timestamptz`, dinero como `*_minor integer` + `currency`, enums vía `pgEnum`, FK con `ON DELETE` explícito.

### 2.1 Enums (de `packages/types/src/enums.ts`)

```ts
export enum OrderStatus {
  DRAFT, PENDING_CONFIRMATION, CONFIRMED, PREPARING,
  READY_TO_SHIP, SHIPPED, DELIVERED, CANCELLED, RETURN_REQUESTED, RETURNED
}
export enum ShipmentStatus {
  CREATED, PREPARED, DISPATCHED, IN_TRANSIT, OUT_FOR_DELIVERY,
  DELIVERED, DELAYED, FAILED_ATTEMPT
}
export enum ShippingMethod { STANDARD, EXPRESS, PICKUP }   // ← store constants.ts
```

Enum local del dominio (no en canon global; vive en `orders`):

```ts
export enum OrderChannel { store, admin_manual }
export enum CartStatus   { active, converted, abandoned }
```

### 2.2 Tablas (DDL ilustrativo — el esquema real vive en `packages/database/src/schema/orders.ts`)

```txt
cart              id, customer_id?(FK customer, nullable=anónimo), status(CartStatus),
                  currency, created_at, updated_at, expires_at?
cart_item         id, cart_id(FK), variant_id(FK product_variant), quantity,
                  unit_price_snapshot_minor, added_at
                  # UNIQUE(cart_id, variant_id)  → una línea por variante; sumar cantidades

order             id, order_number(unique, human), customer_id(FK customer), status(OrderStatus),
                  channel(OrderChannel), currency,
                  subtotal_minor, shipping_minor, discount_minor, tax_minor, total_minor,
                  shipping_method(ShippingMethod), shipping_address_id?(FK customer_address),
                  placed_by?(admin_user_id si manual), notes?, created_at, updated_at

order_line        id, order_id(FK), variant_id(FK),
                  product_title_snapshot, sku_snapshot,
                  quantity, unit_price_minor, line_total_minor,
                  supplier_cost_snapshot_minor?
                  # snapshots inmutables: la orden no cambia si el catálogo/pricing cambian

order_status_event id, order_id(FK), from_status, to_status, reason?, actor_id, created_at

shipment          id, order_id(FK), carrier?, tracking_code?, status(ShipmentStatus),
                  eta?, created_at, updated_at
shipment_event    id, shipment_id(FK), status(ShipmentStatus), description?, occurred_at

idempotency_key   id, key(unique), actor_id, route, request_hash,
                  response_status, response_ref, created_at, expires_at
```

Constraints e invariantes de persistencia (capa 4 de [06](../06-validaciones.md)):

```sql
-- Dinero no negativo y totales coherentes
ALTER TABLE "order" ADD CONSTRAINT chk_order_amounts_nonneg
  CHECK (subtotal_minor >= 0 AND shipping_minor >= 0 AND discount_minor >= 0
         AND tax_minor >= 0 AND total_minor >= 0);
ALTER TABLE "order" ADD CONSTRAINT chk_order_total
  CHECK (total_minor = subtotal_minor + shipping_minor + tax_minor - discount_minor);

ALTER TABLE order_line ADD CONSTRAINT chk_line_qty CHECK (quantity >= 1);
ALTER TABLE order_line ADD CONSTRAINT chk_line_total
  CHECK (line_total_minor = unit_price_minor * quantity);

ALTER TABLE cart_item ADD CONSTRAINT chk_cart_qty CHECK (quantity >= 1);

-- order_number único y estable (correlativo human-friendly, ver §2.3)
CREATE UNIQUE INDEX uq_order_number ON "order"(order_number);
```

Índices mínimos (del canon [04](../04-modelo-de-datos.md) §Índices):

```sql
CREATE INDEX idx_orders_customer_created ON "order"(customer_id, created_at DESC);
CREATE INDEX idx_orders_status           ON "order"(status);
CREATE INDEX idx_order_lines_order       ON order_line(order_id);
CREATE INDEX idx_shipments_order         ON shipment(order_id);
CREATE INDEX idx_cart_customer           ON cart(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_idem_key                ON idempotency_key(key);
```

### 2.3 `order_number` (humano, único, no secuencial expuesto)

- Formato: `ORD-YYYY-NNNNNN` (p. ej. `ORD-2026-000123`). El correlativo se obtiene con una **secuencia
  Postgres por año** o un contador transaccional; nunca se expone el `uuid` interno como número de pedido.
- Se genera **dentro de la transacción de checkout**, protegido por la unicidad de DB. Si colisiona
  (carrera improbable), se reintenta dentro de la misma tx.
- No confundir con `id` (uuid, identidad primaria). `order_number` es para humanos y documentos.

### 2.4 Relación con snapshots (por qué la orden es inmutable)

`order_line` copia (no referencia por join vivo) `product_title_snapshot`, `sku_snapshot`,
`unit_price_minor` y `supplier_cost_snapshot_minor`. Motivo:

- **Finanzas correctas**: el margen histórico usa el costo proveedor *del momento de la venta*
  ([./16-modulo-finanzas.md](./16-modulo-finanzas.md)), no el costo actual.
- **Documentos estables**: un remito emitido no cambia si mañana sube el precio o se renombra el producto.
- **Auditoría**: la orden es evidencia de qué se vendió, a cuánto y con qué costo.

`supplier_cost_snapshot_minor` es **campo interno**: nunca sale en presenters del cliente
([06](../06-validaciones.md) §salida). Solo lo ven roles con permiso de costo (`OWNER`/`ADMIN`/`FINANCE`).

---

## 3. Casos de uso (`application/`)

Cada caso de uso declara: **actor**, **input (Zod)**, **permiso**, **transacción**, **eventos**, **salida**,
**errores**. Los schemas viven en `packages/validators/src/order.ts` y se comparten con el front
([06](../06-validaciones.md)). La autorización crítica vive en el caso de uso, no solo en el middleware
([07](../07-auth-identidad.md) §Autorización).

### 3.1 `AddCartItem`

- **Actor**: `public` (sesión anónima con `cartToken`) o `customer`.
- **Input**:
  ```ts
  export const AddCartItemSchema = z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid(),
    quantity:  z.number().int().min(1).max(MAX_QTY_PER_LINE),   // MAX_QTY_PER_LINE = 20
  });
  ```
- **Permiso**: ninguno especial; ownership del carrito por `cartToken`/`customerId`.
- **Tx**: sí (upsert de `cart` + `cart_item`).
- **Lógica**: resuelve o crea el `cart` del actor; valida que la variante exista, esté vendible
  (producto `PUBLISHED`, variante activa) y con `available > 0` ([13](./13-modulo-inventario.md)); hace
  **upsert** por `(cart_id, variant_id)` sumando cantidades, respetando `MAX_QTY_PER_LINE` y
  `MAX_LINES_PER_CART`; guarda `unit_price_snapshot_minor` como referencia informativa (no vinculante —
  el precio real se recalcula en checkout).
- **Eventos**: ninguno de dominio (mutación de carrito de trabajo).
- **Salida**: carrito revalidado (ver §3.7 forma de salida).
- **Errores**: `VALIDATION_FAILED`, `PRODUCT_NOT_AVAILABLE`, `INSUFFICIENT_STOCK`, `CONFLICT`
  (excede límite por carrito).

### 3.2 `UpdateCartItem`

- **Actor**: dueño del carrito.
- **Input**: `{ itemId: uuid, quantity: int 1..MAX_QTY_PER_LINE }`.
- **Permiso/ownership**: el `cart_item` debe pertenecer al carrito del actor → si no, `RESOURCE_NOT_FOUND`
  (nunca 200 sobre carrito ajeno, [06](../06-validaciones.md) §ownership).
- **Tx**: sí. **Lógica**: revalida stock disponible para la nueva cantidad. Si `quantity` supera stock,
  `INSUFFICIENT_STOCK` con el máximo disponible en `details`.
- **Salida**: carrito revalidado. **Errores**: `VALIDATION_FAILED`, `RESOURCE_NOT_FOUND`, `INSUFFICIENT_STOCK`.

### 3.3 `RemoveCartItem`

- **Actor**: dueño del carrito. **Input**: `{ itemId: uuid }`. **Ownership**: como §3.2.
- **Tx**: sí (borra la línea). **Salida**: carrito revalidado. **Errores**: `RESOURCE_NOT_FOUND`.

### 3.4 `MergeCart`

- **Cuándo**: el cliente inicia sesión y traía un carrito anónimo (fase login cliente).
- **Actor**: `customer` recién autenticado. **Input**: `{ anonymousCartToken: string }`.
- **Tx**: sí. **Lógica** ([backend.md §13.2]):
  1. Localiza carrito anónimo por token y carrito del cliente (o lo crea).
  2. **Fusiona líneas iguales** por `variant_id` sumando cantidades, con tope `MAX_QTY_PER_LINE`.
  3. Revalida stock por línea fusionada; si excede, ajusta al máximo y lo reporta como diferencia.
  4. Marca el carrito anónimo `converted`/eliminado; registra evento.
  5. Devuelve **diferencias** (líneas ajustadas, removidas por no disponibles) para que el front avise.
- **Eventos**: `CartMerged` (in-process, informativo; no cruza tx crítica).
- **Salida**: carrito del cliente + `diffs[]`. **Errores**: `RESOURCE_NOT_FOUND` (token inválido → merge no-op idempotente).

### 3.5 `CreateOrderFromCheckout` (store, futuro) — **idempotente**

- **Actor**: `customer` (o sesión válida). **Header obligatorio**: `Idempotency-Key`
  ([05](../05-convenciones-api.md) §Idempotencia).
- **Input**:
  ```ts
  export const CheckoutSchema = z.object({
    cartId:          z.string().uuid(),
    shippingAddressId: z.string().uuid(),
    shippingMethod:  z.nativeEnum(ShippingMethod),   // STANDARD | EXPRESS | PICKUP
    discountCode:    z.string().trim().max(40).optional(),
    notes:           z.string().max(1000).optional(),
  });
  // NB: NO se acepta ningún *_minor ni total desde el cliente (06 §Dinero).
  ```
- **Permiso**: el carrito y la dirección deben pertenecer al actor (ownership).
- **Precondiciones** (capa aplicación): actor válido; carrito **no vacío**; dirección **válida y
  entregable** (`ADDRESS_NOT_DELIVERABLE` si no); todas las líneas vendibles.
- **Transacción única** (checkout idempotente, [backend.md §13.3]):
  1. **Idempotencia**: buscar `idempotency_key` por `(key, actor)`. Si existe y `request_hash` coincide →
     devolver la **misma respuesta** (`response_ref` → orden ya creada). Si `request_hash` difiere →
     `IDEMPOTENCY_CONFLICT` (409). Si no existe, insertar fila `pending` (unicidad de `key` bloquea carreras).
  2. **Recalcular precios**: pedir a [pricing](./14-modulo-pricing.md) el precio vigente por variante
     (markup dropshipping, descuentos, vigencias). Comparar con `unit_price_snapshot_minor` del carrito:
     si cambió de forma relevante → `PRICE_CHANGED` (409) con los precios nuevos, salvo que el flujo
     acepte re-confirmar (política de UI). El backend **nunca** confía en el precio del carrito para cobrar.
  3. **Reservar/confirmar stock** en la **misma tx** ([inventario](./13-modulo-inventario.md)): descuenta
     `available`, crea `stock_reservation` → `CONFIRMED` y `stock_movement type=SALE`. Si algo no alcanza →
     `INSUFFICIENT_STOCK` (rollback total, sin stock bloqueado, [backend.md §20.4]).
  4. **Calcular totales** en backend: `subtotal` = Σ líneas; `shipping` según `shippingMethod` y config de
     envíos (§9); `discount` auditable; `tax` según config; `total` = fórmula del CHECK.
  5. **Crear `order`** (`channel=store`, estado inicial `PENDING_CONFIRMATION` o `CONFIRMED` si el pago ya
     está capturado en la fase de pagos) + `order_line` con **snapshots** (título, sku, precio, costo).
  6. **`order_status_event`** inicial (`from=null → PENDING_CONFIRMATION`, actor).
  7. **Outbox**: escribir `OrderCreated` (y `OrderConfirmed` si arranca confirmada) en `outbox` dentro de la
     tx ([02](../02-arquitectura.md) §Outbox).
  8. **Cerrar idempotency_key**: `response_status`, `response_ref = order.id`.
- **Eventos** (vía outbox → worker): `OrderCreated`, y `OrderConfirmed` si aplica → disparan finanzas,
  email, reenvío a proveedor (§8).
- **Salida**: `{ orderId, orderNumber, status, totals, lines[] }` (presenter sin campos internos).
- **Errores**: `VALIDATION_FAILED`, `FORBIDDEN`/`RESOURCE_NOT_FOUND` (ownership), `CONFLICT` (carrito vacío),
  `ADDRESS_NOT_DELIVERABLE`, `PRICE_CHANGED`, `INSUFFICIENT_STOCK`, `IDEMPOTENCY_CONFLICT`.

### 3.6 `CreateManualOrder` (admin, **esta fase**) — **idempotente**

Venta asistida cargada por el dueño. Reutiliza el **mismo motor** de `CreateOrderFromCheckout` (recálculo
de precio, reserva/confirmación de stock, snapshots, outbox), con estas diferencias:

- **Actor**: `admin` con permiso `orders.create_manual` (`OWNER`/`ADMIN`; `SUPPORT` según matriz §6).
- **Header**: `Idempotency-Key` (evita doble alta por doble click en el panel).
- **Input** (sin carrito previo — las líneas van explícitas):
  ```ts
  export const CreateManualOrderSchema = z.object({
    customerId:      z.string().uuid(),               // cliente existente (o crear antes, ver módulo 11)
    channel:         z.literal('admin_manual'),
    shippingMethod:  z.nativeEnum(ShippingMethod),
    shippingAddressId: z.string().uuid().optional(),  // opcional si PICKUP
    lines: z.array(z.object({
      variantId: z.string().uuid(),
      quantity:  z.number().int().min(1).max(MAX_QTY_PER_LINE),
    })).min(1),
    discountCode:    z.string().trim().max(40).optional(),
    priceOverride:   z.boolean().default(false),      // permitir precio pactado (auditado)
    notes:           z.string().max(1000).optional(),
    initialStatus:   z.enum(['CONFIRMED', 'PENDING_CONFIRMATION']).optional(), // default por setting
  });
  ```
- **Tx**: igual que §3.5 pasos 2–8, con:
  - `channel = admin_manual`, `placed_by = actor.userId`.
  - **Estado inicial**: `initialStatus` o el default de `setting` `orders.manual_default_status`
    (típicamente `CONFIRMED` en venta cerrada por WSP). Si arranca `CONFIRMED`, se emite `OrderConfirmed`
    además de `OrderCreated`.
  - `priceOverride`: si el rol lo permite, acepta un precio pactado por línea respetando `min_margin_pct`
    de [pricing](./14-modulo-pricing.md); todo override queda en `audit_log` con `reason`.
- **Eventos**: `OrderCreated` (+ `OrderConfirmed`). Alimenta "cuánto gastó el cliente" y finanzas.
- **Salida/Errores**: como §3.5 (más `FORBIDDEN` si el rol no puede override de precio).

### 3.7 `TransitionOrder`

- **Actor**: `admin` con permiso; ciertas transiciones las dispara `system` (webhook proveedor).
- **Input**: `{ orderId: uuid, toStatus: OrderStatus, reason?: string }`.
- **Permiso/policy**: `OrderStateMachinePolicy` decide si `from→to` es válida para ese **actor** y si
  requiere `reason` (§5). Estados/actores/motivos se validan **centralizadamente**, no ad-hoc en el handler.
- **Tx**: sí (update `order.status` + insert `order_status_event`, atómico).
- **Eventos**: según destino — p. ej. `→ CANCELLED` emite `OrderCancelled`; `→ CONFIRMED` emite
  `OrderConfirmed`; `→ SHIPPED` puede requerir un `shipment` existente.
- **Salida**: orden actualizada. **Errores**: `INVALID_ORDER_STATE` (transición no permitida),
  `VALIDATION_FAILED` (falta `reason` obligatorio), `FORBIDDEN`, `RESOURCE_NOT_FOUND`.

### 3.8 `CancelOrder`

- Caso especializado de transición (por seguridad y por idempotencia propia). **Header**: `Idempotency-Key`
  ([05](../05-convenciones-api.md)).
- **Actor**: `admin` (`orders.cancel`); el cliente cancela lo suyo solo si el estado lo permite (futuro).
- **Input**: `{ orderId: uuid, reason: string.min(1) }` (motivo **obligatorio**).
- **Tx**: sí. **Lógica**: valida transición `→ CANCELLED` (solo desde `DRAFT`/`PENDING_CONFIRMATION`/
  `CONFIRMED`/`PREPARING`, ver §5). **Libera/compensa stock** ([inventario](./13-modulo-inventario.md):
  `stock_movement type=RELEASE`/`RETURN` según haya sido confirmado). No permite cancelar `SHIPPED`/
  `DELIVERED` (esos van por `RETURN_REQUESTED`). Un pedido cancelado **no** puede emitir remito
  ([backend.md §3.3 invariante], [16](./16-modulo-finanzas.md)).
- **Eventos**: `OrderCancelled` → finanzas (posible NC), inventory (libera), email.
- **Salida/Errores**: `INVALID_ORDER_STATE`, `VALIDATION_FAILED` (sin `reason`), `FORBIDDEN`, `IDEMPOTENCY_CONFLICT`.

### 3.9 `CreateShipment`

- **Actor**: `admin` (`shipments.create`); también lo puede iniciar el flujo de fulfillment del proveedor.
- **Input**: `{ orderId: uuid, carrier?: string, trackingCode?: string, eta?: date }`.
- **Precondición**: la orden debe estar en `READY_TO_SHIP` (o `PREPARING` según policy). No se crea shipment
  para orden `CANCELLED`.
- **Tx**: sí (crea `shipment` estado `CREATED` + primer `shipment_event`). Al despachar, `TransitionOrder`
  lleva la orden a `SHIPPED`.
- **Eventos**: `ShipmentStatusChanged` (`→ CREATED`).
- **Salida**: shipment. **Errores**: `INVALID_ORDER_STATE`, `RESOURCE_NOT_FOUND`, `VALIDATION_FAILED`.

### 3.10 `RefreshTracking`

- **Actor**: `admin` o `system` (job periódico, [32](../32-jobs-y-async.md)). **Header**: `Idempotency-Key`.
- **Input**: `{ shipmentId: uuid }`.
- **Lógica**: consulta al proveedor de tracking; **valida la respuesta con schema antes de confiar**
  ([06](../06-validaciones.md) §terceros). Aplica nuevos `shipment_event` (idempotentes por `(shipmentId,
  status, occurred_at)`), actualiza `shipment.status`/`eta`, y sincroniza estado de orden si corresponde
  (`DELIVERED` → orden `DELIVERED`). Si el proveedor no responde → `SHIPMENT_TRACKING_UNAVAILABLE` (503)
  **con fallback** al último estado conocido (degradación elegante, [backend.md §17.6]).
- **Eventos**: `ShipmentStatusChanged` por cada cambio real.
- **Salida**: tracking actualizado (o último conocido + flag `stale`). **Errores**: `SHIPMENT_TRACKING_UNAVAILABLE`,
  `RESOURCE_NOT_FOUND`.

### 3.11 `GetOrderDetail`

- **Actor**: `customer` (solo la suya) o `admin` (con permiso; `SUPPORT` con `reason` para datos sensibles).
- **Input**: `{ orderId: uuid }`.
- **Ownership**: cliente → `order.customer_id === actor.customerId`, si no `RESOURCE_NOT_FOUND` (anti-BOLA,
  nunca 200 sobre orden ajena). `SUPPORT` que ve domicilio/WSP registra `access_log` con `reason`
  ([07](../07-auth-identidad.md) §Motivos).
- **Salida**: presenter tipado. El presenter del **cliente oculta** `supplier_cost_snapshot_minor` y
  cualquier costo/margen; el presenter **admin** los incluye solo si el rol tiene permiso de costo.
- **Errores**: `RESOURCE_NOT_FOUND`, `FORBIDDEN`.

### 3.12 `ListOrders`

- **Actor**: `admin` (todas, con filtros) o `customer` (solo las suyas).
- **Input**: filtros **whitelisted** ([05](../05-convenciones-api.md) §Paginación/filtros):
  `status`, `channel`, `customerId` (admin), `dateFrom/dateTo`, `sort` (`newest|total-desc|total-asc`),
  `cursor`, `limit` (default 20, máx 50).
- **Salida**: **cursor pagination** (`{ data, pageInfo }`). Nunca lista sin límite. Cursor firmado.
- **Errores**: `VALIDATION_FAILED`.

**Forma de salida del carrito revalidado** (§3.1–3.4) — read model, no la tabla cruda:

```ts
type CartView = {
  cartId: string;
  currency: Currency;
  lines: Array<{
    itemId: string; variantId: string; productTitle: string; image: string;
    quantity: number;
    unitPriceMinor: number;        // recalculado por pricing al mostrar
    lineTotalMinor: number;
    availability: 'IN_STOCK' | 'LOW' | 'OUT_OF_STOCK';
    issues?: Array<'PRICE_CHANGED' | 'OUT_OF_STOCK' | 'PRODUCT_UNAVAILABLE' | 'QTY_ADJUSTED'>;
  }>;
  subtotalMinor: number;           // informativo; el total real se fija en checkout
};
```

---

## 4. Endpoints

Dos transportes sobre el mismo dominio ([05](../05-convenciones-api.md)). tRPC para store/admin; REST para
lo que necesita `Idempotency-Key` explícito y para terceros/webhooks. Ninguno contiene lógica de negocio.

### 4.1 tRPC (`cart.*` y `orders.*`)

```txt
cart.getCurrent()                        → CartView (crea carrito si no existe)   [public|protected]
cart.addItem(AddCartItemInput)           → CartView                               [public|protected]
cart.updateItem(UpdateCartItemInput)     → CartView                               [public|protected]
cart.removeItem({ itemId })              → CartView                               [public|protected]
cart.merge({ anonymousCartToken })       → { cart: CartView, diffs }              [protected]

orders.create(CheckoutInput)             → OrderSummary  (Idempotency-Key)        [protected]  (futuro)
orders.createManual(CreateManualOrderInput) → OrderSummary (Idempotency-Key)      [admin]      (esta fase)
orders.get({ orderId })                  → OrderDetail                            [protected|admin]
orders.list(ListOrdersInput)             → Paginated<OrderSummary>                [protected|admin]
orders.transition({ orderId, toStatus, reason? }) → OrderSummary                  [admin]
orders.cancel({ orderId, reason })       → OrderSummary  (Idempotency-Key)        [admin]
shipments.create(CreateShipmentInput)    → Shipment                              [admin]
shipments.refreshTracking({ shipmentId })→ Tracking      (Idempotency-Key)        [admin]
shipments.tracking({ orderId })          → Tracking                              [protected|admin]
```

`naming`: queries = `get*/list*`; mutations = `create*/update*/cancel*/transition*`. Input siempre schema
Zod de `packages/validators`.

### 4.2 REST (`/api/v1`) — con envelope y códigos de [05](../05-convenciones-api.md)

```txt
POST   /api/v1/cart/items                      # AddCartItem
PATCH  /api/v1/cart/items/:itemId              # UpdateCartItem
DELETE /api/v1/cart/items/:itemId              # RemoveCartItem
POST   /api/v1/checkout/orders                 # CreateOrderFromCheckout  (Idempotency-Key OBLIGATORIA)
GET    /api/v1/orders                          # ListOrders (cursor)
GET    /api/v1/orders/:orderId                 # GetOrderDetail (ownership)
POST   /api/v1/orders/:orderId/cancel          # CancelOrder    (Idempotency-Key)
GET    /api/v1/shipments/:shipmentId/tracking  # tracking (ownership: solo lo suyo; admin con permiso)
POST   /api/v1/shipments/:shipmentId/refresh-tracking  # RefreshTracking (Idempotency-Key)
```

- El alta manual (`admin_manual`) va por **tRPC admin** (`orders.createManual`); no se expone en REST público.
- Webhook del proveedor de envíos (actualiza tracking) entra por `interfaces/webhooks/` con firma HMAC +
  anti-replay + idempotencia por `eventId` ([08](../08-seguridad.md) §Webhooks) y termina llamando al mismo
  caso de uso que `RefreshTracking`.
- Todo endpoint REST público tiene OpenAPI; `Idempotency-Key` documentada donde aplica.

---

## 5. Máquina de estados e invariantes

Las transiciones de orden viven en **una** policy central (`OrderStateMachinePolicy`), no dispersas en
handlers ([backend.md §4.9], [02](../02-arquitectura.md) §domain/policies). Cada transición declara: estados
origen permitidos, actor habilitado, si exige `reason`, y efectos (stock, eventos).

### 5.1 Tabla de transiciones

| Desde | Hacia | Actor | `reason` | Efectos |
|---|---|---|:--:|---|
| _(alta)_ | `DRAFT` | system/admin | no | orden borrador (manual sin confirmar) |
| _(alta)_ | `PENDING_CONFIRMATION` | checkout | no | `OrderCreated` |
| `DRAFT` | `PENDING_CONFIRMATION` | admin | no | — |
| `PENDING_CONFIRMATION` | `CONFIRMED` | admin/system(pago) | no | `OrderConfirmed`, confirma stock |
| _(alta manual)_ | `CONFIRMED` | admin | no | `OrderCreated`+`OrderConfirmed` |
| `CONFIRMED` | `PREPARING` | admin | no | — |
| `PREPARING` | `READY_TO_SHIP` | admin | no | habilita `CreateShipment` |
| `READY_TO_SHIP` | `SHIPPED` | admin/system | no | requiere `shipment`; `ShipmentStatusChanged` |
| `SHIPPED` | `DELIVERED` | system(webhook)/admin | no | cierra ciclo feliz |
| `DRAFT` | `CANCELLED` | admin | **sí** | libera stock si reservado |
| `PENDING_CONFIRMATION` | `CANCELLED` | admin/cliente\* | **sí** | libera stock |
| `CONFIRMED` | `CANCELLED` | admin | **sí** | libera/compensa stock, `OrderCancelled` |
| `PREPARING` | `CANCELLED` | admin | **sí** | solo si policy lo permite |
| `SHIPPED` | `RETURN_REQUESTED` | cliente\*/admin | **sí** | inicia devolución |
| `RETURN_REQUESTED` | `RETURNED` | admin | **sí** | `stock RETURN`, posible NC en finanzas |

\* Acciones de cliente: solo fase futura del portal, y solo sobre pedidos propios.

### 5.2 Invariantes (capa domain — irrompibles)

```txt
- Toda transición no listada es INVALID_ORDER_STATE (rechazo, no efecto).
- No se cancela SHIPPED/DELIVERED (van por RETURN_REQUESTED).
- No se emite remito para orden CANCELLED (invariante compartida con finanzas).
- Una orden no pasa a SHIPPED sin dirección válida (salvo PICKUP) y stock confirmado.
- Los montos de la orden son inmutables una vez CONFIRMED (los snapshots no cambian).
- CANCELLED y RETURNED liberan/compensan stock exactamente una vez (idempotencia por order_status_event).
- Toda transición deja rastro en order_status_event (from, to, actor, reason, timestamp).
```

---

## 6. Permisos (matriz de [07](../07-auth-identidad.md))

| Acción | OWNER | ADMIN | CATALOG_MANAGER | FINANCE | SUPPORT | customer\* |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Ver/editar carrito | — | — | — | — | — | ✔ (propio) |
| Checkout store | — | — | — | — | — | ✔ (propio) |
| Crear pedido manual (`admin_manual`) | ✔ | ✔ | ✖ | ✖ | ✔ | — |
| Override de precio en manual | ✔ | ✔ | ✖ | ✖ | ✖ | — |
| Ver detalle de orden | ✔ | ✔ | ✖ | ✔ (lectura) | con motivo | ✔ (propia) |
| Ver costo/margen en orden (`supplier_cost_snapshot`) | ✔ | ✔ | ✖ | ✔ | ✖ | ✖ |
| Transicionar estado | ✔ | ✔ | ✖ | ✖ | parcial | ✖ |
| Cancelar orden | ✔ | ✔ | ✖ | ✖ | con motivo | ✔ si estado permite (propia) |
| Crear/gestionar shipment | ✔ | ✔ | ✖ | ✖ | ✖ | ✖ |
| Ver tracking | ✔ | ✔ | ✖ | ✖ | ✔ | ✔ (propio) |
| Listar todas las órdenes | ✔ | ✔ | ✖ | ✔ | ✔ | ✖ (solo propias) |

\* `customer` = fase futura del portal. Ownership siempre validado en el caso de uso
([07](../07-auth-identidad.md), [06](../06-validaciones.md) §ownership). `SUPPORT` que accede a datos
sensibles (domicilio, WSP, costo) registra `access_log` con `reason`.

---

## 7. Validaciones (las 4 capas de [06](../06-validaciones.md))

- **Transporte**: schemas Zod de `packages/validators` en todo `body/params/query/header`. `quantity`
  acotada, `uuid` en IDs, `Idempotency-Key` presente en rutas críticas. Cursor y `limit` validados.
- **Aplicación**: ownership de carrito/orden/dirección; existencia y estado (carrito no vacío, dirección
  entregable, transición válida); permiso por rol.
- **Dominio**: invariantes de §5.2 + no reservar stock negativo + totales coherentes + snapshots inmutables.
- **Persistencia**: `UNIQUE(order_number)`, `UNIQUE(cart_id, variant_id)`, CHECK de montos/totales/cantidades,
  FK con `ON DELETE RESTRICT`, `UNIQUE(idempotency_key.key)`.
- **Dinero** ([06](../06-validaciones.md) §Dinero): el backend **recalcula** subtotal, envío, descuento,
  impuesto y total. El cliente **nunca** envía `*_minor` ni total. Moneda base `ARS`, enteros en unidad menor.
- **Salida**: presenters ocultan `supplier_cost_snapshot_minor`, `placed_by`, notas internas al cliente.
- **Mass assignment / prototype pollution**: nunca `req.body` directo al ORM; `notes` saneadas; claves
  peligrosas bloqueadas si hubiera jsonb.

---

## 8. Eventos (outbox → worker, [02](../02-arquitectura.md) §Outbox, [32](../32-jobs-y-async.md))

Los eventos se escriben en `outbox` **dentro de la tx** y los publica un worker con reintentos. Consumidores
en otros dominios reaccionan sin acoplarse a `orders`.

| Evento | Cuándo | Consumidores |
|---|---|---|
| `OrderCreated` | tras crear la orden (store o manual) | email (confirmación), dashboard (KPIs), analytics |
| `OrderConfirmed` | al confirmar (checkout con pago o manual `CONFIRMED`) | **finanzas** (genera remito/factura), **inventory** (confirma stock), **suppliers** (reenvía pedido al proveedor — dropshipping), email |
| `OrderCancelled` | al cancelar | inventory (libera/compensa), finanzas (posible NC), email |
| `ShipmentStatusChanged` | cada cambio real de estado de envío | email (tracking), dashboard, cliente (portal futuro) |

Reenvío al proveedor (fulfillment dropshipping): `OrderConfirmed` → worker → adaptador de
[suppliers](./20-modulo-suppliers.md) que llama a la API/feed del proveedor. El reenvío es **idempotente**
(clave por `orderId`) y su fallo no revierte la orden: se reintenta con backoff y DLQ ([32](../32-jobs-y-async.md)).

Payloads **mínimos**: `orderId`, `orderNumber`, `customerId`, `status`, y IDs — nunca PII innecesaria ni
documentos completos ([backend.md §25.1]). Finanzas/suppliers leen el detalle por read model autorizado, no
por JOIN a tablas de `orders` ([02](../02-arquitectura.md) §reglas de dependencia).

---

## 9. Métodos de envío (del store `constants.ts`)

El front ya define tres opciones; el backend las mapea a `ShippingMethod` y fija el costo (el front muestra,
no decide el cobro):

| `constants.ts` id | `ShippingMethod` | Costo | Regla backend |
|---|---|---|---|
| `standard` (default, `DEFAULT_SHIPPING_ID`) | `STANDARD` | gratis (`0`) | envío estándar 3–5 días; `shipping_minor = 0` |
| `express` | `EXPRESS` | `24900` (ARS minor) | 24–48 h; costo desde config de envíos, no del cliente |
| `pickup` | `PICKUP` | gratis (`0`) | retiro coordinado; `shipping_address_id` puede ser `null` |

- Los costos reales viven en `setting` (config de envíos, [19](./19-modulo-configuracion.md)); el
  `24900` del front es un valor de referencia que el backend **revalida**.
- `PICKUP` no exige dirección de envío pero sí punto de retiro (config). `STANDARD`/`EXPRESS` exigen
  `shipping_address_id` **entregable** (`ADDRESS_NOT_DELIVERABLE` si no).
- La lógica de "envío gratis" por tier/loyalty (mock del store) se resuelve como **descuento de envío**
  auditable en el cálculo de totales, no como columna mágica.

---

## 10. Errores del dominio ([05](../05-convenciones-api.md) §Catálogo de códigos)

| `code` | HTTP | Cuándo |
|---|:--:|---|
| `INSUFFICIENT_STOCK` | 409 | stock insuficiente al agregar/actualizar carrito o al confirmar checkout (rollback total) |
| `PRICE_CHANGED` | 409 | el precio vigente difiere del snapshot del carrito; se devuelve el nuevo precio |
| `PRODUCT_NOT_AVAILABLE` | 409 | variante despublicada/archivada/sin stock al agregar |
| `INVALID_ORDER_STATE` | 409 | transición no permitida por la máquina de estados |
| `IDEMPOTENCY_CONFLICT` | 409 | misma `Idempotency-Key`, `request_hash` distinto |
| `ADDRESS_NOT_DELIVERABLE` | 422 | dirección inexistente/no entregable (no PICKUP) |
| `SHIPMENT_TRACKING_UNAVAILABLE` | 503 | proveedor de tracking caído → **fallback** a último estado conocido |
| `RESOURCE_NOT_FOUND` | 404 | recurso inexistente o ajeno (anti-enumeración/BOLA) |
| `VALIDATION_FAILED` | 400 | schema de entrada inválido |
| `FORBIDDEN` | 403 | autenticado sin permiso (p. ej. override de precio) |

Mensajes públicos claros, sin detalle técnico ni nombres de tabla ([05](../05-convenciones-api.md), [06](../06-validaciones.md)).

---

## 11. Tests de checkout críticos ([31](../31-testing.md), [backend.md §20.4])

Obligatorios antes de dar por hecho el checkout (store y manual):

```txt
[ ] Carrito vacío → CONFLICT/VALIDATION, no crea orden.
[ ] Producto sin stock → INSUFFICIENT_STOCK, rollback total, sin reserva colgada.
[ ] Precio cambió entre carrito y checkout → PRICE_CHANGED con precios nuevos (no cobra el viejo).
[ ] Misma Idempotency-Key + mismo payload → una sola orden; segunda respuesta idéntica (mismo order_number).
[ ] Misma Idempotency-Key + payload distinto → IDEMPOTENCY_CONFLICT (409).
[ ] Falla parcial de stock (una de N líneas) → no deja stock bloqueado en las otras (tx atómica).
[ ] Dirección no entregable → ADDRESS_NOT_DELIVERABLE (salvo PICKUP).
[ ] order_number es único bajo checkout concurrente (test de carrera).
[ ] Alta manual arranca en CONFIRMED/PENDING según setting; emite eventos correctos.
[ ] Override de precio por rol sin permiso → FORBIDDEN; con permiso queda auditado.
[ ] El total se recalcula en backend e ignora cualquier *_minor enviado por el cliente.
```

Tests de autorización negativa (BOLA/IDOR, [backend.md §20.3]):

```txt
[ ] customer B lee/cancela orden de customer A → 404/403, nunca 200.
[ ] Presenter de cliente NO expone supplier_cost_snapshot_minor ni margen.
[ ] SUPPORT accede a domicilio/costo → registra access_log con reason (o se le niega el costo).
[ ] Carrito ajeno por cartToken → RESOURCE_NOT_FOUND.
```

Tracking:

```txt
[ ] Proveedor caído → SHIPMENT_TRACKING_UNAVAILABLE con fallback a último estado (flag stale).
[ ] Eventos de tracking duplicados (webhook reintenta) → idempotentes, no duplican shipment_event.
[ ] Cliente solo ve su propio tracking.
```

---

## 12. Casos borde

- **Doble submit por timeout**: el cliente reintenta checkout; la `Idempotency-Key` garantiza una sola orden
  y respuesta estable ([backend.md §13.3]).
- **Carrera de stock**: dos checkouts compiten por la última unidad; la confirmación de stock en la tx
  (con lock/`SELECT ... FOR UPDATE` en inventario) hace que uno gane y el otro reciba `INSUFFICIENT_STOCK`.
- **Precio cambia mid-checkout**: recálculo en paso 2 detecta el delta → `PRICE_CHANGED`; nunca se cobra el
  precio viejo del carrito.
- **Producto despublicado con carrito vivo**: al revalidar se marca la línea inválida; no se cobra; el
  checkout falla con `PRODUCT_NOT_AVAILABLE` hasta que se remueva.
- **Reserva de carrito expirada**: `cart.expires_at`/reservas TTL; job libera reservas vencidas
  ([13](./13-modulo-inventario.md), [32](../32-jobs-y-async.md)).
- **Cancelación tras confirmación de stock**: `CancelOrder` compensa exactamente una vez (idempotencia por
  `order_status_event`), evita liberar dos veces.
- **PICKUP sin dirección**: válido; no exige `shipping_address_id`, sí punto de retiro.
- **Manual con cliente inexistente**: se exige `customerId` válido (crear cliente antes, [11](./11-modulo-clientes.md)).
- **Override de precio bajo `min_margin_pct`**: rechazado por pricing aunque el rol tenga permiso, salvo
  excepción explícita auditada.
- **Webhook de tracking fuera de orden**: los `shipment_event` se ordenan por `occurred_at`; no se asume
  orden de llegada ([06](../06-validaciones.md) §webhooks).
- **Merge de carrito con líneas que exceden stock**: se ajusta al máximo disponible y se devuelve como diff.

---

## 13. Definition of Done ([backend.md §28])

```txt
[ ] Reglas de negocio (transiciones, invariantes, totales) en domain/application, no en controllers.
[ ] Checkout store y alta manual comparten el mismo motor transaccional (recálculo, stock, snapshots, outbox).
[ ] Todo input externo validado con Zod compartido; ningún *_minor entra desde el cliente.
[ ] Idempotency-Key obligatoria y probada en checkout, cancel y refresh-tracking.
[ ] Máquina de estados centralizada; toda transición valida actor/estado/motivo y deja order_status_event.
[ ] Snapshots (título, sku, precio, costo proveedor) persistidos por línea; orden inmutable tras CONFIRMED.
[ ] Reserva/confirmación de stock en la MISMA tx que la creación de orden; rollback total ante fallo.
[ ] Eventos OrderCreated/OrderConfirmed/OrderCancelled/ShipmentStatusChanged por outbox; consumidores desacoplados.
[ ] Reenvío a proveedor (dropshipping) idempotente vía worker; su fallo no revierte la orden.
[ ] Tracking con ownership estricto y fallback a último estado (SHIPMENT_TRACKING_UNAVAILABLE).
[ ] Presenters ocultan costo/margen y campos internos al cliente; costo solo a roles con permiso.
[ ] Errores tipados mapeados a códigos de 05; mensajes públicos claros.
[ ] Tests: checkout crítico, autorización negativa (BOLA), idempotencia, carreras, tracking.
[ ] Endpoints en OpenAPI (REST) / tipos tRPC; logs con requestId sin PII; métricas de checkout.
[ ] Migraciones corren desde cero; constraints (unique/check/FK) presentes en DB, no solo en app.
```
