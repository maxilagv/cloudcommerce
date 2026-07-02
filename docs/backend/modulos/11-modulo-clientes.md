# 11 · Módulo Clientes (dominio `customers`)

> Cubre el pedido explícito del dueño: **ABM de clientes**. Alta con nombre/apellido (obligatorios),
> WhatsApp y email opcionales, notas; domicilios argentinos (varios por cliente, uno primario);
> listado de **todos** los clientes con **búsqueda por lupa** (nombre/apellido/whatsapp/email) y
> paginación cursor; y detalle del cliente con **analytics** (compras, cuánto gastó, veces que llamó,
> y —para roles autorizados— cuánto se invirtió: costo/margen).
>
> Documentos que este módulo da por sentados: [02 Arquitectura](../02-arquitectura.md),
> [04 Modelo de datos](../04-modelo-de-datos.md), [05 Convenciones de API](../05-convenciones-api.md),
> [06 Validaciones](../06-validaciones.md), [07 Auth e identidad](../07-auth-identidad.md).
> Skill base: `.claude/Skills/backend/backend.md` (§4.2 Customers, §6.6 ownership, §25 privacidad).

---

## 1. Propósito y alcance

### 1.1 Qué resuelve

El dueño necesita un registro operativo de sus clientes para vender de forma asistida (canal
`admin_manual`, ver [04](../04-modelo-de-datos.md) §orders) y para entender a quién le vende. En esta
fase **no** hay login de cliente en el store (ver [07](../07-auth-identidad.md) §Principios: los actores
son usuarios admin). Por lo tanto el dominio `customers` es, hoy, un **CRM ligero administrado por el
panel**: los clientes son creados y editados por staff admin, no se auto-registran.

El módulo entrega, de punta a punta:

1. **Alta de cliente**: `firstName` + `lastName` obligatorios; `whatsapp`, `email`, `notes` opcionales.
2. **Domicilios AR**: `province`, `city`, `street`, `streetNumber?` ("si aplica"),
   `betweenStreets?` ("entre calles"), `postalCode?`. Varios por cliente, uno `isPrimary`.
3. **Registro de contactos** (`customer_contact_log`): sostiene el KPI "veces que llamó".
4. **Listado + búsqueda** de todos los clientes, con lupa y paginación cursor.
5. **Detalle + analytics** derivados de `order`/`order_line`/`finance` (read models, no columnas).

### 1.2 Qué NO cubre (límites del bounded context)

- **No** persiste analytics como columnas del cliente. Compras, gasto, margen y "veces que llamó" se
  **derivan** por read model (§10). Regla canónica de [04](../04-modelo-de-datos.md) §customers.
- **No** implementa login/auth de cliente del store (fase futura: tabla `customer_auth`, fuera de alcance).
- **No** calcula precios ni márgenes por sí mismo: **consume** read models de `orders`/`finance` vía
  puertos. Un dominio no hace JOIN a tablas de otro ([02](../02-arquitectura.md) §Reglas de dependencia).
- **No** crea órdenes ni documentos. Eso vive en `orders` ([15](./15-modulo-ordenes.md)) y `finance`
  ([16](./16-modulo-finanzas.md)).
- **Seguimiento con IA del cliente**: **PRÓXIMAMENTE — no en esta fase** (§10.5). El dueño lo pidió así.

### 1.3 Ubicación en el árbol (`apps/api/src/domains/customers/`)

Estructura estándar de dominio ([02](../02-arquitectura.md) §Estructura interna de cada dominio):

```
domains/customers/
├─ domain/
│  ├─ entities/           Customer, CustomerAddress, ContactLogEntry, Consent
│  ├─ value-objects/      Whatsapp (E.164), Email, ArgentineAddress, PersonName
│  ├─ events/             CustomerCreated, CustomerUpdated, AddressAdded,
│  │                      PrimaryAddressChanged, ContactLogged, CustomerConsentUpdated
│  ├─ policies/           CanViewSensitiveCustomerDataPolicy, CanViewCustomerCostPolicy
│  └─ errors.ts           CustomerNotFound, DuplicateCustomerEmail, PrimaryAddressRequired, ...
├─ application/
│  ├─ commands/           CreateCustomer, UpdateCustomer, AddAddress, UpdateAddress,
│  │                      SetPrimaryAddress, LogContact, SoftDeleteCustomer
│  ├─ queries/            SearchCustomers, GetCustomerDetail, GetCustomerAnalytics
│  ├─ ports/              CustomerRepository, AddressRepository, ContactLogRepository,
│  │                      OrderAnalyticsPort (read model de orders),
│  │                      CustomerFinancePort (read model de finance)  ← sensible
│  ├─ services/           CustomerSearchService, AccessReasonRecorder (→ access_log)
│  └─ dto/                CreateCustomerInput, CustomerSummary, CustomerDetail, CustomerAnalytics
├─ infra/
│  ├─ repositories/       DrizzleCustomerRepository, DrizzleAddressRepository, ...
│  ├─ mappers/            row ↔ entidad
│  └─ read-models/        adapters a OrderAnalyticsPort / CustomerFinancePort
├─ interfaces/
│  ├─ trpc.ts             router customers.*
│  ├─ schemas.ts          re-export de packages/validators + schemas locales
│  └─ presenters.ts       entidad → response tipada (oculta cost/margin si no autorizado)
└─ tests/  unit/ integration/ contract/
```

---

## 2. Entidades y tablas

Tablas **canónicas** definidas en [04 Modelo de datos](../04-modelo-de-datos.md) §customers
(`schema/customers.ts`). Este módulo **no inventa** columnas; usa exactamente:

```
customer             id, first_name, last_name, display_name(gen), email?(unique nullable, lower),
                     whatsapp?(e164), notes?, tier?(CloudBase/Plus/Prime),
                     created_at, updated_at, deleted_at?
customer_address     id, customer_id(FK), label?, recipient_name?,
                     province, city, street, street_number?, between_streets?,
                     postal_code?, is_primary(bool), created_at, updated_at
customer_consent     id, customer_id(FK), kind, granted(bool), granted_at, source
customer_contact_log id, customer_id(FK), channel(call/whatsapp/email/other),
                     direction(in/out), note?, occurred_at, created_by(admin_user_id)
```

