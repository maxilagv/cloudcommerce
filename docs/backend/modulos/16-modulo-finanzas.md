# 16 · Módulo Finanzas (dominio `finance`)

> Cubre el pedido explícito del dueño **ABM Finanzas**: documentos comerciales (remito, factura,
> nota de crédito) e informes financieros del panel (ingresos, costos, margen, órdenes, ticket
> promedio). Es un dominio de **diseño**; los tipos y DDL de este documento son ilustrativos y se
> subordinan al canon de [04-modelo-de-datos](../04-modelo-de-datos.md).

Fundacionales que este documento da por sentados: [02-arquitectura](../02-arquitectura.md) (regla de
dependencia entre módulos), [04-modelo-de-datos](../04-modelo-de-datos.md) (tablas y enums),
[05-convenciones-api](../05-convenciones-api.md) (envelope, errores, idempotencia),
[06-validaciones](../06-validaciones.md) (dinero, ownership, salida), [07-auth-identidad](../07-auth-identidad.md)
(matriz de permisos, `Actor`). El dashboard que **consume** estos cálculos vive en
[18-modulo-dashboard-analytics](./18-modulo-dashboard-analytics.md).

---

## 1. Propósito y alcance

### 1.1 Qué resuelve

Finanzas es la **autoridad de la verdad monetaria del negocio hacia adentro** (lo que el store no
muestra): cuánto ingresa, cuánto cuesta el producto al proveedor, cuánto queda de margen, y qué
documentos comerciales respaldan cada operación.

Dos responsabilidades separadas pero relacionadas:

1. **Documentos comerciales** — emisión, numeración correlativa, generación de PDF determinístico,
   estados `PROCESSING → AVAILABLE`, y descarga autorizada con auditoría. Cubre remito, factura y
   nota de crédito. Alimenta la sección "Documentos" del portal de cliente
   (`apps/store/src/lib/mock-account.ts::AccountDocument`) y del panel admin.
2. **Reportes financieros** — read models derivados de `order`/`order_line` que producen revenue,
   costo, margen, cantidad de órdenes y ticket promedio por período (mes), con comparativa, y
   `finance_period_snapshot` como cache invalidable/recomputable. Alimenta los KPIs del dashboard y
   el bloque sensible del detalle de cliente ("cuánto gastó" / "cuánto se invirtió").

### 1.2 Qué NO hace (no-objetivos)

- **No procesa pagos.** Cobros, intents y reembolsos viven en `payments` (Stripe). Finanzas *lee*
  el resultado (orden válida/pagada) para computar revenue; no mueve dinero real.
- **No calcula el precio de venta.** Eso es `pricing` ([14](./14-modulo-pricing.md)). Finanzas usa
  los **snapshots** ya congelados en `order_line` (`unit_price_minor`, `supplier_cost_snapshot_minor`).
- **No hace fiscalidad/AFIP real.** La "factura" de esta fase es un comprobante interno con PDF
  determinístico y numeración correlativa; la integración fiscal (CAE, tipos A/B/C) es fase futura,
  se deja el gancho en `commercial_document` (ver §11.6).
- **No duplica el dashboard.** Define los cálculos; el dashboard los **consume** y arma gráficos.
- **No hace JOIN crudo a tablas de `orders`.** Consume un read model / servicio de lectura
  autorizado (regla de dependencia de [02](../02-arquitectura.md)).

### 1.3 Ubicación en el monolito

```txt
modules/finance/
├─ domain/
│  ├─ entities/           CommercialDocument, FinancePeriodReport (VO)
│  ├─ value-objects/      DocumentNumber, Money, Period(YYYY-MM)
│  ├─ policies/           CanIssueDocumentPolicy, CanViewMarginPolicy
│  ├─ events/             DocumentGenerated, PeriodSnapshotRecomputed
│  └─ errors.ts           DocumentNotReady, DocumentAlreadyIssued, ...
├─ application/
│  ├─ commands/           GenerateDocument, RegenerateDocument, RecomputePeriodSnapshot
│  ├─ queries/            GetDocument, GetFinancePeriodReport, GetFinanceKpis
│  ├─ ports/              OrdersReadModelPort, PdfRendererPort, DocumentStoragePort, NumberSequencePort
│  └─ dto/
├─ infra/
│  ├─ repositories/       DrizzleCommercialDocumentRepository, DrizzleFinanceSnapshotRepository
│  ├─ read-models/        OrdersFinanceReadModel (proyección autorizada de orders)
│  ├─ pdf/                DeterministicPdfRenderer
│  └─ storage/            SignedUrlDocumentStorage (S3/compatible)
└─ http/                  trpc router finance.* + REST descarga
```

> **Regla de dependencia crítica.** `finance` **no importa** repositorios ni tablas de `orders`.
> Consume `OrdersReadModelPort` (implementado por `orders` o por una vista/read model publicada por
> `orders`) que expone solo lo necesario y ya autorizado. Esto evita acoplar finanzas al esquema
> interno de pedidos y respeta "modules no deben acceder directo a tablas de otros módulos salvo read
> models autorizados" (backend.md §3.2).

---

## 2. Entidades y tablas (canon [04](../04-modelo-de-datos.md))

Esquema en `packages/database/src/schema/finance.ts`. Se reproduce el canon de [04](../04-modelo-de-datos.md)
y se detalla con constraints. **DDL ilustrativo**, no implementación.

### 2.1 `commercial_document`

