# 02 · Arquitectura

## Estilo: Modular Monolith + DDD + CQRS

El backend comienza como un **monolito modular** bien separado. Un solo proceso desplegable, con
límites internos fuertes por dominio. Esto da transacciones simples, deploy fácil, baja latencia interna
y reglas de negocio consistentes. No se empieza con microservicios.

El código se divide **por dominio**, no por capa técnica global. Cada dominio implementa **CQRS**:
comandos (mutan estado) y queries (leen) viven en archivos separados.

## Estructura de carpetas (`apps/api/src`)

Se respeta el esqueleto ya carveado en el repo (`domains/`, `interfaces/`, `infrastructure/`, `shared/`)
y se le aplican los principios de la skill.

```
apps/api/src/
├─ app/
│  ├─ bootstrap.ts        # arma el container, registra plugins Fastify
│  ├─ server.ts           # instancia Fastify, timeouts, health, shutdown
│  ├─ config.ts           # validación de env (zod-env) al boot
│  ├─ container.ts        # composición de dependencias (DI manual)
│  └─ shutdown.ts         # graceful shutdown (SIGTERM)
├─ shared/
│  ├─ domain/             # Money, Result, Id, base entity, base error
│  ├─ events/             # event-bus.ts (in-process), outbox
│  ├─ errors/             # AppError, mapeo a HTTP, catálogo de códigos
│  ├─ guards/             # auth, rbac, ownership, rate-limit helpers
│  ├─ http/               # envelope, presenter base, requestId, error handler
│  ├─ observability/      # logger (pino), tracing (otel), métricas
│  └─ utils/              # slugify, money, pagination cursor, etc.
├─ domains/               # bounded contexts (ver §Bounded contexts)
│  ├─ identity/           # auth, sesiones, roles, permisos, usuarios admin
│  ├─ catalog/            # product, category, media
│  ├─ inventory/          # stock, reservas
│  ├─ pricing/            # precios, markup, descuentos
│  ├─ customers/          # customer, address, customer-analytics
│  ├─ orders/             # order, cart, checkout, fulfillment, shipping
│  ├─ finance/            # documentos comerciales, reportes financieros
│  ├─ suppliers/          # supplier, feed (dropshipping)
│  ├─ ai-gateway/         # puerto al servicio Python de IA
│  ├─ dashboard/          # read models / proyecciones para el panel
│  └─ audit/              # bitácora de operaciones críticas
├─ infrastructure/
│  ├─ database/           # cliente Drizzle, unit-of-work, tx helpers
│  ├─ cache/              # ioredis, cache-aside helpers
│  ├─ storage/            # adapter de archivos (local dev / S3 prod)
│  ├─ queue/              # productores BullMQ (los consumers viven en apps/workers)
│  ├─ email/              # cliente Resend
│  └─ observability/      # exporters otel
├─ interfaces/
│  ├─ trpc/               # context, router raíz, middlewares, routers por dominio
│  ├─ http/               # rutas REST (público store, webhooks), middleware
│  └─ webhooks/           # stripe/, suppliers/ (verificación de firma + idempotencia)
└─ index.ts               # entrypoint → app/bootstrap
```

### Estructura interna de cada dominio

Consistente en todos. Ejemplo `domains/catalog/`:

```
domains/catalog/
├─ domain/
│  ├─ entities/           # Product, ProductVariant, Category, MediaAsset
│  ├─ value-objects/      # Slug, Sku, ImageRef, SpecGroup
│  ├─ events/             # ProductPublished, PriceChanged...
│  ├─ policies/           # CanPublishProductPolicy
│  └─ errors.ts           # ProductNotPublishable, ...
├─ application/
│  ├─ commands/           # CreateProduct, PublishProduct, ...  (un caso de uso por archivo)
│  ├─ queries/            # GetProductDetail, SearchProducts, ...
│  ├─ services/           # orquestación reutilizable entre casos de uso
│  ├─ ports/              # interfaces: ProductRepository, MediaStoragePort, AiGatewayPort
│  └─ dto/                # CreateProductInput, ProductSummaryResponse
├─ infra/
│  ├─ repositories/       # DrizzleProductRepository (implementa el port)
│  ├─ mappers/            # row ↔ entidad de dominio
│  └─ integrations/       # adaptadores a servicios externos del dominio
├─ interfaces/
│  ├─ trpc.ts             # router tRPC del dominio
│  ├─ http.ts             # rutas REST del dominio (si aplica)
│  ├─ schemas.ts          # re-export de packages/validators + schemas locales
│  └─ presenters.ts       # entidad → response tipada (oculta campos internos)
└─ tests/
   ├─ unit/  integration/ contract/
```

## Las cuatro capas

```
http/trpc  →  application  →  domain
    infra   →  application/domain (implementa ports)
    shared  →  usado por todos
```

- **domain** — Lo que no puede romperse. Entidades, value objects, invariantes, policies, eventos.
  **No sabe** que existe HTTP, Fastify, Redis, Drizzle, JSON, cookies ni JWT. Sabe de productos,
  clientes, stock, precios, pedidos, remitos, envíos y reglas.
