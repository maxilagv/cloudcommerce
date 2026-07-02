# 40 · Roadmap y fases (admin-first)

Orden de construcción del backend. Principio: **entregar valor al panel admin lo antes posible**, sobre
bases de dominio que luego sirvan también al store, sin retrabajo. Cada fase termina con algo usable y testeado.

## Fase 0 · Fundaciones del proyecto

Objetivo: que el backend arranque, valide env, conecte DB/Redis y tenga el andamiaje de calidad.

```txt
[ ] apps/api: package.json válido, entrar al pnpm-workspace, tsconfig strict absoluto
[ ] app/: bootstrap, server (Fastify), config (zod-env), container, shutdown
[ ] shared/: logger (pino), error handler + catálogo de códigos, envelope, requestId, Result
[ ] infrastructure/database: cliente Drizzle + unit-of-work; packages/database con 1ª migración vacía
[ ] health checks (/live /ready /startup)
[ ] CI: install/lint/typecheck/unit + Testcontainers para integration
[ ] .env.example completo; docker-compose local (postgres, redis)
```
Entregable: API vacía que levanta, responde health y pasa CI.

## Fase 1 · Identity (login del panel)

Objetivo: **la primera parte del panel — login**. Ver [07](./07-auth-identidad.md).

```txt
[ ] admin_user, admin_session, permission_grant, access_log (schema + migración)
[ ] Better Auth: login, logout, me, refresh rotation, sesiones por dispositivo
[ ] RBAC (roles OWNER/ADMIN/CATALOG_MANAGER/FINANCE/SUPPORT) + adminProcedure tRPC
[ ] password reset, MFA opcional (al menos para OWNER)
[ ] seed del usuario OWNER (el dueño)
[ ] tests: auth negativa, rate limit de login, reuse de refresh
```
Entregable: el dueño inicia sesión; el resto del panel puede exigir rol.

## Fase 2 · Catálogo + Media + Categorías

Objetivo: **ABM productos y categorías** con imágenes y specs. Ver [10](./modulos/10-modulo-catalogo.md),
[12](./modulos/12-modulo-media-storage.md).

```txt
[ ] schema catalog (category árbol, brand, product, product_variant, spec_group/item, product_media,
    media_asset, product_slug_history)
[ ] MediaStoragePort + adapter filesystem local (subir desde disco C); validación magic bytes; 1..6 imágenes
[ ] ABM categorías/subcategorías con imagen
[ ] ABM productos: nombre, descripción, specs estructuradas, categoría, 1..6 imágenes, variantes
[ ] ciclo de vida + reglas de publicación (DRAFT→PUBLISHED)
[ ] job de procesamiento de imágenes (thumbnails/color/blur)
[ ] read model de "card" (reconcilia ProductCardData)
[ ] tests: cardinalidad de imágenes, reglas de publicación, ownership por rol
```
Entregable: el dueño carga el catálogo real desde el panel.

## Fase 3 · Pricing + Inventory

Objetivo: precio con markup auditable y stock real. Ver [14](./modulos/14-modulo-pricing.md),
[13](./modulos/13-modulo-inventario.md).

```txt
[ ] schema pricing (price, price_list, supplier_cost, markup_rule, discount) + inventory (stock_item,
    stock_reservation, stock_movement)
[ ] ComputeSalePrice (supplier_cost + markup, min margin), compare_at
[ ] disponibilidad → StockStatus para cards; ajuste manual con motivo; movimientos auditables
[ ] job de expiración de reservas
[ ] tests: cálculo de margen, no-overselling, no precio del cliente
```
Entregable: productos publicables con precio y stock coherentes.

## Fase 4 · Clientes

Objetivo: **ABM clientes** con domicilios AR, búsqueda y detalle. Ver [11](./modulos/11-modulo-clientes.md).

```txt
[ ] schema customers (customer, customer_address, customer_consent, customer_contact_log)
[ ] alta (nombre/apellido + WSP opcional), direcciones AR, registrar contacto (llamadas)
[ ] listado con búsqueda (lupa) + cursor pagination
[ ] detalle con analytics base (aún sin órdenes: contactos, direcciones)
[ ] permisos de datos sensibles (SUPPORT con motivo)
[ ] tests: búsqueda, ownership, acceso sensible
```
Entregable: el dueño gestiona su cartera de clientes.

## Fase 5 · Órdenes (alta manual) + Finanzas