```sql
CREATE TABLE commercial_document (
  id             uuid PRIMARY KEY,                    -- UUIDv7 generado en app
  type           document_type NOT NULL,              -- REMITO | FACTURA | NOTA_CREDITO
  series         text NOT NULL DEFAULT 'A',           -- serie de numeración (R, FA, NC → ver §5)
  number         bigint NOT NULL,                     -- correlativo por (type, series)
  display_number text NOT NULL,                       -- "R-0001", "FA-0002", "NC-0001" (formateado)
  order_id       uuid REFERENCES "order"(id) ON DELETE RESTRICT,
  customer_id    uuid REFERENCES customer(id) ON DELETE RESTRICT,
  status         document_status NOT NULL DEFAULT 'PROCESSING', -- PROCESSING | AVAILABLE
  issued_at      timestamptz,                         -- se setea al pasar a AVAILABLE
  total_minor    integer NOT NULL,                    -- snapshot del total del documento
  currency       text NOT NULL DEFAULT 'ARS',
  pdf_storage_key text,                               -- key en storage; null mientras PROCESSING
  pdf_checksum   text,                                -- sha256 del PDF determinístico (§5.4)
  content_hash   text NOT NULL,                       -- hash del input canónico (idempotencia §3.2)
  related_document_id uuid REFERENCES commercial_document(id), -- NC → factura que anula/ajusta
  created_by     uuid NOT NULL,                       -- admin_user_id o 'system'
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  -- Invariantes en DB (no solo en app):
  CONSTRAINT uq_document_number       UNIQUE (type, series, number),
  CONSTRAINT uq_document_display      UNIQUE (type, series, display_number),
  CONSTRAINT ck_document_total_nonneg CHECK (total_minor >= 0),
  CONSTRAINT ck_document_available_pdf
    CHECK (status <> 'AVAILABLE' OR (pdf_storage_key IS NOT NULL AND issued_at IS NOT NULL))
);

-- Un documento AVAILABLE por (type, order) — evita duplicar la factura de una misma orden.
-- Se permite regenerar (mismo registro) pero no emitir dos facturas distintas para la misma orden.
CREATE UNIQUE INDEX uq_document_type_order_available
  ON commercial_document(type, order_id)
  WHERE order_id IS NOT NULL AND status = 'AVAILABLE';

CREATE INDEX idx_document_order        ON commercial_document(order_id);
CREATE INDEX idx_document_customer     ON commercial_document(customer_id, created_at DESC);
CREATE INDEX idx_document_type_status  ON commercial_document(type, status);
```

Notas de reconciliación con el front (`AccountDocument`):

| Front (`mock-account.ts`) | Canon backend | Nota |
|---|---|---|
| `type: "remito"\|"factura"\|"nota-credito"` | `type: DocumentType` (REMITO/FACTURA/NOTA_CREDITO) | mapeo directo kebab↔enum en presenter |
| `number: "R-0001"` | `display_number` (derivado de `series`+`number`) | `number` real es `bigint` correlativo |
| `orderId` | `order_id` | FK real |
| `date` | `issued_at` | formateado en presenter |
| `status: "available"\|"processing"` | `status: DocumentStatus` | AVAILABLE/PROCESSING |
| `total` | `total_minor` + `currency` | dinero en enteros menores |

### 2.2 `document_download` (auditoría de descarga)

```sql
CREATE TABLE document_download (
  id           uuid PRIMARY KEY,
  document_id  uuid NOT NULL REFERENCES commercial_document(id) ON DELETE CASCADE,
  actor_id     uuid,                    -- admin_user_id, o null/customer si portal cliente futuro
  actor_type   text NOT NULL,           -- 'admin' | 'customer' | 'system'
  reason       text,                    -- motivo si el rol lo exige (SUPPORT) — ver [07]
  ip           inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_document_download_doc ON document_download(document_id, created_at DESC);
```

- Se inserta **una fila por emisión de URL firmada autorizada** (o por evento de descarga efectiva,
  ver §5.6). Sostiene la trazabilidad exigida por backend.md §14.3 y §25.

### 2.3 `finance_period_snapshot` (cache recomputable)

```sql
CREATE TABLE finance_period_snapshot (
  id            uuid PRIMARY KEY,
  period        text NOT NULL,           -- 'YYYY-MM' (mes calendario, zona horaria del negocio)
  currency      text NOT NULL DEFAULT 'ARS',
  revenue_minor integer NOT NULL,        -- suma de totales de órdenes válidas del período
  cost_minor    integer NOT NULL,        -- suma de supplier_cost_snapshot de order_line
  margin_minor  integer NOT NULL,        -- revenue_minor - cost_minor
  orders_count  integer NOT NULL,        -- cantidad de órdenes válidas
  computed_at   timestamptz NOT NULL DEFAULT now(),
  source_version integer NOT NULL DEFAULT 1, -- versión del algoritmo de cómputo (invalidación masiva)
  is_stale      boolean NOT NULL DEFAULT false, -- marcado para recomputar (invalidación)

  CONSTRAINT uq_snapshot_period_currency UNIQUE (period, currency),
  CONSTRAINT ck_snapshot_margin CHECK (margin_minor = revenue_minor - cost_minor)
);
CREATE INDEX idx_snapshot_period ON finance_period_snapshot(period);
CREATE INDEX idx_snapshot_stale  ON finance_period_snapshot(is_stale) WHERE is_stale = true;
```

- `ticket_promedio` **no se persiste**: es derivado (`revenue_minor / orders_count`), se calcula al
  leer para evitar divisiones almacenadas que se desincronizan (§10.4).
- Snapshot es **cache**, no verdad: la verdad son `order`/`order_line`. Ver §11 (invalidación).

---

## 3. Casos de uso

Formato por caso (backend.md §3.4): **actor · input · permiso · transacción · eventos · salida · errores**.
Todos reciben un `Actor` tipado ([07](../07-auth-identidad.md) §Contexto de auth), nunca el request crudo.