Notas canónicas que este módulo respeta ([04](../04-modelo-de-datos.md) §customers):

- `customer_contact_log` sostiene el KPI **"veces que llamó"** (filtrando `channel = 'call'`).
- Analytics (cuánto gastó / cuánto se invirtió / gráfico de compras) **no** son columnas: se
  **calculan** desde `order` + `finance` y se sirven por read model (§10).
- Direcciones AR: `province`, `city`, `street`, `street_number` opcional ("si aplica"),
  `between_streets` ("entre calles"), `postal_code`.

### 2.1 DDL ilustrativo (Drizzle, `packages/database/src/schema/customers.ts`)

> Ilustrativo, alineado a las convenciones globales de [04](../04-modelo-de-datos.md) (UUIDv7 en app,
> `timestamptz`, snake_case, enums pgEnum, CHECK en DB).

```ts
import { pgTable, uuid, text, boolean, timestamp, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const contactChannel   = pgEnum('contact_channel',   ['call', 'whatsapp', 'email', 'other']);
export const contactDirection = pgEnum('contact_direction', ['in', 'out']);
export const consentKind      = pgEnum('consent_kind',      ['marketing_whatsapp', 'marketing_email', 'data_processing']);

export const customer = pgTable('customer', {
  id:          uuid('id').primaryKey(),                 // UUIDv7 generado en app
  firstName:   text('first_name').notNull(),
  lastName:    text('last_name').notNull(),
  // display_name generado por DB: first_name || ' ' || last_name
  displayName: text('display_name').generatedAlwaysAs(sql`first_name || ' ' || last_name`),
  email:       text('email'),                           // nullable; lower; unique parcial (ver índice)
  whatsapp:    text('whatsapp'),                         // E.164 sin espacios: +54911...
  notes:       text('notes'),
  tier:        text('tier'),                             // 'CloudBase' | 'CloudPlus' | 'CloudPrime'
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt:   timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  // unique parcial: email único solo entre clientes no borrados y con email presente
  emailUniq:   uniqueIndex('uq_customer_email').on(t.email).where(sql`email IS NOT NULL AND deleted_at IS NULL`),
  nameFts:     index('idx_customers_name').using('gin', sql`to_tsvector('spanish', first_name || ' ' || last_name)`),
  waIdx:       index('idx_customers_whatsapp').on(t.whatsapp),
}));

export const customerAddress = pgTable('customer_address', {
  id:             uuid('id').primaryKey(),
  customerId:     uuid('customer_id').notNull().references(() => customer.id, { onDelete: 'cascade' }),
  label:          text('label'),
  recipientName:  text('recipient_name'),
  province:       text('province').notNull(),
  city:           text('city').notNull(),
  street:         text('street').notNull(),
  streetNumber:   text('street_number'),                // "si aplica"
  betweenStreets: text('between_streets'),              // "entre calles"
  postalCode:     text('postal_code'),
  isPrimary:      boolean('is_primary').notNull().default(false),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byCustomer:  index('idx_addr_customer').on(t.customerId),
  // invariante: como mucho UNA dirección primaria por cliente (unique parcial)
  onePrimary:  uniqueIndex('uq_addr_primary').on(t.customerId).where(sql`is_primary = true`),
}));

export const customerContactLog = pgTable('customer_contact_log', {
  id:         uuid('id').primaryKey(),
  customerId: uuid('customer_id').notNull().references(() => customer.id, { onDelete: 'cascade' }),
  channel:    contactChannel('channel').notNull(),
  direction:  contactDirection('direction').notNull().default('in'),
  note:       text('note'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy:  uuid('created_by').notNull(),             // admin_user.id
}, (t) => ({
  byCustomerTime: index('idx_contactlog_customer_time').on(t.customerId, t.occurredAt),
  // KPI "veces que llamó": filtro por channel; índice parcial para el conteo rápido
  callsIdx:       index('idx_contactlog_calls').on(t.customerId).where(sql`channel = 'call'`),
}));

export const customerConsent = pgTable('customer_consent', {
  id:         uuid('id').primaryKey(),
  customerId: uuid('customer_id').notNull().references(() => customer.id, { onDelete: 'cascade' }),
  kind:       consentKind('kind').notNull(),
  granted:    boolean('granted').notNull(),
  grantedAt:  timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  source:     text('source'),                           // 'admin_panel' | 'import' | ...
});
```

Índices ya declarados en el canon ([04](../04-modelo-de-datos.md) §Índices mínimos):
`idx_customers_name` (GIN tsvector español) y `idx_customers_whatsapp`. Este módulo agrega los
parciales para primaria y para llamadas.

### 2.2 Entidad de dominio (esquema conceptual)

El dominio no conoce Drizzle ([02](../02-arquitectura.md) §infra). La entidad expone invariantes:

```ts
class Customer {
  readonly id: CustomerId;
  name: PersonName;              // firstName + lastName (ambos requeridos, trim, no vacíos)
  email?: Email;                 // VO: normaliza lower, valida formato
  whatsapp?: Whatsapp;           // VO: normaliza a E.164
  notes?: string;
  tier?: CustomerTier;
  private addresses: CustomerAddress[];

  addAddress(addr: CustomerAddress): void;      // si es la 1ª → forzar isPrimary=true
  setPrimary(addressId: AddressId): void;       // desmarca las demás (invariante: exactamente 1)
  // Los analytics NO viven acá; se calculan fuera (read model).
}
```

---

## 3. Casos de uso (application layer)

Cada caso de uso declara, según [02](../02-arquitectura.md) §Capa application:
`actor`, `input validado`, `permisos`, `transacción`, `entidades afectadas`, `eventos`, `salida`, `errores`.

