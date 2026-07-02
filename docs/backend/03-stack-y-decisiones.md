# 03 · Stack y decisiones (ADRs)

Cada decisión grande se registra como ADR (Architecture Decision Record). No se agregan dependencias por
comodidad estética: cada una tiene una razón. Formato: contexto → decisión → consecuencias.

## Stack base

```txt
Runtime:        Node.js LTS
Lenguaje:       TypeScript strict absoluto
API interna:    tRPC v11 (store + admin)
API pública:    REST JSON + OpenAPI (webhooks, terceros, futura API partner)
DB primaria:    PostgreSQL
Cache/locks:    Redis (ioredis)
Colas:          BullMQ (apps/workers)
Logs:           Pino (JSON estructurado)
Observabilidad: OpenTelemetry
Validación:     Zod (packages/validators)
Auth:           Better Auth
Email:          React Email + Resend
Pagos:          Stripe
Testing:        Vitest, Supertest/undici, Testcontainers
Lint/format:    ESLint + Prettier
Package mgr:    pnpm (lockfile congelado)
Contenedor:     Docker multi-stage, usuario no-root
```

---

## ADR-001 · Framework HTTP: Fastify

- **Contexto**: se necesita máxima performance, control fino y bajo acoplamiento. `AGENTS.md` ya define Fastify.
- **Decisión**: **Fastify** + arquitectura modular/hexagonal. Fastify vive **solo** en `interfaces/http` y
  `app/server.ts`. Los dominios **no** dependen de Fastify.
- **Consecuencias**: los handlers son delgados; el negocio es testeable sin levantar HTTP. Se descarta NestJS
  para evitar acoplar el dominio a decorators/DI del framework.

## ADR-002 · RPC tipado interno: tRPC v11

- **Contexto**: store y admin son Next.js/TS. Queremos type-safety end-to-end sin generar clientes.
- **Decisión**: **tRPC v11** como interfaz principal para apps internas. Se monta como plugin sobre Fastify.
  Cada dominio expone un router (`interfaces/trpc.ts`) compuesto en el router raíz.
- **Consecuencias**: el front consume procedimientos tipados; los inputs se validan con los **mismos** schemas
  Zod de `packages/validators`. REST/OpenAPI se reserva para webhooks y consumidores no-TS.
- **Regla**: tRPC y REST son **dos transportes del mismo caso de uso**; ninguno contiene lógica de negocio.

## ADR-003 · ORM: Drizzle

- **Contexto**: `AGENTS.md` define Drizzle. Se quiere SQL-first, tipado, sin magia.
- **Decisión**: **Drizzle ORM**. Schema en `packages/database/src/schema/` (un archivo por dominio).
  Migraciones versionadas (`pnpm db:generate` / `db:migrate`).
- **Consecuencias**: los tipos de Drizzle **no** cruzan a `domain/`; se mapean en `infra/mappers`. Las reglas
  de negocio **no** viven en hooks del ORM: viven en use cases/domain.

## ADR-004 · Autenticación: Better Auth (sesión por cookie)

- **Contexto**: front web. Se prioriza robustez contra robo de token por XSS.
- **Decisión**: **Better Auth** con **sesión en cookie `httpOnly`, `Secure`, `SameSite=Lax`** + protección CSRF.
  Refresh token rotation, sesiones revocables por dispositivo. MFA opcional para admin.
- **Consecuencias**: se evita `localStorage` para tokens. El admin exige mayor rigor (MFA opcional, reauth para
  acciones críticas). Detalle en [07](./07-auth-identidad.md).

## ADR-005 · Validación: Zod compartido

- **Decisión**: **Zod** en `packages/validators`, importado por front y back — única fuente de verdad de forma
  de entrada. `zod-to-openapi` para derivar el contrato REST. Config de env validada con **zod-env** al boot.
- **Consecuencias**: no hay documentación OpenAPI divergente escrita a mano; se genera desde schemas.

## ADR-006 · Colas: BullMQ en proceso separado