### 3.1 `GenerateDocument` (command)

Emite un documento comercial para una orden.

- **Actor:** `admin` con rol `OWNER | ADMIN | FINANCE`. También `system` (job post-orden, p. ej.
  auto-emitir remito al confirmar la orden).
- **Input:** `{ type: DocumentType, orderId: uuid, series?: string }` (`GenerateDocumentSchema`).
  `Idempotency-Key` obligatorio.
- **Permiso:** `emitir/regenerar documento` (matriz [07](../07-auth-identidad.md)). Puede exigir
  **reauth reciente** para roles sensibles (backend.md §7 / [07] MFA).
- **Transacción:** sí. Dentro de la tx:
  1. Cargar la orden vía `OrdersReadModelPort.getOrderForDocument(orderId)` (totales, líneas con
     snapshots, cliente). Validar estado (§5.2: no `CANCELLED`/`DRAFT` para remito/factura).
  2. Reservar el próximo `number` correlativo por `(type, series)` con lock (`NumberSequencePort`,
     ver §5.1) — sin huecos, sin colisión.
  3. Insertar `commercial_document` en estado `PROCESSING` con `content_hash` calculado del input
     canónico (§3.2 / §5.4).
  4. Escribir evento `DocumentGenerated` en **outbox** (mismo tx — backend.md §11.7).
- **Post-commit (async, worker):** el worker toma el outbox, renderiza el PDF determinístico
  (`PdfRendererPort`), lo sube (`DocumentStoragePort`), guarda `pdf_storage_key`+`pdf_checksum`, y
  transiciona `PROCESSING → AVAILABLE` con `issued_at = now()`. Ver [32-jobs-y-async](../32-jobs-y-async.md).
- **Eventos:** `DocumentGenerated` (al crear) y, opcionalmente, `DocumentAvailable` (al pasar a
  AVAILABLE, dispara email de comprobante).
- **Salida:** `DocumentSummary` (id, type, displayNumber, status=`PROCESSING`, total, currency).
  El PDF **aún no** está disponible; el cliente debe reconsultar/DownloadDocument (que puede dar
  `DOCUMENT_NOT_READY`).
- **Errores:** `RESOURCE_NOT_FOUND` (orden no existe / no visible), `INVALID_ORDER_STATE` (orden
  cancelada, §5.2 → 409), `DOCUMENT_ALREADY_ISSUED` (`CONFLICT` si ya hay AVAILABLE de ese type/order
  y no es regeneración), `IDEMPOTENCY_CONFLICT`, `FORBIDDEN`.

### 3.2 `RegenerateDocument` (command, idempotente)

Regenera el PDF de un documento ya emitido (p. ej. cambió el template, se corrigió un dato no
numerado). **No** cambia el `number` ni el `total_minor` congelado.

- **Actor:** `admin` con `OWNER | ADMIN | FINANCE`.
- **Input:** `{ documentId: uuid }` (`RegenerateDocumentSchema`). `Idempotency-Key` obligatorio
  (backend.md §11.6, ruta `POST /documents/:id/regenerate`).
- **Permiso:** `emitir/regenerar documento`.
- **Transacción + idempotencia de contenido:**
  - Se recalcula `content_hash` del input canónico del documento (número, líneas snapshot, totales,
    versión de template). Si el `content_hash` **no cambió** y ya existe `pdf_storage_key`, la
    operación es **no-op**: devuelve el documento actual (idempotente por naturaleza, además de por
    `Idempotency-Key`).
  - Si cambió (nuevo template), se vuelve a `PROCESSING`, se regenera el PDF, se sube con **nueva**
    key versionada, y se vuelve a `AVAILABLE`. La numeración es **inmutable**.
- **Eventos:** `DocumentRegenerated` (o reutiliza `DocumentGenerated` con `regenerated=true`).
- **Salida:** `DocumentSummary` con status resultante.
- **Errores:** `RESOURCE_NOT_FOUND`, `IDEMPOTENCY_CONFLICT`, `FORBIDDEN`. Regenerar un documento en
  `PROCESSING` → `DOCUMENT_NOT_READY` (409) o encolar detrás (política: rechazar con 409).

> **Determinismo:** regenerar con el mismo input canónico produce **byte-idéntico** PDF (§5.4). El
> `content_hash`/`pdf_checksum` lo verifica; esto hace la regeneración segura y auditable.

### 3.3 `GetDocument` (query)

Metadata del documento (no el binario).

- **Actor:** `admin` (`OWNER|ADMIN|FINANCE`; `SUPPORT` con motivo). Cliente dueño de la orden (portal
  futuro).
- **Input:** `{ documentId: uuid }`.
- **Permiso:** ver documento + **ownership** (si es cliente, la orden debe ser suya — anti-BOLA
  [06](../06-validaciones.md) §IDs y ownership).
- **Transacción:** no (lectura).
- **Salida:** `DocumentDetail` (presenter): type, displayNumber, status, issuedAt, total, currency,
  orderId, customerRef. **Nunca** expone `pdf_storage_key`, `content_hash` ni `created_by` interno.
- **Errores:** `RESOURCE_NOT_FOUND` (inexistente o ajeno → 404, anti-enumeración), `FORBIDDEN`.

### 3.4 `DownloadDocument` (command de lectura + efecto de auditoría)

Devuelve una **URL firmada de corta expiración** al PDF y registra la descarga.