Todos reciben un `Actor` tipado (nunca el request crudo, [07](../07-auth-identidad.md) §Contexto de auth):

```ts
type Actor =
  | { kind: 'admin'; userId: string; role: AdminRole; sessionId: string }
  | { kind: 'system'; service: string };
```

### 3.1 `CreateCustomer` (command)

| Campo | Valor |
|---|---|
| **Actor** | admin con permiso `customer:create` |
| **Input** | `CreateCustomerSchema` (§7) — `firstName`, `lastName` requeridos; `whatsapp?`, `email?`, `notes?`; opcional `initialAddress?` (`CustomerAddressSchema`) |
| **Permiso** | `OWNER`, `ADMIN`, `SUPPORT` (matriz [07](../07-auth-identidad.md): "Crear/editar cliente"). `CATALOG_MANAGER`/`FINANCE` → `FORBIDDEN` |
| **Transacción** | Sí: `INSERT customer` (+ `INSERT customer_address` si viene `initialAddress`, marcada `isPrimary`) + `INSERT outbox(CustomerCreated)` |
| **Entidades** | `customer`, opcional `customer_address`, `outbox` |
| **Eventos** | `CustomerCreated` (payload: `customerId`, `createdBy`, sin PII innecesaria — [08](../08-seguridad.md) §minimización) |
| **Salida** | `CustomerDetail` (presenter, sin campos internos) |
| **Errores** | `VALIDATION_FAILED`, `FORBIDDEN`, `DuplicateCustomerEmail → CONFLICT` (si email ya existe entre no borrados) |

Normalización antes de persistir ([06](../06-validaciones.md) §Normalización): `trim` de nombres,
`lower` de email, `whatsapp` → E.164. `display_name` lo genera la DB.

### 3.2 `UpdateCustomer` (command)

| Campo | Valor |
|---|---|
| **Actor** | admin con `customer:update` |
| **Input** | `UpdateCustomerSchema` = `CreateCustomerSchema.partial()` (§7). Solo campos presentes se aplican (anti mass-assignment, [06](../06-validaciones.md) §Mass assignment) |
| **Permiso** | `OWNER`, `ADMIN`, `SUPPORT` |
| **Transacción** | Sí: `UPDATE customer` (optimista por `updated_at`) + `outbox(CustomerUpdated)` + `audit_log(before/after)` |
| **Entidades** | `customer`, `audit_log`, `outbox` |
| **Eventos** | `CustomerUpdated` |
| **Salida** | `CustomerDetail` |
| **Errores** | `VALIDATION_FAILED`, `FORBIDDEN`, `CustomerNotFound → RESOURCE_NOT_FOUND`, `DuplicateCustomerEmail → CONFLICT`, `CONFLICT` (edición concurrente) |

### 3.3 `AddAddress` / `UpdateAddress` / `SetPrimaryAddress` (commands)

| Campo | Valor |
|---|---|
| **Actor** | admin con `customer:update` |
| **Input** | `CustomerAddressSchema` (§7) + `customerId`. `SetPrimaryAddress`: `{ customerId, addressId }` |
| **Permiso** | `OWNER`, `ADMIN`, `SUPPORT`. Editar/leer domicilio = "dato sensible" para `SUPPORT` → **requiere `reason`** (§6) |
| **Transacción** | Sí. Al marcar una dirección `isPrimary=true`, desmarcar la anterior en la **misma tx** (invariante "exactamente una primaria"). Primera dirección del cliente → `isPrimary` forzado a `true` |
| **Entidades** | `customer_address`, `outbox` |
| **Eventos** | `AddressAdded`, `PrimaryAddressChanged` |
| **Salida** | `CustomerAddressView` (presenter) |
| **Errores** | `VALIDATION_FAILED`, `FORBIDDEN`, `CustomerNotFound → RESOURCE_NOT_FOUND`, `AddressNotFound → RESOURCE_NOT_FOUND`, `PrimaryAddressRequired → CONFLICT` (intentar dejar 0 primarias) |

### 3.4 `LogContact` (command) — sostiene "veces que llamó"

| Campo | Valor |
|---|---|
| **Actor** | admin con `customer:update` (o `customer:contact`) |
| **Input** | `LogContactSchema` (§7): `{ customerId, channel, direction?, note?, occurredAt? }` |
| **Permiso** | `OWNER`, `ADMIN`, `SUPPORT` |
| **Transacción** | Simple `INSERT customer_contact_log` con `created_by = actor.userId` + `outbox(ContactLogged)` |
| **Entidades** | `customer_contact_log`, `outbox` |
| **Eventos** | `ContactLogged` |
| **Salida** | `ContactLogEntryView` |
| **Errores** | `VALIDATION_FAILED`, `FORBIDDEN`, `CustomerNotFound → RESOURCE_NOT_FOUND` |

> El conteo "veces que llamó" = `count(customer_contact_log WHERE customer_id = ? AND channel='call')`.
> No es una columna; se calcula en `GetCustomerAnalytics` (§3.7 / §10).

### 3.5 `SearchCustomers` (query) — listado con lupa

| Campo | Valor |
|---|---|
| **Actor** | admin con `customer:read` |
| **Input** | `SearchCustomersSchema` (§7): `{ q?, sort?, cursor?, limit? }` — `q` es el texto de la lupa |
| **Permiso** | `OWNER`, `ADMIN`, `SUPPORT`. Nota: `SUPPORT` ve el listado; los **datos sensibles** (whatsapp/domicilio) se enmascaran en la card salvo `reason` (§6) |
| **Transacción** | No (solo lectura). Statement timeout configurado ([05](../05-convenciones-api.md) §Headers y límites) |
| **Búsqueda** | `q` matchea contra **nombre/apellido** (FTS español + trigram tolerante), **whatsapp** (prefijo normalizado E.164) y **email** (prefijo lower). Ver §10.4 |
| **Salida** | `{ data: CustomerSummary[], pageInfo: { nextCursor, hasNextPage, limit } }` — cursor **firmado** ([05](../05-convenciones-api.md) §Paginación) |
| **Errores** | `VALIDATION_FAILED` (limit fuera de rango, cursor manipulado), `FORBIDDEN` |

