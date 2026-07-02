# Backend CloudCommerce — Documentación de construcción

> Especificación viva del backend TS/Node de CloudCommerce. No es marketing ni decoración:
> es el contrato que guía la construcción del API que sostiene la **tienda** (clientes) y el
> **panel administrativo** (dueño). Basada en `.claude/Skills/backend/backend.md`.

## Estado del proyecto (2026-07, actualizado)

- **Backend (`apps/api`)**: **construido** — Fases 0 a 10 del roadmap implementadas: identity, catalog,
  media, pricing, inventory, customers, orders, finance, dashboard, settings, **ai-gateway** (Fase 8),
  **suppliers** (Fase 9: feeds con SSRF guard, forward idempotente, webhook HMAC) y **catálogo público
  del store** (Fase 10, `appRouter.store` con `publicProcedure`).
- **Workers (`apps/workers`)**: procesadores de media, reservas vencidas, documentos y **reenvío de
  órdenes al proveedor** (consume `OrderConfirmed` del outbox). El scheduler cron de feeds queda pendiente
  (hoy la corrida es manual vía `suppliers.feeds.run`).
- **Packages** (`database`, `validators`, `types`, `trpc`): construidos; migraciones 0000–0008.
- **Frontend store**: construido con mock data; el contrato real ya está disponible en `store.*`.
- **Panel admin (`apps/admin`)**: **pendiente** (esqueleto vacío).
- **Servicio IA (`apps/ai`)**: **pendiente** (Python/FastAPI). El backend ya expone el gateway con
  degradación elegante; el contrato interno es `POST /internal/ai/v1/*` (ver 17-modulo-ia-gateway.md).

## Enfoque: admin-first

El objetivo inmediato del dueño es tener **su sistema de administración**. El backend se construye
para servir **primero al panel admin** (login + dashboard + ABM de clientes, productos, categorías,
finanzas, IA, configuración) y, sobre las mismas bases de dominio, luego al store público.

El backend es **uno solo**: un modular monolith DDD que expone su dominio vía tRPC (apps internas:
store y admin) y REST/OpenAPI (webhooks y terceros). No hay "backend de admin" separado del "backend
de tienda"; hay un dominio único con autorización por rol.

## Cómo leer esta documentación

Orden recomendado. Los documentos fundacionales fijan modelo de datos y convenciones que los
documentos de módulo dan por sentados.

### Fundacionales

| # | Documento | Qué fija |
|---|-----------|----------|
| 01 | [Visión y alcance](./01-vision-y-alcance.md) | Qué es el backend, principio rector, no-objetivos |
| 02 | [Arquitectura](./02-arquitectura.md) | Capas, DDD+CQRS, reglas de dependencia, bounded contexts |
| 03 | [Stack y decisiones (ADRs)](./03-stack-y-decisiones.md) | Fastify+tRPC, Drizzle, Better Auth, etc. con justificación |
| 04 | [Modelo de datos](./04-modelo-de-datos.md) | Esquema canónico, tablas Drizzle, IDs, dinero, slugs, índices |
| 05 | [Convenciones de API](./05-convenciones-api.md) | REST+tRPC, versionado, envelope, errores, paginación, idempotencia |
| 06 | [Validaciones](./06-validaciones.md) | 4 capas, input/output, dinero, ownership, uploads |
| 07 | [Auth e identidad](./07-auth-identidad.md) | Login admin, sesiones, RBAC/ABAC/ownership, matriz de permisos |
| 08 | [Seguridad](./08-seguridad.md) | OWASP API Top 10, rate limiting, CORS, SSRF, webhooks, secrets |

### Módulos (`modulos/`)