- **Actor:** `admin` (`OWNER|ADMIN|FINANCE`; `SUPPORT` con `reason` obligatorio). Cliente dueño (futuro).
- **Input:** `{ documentId: uuid, reason?: string }`. `reason` requerido si el rol lo exige ([07]).
- **Permiso:** descargar documento + ownership.
- **Transacción:** sí (corta): validar `status = AVAILABLE`, generar URL firmada
  (`DocumentStoragePort.signDownload(pdf_storage_key, ttl=60s)`), insertar `document_download`
  (auditoría). Idempotencia **no** requerida (operación repetible sin efecto dañino; cada descarga
  se audita).
- **Eventos:** ninguno de dominio; sí `access_log` si el actor es de acceso restringido ([07]).
- **Salida:** `{ url: string, expiresAt: string, filename: string }`. La URL apunta a storage
  privado, **nunca** a un bucket público permanente (§5.5).
- **Errores:** `DOCUMENT_NOT_READY` (status = PROCESSING → **409**, backend.md §26.2),
  `RESOURCE_NOT_FOUND`, `FORBIDDEN`.

### 3.5 `GetFinancePeriodReport` (query)

Reporte financiero de un período con comparativa.

- **Actor:** `admin` con `OWNER | ADMIN | FINANCE`.
- **Input:** `{ period: 'YYYY-MM', compareTo?: 'previous' | 'YYYY-MM', currency?: 'ARS' }`
  (`FinancePeriodReportQuerySchema`).
- **Permiso:** `ver "cuánto invirtió" (costo/margen)` (matriz [07]). **CATALOG_MANAGER y SUPPORT no
  acceden** a costo/margen.
- **Transacción:** no. Estrategia de lectura:
  1. Buscar `finance_period_snapshot` del período. Si existe, no `is_stale`, y `source_version`
     coincide → usar cache.
  2. Si falta o está stale → computar on-demand vía `OrdersFinanceReadModel` (§10), **persistir** el
     snapshot (upsert) y devolver. (Cómputo pesado puede delegarse a `RecomputePeriodSnapshot` si el
     rango es grande; para un mes es aceptable inline con timeout.)
  3. Cargar también el período de comparación (mismo mecanismo) para deltas.
- **Salida:** `FinancePeriodReport` (presenter):

  ```ts
  type FinancePeriodReport = {
    period: string;                 // 'YYYY-MM'
    currency: Currency;
    revenue: Money;
    cost: Money;
    margin: Money;                  // revenue - cost
    marginPct: number;              // margin / revenue (0 si revenue=0)
    ordersCount: number;
    avgTicket: Money;               // revenue / ordersCount (0 si ordersCount=0)
    comparison?: {
      period: string;
      revenueDeltaPct: number | null;   // null si base=0
      marginDeltaPct: number | null;
      ordersDeltaPct: number | null;
    };
    computedAt: string;
    fromCache: boolean;
  };
  ```
- **Errores:** `VALIDATION_FAILED` (period mal formado), `FORBIDDEN`.

### 3.6 `GetFinanceKpis` (query)

KPIs financieros agregados que **consume el dashboard** ([18](./18-modulo-dashboard-analytics.md)).
No duplica el dashboard: define el contrato de datos.

- **Actor:** `admin` con `OWNER | ADMIN | FINANCE`.
- **Input:** `{ range: 'this-month' | 'last-30d' | 'ytd' | { from: 'YYYY-MM', to: 'YYYY-MM' } }`.
- **Permiso:** `ver "cuánto invirtió" (costo/margen)`. Si el actor no puede ver margen/costo
  (p. ej. una variante restringida), se devuelve un subset (solo revenue/órdenes) o `FORBIDDEN`
  según policy — ver §6.
- **Transacción:** no. Se apoya en `finance_period_snapshot` (sumando/agregando meses del rango).
- **Salida:** `FinanceKpis`:

  ```ts
  type FinanceKpis = {
    range: string;
    totalRevenue: Money;   // "total facturado"
    totalCost: Money;
    totalMargin: Money;
    marginPct: number;
    ordersCount: number;
    avgTicket: Money;
    trend: { period: string; revenue: Money; margin: Money }[]; // serie para el gráfico
  };
  ```
- **Errores:** `VALIDATION_FAILED`, `FORBIDDEN`.

> El dashboard ([18]) **no recalcula** revenue/margen: llama `finance.getKpis`. Finanzas es la única
> fuente de estos números. Así se evita la divergencia entre "total del dashboard" y "total de
> finanzas".

### 3.7 `RecomputePeriodSnapshot` (command)

Invalida y recomputa el snapshot de un período (manual o disparado por evento).

- **Actor:** `admin` (`OWNER | ADMIN | FINANCE`) o `system` (job/evento — §11).
- **Input:** `{ period: 'YYYY-MM', currency?: 'ARS' }`.
- **Permiso:** `ver costo/margen` (equivalente; solo quien ve finanzas puede forzar recomputo).
- **Transacción:** sí. Recalcula desde `OrdersFinanceReadModel`, hace **upsert** en
  `finance_period_snapshot`, setea `is_stale=false`, actualiza `computed_at` y `source_version`.
- **Eventos:** `PeriodSnapshotRecomputed`.
- **Salida:** `FinancePeriodReport` (fresco).
- **Errores:** `VALIDATION_FAILED`, `FORBIDDEN`. Idempotente por período (recomputar dos veces da el
  mismo resultado salvo que cambiaran las órdenes base).

---

## 4. Endpoints

### 4.1 tRPC `finance.*` (panel admin — [05](../05-convenciones-api.md) §Convención tRPC)

Todos `adminProcedure` + autorización de negocio en el caso de uso.

