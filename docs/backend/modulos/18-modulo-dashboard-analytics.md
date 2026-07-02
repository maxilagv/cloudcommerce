# 18 · Dashboard y analytics (dominio `dashboard`)

Cubre el requerimiento del dueño **Dashboard**: la **primera vista del panel admin**. Es el resumen
ejecutivo del negocio (KPIs, gráficos, actividad reciente, alertas) que el dueño ve al iniciar sesión.

> Documentos fundacionales que este módulo da por sentados:
> [02-arquitectura](../02-arquitectura.md) (regla de dependencia entre módulos, read models),
> [04-modelo-de-datos](../04-modelo-de-datos.md) (tablas canónicas y snapshots),
> [05-convenciones-api](../05-convenciones-api.md) (envelope, errores, paginación),
> [07-auth-identidad](../07-auth-identidad.md) (RBAC y matriz de permisos),
> [30-observabilidad](../30-observabilidad.md) (métricas, budgets), [32-jobs-y-async](../32-jobs-y-async.md).

---

## 1. Propósito y alcance

### 1.1 Qué es

El dominio `dashboard` es una **capa de lectura cross-dominio**. Su única responsabilidad es **agregar y
presentar** datos que ya son propiedad de otros dominios (orders, finance, inventory, catalog, customers,
ai-gateway) en las formas exactas que el panel admin pinta: KPIs, series temporales, distribuciones para
gráficos y listas de actividad.

Está inspirado en el `mockMetrics` / `SpendingPoint` del front del **cliente**
(`apps/store/src/lib/mock-account.ts`), pero **invertido a la óptica del dueño**: donde el cliente ve
"total gastado / total ahorrado / CloudPoints", el dueño ve "ventas / margen / pedidos / stock bajo".

### 1.2 Regla de oro: SOLO LECTURA, sin JOINs crudos

```txt
El dashboard NUNCA muta estado. No tiene comandos, solo queries.
El dashboard NUNCA hace JOIN directo a tablas de otros dominios.
```

