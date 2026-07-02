# 31 · Testing

Los tests bloquean regresiones. Sin ellos, "correcto" y "seguro" son opiniones. Stack: **Vitest**,
**Supertest/undici**, **Testcontainers** (PostgreSQL/Redis reales), **msw/nock** (mock de terceros).

## Pirámide

```txt
Unit         → reglas de dominio y policies (rápidos, sin IO)
Application  → casos de uso con repos fake o test DB
Integration  → DB real con Testcontainers
HTTP/tRPC    → rutas y contratos
Contract     → OpenAPI y clientes tRPC
E2E          → flujos críticos (checkout, alta de producto, alta de cliente)
Security     → auth, permisos, rate limits, input malicioso
Load         → endpoints calientes
Migration    → subir/bajar migraciones desde cero con datos representativos
```

## Tests obligatorios por endpoint

Cada endpoint público prueba:

```txt
- request válido
- body inválido / params inválidos / query inválida
- no autenticado (si requiere auth)
- autenticado sin permiso (rol equivocado)
- recurso inexistente
- recurso de OTRO actor (ownership)
- límite / rate limit (si aplica)
- la respuesta NO filtra campos internos (costPrice, supplierId, passwordHash, deletedAt...)
```

## Tests de autorización (BOLA/IDOR) — obligatorios

```txt
customer/actor A crea un recurso
actor B intenta leerlo/modificarlo
→ respuesta 404 o 403 según política, NUNCA 200
```

Aplica a: pedidos, documentos, direcciones, datos de cliente. Para el panel: `SUPPORT` sin motivo no accede
a datos sensibles; `CATALOG_MANAGER` no ve costos/finanzas ([07](./07-auth-identidad.md)).

## Tests de checkout (críticos)

```txt
- carrito vacío falla
- producto sin stock falla (INSUFFICIENT_STOCK)
- precio cambió → recalcula y avisa (PRICE_CHANGED)
- request duplicada con misma Idempotency-Key NO duplica orden
- misma Idempotency-Key con payload distinto falla (IDEMPOTENCY_CONFLICT)
- falla parcial no deja stock bloqueado incorrectamente (rollback + reserva liberada)
```

## Tests de contrato

```txt
- OpenAPI genera cliente sin errores
- schemas request/response sincronizados con Zod
- campos requeridos no desaparecen
- errores con formato estándar (code + status + requestId)
```

## Tests de carga

Escenarios: listado de catálogo, búsqueda/autocomplete, página de producto, agregar al carrito, checkout,
tracking, documentos de cliente, endpoint IA (con y sin cache). Medir p50/p95/p99, error rate, CPU de DB,
memoria, event loop delay. Budgets de referencia en la skill / [30](./30-observabilidad.md).

## Datos y aislamiento

- Cada test corre con DB efímera (Testcontainers) migrada desde cero → detecta migraciones rotas.
- Sin datos compartidos entre tests; factories por dominio.
- Terceros (Stripe, proveedor, IA) siempre mockeados; nunca llamadas reales en CI.

## Prohibido N+1

En tests de integración de endpoints de listado (catálogo, clientes, pedidos), contar queries y fallar si
supera un umbral. Los read models existen para evitar N+1 ([18](./modulos/18-modulo-dashboard-analytics.md)).

## Cobertura mínima por módulo

Dominio (invariantes/policies) y casos de uso críticos: cobertura alta. No perseguir 100% ciego; perseguir
**todas las ramas de decisión de negocio y de autorización**.