```txt
finance.generateDocument(input)        mutation  → DocumentSummary        [Idempotency-Key]
finance.regenerateDocument(input)      mutation  → DocumentSummary        [Idempotency-Key]
finance.getDocument(documentId)        query     → DocumentDetail
finance.listDocuments(filter)          query     → cursor<DocumentSummary> (por order/customer/type)
finance.getDocumentDownloadUrl(input)  mutation  → { url, expiresAt, filename }  (DownloadDocument)
finance.getPeriodReport(input)         query     → FinancePeriodReport
finance.getKpis(input)                 query     → FinanceKpis
finance.recomputePeriodSnapshot(input) mutation  → FinancePeriodReport
```

- `getDocumentDownloadUrl` es `mutation` (no `query`) porque tiene efecto: emite URL firmada e
  inserta auditoría (`document_download`). Naming: excepción justificada al `get*`=query.
- `listDocuments` con **cursor pagination** (default 20, máx 50) — [05] §Paginación.

### 4.2 REST — descarga de documento

Para servir el binario / integraciones y webhooks. Todo REST público con OpenAPI ([05]).

```txt
POST /api/v1/documents/:documentId/regenerate     → 202 (encola) | 200 (no-op)   [Idempotency-Key]
GET  /api/v1/documents/:documentId                 → 200 DocumentDetail (metadata)
POST /api/v1/documents/:documentId/download-url    → 200 { url, expiresAt }  (auth + auditoría)
GET  /api/v1/documents/:documentId/download        → 302 → URL firmada, o 409 DOCUMENT_NOT_READY
```

- El binario **no** se sirve desde un path público estable. `/download` autoriza, audita y
  **redirige** a la URL firmada temporal (o hace streaming controlado con `Content-Disposition`).
- `409 DOCUMENT_NOT_READY` si `status = PROCESSING` (backend.md §26.2, [05] catálogo de errores).
- Rate limit por actor en `download-url`/`download` (anti "generación/descarga masiva" — backend.md §9.3).

---

## 5. Reglas e invariantes

### 5.1 Numeración correlativa única

- El `number` es **correlativo por `(type, series)`**, sin huecos, asignado dentro de la tx de
  `GenerateDocument`. Implementación vía `NumberSequencePort`:
  - Opción A (recomendada): tabla `document_sequence(type, series, next_number)` con
    `SELECT ... FOR UPDATE` (lock de fila) o `UPDATE ... RETURNING next_number` atómico.
  - Opción B: `pg` sequence por `(type, series)` — más simple pero puede dejar huecos ante rollback;
    aceptable para remitos, **no** ideal para facturas fiscales (se prefiere A para no dejar huecos).
- Series por tipo (mapeo a `display_number` del front): `REMITO → 'R'`, `FACTURA → 'FA'`,
  `NOTA_CREDITO → 'NC'`. `display_number = \`${prefix}-${String(number).padStart(4,'0')}\``
  (ej. `R-0001`, `FA-0002`, `NC-0001` — idéntico al mock).
- **Unicidad garantizada en DB:** `UNIQUE(type, series, number)` y `UNIQUE(type, series, display_number)`.

### 5.2 No emitir para orden inválida