Objetivo: pedidos reales (venta asistida) → analytics de cliente y **ABM finanzas**. Ver
[15](./modulos/15-modulo-ordenes.md), [16](./modulos/16-modulo-finanzas.md).

```txt
[ ] schema orders (cart, order, order_line con snapshots, order_status_event, shipment, idempotency_key)
[ ] CreateManualOrder (channel=admin_manual) con recálculo de precio + confirmación de stock en tx
[ ] máquina de estados de orden; cancelaciones
[ ] schema finance (commercial_document, document_download, finance_period_snapshot)
[ ] documentos remito/factura/NC (numeración, PDF por job, descarga firmada)
[ ] reportes: revenue/cost/margin por período; alimenta detalle de cliente (cuánto gastó / invirtió)
[ ] outbox + workers (email confirmación, PDF)
[ ] tests: idempotencia de checkout, snapshots, numeración correlativa
```
Entregable: el dueño registra ventas, emite documentos y ve finanzas; el detalle de cliente muestra gasto real.

## Fase 6 · Dashboard

Objetivo: **dashboard** con KPIs y gráficos. Ver [18](./modulos/18-modulo-dashboard-analytics.md).

```txt
[ ] read models / proyecciones actualizadas por eventos
[ ] KPIs (ventas, ingresos, margen, pedidos, clientes nuevos, stock bajo)
[ ] series temporales + ventas por categoría + top productos/clientes
[ ] cache Redis con invalidación por eventos
[ ] tests: sin N+1, permisos por rol (margen)
```
Entregable: primera pantalla del panel con el pulso del negocio.

## Fase 7 · Configuración

Objetivo: **configuración**. Ver [19](./modulos/19-modulo-configuracion.md).

```txt
[ ] schema setting, feature_flag
[ ] config de tienda, envíos, métodos de pago (secrets en secret manager)
[ ] CRUD de usuarios admin desde el panel
[ ] feature flags con owner/review/plan
```
Entregable: el dueño configura su tienda sin tocar código.

## Fase 8 · IA Gateway

Objetivo: **ABM IA** y generación de contenido. Ver [17](./modulos/17-modulo-ia-gateway.md).

```txt
[ ] AiGatewayPort + contrato interno con apps/ai; token de servicio; timeouts; degradación
[ ] generar descripción/specs/SEO/imágenes de producto (whitelist de contexto)
[ ] ai_generation (costos/uso), ai_alert (price/stock/trend)
[ ] rate limit + cuota de costo por actor
[ ] panel de IA (uso, generaciones, alertas)
```
Entregable: el dueño genera contenido de producto con IA desde el panel.
Nota: "seguimiento con IA de clientes" queda como **próximamente** ([11](./modulos/11-modulo-clientes.md)).

## Fase 9 · Suppliers / Dropshipping

Objetivo: automatizar el motor dropshipping. Ver [20](./modulos/20-modulo-suppliers.md).

```txt
[ ] schema suppliers (supplier, supplier_feed, supplier_product_map)
[ ] import de feeds (CSV/API) → catálogo + supplier_cost + stock
[ ] reenvío de pedidos al proveedor (outbox/worker, idempotente)
[ ] webhooks de fulfillment/tracking (firma, anti-replay, idempotencia)
[ ] SSRF en source_url; validación de respuestas del proveedor
```
Entregable: productos y fulfillment se automatizan; el store queda listo para checkout público.

## Fase 10 · Store público + hardening

```txt
[ ] exponer catálogo público (tRPC publicProcedure) + búsqueda (FTS + pg_trgm)
[ ] carrito/checkout del cliente (login de cliente, cuando aplique)
[ ] load tests de endpoints calientes; ajustar índices/cache
[ ] runbooks completos; alertas afinadas; security review
```

---

## Definition of Done global (toda funcionalidad)

Una funcionalidad backend no está terminada hasta que:

```txt
[ ] La regla de negocio vive en domain/application, no en el controller.
[ ] Todo input externo está validado (Zod).
[ ] Todos los errores esperados son tipados y mapeados a code/HTTP.
[ ] Hay tests unitarios y de integración.
[ ] Hay test de autorización negativa (ownership / rol).
[ ] El endpoint está en OpenAPI (si REST) o tipado en tRPC.
[ ] Hay logs con requestId; sin PII innecesaria.
[ ] Hay métricas si el flujo es crítico.
[ ] No hay `any` no justificado.
[ ] El módulo funciona con migraciones desde cero.
[ ] El módulo funciona en staging con smoke test.
[ ] Se agregó/actualizó runbook si el flujo es operativo.
```