Paginación cursor keyset sobre `(created_at DESC, id DESC)` para orden estable; `sort` mapeado a
whitelist (`recent | name | last_contact`), nunca columna libre ([05](../05-convenciones-api.md) §Filtros).

### 3.6 `GetCustomerDetail` (query)

| Campo | Valor |
|---|---|
| **Actor** | admin con `customer:read` |
| **Input** | `{ customerId: uuid, reason?: string }` |
| **Permiso** | `OWNER`, `ADMIN`, `SUPPORT`. Si el actor es `SUPPORT` y la vista incluye datos sensibles (whatsapp/domicilio) → `reason` obligatorio y se escribe `access_log` (§6) |
| **Transacción** | No |
| **Salida** | `CustomerDetail`: identidad + direcciones + timeline de contactos recientes + bloque `analytics` (§3.7). Campos sensibles enmascarados según policy |
| **Errores** | `VALIDATION_FAILED`, `FORBIDDEN` (SUPPORT sin `reason` para datos sensibles), `CustomerNotFound → RESOURCE_NOT_FOUND` |

### 3.7 `GetCustomerAnalytics` (query) — el corazón del detalle

| Campo | Valor |
|---|---|
| **Actor** | admin con `customer:read` |
| **Input** | `GetCustomerAnalyticsSchema` (§7): `{ customerId, range?: '3M'\|'6M'\|'12M', breakdown?: 'category'\|'spend' }` |
| **Permiso** | `customer:read`. **Los campos de costo/margen (`cuánto se invirtió`) SOLO** para `OWNER`, `ADMIN`, `FINANCE` (matriz [07](../07-auth-identidad.md): "Ver cuánto invirtió (costo/margen)"). `SUPPORT` y `CATALOG_MANAGER` reciben el bloque **sin** `invested`/`margin` |
| **Transacción** | No. Read models de `orders`/`finance` vía puertos (`OrderAnalyticsPort`, `CustomerFinancePort`), **nunca** JOIN directo a tablas de otros dominios ([02](../02-arquitectura.md) §Reglas de dependencia) |
| **Salida** | `CustomerAnalytics` (§10.1): `ordersCount`, `totalSpent`, `totalSaved`, `callsCount`, `spendingSeries[]`, `purchaseBreakdown[]`, y —solo autorizados— `totalInvested`, `margin` |
| **Errores** | `VALIDATION_FAILED`, `FORBIDDEN`, `CustomerNotFound → RESOURCE_NOT_FOUND`, `UPSTREAM_UNAVAILABLE` (si el read model de finanzas no está disponible → degradar: devolver métricas de gasto sin costo, marcar `investedAvailable=false`) |

### 3.8 `SoftDeleteCustomer` (command)

| Campo | Valor |
|---|---|
| **Actor** | admin con `customer:delete` |
| **Input** | `{ customerId, reason }` (`reason` obligatorio) |
| **Permiso** | `OWNER`, `ADMIN` (baja de cliente = operación sensible; `SUPPORT` no borra) |
| **Transacción** | `UPDATE customer SET deleted_at=now()` + `audit_log` + `outbox(CustomerDeleted)`. No borra órdenes históricas (integridad financiera) |
| **Eventos** | `CustomerDeleted` |
| **Errores** | `VALIDATION_FAILED`, `FORBIDDEN`, `CustomerNotFound`, `CONFLICT` (ya borrado) |

---

## 4. Endpoints tRPC (`customers.*`)

Router `customers` bajo `appRouter` ([05](../05-convenciones-api.md) §Convención tRPC). Todos usan
`adminProcedure` (requiere `admin_user` + rol). La **autorización fina vive en el caso de uso**, no solo
en el middleware ([05](../05-convenciones-api.md), [07](../07-auth-identidad.md)). Input siempre un schema
Zod de `packages/validators`.

```ts
export const customersRouter = router({
  // Queries (get*/list*/search*)
  search:        adminProcedure.input(SearchCustomersSchema).query(...),      // listado + lupa + cursor
  getDetail:     adminProcedure.input(GetCustomerDetailSchema).query(...),    // detalle
  getAnalytics:  adminProcedure.input(GetCustomerAnalyticsSchema).query(...), // gráficos + KPIs
  listAddresses: adminProcedure.input(z.object({ customerId: z.string().uuid() })).query(...),
  listContacts:  adminProcedure.input(ListContactsSchema).query(...),        // timeline paginado

  // Mutations (create*/update*/delete*)
  create:            adminProcedure.input(CreateCustomerSchema).mutation(...),
  update:            adminProcedure.input(UpdateCustomerSchema.extend({ customerId: z.string().uuid() })).mutation(...),
  addAddress:        adminProcedure.input(CustomerAddressSchema.extend({ customerId: z.string().uuid() })).mutation(...),
  updateAddress:     adminProcedure.input(UpdateAddressSchema).mutation(...),
  setPrimaryAddress: adminProcedure.input(z.object({ customerId: z.string().uuid(), addressId: z.string().uuid() })).mutation(...),
  logContact:        adminProcedure.input(LogContactSchema).mutation(...),
  softDelete:        adminProcedure.input(z.object({ customerId: z.string().uuid(), reason: z.string().min(3).max(300) })).mutation(...),
});
```

En tRPC no hay envelope REST: `data` es el retorno tipado y `requestId` viaja por context/header
([05](../05-convenciones-api.md) §Envelope). No se expone REST público de clientes en esta fase (es
panel-only); si a futuro se necesita para integraciones, se agrega `/api/v1/customers` con OpenAPI.

---

## 5. Reglas e invariantes

**Dominio** (irrompibles, viven en `domain/`):