- **application** — Orquesta casos de uso. Sin lógica de transporte. Cada caso de uso declara:
  `actor`, `input validado`, `permisos`, `transacción requerida`, `entidades afectadas`,
  `eventos emitidos`, `salida tipada`, `errores esperados`.
- **infra** — Detalles técnicos (DB, Redis, storage, terceros, colas, email). **Nunca** filtra sus
  tipos hacia el dominio (los tipos de Drizzle no contaminan entidades).
- **interfaces (http/trpc)** — Rutas, schemas, OpenAPI, parsing, presentación, headers, status codes.
  Sin lógica de negocio compleja. Un handler con >25–40 líneas reales probablemente está mal ubicado.

## Reglas de dependencia (obligatorias)

```
interfaces → application → domain
infra      → application/domain (vía ports)
shared     → cualquiera
```

- Un dominio **no** importa `interfaces` de otro dominio.
- Un dominio **no** accede directo a tablas de otro dominio; solo vía **read models autorizados** o
  eventos. (Ej.: `finance` lee ventas por read model de `orders`, no hace JOIN a `orders.*`.)
- El **domain** no importa nada de `infra`, `interfaces`, ni librerías de transporte.
- Regla crítica: **la autorización de negocio vive en application/domain**, no solo en middleware.

## Comunicación entre módulos

1. **Ports + inyección** — un dominio consume otro por una interfaz declarada en su capa `application/ports`,
   resuelta en `container.ts`. Se prefiere para lecturas sincrónicas simples.
2. **Eventos de dominio** — para efectos secundarios desacoplados (`OrderConfirmed` → `finance` genera
   documento, `inventory` confirma stock, `email` envía confirmación).
3. **Read models** — para vistas cross-dominio (dashboard, finanzas) que agregan datos de varios módulos.

### Event bus y Outbox

- `shared/events/event-bus.ts`: despacho **in-process, síncrono** por ahora. Interfaz estable para migrar
  a Redis pub/sub cuando haya multi-instancia.
- Para efectos que cruzan el límite transaccional (email, indexación, IA, reenvío a proveedor) se usa el
  **patrón Outbox**: dentro de la transacción se escribe el evento en tabla `outbox`; un worker lo lee y
  publica con reintentos. Ver [32-jobs](./32-jobs-y-async.md) y [04-modelo-de-datos](./04-modelo-de-datos.md).

## Bounded contexts

| Dominio | Responsabilidad | Doc |
|---------|-----------------|-----|
| **identity** | Auth, sesiones, refresh rotation, roles, permisos, usuarios admin, MFA opcional, auditoría de acceso | [07](./07-auth-identidad.md) |
| **customers** | Perfil, direcciones, consentimientos, favoritos, historial, analytics del cliente | [11](./modulos/11-modulo-clientes.md) |
| **catalog** | Categorías, subcategorías, productos, variantes, atributos, media, specs, slugs, publicación | [10](./modulos/10-modulo-catalogo.md) |
| **inventory** | Stock disponible/reservado/comprometido, reservas con TTL, movimientos auditables | [13](./modulos/13-modulo-inventario.md) |
| **pricing** | Precios, listas, markup dropshipping, descuentos, vigencias, auditoría | [14](./modulos/14-modulo-pricing.md) |
| **orders** | Carrito, checkout idempotente, pedidos, estados, fulfillment, envíos, tracking | [15](./modulos/15-modulo-ordenes.md) |
| **finance** | Documentos (remito/factura/NC), ingresos, costos, márgenes, reportes | [16](./modulos/16-modulo-finanzas.md) |
| **suppliers** | Proveedores, feeds CSV/API, mapeo, reenvío de pedidos | [20](./modulos/20-modulo-suppliers.md) |
| **ai-gateway** | Puerto al servicio IA Python; permisos, contexto mínimo, auditoría, rate limit, costos | [17](./modulos/17-modulo-ia-gateway.md) |
| **dashboard** | Read models y proyecciones para el panel admin | [18](./modulos/18-modulo-dashboard-analytics.md) |
| **audit** | Bitácora de operaciones críticas y accesos administrativos a datos sensibles | [08](./08-seguridad.md) |

> Nota de reconciliación con `AGENTS.md`: el esqueleto original agrupaba `inventory` dentro de `catalog`
> y `shipping/fulfillment` dentro de `orders`. Esta doc los promueve/mantiene como sub-dominios explícitos
> para que sus invariantes (overselling, transiciones de envío) tengan un lugar propio. La estructura
> física de carpetas puede mantener el anidamiento; lo que importa es la separación de responsabilidades.

## Diagrama de flujo (dropshipping)

```
Feed proveedor (CSV/API) ─▶ suppliers/feed ─▶ catalog (import + markup pricing)
Cliente / Admin ─▶ orders/checkout ─(tx)─▶ inventory(confirma) + pricing(recalcula) + finance(documento)
        │                                         │
        └─ evento OrderConfirmed ─▶ outbox ─▶ worker ─▶ proveedor(reenvía) + email(confirma)
Proveedor despacha ─▶ webhook ─▶ orders/shipping (actualiza tracking) ─▶ email(tracking)
```