- **No** se emite remito ni factura para una orden en `CANCELLED` o `DRAFT` → `INVALID_ORDER_STATE`
  (409). (Invariante de dominio, backend.md §3.3: "Un remito no puede emitirse para un pedido
  cancelado".)
- **Nota de crédito** es la excepción: se emite **justamente** para revertir/ajustar una orden ya
  facturada (devolución, cancelación posterior). Requiere `related_document_id` apuntando a la
  factura original y una orden en estado que lo permita (`RETURNED`, `RETURN_REQUESTED`, o
  `CANCELLED` posterior a facturación). Ver §11.1.

### 5.3 Un documento vigente por tipo/orden

- No puede haber **dos** documentos `AVAILABLE` del mismo `type` para la misma `order_id` (índice
  parcial `uq_document_type_order_available`). Reemitir = `RegenerateDocument` sobre el existente.
- Una orden puede tener a la vez un REMITO, una FACTURA y (si corresponde) una NOTA_CREDITO —
  distintos `type`, todos válidos.

### 5.4 PDF determinístico

- El PDF se renderiza desde un **input canónico** (JSON serializado de forma estable: claves
  ordenadas, dinero como enteros menores, fechas ISO en zona fija, sin timestamps de generación
  embebidos, sin metadata no determinística del renderer). Fuentes embebidas fijas.
- Mismo input canónico → **mismos bytes** → mismo `pdf_checksum` (sha256). Esto habilita
  regeneración idempotente (§3.2) y verificación de integridad.
- Números "volátiles" (fecha de descarga, marca de agua por usuario) **no** van embebidos en el PDF
  base; si se necesitan, se aplican en una capa aparte fuera del artefacto determinístico.

### 5.5 Sin URLs públicas permanentes

- Los PDF viven en storage **privado**. El acceso es siempre por **URL firmada de expiración corta**
  (ej. 60 s) emitida tras autorización + auditoría (backend.md §14.3: "No exponer documentos por
  URLs públicas permanentes"). Nada de `pdf_storage_key` filtrado al cliente.

### 5.6 Auditoría de descarga

- Cada emisión autorizada de URL firmada inserta `document_download` (actor, ip, ua, reason si
  aplica). Retención según [08](../08-seguridad.md)/backend.md §25.2.

### 5.7 Inmutabilidad monetaria

- `total_minor` y las líneas del documento son **snapshots** al momento de emisión (derivados de
  `order_line`). Cambios posteriores en catálogo/pricing **no** alteran documentos ya emitidos
  (backend.md §11.x, [04] "la orden es un documento histórico inmutable").

---

## 6. Permisos (matriz [07](../07-auth-identidad.md))

Costo y margen son **datos sensibles** (revelan el negocio de dropshipping). Matriz aplicable:

| Acción | OWNER | ADMIN | CATALOG_MANAGER | FINANCE | SUPPORT |
|---|:--:|:--:|:--:|:--:|:--:|
| Emitir documento (`generateDocument`) | ✔ | ✔ | ✖ | ✔ | ✖ |
| Regenerar documento (`regenerateDocument`) | ✔ | ✔ | ✖ | ✔ | ✖ |
| Ver metadata de documento (`getDocument`/`listDocuments`) | ✔ | ✔ | ✖ | ✔ | con motivo |
| Descargar documento (`getDocumentDownloadUrl`) | ✔ | ✔ | ✖ | ✔ | con motivo |
| Ver reporte financiero (revenue/costo/margen) | ✔ | ✔ | ✖ | ✔ | ✖ |
| Ver KPIs financieros (margen/costo) | ✔ | ✔ | ✖ | ✔ | ✖ |
| Ver detalle de cliente "cuánto invirtió" (costo/margen) | ✔ | ✔ | ✖ | ✔ | ✖ |
| Ver detalle de cliente "cuánto gastó" (solo revenue del cliente) | ✔ | ✔ | ✖ | ✔ | con motivo |
| Recompute snapshot | ✔ | ✔ | ✖ | ✔ | ✖ |

- **Regla de oro de salida** ([06] §Validación de salida): los presenters de finanzas **nunca**
  filtran `cost_minor`/`margin_minor`/`supplier_cost_snapshot_minor` a roles sin permiso. `SUPPORT`
  al ver un pedido puede ver el total (lo que pagó el cliente) pero **no** costo/margen.
- `CanViewMarginPolicy(actor)` centraliza la decisión; se evalúa en el caso de uso, no solo en
  middleware ([07] §Autorización en use cases).
- Acciones críticas (emitir/regenerar) pueden requerir **reauth reciente** ([07] MFA).

---

## 7. Validaciones ([06](../06-validaciones.md))

Schemas Zod en `packages/validators/src/finance.ts` (compartidos front/back).

```ts
export const PeriodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/); // 'YYYY-MM'

export const GenerateDocumentSchema = z.object({
  type:    z.nativeEnum(DocumentType),
  orderId: z.string().uuid(),
  series:  z.string().trim().min(1).max(8).optional(),
});

export const RegenerateDocumentSchema = z.object({
  documentId: z.string().uuid(),
});

export const DownloadDocumentSchema = z.object({
  documentId: z.string().uuid(),
  reason:     z.string().trim().min(3).max(300).optional(), // requerido para SUPPORT (refine por rol en app)
});

export const FinancePeriodReportQuerySchema = z.object({
  period:    PeriodSchema,
  compareTo: z.union([z.literal('previous'), PeriodSchema]).optional(),
  currency:  z.enum(['ARS', 'USD']).default('ARS'),
});

export const FinanceKpisQuerySchema = z.object({
  range: z.union([
    z.enum(['this-month', 'last-30d', 'ytd']),
    z.object({ from: PeriodSchema, to: PeriodSchema }),
  ]),
});
```

- **Cuatro capas** ([06] §capas): transporte (schemas de arriba), aplicación (permiso + estado de
  orden), dominio (invariantes de numeración / no-emisión), persistencia (UNIQUE/CHECK del §2).
- **Dinero** siempre en enteros menores; el frontend **no** envía totales — el backend los toma del
  snapshot de la orden ([06] §Dinero).
- **Ownership** en `getDocument`/`download` cuando el actor sea cliente (futuro): la orden del
  documento debe ser suya, sino 404 ([06] §IDs y ownership).
- **Salida** por presenter tipado; test de output verifica que no se filtren campos internos.
- **`reason`** validado y **obligatorio por rol** (SUPPORT) mediante `refine`/policy en aplicación.

---

## 8. Eventos ([04] outbox / backend.md §11.7)

Emitidos vía **outbox transaccional** (`outbox` en [04] `schema/shared.ts`):

| Evento | Cuándo | Payload (mínimo, sin PII innecesaria) | Consumidores |
|---|---|---|---|
| `DocumentGenerated` | al crear el `commercial_document` (PROCESSING) | `{ documentId, type, orderId, customerId, series, number }` | worker de render PDF; auditoría |
| `DocumentAvailable` | al pasar a AVAILABLE | `{ documentId, type, orderId, customerId }` | email de comprobante ([email package]); dashboard invalidación |
| `DocumentRegenerated` | tras regenerar PDF | `{ documentId, contentHashChanged }` | auditoría |
| `PeriodSnapshotRecomputed` | tras recompute | `{ period, revenueMinor, marginMinor }` | dashboard cache warm |

- Los eventos llevan **`documentId`, no el PDF completo** (backend.md §25.1: no incluir documentos
  completos en eventos si basta un id).
- Finanzas **escucha** eventos de otros dominios para invalidar snapshots (§11): `OrderConfirmed`,
  `OrderCancelled`, `OrderReturned`, `PriceChanged` (histórico → no afecta; ver §11.2).

---

## 9. Errores ([05](../05-convenciones-api.md) §Catálogo de códigos)

| `code` | HTTP | Cuándo |
|---|---|---|
| `DOCUMENT_NOT_READY` | **409** | Descargar/servir un documento en `PROCESSING` (PDF aún no generado) |
| `INVALID_ORDER_STATE` | 409 | Emitir remito/factura para orden `CANCELLED`/`DRAFT` |
| `DOCUMENT_ALREADY_ISSUED` | 409 (`CONFLICT`) | Ya existe un AVAILABLE de ese `type`/orden y no es regeneración |
| `IDEMPOTENCY_CONFLICT` | 409 | Misma `Idempotency-Key`, payload distinto |
| `RESOURCE_NOT_FOUND` | 404 | Documento/orden inexistente o ajeno (anti-enumeración) |
| `FORBIDDEN` | 403 | Autenticado sin permiso (p. ej. CATALOG_MANAGER pidiendo margen) |
| `VALIDATION_FAILED` | 400 | Period mal formado, uuid inválido, etc. |
| `UPSTREAM_UNAVAILABLE` | 502/503 | Storage de documentos / render caído (degradación: doc queda PROCESSING) |

- Mensajes públicos claros, no técnicos ([05]/backend.md §26.3). Nunca exponer `pdf_storage_key`,
  SQL ni nombres de tabla.
- Degradación elegante (backend.md §17.6): si el render falla, el documento **permanece en
  `PROCESSING`** y el worker reintenta; `DownloadDocument` responde `DOCUMENT_NOT_READY`, no 500.

---

## 10. Definición de cálculos financieros

Todo el dinero en **enteros de unidad menor** (centavos ARS), moneda explícita ([04] ADR-007). Los
cálculos se derivan de un **read model autorizado** de orders (`OrdersFinanceReadModel`), no de JOIN
crudo a tablas de `orders` (regla de dependencia [02]).

### 10.1 Universo: "órdenes válidas"

Una orden entra en revenue/costo/órdenes del período si:

```txt
- order.status ∈ {CONFIRMED, PREPARING, READY_TO_SHIP, SHIPPED, DELIVERED}
  (o RETURNED/RETURN_REQUESTED según política de reconocimiento — ver §11.1)
- NO cuenta: DRAFT, PENDING_CONFIRMATION, CANCELLED
- El período se asigna por una fecha de reconocimiento estable (recomendado: order.confirmed_at;
  fallback order.created_at), truncada a mes en la zona horaria del negocio (America/Argentina).
```

> La elección de la fecha de reconocimiento (confirmación vs. entrega vs. pago) es una **decisión de
> negocio**; se fija una y se documenta como constante del módulo para que revenue sea reproducible.
> Recomendado: **confirmación** (`OrderConfirmed`).

### 10.2 Revenue (ingresos)

```txt
revenue_minor(period) = Σ order.total_minor
                        para toda orden válida cuya fecha de reconocimiento ∈ period
```

- `order.total_minor` ya incluye subtotal − descuento + envío + impuestos (calculado por orders al
  crear la orden; finanzas **no** recalcula, usa el snapshot).
- Nota: revenue usa `total_minor` de la orden (definición del dueño: "suma de totales de órdenes
  válidas"). Si se quisiera revenue neto de envío/impuestos, se define aparte; por ahora = total.

### 10.3 Costo

```txt
cost_minor(period) = Σ ( order_line.supplier_cost_snapshot_minor × order_line.quantity )
                     para toda línea de toda orden válida del period
```

- Usa **exclusivamente** el snapshot `supplier_cost_snapshot_minor` congelado en la línea al crear
  la orden ([04] `order_line`). **Nunca** el costo actual de `supplier_cost` (que pudo cambiar). Esto
  hace el margen histórico correcto (§11.2).
- Si `supplier_cost_snapshot_minor` es `NULL` en alguna línea (dato faltante al importar), esa línea
  aporta costo 0 y se marca en un contador `linesMissingCost` para alertar (el margen quedaría
  sobreestimado; se expone la advertencia en el reporte).

### 10.4 Margen, órdenes, ticket promedio

```txt
margin_minor(period)  = revenue_minor(period) − cost_minor(period)
margin_pct(period)    = revenue_minor > 0 ? margin_minor / revenue_minor : 0
orders_count(period)  = COUNT(DISTINCT order.id) de órdenes válidas del period
avg_ticket_minor(p)   = orders_count > 0 ? round(revenue_minor / orders_count) : 0
```

- Divisiones (`margin_pct`, `avg_ticket`) se calculan **al leer**, con guardas de división por cero;
  no se persisten en el snapshot para no desincronizar (§2.3).
- Redondeo **determinístico** (half-up sobre enteros menores) para `avg_ticket` ([06] §Dinero).

### 10.5 Comparativa (deltas)

```txt
revenue_delta_pct = base.revenue > 0 ? (curr.revenue − base.revenue) / base.revenue : null
```

- `base` = período de comparación (`previous` = mes anterior, o `YYYY-MM` explícito).
- Delta `null` (no `0` ni `∞`) cuando la base es 0 — el presenter lo muestra como "—" o "nuevo".

### 10.6 Contrato con orders (`OrdersFinanceReadModel`)

```ts
interface OrdersReadModelPort {
  // devuelve agregados ya calculados por el read model de orders, autorizados
  getPeriodAggregates(input: { period: string; currency: Currency }): Promise<{
    revenueMinor: number;
    costMinor: number;
    ordersCount: number;
    linesMissingCost: number;
  }>;
  // datos de una orden para emitir documento (líneas snapshot + totales + cliente)
  getOrderForDocument(orderId: string): Promise<OrderDocumentSource | null>;
}
```

- La proyección puede materializarse como **vista SQL** publicada por `orders`
  (`order_finance_read_model`) que finanzas consulta como puerto — sin importar el esquema interno de
  `orders`. Índices de apoyo: `idx_orders_customer_created`, `idx_orders_status`, `idx_order_lines_order`
  ([04] §Índices).

---

## 11. Casos borde

### 11.1 Devoluciones y notas de crédito

- Una **devolución** (`RETURN_REQUESTED → RETURNED`) genera una **Nota de Crédito** que revierte
  (total o parcial) la factura original (`related_document_id`). La NC **no** borra la factura; la
  compensa.
- Efecto en reportes: la política recomendada es **reconocer la reversión en el período de la NC**
  (no reabrir el período de la factura original), y descontar del revenue neto ese monto. Alternativa
  contable (ajustar el período original) queda documentada como decisión; se elige una y se aplica
  consistentemente. En cualquier caso, emitir/registrar la NC marca `is_stale=true` en los snapshots
  de los períodos afectados → recompute.
- El "cuánto gastó" del cliente ([11](./11-modulo-clientes.md)) debe descontar devoluciones (revenue
  neto del cliente), usando el mismo criterio.

### 11.2 Cambios de precio y de costo históricos → snapshots

- Si `pricing` cambia el precio de venta o `supplier_cost` cambia el costo **después** de creada la
  orden, los reportes **no** cambian: usan los snapshots congelados en `order_line`
  (`unit_price_minor`, `supplier_cost_snapshot_minor`). Un `PriceChanged` **no** invalida snapshots
  de períodos pasados.
- Esto es lo que hace el margen histórico **estable y auditable** (backend.md §3.3, [04] snapshots).

### 11.3 Líneas sin costo snapshot

- `supplier_cost_snapshot_minor = NULL` (import incompleto) → costo 0 para esa línea + `linesMissingCost++`.
  El reporte expone `warnings: ['N líneas sin costo — margen sobreestimado']`. No se inventa un costo.

### 11.4 Órdenes multi-moneda

- El snapshot y los reportes son **por `currency`**. `finance_period_snapshot` tiene `currency` en su
  unicidad. No se suman ARS + USD; si hay ventas en ambas, hay dos snapshots por mes. La base es ARS
  ([04]). Conversión FX (si se quiere un total unificado) es fase futura con tasa fechada.

### 11.5 Cancelación de una orden ya facturada

- Cancelar una orden que ya tiene FACTURA `AVAILABLE`: no se borra la factura (numeración inmutable);
  se emite **Nota de Crédito** que la anula (§11.1) y se marca el período stale para recompute. La
  orden sale del universo "válida" para revenue solo vía la NC compensatoria, no borrando el dato.

### 11.6 Gancho fiscal (futuro)

- `commercial_document` reserva espacio para integración fiscal futura (tipo A/B/C, CAE/CAI,
  `tax_id` del cliente, alícuotas). En esta fase el documento es interno + PDF determinístico; el
  gancho evita migración disruptiva (patrón expand/contract, [04] §Migraciones).

### 11.7 Zona horaria de corte de período

- El corte de mes usa **una zona horaria fija del negocio** (America/Argentina). Una orden confirmada
  el 30/06 23:30 ART cuenta en junio aunque en UTC sea julio. Definido como constante para que el
  reporte sea reproducible y coincida con la percepción del dueño.

### 11.8 Concurrencia en numeración

- Dos `GenerateDocument` simultáneos del mismo `type/series`: el lock del `NumberSequencePort`
  (§5.1) serializa la asignación; el `UNIQUE(type, series, number)` es la última red de seguridad
  (un choque improbable → reintento con el siguiente number).

### 11.9 Snapshot del mes en curso

- El snapshot del **mes actual** se marca siempre como potencialmente stale (o con TTL corto): sigue
  llegando actividad. `GetFinancePeriodReport` del mes en curso recomputa on-demand o usa un TTL
  chico; los meses cerrados usan cache persistente hasta que un evento (devolución tardía) los marque
  stale.

---

## 12. Definition of Done (backend.md §28, [05] checklist)

```txt
[ ] Numeración correlativa por (type, series) sin huecos, garantizada por lock + UNIQUE en DB.
[ ] No se emite remito/factura para orden CANCELLED/DRAFT (INVALID_ORDER_STATE, test negativo).
[ ] PDF determinístico: mismo input canónico → mismo checksum (test de bytes/checksum estable).
[ ] Estado PROCESSING→AVAILABLE vía worker; DownloadDocument da DOCUMENT_NOT_READY (409) si PROCESSING.
[ ] RegenerateDocument idempotente por content_hash + Idempotency-Key; numeración inmutable.
[ ] Descarga solo por URL firmada de expiración corta; sin URLs públicas permanentes.
[ ] Cada descarga autorizada inserta document_download (auditoría); reason obligatorio para SUPPORT.
[ ] Reportes derivados de order/order_line vía read model autorizado; SIN JOIN crudo a tablas de orders.
[ ] revenue/cost/margin/avgTicket con dinero en enteros menores; divisiones con guarda /0.
[ ] Costo usa supplier_cost_snapshot_minor (histórico), nunca el costo actual.
[ ] finance_period_snapshot como cache: invalidable (is_stale) y recomputable (RecomputePeriodSnapshot).
[ ] Cambios de precio/costo posteriores NO alteran reportes de períodos pasados (test).
[ ] Costo/margen sensibles: presenters no los filtran a CATALOG_MANAGER/SUPPORT (test de output).
[ ] Permisos evaluados en el caso de uso (CanViewMarginPolicy), no solo en middleware.
[ ] Dashboard consume finance.getKpis; no recalcula revenue/margen por su cuenta.
[ ] Detalle de cliente ("gastó"/"invirtió") usa estos cálculos con permisos FINANCE/OWNER/ADMIN.
[ ] Devoluciones/NC: reversión reconocida consistentemente + período marcado stale.
[ ] Eventos por outbox (DocumentGenerated/DocumentAvailable); payload sin PDF completo ni PII de más.
[ ] Errores tipados mapeados a HTTP; mensajes públicos no técnicos.
[ ] Endpoints en OpenAPI (REST) / tipos tRPC; tests éxito + error + auth negativa (BOLA).
[ ] Logs con requestId, sin PII de documentos; métricas de documentos generados/fallidos.
[ ] Migraciones corren desde cero; smoke test en staging.
```