1. `firstName` y `lastName` son **obligatorios** y no vacíos tras `trim`. Todo lo demás es opcional.
2. Un cliente tiene **0..N** direcciones. Si tiene ≥1, **exactamente una** es `isPrimary`
   (garantizado por índice único parcial `uq_addr_primary` + lógica de tx en `SetPrimaryAddress`).
3. La **primera** dirección agregada se marca `isPrimary=true` automáticamente.
4. `email`, cuando está presente, es **único** entre clientes no borrados (índice parcial `uq_customer_email`).
   Dos clientes sin email son válidos (el email es opcional, no identidad).
5. `whatsapp` se persiste **normalizado a E.164** (VO `Whatsapp`); la búsqueda normaliza el `q` igual antes de comparar.
6. Los **analytics no se persisten** en `customer`: siempre se **derivan** de `orders`/`finance`
   (regla de oro de [04](../04-modelo-de-datos.md)). No cachear analytics con PII sin diseño de invalidación
   ([backend.md](../../../.claude/Skills/backend/backend.md) §25, §17.5 "no cachear datos personales").
7. Baja = **soft delete** (`deleted_at`). Nunca hard-delete: las órdenes lo referencian y finanzas depende de ello.

**Aplicación**:

8. Ownership/BFLA: no hay "cliente dueño de sí mismo" en esta fase (no hay login de cliente); el control
   es **RBAC admin** + **motivo de acceso** para datos sensibles ([07](../07-auth-identidad.md) §Autorización).
9. Mass assignment prohibido: `UpdateCustomer` aplica solo el subconjunto validado
   ([06](../06-validaciones.md) §Mass assignment).

---

## 6. Permisos (matriz [07](../07-auth-identidad.md)) y datos sensibles

Roles: `OWNER`, `ADMIN`, `CATALOG_MANAGER`, `FINANCE`, `SUPPORT` ([07](../07-auth-identidad.md) §Roles).

| Acción `customers.*` | OWNER | ADMIN | CATALOG_MANAGER | FINANCE | SUPPORT |
|---|:--:|:--:|:--:|:--:|:--:|
| `search` / `getDetail` (identidad básica) | ✔ | ✔ | ✖ | ✖ | ✔ |
| `create` / `update` cliente | ✔ | ✔ | ✖ | ✖ | ✔ |
| Ver **datos sensibles** (whatsapp, domicilio) | ✔ | ✔ | ✖ | ✖ | **con motivo** |
| `addAddress` / `updateAddress` / `setPrimary` | ✔ | ✔ | ✖ | ✖ | con motivo |
| `logContact` | ✔ | ✔ | ✖ | ✖ | ✔ |
| `getAnalytics` — gasto/compras/llamadas | ✔ | ✔ | ✖ | ✔ | ✔ |
| `getAnalytics` — **"cuánto invirtió" (costo/margen)** | ✔ | ✔ | ✖ | ✔ | **✖** |
| `softDelete` | ✔ | ✔ | ✖ | ✖ | ✖ |

Filas alineadas 1:1 con la matriz canónica de [07](../07-auth-identidad.md) §Matriz de permisos
("Crear/editar cliente", "Ver datos sensibles cliente (WSP, domicilio)", "Ver cuánto invirtió (costo/margen)").

### 6.1 Dato sensible: "cuánto se invirtió" (costo / margen)

`totalInvested` y `margin` derivan de `supplier_cost_snapshot_minor` (por línea de orden,
[04](../04-modelo-de-datos.md) §orders) vía `CustomerFinancePort`. Es **información de negocio sensible**:

- Solo `OWNER`, `ADMIN`, `FINANCE` reciben estos campos.
- Para el resto, el **presenter los omite** (no los envía en `null`: no aparecen en el objeto), y el
  read model **no los calcula** para evitar side-channel por tiempos de respuesta.
- Motivo canónico: matriz [07](../07-auth-identidad.md) — "Ver cuánto invirtió" ✖ para `SUPPORT`.

### 6.2 Motivo de acceso de `SUPPORT` (auditoría, [07](../07-auth-identidad.md) §Motivos de acceso)

Cuando `SUPPORT` accede a datos personales del cliente (whatsapp, domicilio, timeline de contactos) debe
enviar `reason`. El caso de uso lo registra en `access_log` **antes** de devolver los datos:

```
access_log: actorId, resourceType='customer', resourceId, action='view_sensitive',
            reason, ip, userAgent, createdAt
```

Sin `reason`, `SUPPORT` recibe la card/detalle con esos campos **enmascarados** (p. ej. `+54 9 •• •• 4242`,
domicilio sin número/calle) y `FORBIDDEN` si intenta abrir el detalle sensible completo. `OWNER`/`ADMIN`/
`FINANCE` no requieren motivo (pero toda operación de escritura sigue pasando por `audit_log`).

---

## 7. Validaciones (`packages/validators/src/customer.ts`)

Schemas Zod compartidos front/back ([06](../06-validaciones.md) §Validación de entrada). Los dos primeros
son **exactamente** los del canon de [06](../06-validaciones.md):

