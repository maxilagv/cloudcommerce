# 19 · Módulo Configuración (dominio `settings`/`config`)

> Documento de **diseño**, no de implementación. Los tipos TS y el DDL son **ilustrativos**: fijan
> forma y contrato, no código final. Cubre el requerimiento del dueño **Configuración**: tienda,
> envíos, pagos, usuarios admin y feature flags.

Fundacionales que este módulo da por sentados: [04 Modelo de datos](../04-modelo-de-datos.md),
[05 Convenciones de API](../05-convenciones-api.md), [07 Auth e identidad](../07-auth-identidad.md),
[08 Seguridad](../08-seguridad.md). Referencia de skill: `.claude/Skills/backend/backend.md`
(§18 configuración por ambientes, §18.3 feature flags, §9.9 secrets).

---

## 1. Propósito y alcance

### 1.1 Qué resuelve

El panel admin necesita un lugar único donde el dueño gobierne **cómo se comporta la tienda** sin
tocar código ni redeploy. Hoy datos que deberían ser configurables viven **hardcodeados en el
frontend** (`apps/store/src/lib/constants.ts`: opciones de envío, ciudades AR; y los logos de pago en
`purchase-panel.tsx`). Este módulo los **promueve a configuración de negocio** administrada por backend,
auditada y con permisos.

El módulo cubre cinco superficies:

1. **Configuración de la tienda** — nombre, moneda base, datos de facturación, textos legales, redes.
2. **Opciones de envío** — `ShippingOption` (standard/express/pickup) con costos; provincias/ciudades AR disponibles.
3. **Métodos de pago** — habilitar/deshabilitar VISA/MC/AMEX/MercadoPago/MODO/EFECTIVO; sus credenciales
   viven en **secret manager**, nunca en la tabla `setting` en claro.
4. **Usuarios admin y roles** — CRUD de staff desde el panel (invitar, activar/desactivar, cambiar rol).
   El detalle de auth (sesiones, MFA, refresh rotation) se delega a [07](../07-auth-identidad.md).
5. **Feature flags** — flags con owner, fecha de revisión y plan de eliminación.

### 1.2 Fuera de alcance (delegado)