Esto es la aplicación literal de la regla de dependencia de [02](../02-arquitectura.md#reglas-de-dependencia-obligatorias):

> *Un dominio no accede directo a tablas de otro dominio; solo vía **read models autorizados** o eventos.*

Por lo tanto:

- Los **cálculos financieros** (ingresos, costos, **margen**, ticket promedio) los provee **finance**
  ([16-modulo-finanzas](./16-modulo-finanzas.md)) a través de un port de lectura. El dashboard **no** conoce
  `supplier_cost_snapshot_minor` ni recalcula márgenes por su cuenta.
- Las **ventas y pedidos** (conteos, estados, series) los provee **orders**
  ([15-modulo-ordenes](./15-modulo-ordenes.md)).
- El **stock bajo** lo provee **inventory** ([13-modulo-inventario](./13-modulo-inventario.md)).
- Los **productos publicados** los provee **catalog** ([10-modulo-catalogo](./10-modulo-catalogo.md)).
- Los **clientes nuevos** los provee **customers** ([11-modulo-clientes](./11-modulo-clientes.md)).
- Las **generaciones IA** las provee **ai-gateway** ([17-modulo-ia-gateway](./17-modulo-ia-gateway.md)).

El dashboard consume esos dominios por **ports** (interfaces en `application/ports`), resueltos en
`container.ts`. Cada port devuelve un **read model / DTO ya presentado y ya autorizado** por el dominio dueño;
el dashboard solo compone y aplica la policy de visibilidad por rol.

### 1.3 Fuera de alcance

- No genera documentos, no exporta CSV pesados (eso es finance / jobs de export).
- No define reglas de negocio nuevas (márgenes, publicación, reservas): son de sus dominios.
- No es analítica avanzada / BI histórico profundo (cohortes, LTV, forecasting): eso lo cubre el servicio
  IA ([17](./17-modulo-ia-gateway.md)) en fase posterior. El dashboard es el **resumen operativo del día a día**.

---

## 2. Fuentes de datos y read models

El dashboard nunca lee tablas ajenas: consume **ports** que devuelven **read models** provistos por el dominio
dueño. La siguiente tabla mapea cada KPI a su fuente y cómo se calcula (en el dominio dueño, no acá).

### 2.1 KPIs principales → fuente → cálculo

| KPI (óptica dueño) | Módulo dueño / port | Cómo se calcula (en el dominio dueño) |
|---|---|---|
| **Ventas del período** (monto) | finance → `FinanceReadPort.getPeriodTotals` | Σ `total_minor` de `order` con estado ∈ {CONFIRMED..DELIVERED} en `[from,to)`, moneda base ARS |
| **Ingresos netos** | finance | Ventas − descuentos − devoluciones; deriva de `order`/`order_line` + notas de crédito |
| **Margen** (monto y %) | finance | Σ (`unit_price_minor` − `supplier_cost_snapshot_minor`) × qty por línea; % = margen / ingresos. **Sensible** |
| **Cantidad de pedidos** | orders → `OrdersReadPort.countOrders` | `COUNT(order)` en el período (con filtro de estado configurable) |
| **Ticket promedio (AOV)** | finance | Ingresos / cantidad de pedidos pagados del período |
| **Clientes nuevos** | customers → `CustomersReadPort.countNewCustomers` | `COUNT(customer)` con `created_at` en el período (excluye `deleted_at`) |
| **Productos publicados** | catalog → `CatalogReadPort.countPublished` | `COUNT(product)` con `status = PUBLISHED` y `deleted_at IS NULL` |
| **Stock bajo (alertas)** | inventory → `InventoryReadPort.listLowStock` | `stock_item` con `on_hand - reserved <= reorder_point` (o `= 0`) |
| **Pedidos por estado** | orders → `OrdersReadPort.countByStatus` | `COUNT(order) GROUP BY status` en el período |

### 2.2 Datos de gráficos → fuente

| Gráfico | Módulo dueño / port | Cómo se calcula |
|---|---|---|
| **Serie temporal ventas/ingresos** | finance → `FinanceReadPort.getSalesTimeSeries` | Agregado por bucket (día/mes) sobre `order`; ventana 7d/30d/12m |
| **Ventas por categoría** | orders + catalog → `OrdersReadPort.salesByCategory` | Σ `line_total_minor` GROUP BY `category_id`; nombre denormalizado por catalog |
| **Top productos** | orders → `OrdersReadPort.topProducts` | Σ qty y Σ `line_total_minor` GROUP BY producto; ORDER BY revenue DESC LIMIT n |
| **Top clientes** | orders + finance → `OrdersReadPort.topCustomers` | Σ `total_minor` GROUP BY `customer_id`; nombre denormalizado por customers |

### 2.3 Actividad reciente → fuente

| Bloque | Módulo dueño / port | Cómo se calcula |
|---|---|---|
| **Últimos pedidos** | orders → `OrdersReadPort.recentOrders` | `order` ORDER BY `created_at` DESC LIMIT 10 |
| **Últimos clientes** | customers → `CustomersReadPort.recentCustomers` | `customer` ORDER BY `created_at` DESC LIMIT 10 |
| **Últimas generaciones IA** | ai-gateway → `AiReadPort.recentGenerations` | `ai_generation` ORDER BY `created_at` DESC LIMIT 10 |

### 2.4 Materialización propia del dominio (proyecciones)

Para no golpear a los dominios dueños en cada carga, el dashboard mantiene proyecciones propias
**recomputables** (nunca fuente de verdad):

```
dashboard_daily_metric   date, revenue_minor, income_minor, margin_minor, orders_count,
                         paid_orders_count, new_customers_count, units_sold,
                         currency, computed_at
                         # PK (date). Una fila por día. Alimenta serie temporal y overview.
dashboard_category_daily date, category_id, category_name, revenue_minor, units_sold, computed_at
                         # PK (date, category_id). Alimenta "ventas por categoría".
```

- Se reconstruyen desde cero corriendo un reprocesado idempotente sobre `finance`/`orders` (job de backfill).
- `finance_period_snapshot` (definido en [04](../04-modelo-de-datos.md#finance-schemafinancets)) es la cache
  mensual **de finance**; el dashboard la **consume** vía port, no la posee.
- Estas tablas viven en `schema/dashboard.ts` y son las **únicas** que el dominio dashboard posee/escribe
  (vía su proyector por eventos, §7).

---

## 3. Casos de uso / queries

Todas son **queries** (CQRS: sin comandos). Cada una recibe un `Actor` admin tipado
([07](../07-auth-identidad.md#contexto-de-auth-para-casos-de-uso)) y valida permiso **en el caso de uso**,
no solo en el middleware. La salida es un presenter tipado (§5). Los campos sensibles (margen, costo) se
**omiten del shape** según rol (§6), no se envían con `null`.

### 3.1 `GetDashboardOverview`

- **Input**: `{ range: '7d' | '30d' | '12m'; compareToPrevious?: boolean }`
- **Permiso**: `dashboard.view`. Campos de margen/costo requieren `finance.read_margin`.
- **Orquestación**: lee `dashboard_daily_metric` del rango (fast path) o pide a los ports si falta cache;
  arma todos los KPIs de §2.1 + variaciones vs. período anterior.
- **Salida**: `DashboardOverviewResponse` (§5.1).

### 3.2 `GetSalesTimeSeries`

- **Input**: `{ range: '7d' | '30d' | '12m'; metric: 'revenue' | 'income' | 'orders' }`
- **Permiso**: `dashboard.view` (para `revenue`/`orders`); `income` con margen no aplica acá (income no es margen).
- **Bucketing**: 7d/30d → bucket **diario**; 12m → bucket **mensual**. Rellena buckets vacíos con `0`.
- **Salida**: `SalesTimeSeriesResponse` (§5.2). Mismo shape que alimenta el gráfico tipo `SpendingPoint` del front.

### 3.3 `GetSalesByCategory`

- **Input**: `{ range; limit?: number (default 8); metric: 'revenue' | 'units' }`
- **Permiso**: `dashboard.view`.
- **Orquestación**: `dashboard_category_daily` agregado por categoría; top `limit`, resto agrupado en `"Otras"`.
- **Salida**: `SalesByCategoryResponse` (§5.3) — apto para pie o bar.

### 3.4 `GetTopProducts`

- **Input**: `{ range; limit?: number (default 5); metric: 'revenue' | 'units' }`
- **Permiso**: `dashboard.view`. `marginMinor` por producto solo con `finance.read_margin`.
- **Salida**: `TopProductsResponse` (§5.4).

### 3.5 `GetTopCustomers`

- **Input**: `{ range; limit?: number (default 5) }`
- **Permiso**: `dashboard.view` + `customers.read`. Nombre completo/WSP solo si el rol puede ver datos de
  cliente (SUPPORT con motivo, ver [07](../07-auth-identidad.md)); si no, se muestra iniciales/anonimizado.
- **Salida**: `TopCustomersResponse` (§5.5).

### 3.6 `GetRecentActivity`

- **Input**: `{ limit?: number (default 10 por bloque) }`
- **Permiso**: `dashboard.view`. Bloque IA requiere `ai.view`; bloque clientes respeta visibilidad de PII.
- **Salida**: `RecentActivityResponse` (§5.6) — tres listas (pedidos, clientes, generaciones IA).

### 3.7 `GetLowStockAlerts`

- **Input**: `{ limit?: number (default 20); threshold?: 'reorder_point' | 'zero' }`
- **Permiso**: `dashboard.view` (parcial para CATALOG_MANAGER; ver §6).
- **Orquestación**: `InventoryReadPort.listLowStock` — no expone costo, solo `available`, `reorderPoint`.
- **Salida**: `LowStockAlertsResponse` (§5.7).

> Nota de autorización negativa (obligatoria en tests, [31](../31-testing.md)): un `CATALOG_MANAGER` que
> llame `GetDashboardOverview` recibe el overview **sin** los campos `margin*`; un `FINANCE` recibe márgenes
> pero **no** datos sensibles de clientes en `GetTopCustomers`.

---

## 4. Endpoints tRPC `dashboard.*`

Router `dashboard` bajo `appRouter` ([05](../05-convenciones-api.md#convención-trpc)). **Todas** son
`adminProcedure` (requieren `admin_user` + rol) y **queries** (no hay mutations). Input siempre por schema Zod
de `packages/validators`.

```txt
dashboard.getOverview({ range, compareToPrevious? })      → DashboardOverviewResponse
dashboard.getSalesTimeSeries({ range, metric })           → SalesTimeSeriesResponse
dashboard.getSalesByCategory({ range, limit?, metric })   → SalesByCategoryResponse
dashboard.getTopProducts({ range, limit?, metric })       → TopProductsResponse
dashboard.getTopCustomers({ range, limit? })              → TopCustomersResponse
dashboard.getRecentActivity({ limit? })                   → RecentActivityResponse
dashboard.getLowStockAlerts({ limit?, threshold? })       → LowStockAlertsResponse
```

Schema de entrada compartido (ilustrativo, `packages/validators/src/dashboard.ts`):

```ts
export const DashboardRange = z.enum(['7d', '30d', '12m']);

export const GetOverviewInput = z.object({
  range: DashboardRange.default('30d'),
  compareToPrevious: z.boolean().default(true),
});

export const GetSalesTimeSeriesInput = z.object({
  range: DashboardRange.default('30d'),
  metric: z.enum(['revenue', 'income', 'orders']).default('revenue'),
});

export const GetTopEntitiesInput = z.object({
  range: DashboardRange.default('30d'),
  limit: z.number().int().min(1).max(20).default(5),
  metric: z.enum(['revenue', 'units']).default('revenue'),
});
```

- **REST**: no se expone REST público para el dashboard (es superficie interna del panel). Si en el futuro
  se requiere para un widget de terceros, se agrega bajo `/api/v1/admin/dashboard/*` con OpenAPI y auth admin.
- **Rate limit**: por `actor` + ruta (categoría "Admin", [08](../08-seguridad.md)). El dashboard dispara
  varias queries en paralelo al cargar; el límite debe contemplar el fan-out (p. ej. 60 req/min por admin).
- **`requestId`** propagado en `meta` / context ([05](../05-convenciones-api.md#headers-y-límites)).

---

## 5. Shapes de respuesta (contrato que pinta el front)

Tipos en `packages/types/src/dashboard.ts`. Dinero siempre como `Money` (`amountMinor` entero + `currency`),
nunca float ([04](../04-modelo-de-datos.md#convenciones-globales-de-tabla)). Los presenters **omiten** campos
sensibles según rol; los tipos marcan esos campos como opcionales.

### 5.1 Overview (KPIs)

```ts
export type KpiDelta = {
  /** variación vs período anterior, como fracción: 0.34 = +34% */
  pct: number;
  positive: boolean;
  /** texto ya formateado para el front: "+34%" | "+1 este mes" */
  label: string;
};

export type Kpi<T = Money | number> = {
  key: string;              // 'sales' | 'income' | 'margin' | 'orders' | 'aov' | ...
  label: string;            // "Ventas del período"
  value: T;
  delta?: KpiDelta;         // ausente si compareToPrevious=false o sin base
};

export type DashboardOverviewResponse = {
  range: '7d' | '30d' | '12m';
  period: { from: string; to: string };       // ISO
  currency: 'ARS' | 'USD';
  kpis: {
    sales: Kpi<Money>;                          // ventas del período
    income: Kpi<Money>;                         // ingresos netos
    margin?: Kpi<Money>;                        // SOLO con finance.read_margin
    marginPct?: number;                         // SOLO con finance.read_margin
    orders: Kpi<number>;                        // cantidad de pedidos
    averageTicket: Kpi<Money>;                  // AOV
    newCustomers: Kpi<number>;
    publishedProducts: Kpi<number>;
    lowStockCount: Kpi<number>;                 // nº de alertas de stock bajo
  };
  ordersByStatus: { status: OrderStatus; count: number }[];
  computedAt: string;                           // ISO; delata frescura de la proyección
  stale: boolean;                               // true si se sirvió cache vencida (degradación)
};
```

### 5.2 Serie temporal (línea/área)

```ts
export type TimeSeriesPoint = {
  bucket: string;      // '2026-06-01' (día) o '2026-06' (mes)
  label: string;       // "1 jun" | "Jun"  — ya localizado, espejo de SpendingPoint.month
  value: number;       // Money.amountMinor si metric∈{revenue,income}; entero si orders
};

export type SalesTimeSeriesResponse = {
  range: '7d' | '30d' | '12m';
  metric: 'revenue' | 'income' | 'orders';
  granularity: 'day' | 'month';
  currency: 'ARS' | 'USD';
  points: TimeSeriesPoint[];   // buckets vacíos incluidos con value=0
  total: number;               // suma del período
};
```

> Espejo directo de `SpendingPoint { month, amount }` del front del cliente, generalizado a `bucket/label/value`.

### 5.3 Ventas por categoría (pie/bar)

```ts
export type CategorySlice = {
  categoryId: string | null;   // null = agregado "Otras"
  name: string;                // denormalizado por catalog
  value: number;               // revenue en minor o unidades según metric
  share: number;               // fracción del total, 0..1 (para pie)
};

export type SalesByCategoryResponse = {
  range: '7d' | '30d' | '12m';
  metric: 'revenue' | 'units';
  currency: 'ARS' | 'USD';
  slices: CategorySlice[];     // top N + "Otras"
  total: number;
};
```

### 5.4 Top productos

```ts
export type TopProduct = {
  productId: string;
  title: string;               // snapshot / denormalizado
  imageUrl?: string;
  unitsSold: number;
  revenue: Money;
  marginMinor?: number;        // SOLO con finance.read_margin
};

export type TopProductsResponse = {
  range: '7d' | '30d' | '12m';
  metric: 'revenue' | 'units';
  items: TopProduct[];
};
```

### 5.5 Top clientes

```ts
export type TopCustomer = {
  customerId: string;
  displayName: string;         // nombre completo o iniciales según visibilidad de PII
  ordersCount: number;
  totalSpent: Money;
  isAnonymized: boolean;       // true → el rol no puede ver PII; nombre reducido a iniciales
};

export type TopCustomersResponse = {
  range: '7d' | '30d' | '12m';
  items: TopCustomer[];
};
```

### 5.6 Actividad reciente

```ts
export type RecentOrder = {
  orderId: string; orderNumber: string; status: OrderStatus;
  total: Money; customerLabel: string; createdAt: string;
};
export type RecentCustomer = {
  customerId: string; displayName: string; createdAt: string; isAnonymized: boolean;
};
export type RecentAiGeneration = {
  id: string; kind: string; status: string; targetLabel?: string; createdAt: string;
};

export type RecentActivityResponse = {
  orders: RecentOrder[];
  customers: RecentCustomer[];
  aiGenerations: RecentAiGeneration[];   // vacío si el rol no tiene ai.view
};
```

### 5.7 Alertas de stock bajo

```ts
export type LowStockAlert = {
  variantId: string;
  productId: string;
  productTitle: string;
  sku: string;
  available: number;           // on_hand - reserved
  reorderPoint: number | null;
  severity: 'out_of_stock' | 'low';   // available=0 → out_of_stock; <=reorder → low
};

export type LowStockAlertsResponse = {
  items: LowStockAlert[];
  totalCount: number;          // total de alertas (para el badge del KPI)
};
```

---

## 6. Permisos (qué ve cada rol)

Extensión de la matriz de [07](../07-auth-identidad.md#matriz-de-permisos-extracto--versionada-en-permission_grant).
Fila base: *"Ver dashboard"* → OWNER ✔, ADMIN ✔, CATALOG_MANAGER parcial, FINANCE ✔, SUPPORT parcial.
Se descompone por widget:

| Widget / dato | OWNER | ADMIN | CATALOG_MANAGER | FINANCE | SUPPORT |
|---|:--:|:--:|:--:|:--:|:--:|
| Ventas, ingresos, nº pedidos, AOV | ✔ | ✔ | ✖ | ✔ | ✖ |
| **Margen / margen %** (sensible) | ✔ | ✔ | ✖ | ✔ | ✖ |
| Serie temporal ventas/ingresos | ✔ | ✔ | ✖ | ✔ | ✖ |
| Ventas por categoría | ✔ | ✔ | ✔ (unidades, sin $) | ✔ | ✖ |
| Top productos (unidades) | ✔ | ✔ | ✔ | ✔ | ✖ |
| Top productos (revenue/margen) | ✔ | ✔ | ✖ | ✔ | ✖ |
| Top clientes (con PII) | ✔ | ✔ | ✖ | ✖ (anonimizado) | con motivo |
| Productos publicados (KPI) | ✔ | ✔ | ✔ | ✔ | ✔ |
| **Stock bajo (alertas)** | ✔ | ✔ | ✔ | ✖ | ✖ |
| Pedidos por estado | ✔ | ✔ | ✖ | ✔ | ✔ |
| Actividad: últimos pedidos | ✔ | ✔ | ✖ | ✔ | ✔ |
| Actividad: últimos clientes | ✔ | ✔ | ✖ | ✖ | ✔ (motivo p/ PII) |
| Actividad: generaciones IA | ✔ | ✔ | ✔ | ✖ | ✖ |

Reglas de implementación:

- **CATALOG_MANAGER**: dashboard operativo de catálogo → ve productos publicados, stock bajo, top productos
  por **unidades** y ventas por categoría en **unidades**; **no** ve dinero, margen ni datos de clientes.
- **FINANCE**: ve todo lo financiero, incluido **margen**; **no** ve PII de clientes (top clientes anonimizado).
- **SUPPORT**: ve actividad de pedidos/clientes para dar soporte; acceso a PII **con motivo**
  (se registra en `access_log`, [07](../07-auth-identidad.md#motivos-de-acceso-administrativo)); no ve finanzas.
- La policy vive en `dashboard/domain/policies/DashboardVisibilityPolicy.ts`. Los presenters reciben las
  **capacidades efectivas** del actor y **omiten** (no envían con `null`) los campos no autorizados
  (evita fuga de propiedad de objeto — BOPLA, [08](../08-seguridad.md)).

---

## 7. Read models, cache e invalidación por eventos

### 7.1 Estrategia en tres niveles

```txt
Nivel 1 — Proyección materializada (Postgres):  dashboard_daily_metric, dashboard_category_daily
          Precomputada por eventos de dominio. Fuente para overview y series.
Nivel 2 — Cache Redis (cache-aside):            respuestas de query ya presentadas (por rol + range).
Nivel 3 — Ports on-demand:                      fallback si falta proyección/cache (más lento, siempre correcto).
```

Regla de [17.5 de la skill](../../../.claude/Skills/backend/backend.md): **cachear solo cuando la invalidación
está diseñada**. Todo lo cacheado abajo tiene un disparador de invalidación explícito.

### 7.2 Qué se precomputa vs. qué no

| Dato | Estrategia | Justificación |
|---|---|---|
| `dashboard_daily_metric` (KPIs por día) | **Materializado** + refresco por evento | Barato de mantener incremental; caro de recomputar en request |
| `dashboard_category_daily` | **Materializado** por evento | Ídem; alimenta pie/bar |
| Serie temporal (respuesta armada) | Cache Redis por `range+metric+role` | Se deriva de la proyección; TTL corto |
| Overview (respuesta armada) | Cache Redis por `range+role` | Fan-out de varios ports; vale cachear el ensamblado |
| Ventas por categoría (respuesta) | Cache Redis por `range+metric+role` | Deriva de proyección |
| Top productos / top clientes | Cache Redis por `range+limit+role` | Consulta agregada relativamente cara |
| **Low stock alerts** | **NO cachear** (o TTL 15–30s) | Operativo, debe reflejar reservas casi en vivo |
| **Actividad reciente** | **NO cachear** (o TTL 15–30s) | El dueño espera ver el último pedido/cliente al instante |
| Productos publicados (conteo) | Cache Redis, TTL medio + invalidación por evento | Cambia poco |

> Candidatas claras a cache: overview, series, categoría, top. **No cachear**: low stock, actividad reciente,
> nada con PII sin diseño de invalidación (alineado con [17.5 skill](../../../.claude/Skills/backend/backend.md)).

### 7.3 Claves y TTLs de Redis

```txt
dash:overview:{role}:{range}                     TTL 120s
dash:series:{role}:{range}:{metric}              TTL 120s
dash:category:{role}:{range}:{metric}            TTL 300s
dash:top-products:{role}:{range}:{limit}:{metric} TTL 300s
dash:top-customers:{role}:{range}:{limit}        TTL 300s
dash:published-count                             TTL 600s
# low stock y actividad: sin cache o TTL 15-30s
```

- La clave **incluye el rol** (capacidades) para que un `CATALOG_MANAGER` nunca reciba una respuesta cacheada
  que contenía márgenes de un `FINANCE`. (Evita fuga por cache compartida.)
- TTL corto (120s) como **red de seguridad**; la invalidación por evento es el mecanismo primario.

### 7.4 Invalidación por eventos de dominio

El dashboard se suscribe al **event bus** ([02](../02-arquitectura.md#event-bus-y-outbox)). Dos consumidores:

1. **Proyector** (`dashboard/application/projections/DashboardProjector`): actualiza las tablas del Nivel 1.
2. **Invalidador de cache**: borra/expira las claves Redis afectadas.

| Evento (dominio origen) | Efecto en proyección | Claves de cache invalidadas |
|---|---|---|
| `OrderConfirmed` / `OrderCreated` (orders) | +1 pedido, +total, +unidades en `dashboard_daily_metric` y `_category_daily` del día | `dash:overview:*`, `dash:series:*:revenue`, `dash:series:*:orders`, `dash:category:*`, `dash:top-*` |
| `OrderCancelled` (orders) | revierte los agregados del día del pedido | mismas que arriba |
| `ShipmentStatusChanged` (orders/shipments) | recuenta `ordersByStatus` | `dash:overview:*` |
| `DocumentGenerated` / nota de crédito (finance) | ajusta ingresos/margen del día | `dash:overview:*`, `dash:series:*` |
| `StockReserved` / `StockReleased` / `StockReservationExpired` (inventory) | — (no materializado) | invalida low-stock si estuviera cacheado |
| `ProductPublished` / `ProductArchived` (catalog) | ajusta `publishedProducts` | `dash:overview:*`, `dash:published-count` |
| `CustomerCreated` (customers) | +1 clientes nuevos del día | `dash:overview:*` |
| `AiGenerationCompleted` (ai-gateway) | — | invalida actividad reciente si cacheada |

- La invalidación es **por prefijo** (borra todas las variantes de rol/range afectadas) para no razonar bucket
  por bucket; es barata y segura.
- **Consistencia**: eventual y acotada. Entre el evento y el refresco puede haber < 1s (event bus in-process).
  El campo `computedAt`/`stale` del overview comunica la frescura al front.
- **Reconstrucción**: un job de backfill idempotente ([32](../32-jobs-y-async.md)) puede recomputar las
  proyecciones desde `orders`/`finance` (p. ej. tras una corrección administrativa o migración).

---

## 8. Performance budgets

Basado en [16 de la skill / 17.1](../../../.claude/Skills/backend/backend.md) y [30-observabilidad](../30-observabilidad.md).

| Query | Budget p95 (backend, sin red del front) |
|---|---|
| `getOverview` (cache hit) | < 60 ms |
| `getOverview` (cache miss, desde proyección) | < 250 ms |
| `getSalesTimeSeries` | < 200 ms |
| `getSalesByCategory` | < 200 ms |
| `getTopProducts` / `getTopCustomers` | < 250 ms |
| `getRecentActivity` | < 150 ms |
| `getLowStockAlerts` | < 200 ms |
| **Carga completa del dashboard** (fan-out en paralelo) | < 400 ms p95 con cache templada |

Tácticas:

- **Evitar N+1**: los ports devuelven agregados ya listos (GROUP BY en el dominio dueño), nunca "traer N
  pedidos y sumar en Node". El dashboard **no** itera entidades para calcular.
- **Fan-out en paralelo**: el panel dispara las 7 queries concurrentemente; cada una es independiente y
  cacheable por separado (un widget lento no bloquea al resto).
- **Proyecciones actualizadas por eventos** (`OrderConfirmed`, etc.): el camino caliente lee filas
  pre-agregadas por día, no escanea `order`/`order_line` completos.
- **Índices** sobre las proyecciones: `dashboard_daily_metric(date)` PK; `dashboard_category_daily(date,
  category_id)` PK. Los agregados de fallback usan los índices ya definidos en
  [04](../04-modelo-de-datos.md#índices-mínimos-medir-y-ajustar) (`idx_orders_customer_created`,
  `idx_orders_status`, `idx_order_lines_order`).
- **Statement timeout** y **límites de LIMIT** (top N ≤ 20) para evitar consumo no acotado.
- **Métricas** ([30](../30-observabilidad.md)): `dashboard_query_duration_seconds{query}`,
  `dashboard_cache_hit_total{query}`, `dashboard_projection_lag_seconds`. Alerta si p95 supera budget o si el
  lag de proyección crece (evento no procesado).

---

## 9. Casos borde

- **Sin datos / negocio nuevo**: toda respuesta devuelve estructura válida con ceros y arrays vacíos, nunca
  `null` ni error. `kpis.sales.value = { amountMinor: 0, currency: 'ARS' }`, `points: []` con `total: 0`,
  `slices: []`. El front pinta estados "sin datos aún".
- **Período sin ventas** (p. ej. mes muerto del `mockSpending "6M"` con meses en `0`): la serie **incluye los
  buckets vacíos** con `value: 0` para que la línea no se deforme (mismo criterio que el front del cliente).
- **`compareToPrevious` sin período base** (primer período del negocio): `delta` se **omite** (no `+∞%`,
  no división por cero). El front no muestra flecha de variación.
- **Margen no disponible por rol**: el campo `margin`/`marginPct` **se omite** del shape (no viaja con `null`),
  y ningún KPI derivado lo filtra indirectamente.
- **PII no visible**: `TopCustomer.displayName` = iniciales, `isAnonymized: true`. Nunca WSP/email en el
  dashboard.
- **Proyección desactualizada** (evento aún no procesado): se sirve el valor disponible con `stale: true` y
  `computedAt` viejo; en paralelo se dispara el refresco. Nunca se bloquea la carga esperando el recómputo.
- **Redis caído**: degradación elegante → se saltea el cache y se lee de la proyección/ports (más lento pero
  correcto), se emite métrica/alerta; el dashboard **no** cae.
- **Categoría/cliente borrado** (`deleted_at`) que aparece en un agregado histórico: se muestra con el nombre
  **denormalizado/snapshot** (o `"Categoría eliminada"`), nunca se rompe el join lógico.
- **Rango inválido** o `limit` fuera de whitelist: `VALIDATION_FAILED` (400) por schema Zod, antes del dominio.

---

## 10. Definition of Done

```txt
[ ] El dominio dashboard NO tiene comandos ni escribe en tablas ajenas; solo queries + sus proyecciones.
[ ] Cada KPI/gráfico se obtiene por un port de lectura del dominio dueño (finance/orders/inventory/
    catalog/customers/ai), sin un solo JOIN crudo cross-dominio.
[ ] Los 7 casos de uso (§3) implementados, cada uno con permiso validado en application (no solo middleware).
[ ] Shapes de respuesta (§5) publicados en packages/types y consumidos por el panel admin.
[ ] Matriz de permisos (§6) aplicada por DashboardVisibilityPolicy; campos sensibles OMITIDOS por rol,
    no enviados con null. Test de autorización negativa por rol (CATALOG_MANAGER sin margen, FINANCE sin PII).
[ ] Proyecciones dashboard_daily_metric / dashboard_category_daily con proyector por eventos e invalidación
    de cache por evento (§7). Job de backfill idempotente que recomputa desde cero.
[ ] Claves de cache incluyen el rol; TTLs definidos; low-stock y actividad reciente NO cacheados (o TTL ≤30s).
[ ] Casos borde (§9): sin datos, período vacío, sin base de comparación, PII/margen no visibles, stale, Redis
    caído — todos devuelven estructura válida, nunca error ni null crudo.
[ ] Performance budgets (§8) medidos; sin N+1 (agregados en el dominio dueño); métricas y alertas de lag.
[ ] Schemas Zod de entrada en packages/validators; requestId propagado; logs sin PII.
[ ] Tests unit (policy de visibilidad), integration (proyector + invalidación), contract (shapes estables).
```