- **Decisión**: **BullMQ** (Redis). Los *productores* viven en `apps/api/infrastructure/queue`; los *consumers*
  en `apps/workers`. Jobs idempotentes, con reintentos, backoff, DLQ y timeout.
- **Consecuencias**: el request path nunca hace trabajo pesado (email, PDF, indexación, reenvío a proveedor,
  recomendaciones). Ver [32](./32-jobs-y-async.md).

## ADR-007 · Dinero: enteros en unidad menor

- **Decisión**: dinero como `{ amountMinor: number (int), currency: Currency }`. **Nunca** `float`.
  **Moneda base: `ARS`**. Redondeos determinísticos. El backend **recalcula** todos los totales; el frontend
  muestra, no decide.
- **Consecuencias**: se reconcilia el `formatCOP` del front → `formatARS`. Ver [06](./06-validaciones.md) §Dinero.

## ADR-008 · IDs públicos: UUIDv7

- **Decisión**: **UUIDv7** (ordenable por tiempo) para IDs públicos de entidades. No exponer IDs secuenciales
  que faciliten enumeración/scraping.
- **Consecuencias**: buen locality en índices + no enumerables. Slugs son atributo, no identidad ([04](./04-modelo-de-datos.md)).

## ADR-009 · Storage de archivos: adapter (local dev / S3 prod)

- **Contexto**: el dueño sube imágenes **desde su disco** (Windows, unidad C). Producción necesita CDN/URLs firmadas.
- **Decisión**: puerto `MediaStoragePort` con dos adapters: **filesystem local** (dev) y **S3-compatible** (prod).
  Validación por magic bytes, tamaño, MIME; storage fuera del webroot; URLs firmadas con expiración.
- **Consecuencias**: el dominio no sabe dónde viven los bytes. Detalle en [12](./modulos/12-modulo-media-storage.md).

## ADR-010 · IA como servicio separado (AI Gateway)

- **Decisión**: la inteligencia (descripciones, specs, imágenes, SEO, pricing, trends, recomendaciones) vive en
  `apps/ai` (Python/FastAPI/Pandas). El backend core expone un **puerto `AiGatewayPort`** que autentica,
  autoriza, reduce contexto al mínimo, audita, limita rate y normaliza errores.
- **Consecuencias**: cero lógica de IA en TS. El backend decide qué datos pueden viajar. Ver [17](./modulos/17-modulo-ia-gateway.md).

## ADR-011 · Búsqueda: PostgreSQL primero

- **Decisión**: arrancar con PostgreSQL (Full-Text Search + `pg_trgm` para tolerancia a typos y autocomplete).
  La verdad siempre en PostgreSQL. Migrar a motor externo (Meilisearch/Elastic) solo si la medición lo exige,
  sincronizando read models.
- **Consecuencias**: menos infra inicial; camino de escape definido.

## ADR-012 · Manejo de errores: Result + errores de dominio tipados

- **Decisión**: para errores de negocio **esperados**, usar `Result<T, E>` / errores de dominio tipados (no
  excepciones para flujo normal). Cada error de dominio mapea a un `code` público y HTTP status. Ver [05](./05-convenciones-api.md).

## Librerías permitidas (con criterio)

```txt
Validación:   zod, zod-to-openapi, zod-env
DB:           drizzle-orm, postgres (o node-postgres)
Auth/cripto:  better-auth, argon2 (o bcrypt), jose (si hace falta firmar tokens)
OpenAPI:      @fastify/swagger + scalar/redoc
Redis:        ioredis
Jobs:         bullmq
Fechas:       date-fns (o Temporal polyfill). Prohibido moment.
Dinero:       enteros menores; dinero.js/decimal solo si hace falta
Logs:         pino + pino-http
Testing:      vitest, testcontainers, msw/nock (mock de terceros)
```

> Toda dependencia nueva se revisa por mantenimiento y seguridad (SCA en CI). Ver [08](./08-seguridad.md) §Supply chain.