- **Login, sesiones, MFA, refresh token rotation, recuperación de cuenta** → [07](../07-auth-identidad.md).
- **Almacenamiento y rotación de secretos** (Stripe/MercadoPago keys, HMAC de webhooks) → [08 §Secrets](../08-seguridad.md#secrets).
- **Cálculo de precio final / markup** → [14 Pricing](./14-modulo-pricing.md). Configuración solo fija
  parámetros globales (moneda base, redondeo), no reglas de pricing.
- **Cobro real y webhooks de pago** → módulo payments/checkout ([15 Órdenes](./15-modulo-ordenes.md)).
  Aquí solo se decide **qué método está habilitado** y su metadata pública.

### 1.3 Principio rector del módulo

> La configuración de **negocio** es dato editable en runtime, versionado y auditado.
> La configuración de **infraestructura** (env vars) se valida al boot y no se edita en caliente.
> Los **secretos** nunca se guardan en `setting` en claro: se referencian por handle al secret manager.

Esta triple distinción (§3) es la columna vertebral del módulo.

---

## 2. Entidades y tablas (canon [04](../04-modelo-de-datos.md))

Este módulo **no inventa tablas nuevas**: reutiliza las ya declaradas en el modelo canónico
`schema/shared.ts` y `schema/identity.ts`. Lo que agrega es la **semántica de claves**, las **policies**
y los **casos de uso**.

### 2.1 `setting` (schema/shared.ts) — clave/valor jsonb auditada

```
setting   id, key(unique), value(jsonb), updated_by, updated_at
```

DDL ilustrativo (extiende el canon con auditoría mínima; sin romper la forma):

```sql
CREATE TABLE setting (
  id          uuid PRIMARY KEY,                 -- UUIDv7 en app
  key         text NOT NULL UNIQUE,             -- namespaced: "store.name", "shipping.options"
  value       jsonb NOT NULL,                   -- payload validado por Zod ANTES de persistir
  scope       text NOT NULL DEFAULT 'business', -- 'business' | 'public' (whitelist expuesta al store)
  updated_by  uuid REFERENCES admin_user(id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

- **Una fila por clave**; el `value` es un documento jsonb cuya forma la garantiza un **schema Zod por
  clave** (registro `SETTING_SCHEMAS`, §3.2). No se persiste jsonb libre.
- `scope='public'` marca claves que el store puede leer sin auth (nombre de tienda, redes, textos
  legales, opciones de envío visibles). El resto es `business` (solo panel).
- Los cambios se auditan además en `audit_log` con `before`/`after` (§9).

### 2.2 `feature_flag` (schema/shared.ts)

```
feature_flag   id, key(unique), enabled(bool), owner, review_at?, description
```

DDL ilustrativo (agrega el **plan de eliminación** exigido por skill §18.3):

```sql
CREATE TABLE feature_flag (
  id            uuid PRIMARY KEY,
  key           text NOT NULL UNIQUE,          -- "checkout.v2", "ai.beta", "suppliers.newImporter"
  enabled       boolean NOT NULL DEFAULT false,
  owner         text NOT NULL,                 -- responsable (email/handle admin)
  review_at     date,                          -- fecha de revisión comprometida
  removal_plan  text,                          -- qué pasa cuando se limpie el flag
  description   text NOT NULL,
  updated_by    uuid REFERENCES admin_user(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

- Todo flag **debe** tener `owner`, `description` y `review_at`; `removal_plan` es obligatorio para
  flags de tipo "temporal/experimento" (§4 ToggleFeatureFlag, §6 invariantes).

### 2.3 `admin_user` + `permission_grant` + `access_log` (schema/identity.ts)

Reusadas para la gestión de staff. Canon [04](../04-modelo-de-datos.md) / [07](../07-auth-identidad.md):

```
admin_user       id, email(unique, lower), password_hash(argon2), full_name,
                 role(AdminRole), is_active, mfa_enabled, mfa_secret_enc,
                 last_login_at, created_at, updated_at
permission_grant id, role(AdminRole), resource, action        # matriz RBAC versionada
access_log       id, actor_id, resource_type, resource_id, action, reason, ip, user_agent, created_at
```

Para invitaciones se agrega una tabla de soporte (ilustrativa; convive con el flujo de
recuperación/alta de [07](../07-auth-identidad.md)):

```sql
CREATE TABLE admin_invitation (
  id          uuid PRIMARY KEY,
  email       text NOT NULL,                   -- lower, normalizado
  role        text NOT NULL,                   -- AdminRole propuesto (no OWNER)
  token_hash  text NOT NULL,                   -- token de un solo uso, hasheado (nunca en claro)
  invited_by  uuid NOT NULL REFERENCES admin_user(id),
  status      text NOT NULL DEFAULT 'pending', -- pending | accepted | revoked | expired
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_admin_invitation_pending
  ON admin_invitation(email) WHERE status = 'pending';
```

> `admin_user` **no** es `customer`. Los compradores del store son `customer` (dominio customers).
> Aquí solo gestionamos **staff** del panel.

### 2.4 Enums relevantes ([04](../04-modelo-de-datos.md))

```ts
export enum AdminRole      { OWNER, ADMIN, CATALOG_MANAGER, SUPPORT, FINANCE }
export enum ShippingMethod { STANDARD, EXPRESS, PICKUP }   // ← store constants.ts
export type Currency = 'ARS' | 'USD';                      // moneda base del negocio: ARS
```

---

## 3. Taxonomía de configuración

Toda pieza de configuración cae en **exactamente una** de tres categorías. Confundirlas es un bug de
seguridad o de operación.

| Categoría | Dónde vive | Editable en runtime | Validación | Ejemplo |
|---|---|---|---|---|
| **Setting de negocio** | tabla `setting` (jsonb) | Sí, desde el panel (OWNER/ADMIN) | Zod por clave + auditoría | nombre de tienda, opciones de envío, método de pago habilitado |
| **Env var** | proceso / secret manager (no-secreto) | No — requiere redeploy/restart | Validada al **boot** (falla si falta crítica) | `DATABASE_URL`, `REDIS_URL`, `CORS_ALLOWED_ORIGINS`, `NODE_ENV` |
| **Secret** | **secret manager** (referenciado por handle) | Rotación fuera de banda | Presencia validada al boot; nunca loggeado | `STRIPE_SECRET_KEY`, `MP_ACCESS_TOKEN`, `STRIPE_WEBHOOK_SECRET`, `BETTER_AUTH_SECRET` |

Reglas duras (skill §18, §9.9; [08 §Secrets](../08-seguridad.md#secrets)):

- Un **secret nunca** se escribe en `setting.value` en claro. Si un método de pago necesita credenciales,
  `setting` guarda **solo el handle/referencia** (`{ "credentialsRef": "sm://payments/stripe" }`), y el
  valor real se resuelve contra el secret manager en el borde de infra.
- Una **env var de infra** no se expone como setting editable. Si el dueño necesita cambiar
  `CORS_ALLOWED_ORIGINS`, es un cambio de deploy, no un click en el panel.
- `DEBUG=true` está **prohibido en producción** (skill §18.2). El boot lo rechaza.

### 3.1 Tabla de claves ejemplo (`setting`)

| Clave (`key`) | `scope` | Forma del `value` (jsonb) | Editable por |
|---|---|---|---|
| `store.identity` | public | `{ name, legalName, cuit?, logoAssetId? }` | OWNER/ADMIN |
| `store.currency` | public | `{ base: "ARS", display: "es-AR", rounding: "nearest_100" }` | OWNER |
| `store.billing` | business | `{ legalName, cuit, ivaCondition, fiscalAddress, salesPoint? }` | OWNER |
| `store.legal.terms` | public | `{ markdown, version, updatedAt }` | OWNER/ADMIN |
| `store.legal.privacy` | public | `{ markdown, version, updatedAt }` | OWNER/ADMIN |
| `store.social` | public | `{ instagram?, facebook?, whatsapp?, tiktok?, x? }` | OWNER/ADMIN |
| `shipping.options` | public | `ShippingOption[]` (ver §3.3) | OWNER/ADMIN |
| `shipping.coverage` | public | `{ provinces: string[], cities: string[] }` (AR) | OWNER/ADMIN |
| `payments.methods` | business | `PaymentMethodConfig[]` (ver §3.4) | OWNER/ADMIN |
| `checkout.policy` | business | `{ minOrderAmountMinor?, allowGuest: bool }` | OWNER/ADMIN |

> `store.currency.base` es la **moneda base canónica `ARS`** ([04](../04-modelo-de-datos.md)). No se
> considera un toggle casual: cambiarla tiene implicancias en todo `*_amount_minor`. Es OWNER-only y
> requiere reauth (§8).

### 3.2 Registro de schemas por clave (ilustrativo)

Cada clave tiene un Zod schema en `packages/validators` que valida el `value` **antes** de persistir.
El caso de uso `UpdateSetting` rechaza claves desconocidas y valores que no matchean.

```ts
// packages/validators/settings.ts (ilustrativo)
export const SETTING_SCHEMAS = {
  'store.identity': z.object({
    name: z.string().trim().min(1).max(80),
    legalName: z.string().trim().max(160).optional(),
    cuit: z.string().regex(/^\d{2}-\d{8}-\d$/).optional(),
    logoAssetId: z.string().uuid().optional(),
  }),
  'store.currency': z.object({
    base: z.literal('ARS'),
    display: z.string(),
    rounding: z.enum(['none', 'nearest_100', 'nearest_1000']),
  }),
  'shipping.options': z.array(ShippingOptionSchema).min(1),
  'payments.methods': z.array(PaymentMethodConfigSchema).min(1),
  // ...una entrada por clave; claves fuera del registro → RESOURCE_NOT_FOUND
} as const;

export type SettingKey = keyof typeof SETTING_SCHEMAS;
```

### 3.3 `ShippingOption` — del front al backend

Hoy en `apps/store/src/lib/constants.ts` (hardcodeado). Canon del backend (el front pasa a leerlo de config):

```ts
// front actual (a reemplazar por config):
//   SHIPPING_OPTIONS: { id, label, detail, cost }[]
//   DEFAULT_SHIPPING_ID = "standard"
//   ARGENTINA_CITIES: string[];  DEFAULT_CITY = "Buenos Aires, AR"

// canon backend (value de setting `shipping.options`)
export const ShippingOptionSchema = z.object({
  id: z.string().min(1),                       // slug estable: "standard" | "express" | "pickup"
  method: z.nativeEnum(ShippingMethod),        // STANDARD | EXPRESS | PICKUP (enum canónico)
  label: z.string().trim().min(1).max(60),     // "Envío estándar"
  detail: z.string().trim().max(120),          // "Llega en 3 a 5 días hábiles"
  costAmountMinor: z.number().int().min(0),    // ⚠ dinero en centavos, no float (canon 04)
  currency: z.literal('ARS'),
  isActive: z.boolean().default(true),
  position: z.number().int().min(0),
});
```

- **Reconciliación de dinero**: el front usa `cost: 24900` (número plano). El canon exige
  `costAmountMinor` entero en unidad menor + `currency` ([04](../04-modelo-de-datos.md) ADR-007). El
  presenter público puede formatear a `$249,00`.
- **`DEFAULT_SHIPPING_ID`** se modela como `shipping.options` con una marca `isDefault` (o convención:
  primer `isActive` por `position`). Debe existir **exactamente uno** por defecto (§6).
- **Ciudades/provincias AR** (`ARGENTINA_CITIES`, `DEFAULT_CITY`) pasan a `shipping.coverage`. Se validan
  contra un catálogo cerrado de provincias argentinas; las ciudades son texto normalizado.

### 3.4 `PaymentMethodConfig` — habilitados y su configuración

Del front (`purchase-panel.tsx`, `PAYMENT_LOGOS`): VISA, MC, AMEX, MP (MercadoPago), MODO, EFECTIVO.

```ts
export enum PaymentMethodId { VISA, MASTERCARD, AMEX, MERCADOPAGO, MODO, EFECTIVO }

export const PaymentMethodConfigSchema = z.object({
  id: z.nativeEnum(PaymentMethodId),
  label: z.string().trim().min(1).max(40),      // "Visa", "MercadoPago", "Efectivo"
  provider: z.enum(['stripe', 'mercadopago', 'modo', 'offline']),
  isEnabled: z.boolean(),
  position: z.number().int().min(0),
  // ⚠ SIN credenciales en claro. Solo referencia al secret manager:
  credentialsRef: z.string().startsWith('sm://').optional(),  // p.ej. "sm://payments/stripe"
  // metadata pública no sensible:
  surchargePct: z.number().min(0).max(100).optional(),        // recargo, si aplica
  installmentsMax: z.number().int().min(1).max(24).optional(),// cuotas
});
```

Mapeo provider → secreto (resuelto en infra, **nunca** en `setting`):

| Método | Provider | Secreto (secret manager) |
|---|---|---|
| VISA / MC / AMEX | `stripe` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |
| MercadoPago | `mercadopago` | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` |
| MODO | `modo` | `MODO_API_KEY` |
| EFECTIVO | `offline` | — (sin credenciales; cobro fuera de línea) |

- Habilitar un método cuyo `provider` requiere secreto **valida que el secreto exista** en el ambiente
  (health check al secret manager) antes de permitir `isEnabled=true` (§4 TogglePaymentMethod, §8).

---

## 4. Casos de uso

Todos reciben un `Actor` tipado ([07](../07-auth-identidad.md) §Contexto de auth) y validan permiso en
**application/domain**, no solo en el middleware. Notación: **actor** = rol mínimo; **auditoría** = qué
se registra.

### 4.1 `GetSettings` (query)

- **Actor / permiso**: OWNER/ADMIN para claves `business`; el **store público** puede leer solo claves
  `scope='public'` vía un presenter reducido (`publicProcedure`).
- **Input**: `{ keys?: SettingKey[] }` (whitelist; sin keys → todas las permitidas para el actor).
- **Validación**: claves fuera del registro → ignoradas/`RESOURCE_NOT_FOUND`. El presenter público
  **jamás** incluye claves `business` ni `credentialsRef`.
- **Auditoría**: lectura no se audita salvo claves sensibles (billing) por rol restringido.

### 4.2 `UpdateSetting` (mutation)

- **Actor / permiso**: OWNER/ADMIN (`Cambiar configuración de tienda`, matriz [07](../07-auth-identidad.md)).
  `store.currency` y `store.billing` → **OWNER-only + reauth reciente**.
- **Input**: `{ key: SettingKey, value: jsonb }`.
- **Validación**: `value` parseado por `SETTING_SCHEMAS[key]` (rechazo si no matchea). Normalización
  (trim, lower en emails/URLs, dinero a `*_amount_minor`). Mass-assignment prohibido: solo el `value`
  tipado entra.
- **Auditoría**: `audit_log` con `before`/`after` (jsonb), `actor_id`, `reason?`. `setting.updated_by` +
  `updated_at`. Emite evento `SettingChanged` (outbox) → invalida cache pública.

### 4.3 `ListShippingOptions` (query)

- **Actor / permiso**: público (solo `isActive`, presenter reducido) o OWNER/ADMIN (todas, con `position`).
- **Validación**: ninguna de entrada más allá de filtros whitelisted.
- **Auditoría**: no.

### 4.4 `UpsertShippingOption` (mutation)

- **Actor / permiso**: OWNER/ADMIN.
- **Input**: `ShippingOption` (§3.3). Alta o edición por `id`.
- **Validación**: `costAmountMinor` entero ≥ 0 + `currency='ARS'`; `method` ∈ enum; `id` slug único;
  invariante **exactamente un default activo** (§6). No permite dejar `shipping.options` vacío.
- **Auditoría**: `audit_log` before/after; evento `SettingChanged(shipping.options)`.

### 4.5 `ListPaymentMethods` (query)

- **Actor / permiso**: público (solo `isEnabled`, label, position — para pintar logos del checkout) o
  OWNER/ADMIN (config completa **sin** resolver secretos).
- **Validación**: el presenter público **nunca** expone `credentialsRef`, `surchargePct` interno si es
  sensible, ni provider keys.
- **Auditoría**: no.

### 4.6 `TogglePaymentMethod` (mutation)

- **Actor / permiso**: OWNER/ADMIN.
- **Input**: `{ id: PaymentMethodId, isEnabled: boolean }`.
- **Validación**: al **habilitar** un método con `provider` que requiere secreto, verificar
  **presencia del secreto** en el ambiente (probe al secret manager). Si falta → `CONFIG_SECRET_MISSING`
  (422), no se habilita. Invariante: al menos **un método habilitado** debe quedar (§6).
- **Auditoría**: `audit_log` before/after; evento `SettingChanged(payments.methods)`.

### 4.7 `ListAdminUsers` (query)

- **Actor / permiso**: OWNER/ADMIN (`Gestionar usuarios admin`, matriz [07](../07-auth-identidad.md)).
- **Input**: filtros whitelisted (`role?`, `isActive?`, `search?`), cursor pagination (default 20/máx 50).
- **Validación**: presenter **nunca** expone `password_hash`, `mfa_secret_enc`, `mfa_enabled` en detalle
  fino sin permiso.
- **Auditoría**: acceso a listado no se audita; ver detalle de un usuario sensible sí (motivo).

### 4.8 `InviteAdminUser` (mutation)

- **Actor / permiso**: OWNER/ADMIN. Un ADMIN **no** puede invitar a rol OWNER (§6).
- **Input**: `{ email, fullName, role }` (`role` ≠ OWNER para invitador ADMIN).
- **Validación**: email normalizado (lower/trim) y único (no colisiona con `admin_user` activo ni
  invitación `pending`). Genera token de un solo uso **hasheado** (`admin_invitation.token_hash`),
  expiración corta. No revela si el email ya existía (respuesta uniforme). Rate limit por IP+email.
- **Auditoría**: `audit_log` (action `admin.invite`, `after={email, role}`); evento `AdminUserInvited`
  (outbox) → email de invitación vía React Email/Resend. Nunca loggea el token.

### 4.9 `SetUserRole` (mutation)

- **Actor / permiso**: OWNER/ADMIN. Solo **OWNER** puede otorgar/quitar rol OWNER (transferencia de
  propiedad). ADMIN no puede auto-escalar a OWNER.
- **Input**: `{ userId, role }`.
- **Validación**: no permitir dejar la tienda **sin ningún OWNER** (§6). No permite que un actor cambie
  su **propio** rol para escalar. Cambio de rol = acción crítica → puede exigir reauth.
- **Auditoría**: `audit_log` before/after (`role` viejo → nuevo), `reason?`; evento `AdminRoleChanged`.
  Idealmente invalida sesiones activas del usuario afectado para recomputar permisos.

### 4.10 `DeactivateUser` (mutation)

- **Actor / permiso**: OWNER/ADMIN. No puede desactivar al **último OWNER** ni a **sí mismo** si es el
  único OWNER.
- **Input**: `{ userId, reason? }`.
- **Validación**: setea `admin_user.is_active=false`. Invariante "siempre existe un OWNER" (§6). No borra
  físicamente (auditoría/histórico). Revoca todas las sesiones del usuario ([07](../07-auth-identidad.md)
  `logoutAll` implícito).
- **Auditoría**: `audit_log` (action `admin.deactivate`, `reason`); evento `AdminUserDeactivated`.
- **Reactivación**: `ActivateUser` simétrico (mismo permiso, sin la invariante del último OWNER).

### 4.11 `ListFeatureFlags` (query)

- **Actor / permiso**: OWNER/ADMIN. (Lectura del **estado efectivo** de un flag para el runtime la hace
  un servicio interno, no este endpoint.)
- **Input**: filtros whitelisted (`enabled?`, `owner?`).
- **Validación**: presenter incluye `owner`, `review_at`, `removal_plan` (gobernanza visible).
- **Auditoría**: no.

### 4.12 `ToggleFeatureFlag` (mutation)

- **Actor / permiso**: OWNER/ADMIN.
- **Input**: `{ key, enabled }` (o `UpsertFeatureFlag` con metadata completa al crear).
- **Validación**: al **crear** un flag, `owner`, `description` y `review_at` son obligatorios;
  `removal_plan` obligatorio para flags temporales. Usos previstos (skill §18.3): `checkout.v2`,
  `ai.beta`, `suppliers.newImporter`, `promos.experimental`.
- **Auditoría**: `audit_log` before/after; evento `FeatureFlagChanged`. Cambiar un flag de negocio
  crítico (nuevo checkout) puede exigir reauth.

---

## 5. Endpoints tRPC `settings.*`

Router `settings` bajo `appRouter` ([05](../05-convenciones-api.md) §Convención tRPC). **Todo** es
`adminProcedure` (OWNER/ADMIN) salvo los lectores públicos explícitos que sirven al store. `input`
siempre Zod de `packages/validators`.

```txt
# Store / tienda
settings.getStore()                      query   public(reduce) / adminProcedure
settings.updateStore(key, value)         mutation adminProcedure   [OWNER/ADMIN]

# Envíos
settings.listShippingOptions()           query   public(reduce) / adminProcedure
settings.upsertShippingOption(input)     mutation adminProcedure   [OWNER/ADMIN]
settings.deleteShippingOption(id)        mutation adminProcedure   [OWNER/ADMIN]  (no dejar lista vacía)

# Pagos
settings.listPaymentMethods()            query   public(reduce) / adminProcedure
settings.togglePaymentMethod(id,enabled) mutation adminProcedure   [OWNER/ADMIN]
settings.updatePaymentMethod(input)      mutation adminProcedure   [OWNER/ADMIN]  (sin secretos en payload)

# Usuarios admin (CRUD de staff; auth fino en identity.*)
settings.listAdminUsers(filters)         query   adminProcedure    [OWNER/ADMIN]
settings.inviteAdminUser(input)          mutation adminProcedure   [OWNER/ADMIN]
settings.setUserRole(userId, role)       mutation adminProcedure   [OWNER/ADMIN] (OWNER-only para rol OWNER)
settings.deactivateUser(userId, reason?) mutation adminProcedure   [OWNER/ADMIN]
settings.activateUser(userId)            mutation adminProcedure   [OWNER/ADMIN]

# Feature flags
settings.listFeatureFlags(filters)       query   adminProcedure    [OWNER/ADMIN]
settings.toggleFeatureFlag(key, enabled) mutation adminProcedure   [OWNER/ADMIN]
settings.upsertFeatureFlag(input)        mutation adminProcedure   [OWNER/ADMIN]
```

Notas de contrato:

- Los lectores "`public(reduce)`" son el mismo caso de uso con **presenter reducido**: para
  `publicProcedure` devuelven solo campos `scope='public'` / `isActive` / `isEnabled`, nunca config interna.
- Las mutations críticas (`updateStore` con `store.currency`, `setUserRole` a OWNER, `toggleFeatureFlag`
  de checkout) exigen **reauth reciente** ([07](../07-auth-identidad.md) §MFA / reauth).
- Convención de nombres: `get*/list*` = query, `update*/upsert*/toggle*/invite*/deactivate*` = mutation
  ([05](../05-convenciones-api.md)).
- El CRUD de staff aquí (`settings.inviteAdminUser`, `setUserRole`, `deactivateUser`) es la **cara panel**
  de las operaciones que [07](../07-auth-identidad.md) expone como `identity.admin.*`. Ambos invocan el
  mismo caso de uso de `application/`; no hay lógica duplicada.

REST/OpenAPI: no se requiere superficie REST pública para configuración (es panel interno vía tRPC). Si
se necesitara (partner/terceros), iría bajo `/api/v1/settings/*` con auth admin, nunca anónima.

---

## 6. Reglas e invariantes

```txt
INV-1  Un secreto (Stripe/MP/MODO key, webhook secret, auth secret) NUNCA se persiste en `setting.value`
       en claro. `setting` solo guarda `credentialsRef` (handle sm://...). → [08 §Secrets].
INV-2  Siempre existe al menos UN admin_user con rol OWNER activo. Ninguna operación
       (SetUserRole, DeactivateUser) puede violar esto. Se valida en el caso de uso, con lock.
INV-3  Solo un OWNER puede otorgar o revocar el rol OWNER (transferencia de propiedad). Un ADMIN no
       puede crear/promover OWNER ni auto-escalar.
INV-4  `shipping.options` nunca queda vacío y tiene EXACTAMENTE un default activo.
INV-5  `payments.methods` mantiene al menos un método habilitado; habilitar un método con provider que
       requiere secreto exige que el secreto EXISTA en el ambiente (probe), si no → CONFIG_SECRET_MISSING.
INV-6  Todo `feature_flag` tiene owner, description y review_at; los temporales, además removal_plan.
INV-7  `store.currency.base = 'ARS'` es la moneda base canónica; cambiarla es OWNER-only + reauth y no
       reescribe montos históricos (los `*_amount_minor` existentes conservan su `currency`).
INV-8  Env vars de infraestructura NO son settings editables en runtime; se validan al boot (falla si
       falta una crítica). DEBUG=true prohibido en producción.
INV-9  Todo cambio de configuración (setting, flag, rol, método de pago) queda auditado en audit_log.
INV-10 Claves de setting fuera de SETTING_SCHEMAS no se aceptan (ni leen ni escriben).
```

---

## 7. Permisos (matriz [07](../07-auth-identidad.md))

Extracto aplicable a este módulo (versionado en `permission_grant`). CATALOG_MANAGER, FINANCE y SUPPORT
**no** administran configuración.

| Acción | OWNER | ADMIN | CATALOG_MANAGER | FINANCE | SUPPORT |
|---|:--:|:--:|:--:|:--:|:--:|
| Ver configuración de tienda | ✔ | ✔ | ✖ | ✖ | ✖ |
| Cambiar configuración de tienda (`updateStore`) | ✔ | ✔ | ✖ | ✖ | ✖ |
| Cambiar moneda base / billing | ✔ (reauth) | ✖ | ✖ | ✖ | ✖ |
| Gestionar opciones de envío | ✔ | ✔ | ✖ | ✖ | ✖ |
| Gestionar métodos de pago | ✔ | ✔ | ✖ | ✖ | ✖ |
| Gestionar usuarios admin (invitar/rol/baja) | ✔ | ✔ | ✖ | ✖ | ✖ |
| Otorgar/revocar rol OWNER | ✔ | ✖ | ✖ | ✖ | ✖ |
| Gestionar feature flags | ✔ | ✔ | ✖ | ✖ | ✖ |
| Leer settings públicos (store) | público (presenter reducido) | | | | |

La autorización crítica (p. ej. "este ADMIN no puede promover OWNER") vive en el caso de uso, no solo en
`adminProcedure` ([05](../05-convenciones-api.md) §Convención tRPC, [07](../07-auth-identidad.md)).

---

## 8. Validaciones

Cuatro capas (skill §6.1, [06 Validaciones](../06-validaciones.md)):

- **Transporte**: cada endpoint valida body/params/query con Zod de `packages/validators`. `UpdateSetting`
  usa `SETTING_SCHEMAS[key]`; claves desconocidas → `RESOURCE_NOT_FOUND`.
- **Aplicación**: permiso del actor (matriz §7), existencia del recurso, reauth para acciones críticas
  (moneda base, rol OWNER, toggle de checkout). Rate limit en `inviteAdminUser` (IP+email).
- **Dominio**: invariantes §6 (último OWNER, un default de envío, un método de pago habilitado, secreto
  presente antes de habilitar).
- **Persistencia**: `UNIQUE(setting.key)`, `UNIQUE(feature_flag.key)`, `UNIQUE(admin_user.email)`, índice
  parcial de invitación `pending`, FK `updated_by → admin_user`.

Normalización antes de persistir: `trim` de strings, `lower` de emails y URLs de redes, dinero a
`*_amount_minor` entero, slugify de `shipping.option.id`, escape de markdown legal si se renderiza.

Salida: presenters tipados. **Nunca** exponen `credentialsRef`, `password_hash`, `mfa_secret_enc`,
`token_hash`, ni claves `business` a `publicProcedure` (skill §6.3 anti-fuga de campos internos).

Errores ([05](../05-convenciones-api.md) §Catálogo de códigos):

| Situación | code | HTTP |
|---|---|---|
| Value no matchea schema de la clave | `VALIDATION_FAILED` | 400 |
| Clave/usuario/flag inexistente | `RESOURCE_NOT_FOUND` | 404 |
| Rol insuficiente | `FORBIDDEN` | 403 |
| Violación de invariante (último OWNER, lista vacía) | `CONFLICT` | 409 |
| Habilitar pago sin secreto en el ambiente | `CONFIG_SECRET_MISSING` (mapeable a 422) | 422 |
| Email de invitación ya en uso | respuesta uniforme (no revela) / `CONFLICT` interno | 409 |

---

## 9. Auditoría de cambios de configuración

Toda mutation de este módulo escribe `audit_log` ([04](../04-modelo-de-datos.md) `schema/shared.ts`):

```
audit_log   id, actor_id, actor_type, action, resource_type, resource_id,
            before(jsonb), after(jsonb), ip, user_agent, request_id, reason?, created_at
```

- **`resource_type`**: `setting` | `feature_flag` | `admin_user` | `shipping_option` | `payment_method`.
- **`before`/`after`**: diff del `value` jsonb (settings/flags) o de los campos del `admin_user`
  (role/is_active). **Nunca** se auditan secretos, `token_hash`, `password_hash` ni `mfa_secret_enc`
  (skill §11.8 "no auditar tokens/PII innecesaria").
- **`reason`**: obligatorio en `DeactivateUser` y recomendable en `SetUserRole`.
- Cambios de rol / accesos de staff a datos sensibles también dejan traza en `access_log`
  ([07](../07-auth-identidad.md) §Motivos de acceso).
- Cada mutation emite un **evento de dominio** vía **outbox** ([04](../04-modelo-de-datos.md) `outbox`):
  `SettingChanged`, `FeatureFlagChanged`, `AdminUserInvited`, `AdminRoleChanged`, `AdminUserDeactivated`
  → invalidan cache de configuración pública y disparan emails de invitación.

Cache: la configuración pública (`scope='public'`) es candidata a cache ([skill §17.5 "configuración
pública"]); se invalida por `SettingChanged`. La configuración de negocio y los flags **no** se cachean
de forma agresiva por-request para reflejar cambios rápido.

---

## 10. Casos borde

```txt
- Último OWNER: intentar cambiar su rol o desactivarlo → CONFLICT (INV-2). Requiere designar otro OWNER
  primero (transferencia de propiedad, solo por OWNER).
- ADMIN intenta promover a alguien (o a sí mismo) a OWNER → FORBIDDEN (INV-3).
- Habilitar MercadoPago sin MP_ACCESS_TOKEN en el ambiente → CONFIG_SECRET_MISSING; el método queda
  deshabilitado y se sugiere configurar el secreto (fuera del panel).
- Deshabilitar el único método de pago habilitado → CONFLICT (INV-5). El checkout quedaría sin pagos.
- Borrar la última opción de envío o quitar el default → CONFLICT (INV-4).
- Cambiar store.currency.base a algo ≠ ARS → rechazo por schema (`z.literal('ARS')`); aun con override,
  es OWNER + reauth y no reescribe montos históricos (INV-7).
- Invitación duplicada al mismo email con una pendiente → índice parcial la bloquea; respuesta uniforme
  (no revela si el email existe).
- Token de invitación expirado o reusado → inválido; alta no procede; se registra evento.
- Escritura concurrente sobre `shipping.options` / `payments.methods` (dos admins) → se resuelve con
  lock optimista sobre `setting.updated_at` (o SELECT ... FOR UPDATE); el segundo write revalida invariantes.
- Alguien intenta guardar una key de setting con secreto embebido en el value (p. ej. pega una API key en
  un campo de texto) → el schema de esa clave no admite el campo; además un guard rechaza patrones de
  secreto conocidos (INV-1). El secreto va al secret manager, no a la DB.
- Clave de setting desconocida (`store.foo`) → RESOURCE_NOT_FOUND (INV-10), no se crea jsonb libre.
- Flag temporal sin removal_plan → VALIDATION_FAILED al crear (INV-6).
- Desactivar un usuario con sesiones activas → se revocan sus sesiones (recompute de permisos inmediato).
- Front del store leyendo config mientras el backend aún no expone `settings.*` → fallback a los defaults
  de constants.ts (period de transición); una vez migrado, constants.ts deja de ser fuente de verdad.
```

---

## 11. Definition of Done

```txt
[ ] Casos de uso en application/domain (no en controllers): GetSettings, UpdateSetting,
    List/UpsertShippingOption, List/TogglePaymentMethod, ListAdminUsers, InviteAdminUser, SetUserRole,
    Deactivate/ActivateUser, ListFeatureFlags, ToggleFeatureFlag.
[ ] SETTING_SCHEMAS (Zod por clave) en packages/validators; claves fuera del registro rechazadas.
[ ] ShippingOption y PaymentMethodConfig con dinero en *_amount_minor + currency='ARS' (reconciliado
    contra constants.ts del store).
[ ] Ningún secreto en setting.value en claro; solo credentialsRef → secret manager ([08 §Secrets]).
[ ] Invariantes en dominio con tests: último OWNER (INV-2/3), default de envío (INV-4), método de pago
    habilitado + secreto presente (INV-5), currency ARS (INV-7).
[ ] Endpoints tRPC settings.* como adminProcedure (OWNER/ADMIN); lectores públicos con presenter reducido
    (sin campos business/credenciales).
[ ] Matriz de permisos §7 reflejada en permission_grant y testeada (autorización negativa: CATALOG_MANAGER/
    FINANCE/SUPPORT no pueden tocar config; ADMIN no puede crear OWNER).
[ ] Reauth exigida en acciones críticas (moneda base, rol OWNER, toggle checkout).
[ ] Auditoría: audit_log before/after + eventos outbox (SettingChanged, FeatureFlagChanged,
    AdminUserInvited, AdminRoleChanged, AdminUserDeactivated); nunca loggea secretos/tokens/PII.
[ ] feature_flag con owner/description/review_at obligatorios (+ removal_plan en temporales).
[ ] Env vars críticas validadas al boot; DEBUG=true rechazado en producción.
[ ] Presenters no filtran password_hash, mfa_secret_enc, token_hash, credentialsRef.
[ ] OpenAPI/tipos tRPC actualizados; migraciones corren desde cero; smoke test en staging.
```