```ts
import { z } from 'zod';

// ── Canon de 06 ──────────────────────────────────────────────────────────────
export const CreateCustomerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName:  z.string().trim().min(1).max(80),
  whatsapp:  z.string().regex(/^\+?\d{8,15}$/).optional(),   // opcional
  email:     z.string().email().toLowerCase().optional(),
  notes:     z.string().max(1000).optional(),
});

export const CustomerAddressSchema = z.object({
  province:       z.string().trim().min(1).max(60),
  city:           z.string().trim().min(1).max(80),
  street:         z.string().trim().min(1).max(120),
  streetNumber:   z.string().trim().max(20).optional(),    // "si aplica"
  betweenStreets: z.string().trim().max(160).optional(),   // "entre calles"
  postalCode:     z.string().regex(/^\d{4,8}$/).optional(),
  isPrimary:      z.boolean().default(false),
});

// ── Locales del módulo (derivados) ───────────────────────────────────────────
export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export const UpdateAddressSchema = CustomerAddressSchema.partial().extend({
  customerId: z.string().uuid(),
  addressId:  z.string().uuid(),
});

export const LogContactSchema = z.object({
  customerId: z.string().uuid(),
  channel:    z.enum(['call', 'whatsapp', 'email', 'other']),
  direction:  z.enum(['in', 'out']).default('in'),
  note:       z.string().max(500).optional(),
  occurredAt: z.string().datetime().optional(),           // default: now() en el server
});

export const SearchCustomersSchema = z.object({
  q:      z.string().trim().max(80).optional(),           // texto de la lupa
  sort:   z.enum(['recent', 'name', 'last_contact']).default('recent'),
  cursor: z.string().optional(),                          // firmado; validado server-side
  limit:  z.number().int().min(1).max(50).default(20),    // default 20 (05 §Paginación)
});

export const GetCustomerDetailSchema = z.object({
  customerId: z.string().uuid(),
  reason:     z.string().trim().min(3).max(300).optional(), // requerido para SUPPORT + datos sensibles
});

export const GetCustomerAnalyticsSchema = z.object({
  customerId: z.string().uuid(),
  range:      z.enum(['3M', '6M', '12M']).default('6M'),
  breakdown:  z.enum(['category', 'spend']).default('category'),
});
```

Normalización server-side previa a persistir ([06](../06-validaciones.md) §Normalización): `whatsapp`
→ E.164 canónico (agregar `+54` si viene sin prefijo argentino, según config de tienda); `email` ya
llega `toLowerCase`; `notes`/`street`/etc. `trim` + límite de longitud. `notes` se sanitiza contra HTML
si a futuro se renderiza enriquecido.

**Salida** ([06](../06-validaciones.md) §Validación de salida): presenters tipados que **nunca** filtran
`deletedAt`, `supplier_cost_snapshot_minor`, ni `totalInvested`/`margin` a roles no autorizados. Output
validado contra schema en tests/no-producción.

---

## 8. Eventos de dominio

Emitidos vía **Outbox** dentro de la tx ([02](../02-arquitectura.md) §Event bus y Outbox;
[04](../04-modelo-de-datos.md) §outbox). Payloads mínimos, **sin PII innecesaria**
([08](../08-seguridad.md) §minimización; [backend.md](../../../.claude/Skills/backend/backend.md) §25).

| Evento | Cuándo | Payload (mínimo) | Consumidores potenciales |
|---|---|---|---|
| `CustomerCreated` | alta | `customerId`, `createdBy`, `at` | analytics, email de bienvenida (futuro) |
| `CustomerUpdated` | edición | `customerId`, `changedFields[]`, `by` | audit, search-reindex |
| `AddressAdded` | alta domicilio | `customerId`, `addressId` | — |
| `PrimaryAddressChanged` | cambio de primaria | `customerId`, `addressId` | orders (default de envío) |
| `ContactLogged` | log de contacto | `customerId`, `channel`, `by`, `at` | analytics ("veces que llamó") |
| `CustomerConsentUpdated` | consentimiento | `customerId`, `kind`, `granted` | marketing/compliance |
| `CustomerDeleted` | soft delete | `customerId`, `by`, `reason` | search-deindex, retención |

`CustomerConsentUpdated` figura entre los eventos sugeridos por la skill
([backend.md](../../../.claude/Skills/backend/backend.md) §11.7).

---

## 9. Errores tipados

Errores de dominio (`domain/errors.ts`) mapeados a `code` público del catálogo
([05](../05-convenciones-api.md) §Catálogo de códigos). Se usa Result/errores tipados para flujos
esperados ([backend.md](../../../.claude/Skills/backend/backend.md) §21.2).

| Error de dominio | `code` público | HTTP |
|---|---|---|
| `CustomerNotFound` | `RESOURCE_NOT_FOUND` | 404 |
| `AddressNotFound` | `RESOURCE_NOT_FOUND` | 404 |
| `DuplicateCustomerEmail` | `CONFLICT` | 409 |
| `PrimaryAddressRequired` | `CONFLICT` | 409 |
| `CustomerAlreadyDeleted` | `CONFLICT` | 409 |
| (input Zod inválido) | `VALIDATION_FAILED` | 400 |
| (sin sesión admin) | `UNAUTHENTICATED` | 401 |
| (rol sin permiso / SUPPORT sin motivo) | `FORBIDDEN` | 403 |
| (read model de finanzas caído) | `UPSTREAM_UNAVAILABLE` | 502/503 (degrada, ver §3.7) |

Mensajes públicos claros, no técnicos ([05](../05-convenciones-api.md)): p. ej.
`"Ya existe un cliente con ese email."` — nunca el error crudo del ORM.

---

## 10. Read models de analytics (shapes que consume el front)

Los analytics **se derivan** (regla canónica [04](../04-modelo-de-datos.md) §customers). El front del
store ya define los shapes de referencia en `apps/store/src/lib/mock-account.ts`
(`SpendingPoint`, `mockMetrics`, `LoyaltyData`). Estos read models son el contrato para que el **panel
admin** pinte los mismos gráficos. Dinero siempre en **enteros menores + moneda** (ARS,
[04](../04-modelo-de-datos.md) ADR-007), no floats como en el mock.

### 10.1 `CustomerAnalytics` (salida de `getAnalytics`)