| Documento | Cubre requerimiento del dueño |
|-----------|-------------------------------|
| [Catálogo](./modulos/10-modulo-catalogo.md) | **ABM productos y categorías**: categorías/subcategorías con imágenes, productos con specs, 1–6 imágenes, generación IA |
| [Clientes](./modulos/11-modulo-clientes.md) | **ABM clientes**: alta (nombre/apellido, WSP opcional), domicilios AR, búsqueda, detalle con analytics (compras, gasto, llamadas) |
| [Media y storage](./modulos/12-modulo-media-storage.md) | Subida de imágenes desde disco, validación, generación de imágenes por IA |
| [Inventario](./modulos/13-modulo-inventario.md) | Stock, reservas, prevención de overselling |
| [Pricing](./modulos/14-modulo-pricing.md) | Precios, markup dropshipping, descuentos, vigencias |
| [Órdenes](./modulos/15-modulo-ordenes.md) | Carrito, checkout idempotente, estados, fulfillment, envíos |
| [Finanzas](./modulos/16-modulo-finanzas.md) | **ABM finanzas**: ingresos, costos, márgenes, documentos (remito/factura/NC) |
| [IA Gateway](./modulos/17-modulo-ia-gateway.md) | **ABM IA**: puerto al servicio Python, generación de contenido, alertas, costos |
| [Dashboard y analytics](./modulos/18-modulo-dashboard-analytics.md) | **Dashboard**: KPIs, read models, gráficos |
| [Configuración](./modulos/19-modulo-configuracion.md) | **Configuración**: tienda, envíos, pagos, usuarios admin, feature flags |
| [Suppliers](./modulos/20-modulo-suppliers.md) | Proveedores y feeds (motor del dropshipping) |

### Transversales

| # | Documento |
|---|-----------|
| 30 | [Observabilidad](./30-observabilidad.md) |
| 31 | [Testing](./31-testing.md) |
| 32 | [Jobs y procesos async](./32-jobs-y-async.md) |
| 33 | [DevOps y deploy](./33-devops-y-deploy.md) |
| 40 | [Roadmap y fases (admin-first)](./40-roadmap-y-fases.md) |

## Decisiones ya tomadas (resumen ejecutivo)

Detalle y justificación en [03-stack-y-decisiones](./03-stack-y-decisiones.md).

- **HTTP**: Fastify. **RPC tipado interno**: tRPC v11 (consumido por store y admin).
- **DB**: PostgreSQL. **ORM**: Drizzle. **Cache/locks/rate-limit**: Redis (ioredis).
- **Colas**: BullMQ en `apps/workers`. **Auth**: Better Auth (sesiones cookie httpOnly).
- **Validación**: Zod en `packages/validators` (compartido front/back).
- **Tipos compartidos**: `packages/types`. **IDs públicos**: UUIDv7.
- **Dinero**: enteros en unidad menor (centavos) + moneda. **Moneda base**: `ARS`.
- **IA**: servicio Python separado; el backend solo expone un **AI Gateway** (puerto).

## Inconsistencias del frontend a reconciliar

Detectadas al auditar `apps/store`. El backend fija la **verdad canónica**; el front deberá ajustarse.

1. **Dos shapes de `Product`**: `ProductCardData` (`mock-products.ts`, el que usa el catálogo) vs
   `Product` (`types.ts`, aspiracional). Difieren: `oldPrice`↔`originalPrice`,
   `image/imageAlt`↔`images[]`, `stockStatus`↔`inStock/stockCount`. → Canon en [04](./04-modelo-de-datos.md).
2. **Moneda**: el helper se llama `formatCOP` pero precios (`24900`) y ciudades (`Buenos Aires, AR`)
   son de Argentina. → Moneda base **ARS**; el helper del front debe renombrarse a `formatARS`.
3. **Categorías como string**: hoy el producto lleva `category: string`. → Se normaliza a entidad
   `Category` con FK; el string queda solo como denormalización para cards.

## Glosario rápido

- **ABM**: Alta, Baja, Modificación (CRUD administrativo).
- **Read model**: proyección de solo-lectura optimizada para una vista (p. ej. card de producto, dashboard).
- **Bounded context / módulo / dominio**: unidad de negocio aislada (catalog, orders, customers…).
- **Ownership**: el actor solo accede a los recursos que le pertenecen (anti-IDOR/BOLA).
- **Idempotencia**: repetir una request no produce efectos duplicados.