```ts
type Money = { amountMinor: number; currency: 'ARS' | 'USD' };

type CustomerAnalytics = {
  customerId: string;
  range: '3M' | '6M' | '12M';

  // KPIs (cards del detalle) — equivalen a mockMetrics del front
  ordersCount: number;          // "Compras realizadas"
  totalSpent:  Money;           // "Total gastado"  (sum order.total_minor, órdenes no canceladas)
  totalSaved:  Money;           // "Total ahorrado" (sum order.discount_minor)
  callsCount:  number;          // "Veces que llamó" = count(contact_log WHERE channel='call')
  contactsCount: number;        // total de contactos (todos los canales)
  aov:         Money;           // ticket promedio = totalSpent / ordersCount
  lastOrderAt?: string;         // ISO
  lastContactAt?: string;       // ISO

  // Serie temporal para el gráfico de línea/área (front: SpendingPoint[])
  spendingSeries: SpendingPoint[];

  // Datos del gráfico circular (pie chart)
  purchaseBreakdown: BreakdownSlice[];

  // ── SOLO OWNER/ADMIN/FINANCE (omitido para SUPPORT/CATALOG_MANAGER) ──
  totalInvested?: Money;        // "cuánto se invirtió" = sum(supplier_cost_snapshot_minor)
  margin?: {                    // margen bruto derivado
    amount: Money;              // totalSpent - totalInvested
    pct: number;               // margin.amount / totalSpent  (0..1)
  };
  investedAvailable: boolean;   // false si el actor no está autorizado O el read model degradó
};
```

### 10.2 `SpendingPoint` — serie temporal de gasto

Idéntico al shape que ya usa el front (`apps/store/src/lib/mock-account.ts`), pero con dinero en
enteros menores para no perder precisión:

```ts
type SpendingPoint = {
  month: string;        // etiqueta corta localizada: "Ene", "Feb", ... (o "2026-06" si el front prefiere)
  amount: number;       // amountMinor en ARS  (el front formatea con formatARS)
};
```

Ejemplo de payload (rango 6M) coherente con `mockSpending["6M"]`:

```json
[
  { "month": "Ene", "amount": 0 },
  { "month": "Feb", "amount": 120000000 },
  { "month": "Mar", "amount": 0 },
  { "month": "Abr", "amount": 319990000 },
  { "month": "May", "amount": 319990000 },
  { "month": "Jun", "amount": 1676960000 }
]
```

> Fuente: `OrderAnalyticsPort.spendingByMonth(customerId, range)` → agrega `order.total_minor`
> por mes calendario sobre órdenes no canceladas. Meses sin compra devuelven `0` (serie densa, sin huecos).

### 10.3 `BreakdownSlice` — datos del gráfico circular (pie chart)

Shape propuesto para que el front pinte un **pie chart** directamente (sin transformación). Dos modos
según `breakdown`:

- `breakdown='category'` → **compras por categoría** (una porción por categoría comprada).
- `breakdown='spend'` → **distribución de gasto** por categoría (mismo shape, `value` = monto).

```ts
type BreakdownSlice = {
  key: string;          // slug estable de la categoría: "celulares", "computadoras", ...
  label: string;        // nombre visible: "Celulares"
  value: number;        // si breakdown='category' → cantidad de unidades/órdenes;
                        // si breakdown='spend'    → amountMinor gastado en esa categoría
  amountMinor?: number; // gasto asociado (siempre presente, útil para tooltip)
  count?: number;       // órdenes/unidades (siempre presente, útil para tooltip)
  pct: number;          // participación 0..1 (precalculada por el backend para el pie)
  color?: string;       // opcional: color sugerido/estable por categoría
};
```

Ejemplo (`breakdown='category'`):

```json
[
  { "key": "refrigeradores", "label": "Refrigeradores", "value": 1, "amountMinor": 684990000, "count": 1, "pct": 0.42 },
  { "key": "computadoras",   "label": "Computadoras",   "value": 1, "amountMinor": 549990000, "count": 1, "pct": 0.34 },
  { "key": "audio-video",    "label": "Audio y Video",  "value": 2, "amountMinor": 189990000, "count": 2, "pct": 0.12 },
  { "key": "aspiradoras",    "label": "Aspiradoras",    "value": 1, "amountMinor": 199990000, "count": 1, "pct": 0.12 }
]
```

> Fuente: `OrderAnalyticsPort.breakdownByCategory(customerId, range, mode)` — agrega `order_line`
> por `category_id` (el nombre de categoría llega **denormalizado** en el read model de orders; el
> dominio customers no hace JOIN a catalog). `pct` se calcula server-side y suma 1.0 (la porción
> residual "Otros" absorbe redondeos si hace falta).

### 10.4 Read model del **listado** (`CustomerSummary`) y búsqueda

```ts
type CustomerSummary = {
  id: string;
  displayName: string;           // first + last
  email?: string | null;         // enmascarado para SUPPORT sin motivo
  whatsapp?: string | null;      // enmascarado para SUPPORT sin motivo
  tier?: 'CloudBase' | 'CloudPlus' | 'CloudPrime' | null;
  primaryCity?: string | null;   // de la dirección primaria (barato de exponer)
  ordersCount: number;           // KPI liviano precomputado por el read model de orders
  totalSpent: Money;             // idem
  lastOrderAt?: string | null;
  createdAt: string;
};
```

Búsqueda de la **lupa** (`q`), whitelist de campos ([05](../05-convenciones-api.md) §Filtros):

- **Nombre/apellido**: `to_tsvector('spanish', first_name||' '||last_name)` (índice GIN
  `idx_customers_name`) + `pg_trgm` para tolerancia a typos.
- **Whatsapp**: normalizar `q` a dígitos/E.164 y comparar por prefijo contra `whatsapp`
  (índice `idx_customers_whatsapp`).
- **Email**: `lower(email) LIKE lower(q) || '%'` (prefijo).
- El router combina las tres con `OR`; excluye `deleted_at IS NOT NULL`. Paginación keyset por
  `(created_at DESC, id DESC)`, cursor firmado.

### 10.5 Seguimiento con IA del cliente — **PRÓXIMAMENTE (no en esta fase)**

> **Gancho documentado, deliberadamente NO implementado en esta fase** (pedido explícito del dueño).

Idea futura: un "seguimiento con IA" que analice el historial del cliente (compras, contactos, gasto,
categorías) para sugerir próxima acción comercial (recompra, upsell, recontacto), estimar
churn/propensión y redactar un resumen. Cuando se active:

- Se implementará como consumidor del **AI Gateway** ([17](./17-modulo-ia-gateway.md)), **no** con lógica
  de IA dentro de este dominio ([backend.md](../../../.claude/Skills/backend/backend.md) §4.12 / §15:
  el backend core TS/Node no implementa la inteligencia).
- El backend decide **qué contexto viaja**: se enviará el **mínimo necesario** y **jamás** costo proveedor
  a un actor que no pueda verlo, ni PII innecesaria ([backend.md](../../../.claude/Skills/backend/backend.md)
  §15.2, §25). Toda invocación se audita y se aplica rate limit/costo por operación.
- Contrato tentativo (reservado, no exponer aún): `customers.aiFollowUp(customerId)` → delega en
  `AiGatewayPort.customerInsights(...)`. Feature flag `customers.ai_followup` (owner + fecha de revisión,
  [backend.md](../../../.claude/Skills/backend/backend.md) §18.3), **off** por defecto.

Hasta entonces, el endpoint **no existe** y ninguna respuesta del módulo llama al servicio de IA.

---

## 11. Casos borde

1. **Cliente sin email y sin whatsapp**: válido (ambos opcionales). La búsqueda solo lo encontrará por nombre.
2. **Dos altas con el mismo email**: la segunda falla `DuplicateCustomerEmail → CONFLICT`. Sin email, no colisiona.
3. **Whatsapp con/sin prefijo** (`1122334455` vs `+541122334455`): se normaliza a E.164 antes de guardar y
   antes de comparar en la lupa; la búsqueda por dígitos parciales igual matchea por prefijo.
4. **Primera dirección**: se fuerza `isPrimary=true` aunque el input diga `false`.
5. **Marcar primaria una segunda dirección**: desmarca la anterior en la misma tx; nunca quedan dos primarias
   (índice `uq_addr_primary` es el último candado).
6. **Intentar dejar 0 primarias** (desmarcar la única): `PrimaryAddressRequired → CONFLICT`.
7. **Cliente sin órdenes**: analytics devuelve `ordersCount=0`, `totalSpent=0`, series densas en `0`,
   `purchaseBreakdown=[]`, `aov=0`. No error.
8. **SUPPORT abre detalle sin `reason`**: recibe identidad básica con whatsapp/domicilio **enmascarados**;
   si pide el bloque sensible → `FORBIDDEN` hasta enviar `reason` (que se audita en `access_log`).
9. **SUPPORT pide analytics**: recibe gasto/compras/llamadas pero **sin** `totalInvested`/`margin`
   (`investedAvailable=false`); el read model **no** los calcula.
10. **Read model de finanzas caído** para un `OWNER`: degrada — devuelve métricas de gasto, `investedAvailable=false`,
    y loguea `UPSTREAM_UNAVAILABLE` sin romper la vista ([backend.md](../../../.claude/Skills/backend/backend.md) §17.6).
11. **Cursor manipulado** en `search`: `VALIDATION_FAILED` (el cursor es firmado/codificado).
12. **Cliente soft-deleted**: no aparece en `search`; `getDetail` sobre él → `RESOURCE_NOT_FOUND`
    (anti-enumeración, [05](../05-convenciones-api.md)). Sus órdenes históricas se conservan.
13. **`occurredAt` futuro** en `logContact`: rechazado por validación (no se registran llamadas en el futuro).
14. **Edición concurrente** del mismo cliente por dos admins: control optimista por `updated_at` → el
    segundo recibe `CONFLICT` y reintenta con datos frescos.
15. **Borde de dinero**: nunca floats; el mock del front usa números planos (`7_299_900`), el backend los
    trata como `amountMinor` en ARS y el front formatea con `formatARS` (reconciliación de
    [04](../04-modelo-de-datos.md) §Inconsistencias / [06](../06-validaciones.md) §Dinero).

---

## 12. Definition of Done

Alineado con [backend.md](../../../.claude/Skills/backend/backend.md) §28 y el checklist de endpoint de
[05](../05-convenciones-api.md).

```txt
[ ] firstName/lastName obligatorios; whatsapp/email/notes opcionales — validado por CreateCustomerSchema.
[ ] Domicilios AR con province/city/street/streetNumber?/betweenStreets?/postalCode? — CustomerAddressSchema.
[ ] Invariante "exactamente una dirección primaria" garantizada por índice parcial + tx (test incluido).
[ ] email único entre clientes no borrados (índice parcial) — test de conflicto.
[ ] search: lupa por nombre/apellido/whatsapp/email + paginación cursor firmada + límite (default 20, máx 50).
[ ] getAnalytics: ordersCount, totalSpent, totalSaved, callsCount, spendingSeries, purchaseBreakdown derivados
    por read model (OrderAnalyticsPort / CustomerFinancePort), NUNCA columnas ni JOIN cross-dominio.
[ ] "cuánto invirtió" (totalInvested/margin) SOLO OWNER/ADMIN/FINANCE; presenter lo omite para el resto;
    read model no lo calcula para no autorizados — test de autorización negativa.
[ ] SUPPORT sin motivo → datos sensibles enmascarados; con motivo → access_log escrito antes de responder.
[ ] La regla de negocio vive en domain/application, no en el router tRPC.
[ ] Todos los errores esperados son tipados y mapean a code público (§9).
[ ] Presenters no filtran deletedAt/supplier_cost_snapshot/totalInvested a roles no autorizados
    (test de fuga de campos internos).
[ ] Eventos por Outbox dentro de la tx; payloads sin PII innecesaria.
[ ] Tests: éxito + input inválido + no autenticado + rol sin permiso + BFLA (SUPPORT ve costo) + recurso inexistente.
[ ] Logs con requestId y sin PII; métricas si el flujo es crítico.
[ ] Migraciones corren desde cero; seed de clientes demo coherente con el mock del store.
[ ] "Seguimiento con IA" documentado como PRÓXIMAMENTE; endpoint NO expuesto; feature flag off.
```
