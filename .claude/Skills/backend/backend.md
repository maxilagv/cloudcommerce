---
name: cloudcommerce-backend-skill
description: Skill integral para diseñar, construir y auditar el backend TS/Node de cloudcommerce con arquitectura limpia, seguridad por defecto, validaciones exhaustivas, observabilidad, resiliencia, pruebas, performance y operación profesional.
version: 1.0.0
scope: backend, nodejs, typescript, api, ecommerce, security, validation, database, observability, devops, qa
preferred_stack: Node.js LTS, TypeScript strict, Fastify o NestJS, PostgreSQL, Redis, OpenAPI, Zod/Valibot, Prisma/Drizzle opcional, Pino, OpenTelemetry, Vitest, Testcontainers
owner_goal: Construir un backend tan sólido que cada endpoint sea confiable, auditable, seguro, performante, testeable y preparado para escalar cloudcommerce como e-commerce serio.
---

# Skill Backend — TS/Node para cloudcommerce

## 0. Principio rector

El backend de **cloudcommerce** debe ser tratado como el sistema nervioso del producto. No es una capa que solo responde JSON. Es la autoridad de negocio, seguridad, datos, trazabilidad, permisos, consistencia y operación.

El objetivo no es hacer un backend “que funcione”. El objetivo es hacer un backend que pueda crecer sin volverse frágil, que soporte tráfico real, que preserve la integridad de cada compra, cada producto, cada cliente, cada remito, cada envío y cada interacción de IA.

La implementación debe ser **puramente TypeScript/Node.js**. No se debe introducir lógica backend principal en otros lenguajes. El servicio de IA puede existir aparte en Python/Django/Pandas, pero el backend core de e-commerce debe mantener su frontera TS/Node.

## 1. Definición de backend perfecto para este proyecto

Un backend se considera excelente cuando cumple estas condiciones al mismo tiempo:

1. **Correcto:** cada regla de negocio está codificada en un lugar claro, testeada y protegida contra estados inválidos.
2. **Seguro:** asume que todo cliente, request, webhook, archivo, token, filtro y parámetro puede ser malicioso.
3. **Trazable:** cada request puede investigarse por `requestId`, usuario, endpoint, entidad afectada, evento de dominio y log estructurado.
4. **Validado:** nada entra al dominio sin validación de forma, tipo, rango, permisos e invariantes.
5. **Consistente:** transacciones, locks, idempotencia y eventos evitan duplicados, estados imposibles y carreras.
6. **Observable:** métricas, logs, traces, health checks y alertas permiten detectar problemas antes de que el cliente los reporte.
7. **Documentado:** OpenAPI, ADRs, runbooks y contratos están vivos, no son decoración.
8. **Testeado:** unit tests, integration tests, contract tests, security tests y load tests bloquean regresiones.
9. **Performante:** responde rápido porque limita payloads, pagina correctamente, evita N+1, cachea donde corresponde y mide queries.
10. **Evolutivo:** se puede cambiar una parte sin romper todo el sistema.

## 2. Stack recomendado

### 2.1 Stack base obligatorio

```txt
Runtime: Node.js LTS
Lenguaje: TypeScript en modo strict absoluto
API: REST JSON con OpenAPI como contrato público
Base de datos primaria: PostgreSQL
Cache / rate limit / locks livianos: Redis
Colas: BullMQ, pg-boss o equivalente TS/Node
Logs: Pino estructurado JSON
Observabilidad: OpenTelemetry
Testing: Vitest, Supertest/undici, Testcontainers
Validación: Zod, Valibot o TypeBox
Lint/format: ESLint, Prettier, TypeScript noImplicitAny
Package manager: pnpm con lockfile congelado
Contenedor: Docker multi-stage no-root
```

### 2.2 Framework HTTP

Elegir uno de estos caminos y mantenerlo sin mezclar estilos:

| Opción | Cuándo usarla | Reglas |
|---|---|---|
| **Fastify** | Máxima performance, control fino, arquitectura liviana | Los módulos de negocio no deben depender de Fastify. Fastify solo vive en `http`. |
| **NestJS** | Equipo grande, estructura opinada, DI formal | Evitar decorators como sustituto de arquitectura. El dominio sigue aislado. |

Para cloudcommerce se recomienda **Fastify + arquitectura modular/hexagonal** si el equipo quiere control, velocidad y bajo acoplamiento. Se recomienda **NestJS** si el equipo prefiere convención, DI incorporada y módulos más guiados.

### 2.3 Librerías permitidas con criterio

No agregar dependencias por comodidad estética. Cada dependencia debe tener una razón.

```txt
Validación: zod / valibot / typebox
ORM/query: prisma / drizzle / kysely / node-postgres
Auth/OIDC: jose, openid-client, passport solo si aporta valor
OpenAPI: @fastify/swagger, zod-to-openapi, scalar/redoc
Cache/Redis: ioredis
Jobs: bullmq o pg-boss
Fechas: temporal polyfill o date-fns; evitar moment
Dinero: enteros menores + currency; librería decimal si hace falta
Logs: pino + pino-http
Config: env-var, envalid o zod-env
Testing: vitest, testcontainers, msw/nock para terceros
```

## 3. Arquitectura recomendada

### 3.1 Modular monolith primero

El backend debe comenzar como un **monolito modular** bien separado. No empezar con microservicios salvo que exista una necesidad operacional real. Un monolito modular permite transacciones simples, despliegue más fácil, menor latencia interna y reglas de negocio consistentes.

El código se divide por dominios, no por capas genéricas globales.

```txt
src/
├─ app/
│  ├─ bootstrap.ts
│  ├─ server.ts
│  ├─ config.ts
│  ├─ container.ts
│  └─ shutdown.ts
├─ shared/
│  ├─ domain/
│  ├─ application/
│  ├─ http/
│  ├─ infra/
│  ├─ security/
│  ├─ observability/
│  └─ testing/
├─ modules/
│  ├─ identity/
│  ├─ customers/
│  ├─ catalog/
│  ├─ search/
│  ├─ pricing/
│  ├─ inventory/
│  ├─ cart/
│  ├─ checkout/
│  ├─ orders/
│  ├─ shipments/
│  ├─ documents/
│  ├─ payments/
│  ├─ promotions/
│  ├─ reviews/
│  ├─ support/
│  ├─ ai-gateway/
│  └─ audit/
└─ main.ts
```

Cada módulo debe tener estructura interna consistente:

```txt
modules/catalog/
├─ domain/
│  ├─ entities/
│  ├─ value-objects/
│  ├─ events/
│  ├─ policies/
│  └─ errors.ts
├─ application/
│  ├─ commands/
│  ├─ queries/
│  ├─ services/
│  ├─ ports/
│  └─ dto/
├─ infra/
│  ├─ repositories/
│  ├─ mappers/
│  ├─ persistence/
│  └─ integrations/
├─ http/
│  ├─ routes.ts
│  ├─ schemas.ts
│  ├─ presenters.ts
│  └─ openapi.ts
└─ tests/
   ├─ unit/
   ├─ integration/
   └─ contract/
```

### 3.2 Reglas de dependencia

```txt
http -> application -> domain
infra -> application/domain
shared -> usado por módulos
modules no deben importar http de otros módulos
modules no deben acceder directo a tablas de otros módulos salvo read models autorizados
```

Regla crítica: el dominio no sabe que existe HTTP, Fastify, Redis, Prisma, JSON, cookies ni JWT. El dominio sabe de clientes, productos, stock, precios, pedidos, remitos, envíos y reglas.

### 3.3 Capa domain

Contiene lo que no puede romperse.

Ejemplos:

```txt
Product
ProductVariant
Category
Money
Sku
StockReservation
Order
OrderLine
Shipment
Customer
CommercialDocument
Address
```

Las invariantes viven acá:

```txt
- Un producto publicado debe tener título, slug, categoría, imagen principal, precio visible y al menos una variante vendible.
- Una variante no puede venderse si está archivada, sin stock disponible o bloqueada por auditoría.
- Una reserva de stock debe expirar si no se confirma dentro del TTL definido.
- Un pedido no puede pasar a enviado si no tiene dirección válida y stock confirmado.
- Un remito no puede emitirse para un pedido cancelado.
- El precio final debe provenir de una regla vigente y auditable, no de un valor enviado por el cliente.
```

### 3.4 Capa application

Orquesta casos de uso. No contiene lógica de transporte.

Ejemplos:

```txt
CreateProductCommand
PublishProductCommand
SearchCatalogQuery
ReserveCartStockCommand
CreateOrderCommand
CancelOrderCommand
GenerateCommercialDocumentCommand
TrackShipmentQuery
SyncProductToSearchIndexCommand
```

Cada caso de uso debe declarar:

```txt
- actor: quién ejecuta la acción
- input validado
- permisos necesarios
- transacción requerida
- entidades afectadas
- eventos emitidos
- salida tipada
- errores esperados
```

### 3.5 Capa infra

Implementa detalles técnicos: base de datos, Redis, storage, proveedores externos, cola de jobs, email, búsqueda, webhooks, CDN.

La infraestructura nunca debe filtrar tipos propios hacia el dominio. Si se usa Prisma, Drizzle o Kysely, sus tipos no deben contaminar entidades de dominio.

### 3.6 Capa http

Contiene rutas, schemas, OpenAPI, parsing de request, presentación de response, headers, cookies y status codes.

Nunca debe contener lógica de negocio compleja. Si un controller tiene más de 25–40 líneas reales, probablemente está mal ubicado.

## 4. Bounded contexts de cloudcommerce

### 4.1 Identity

Responsable de autenticación, sesiones, refresh tokens, roles, permisos, dispositivos, MFA, recuperación de cuenta y auditoría de acceso.

Debe resolver:

```txt
- Login seguro
- Logout global y por dispositivo
- Refresh token rotation
- Detección de token reuse
- Sesiones revocables
- MFA opcional para admin
- Roles administrativos
- Permisos por recurso
- Protección contra credential stuffing
```

### 4.2 Customers

Responsable del perfil del cliente.

```txt
- Datos mínimos de identidad
- Direcciones
- Preferencias
- Consentimientos
- Favoritos
- Historial visible para el cliente
- Privacidad y exportación de datos si aplica
```

### 4.3 Catalog

Responsable de categorías, productos, variantes, atributos, imágenes, fichas técnicas, slugs, estado de publicación y contenido comercial.

```txt
Product
Variant
Category
Brand
AttributeDefinition
AttributeValue
MediaAsset
SpecificationGroup
```

### 4.4 Search

Responsable de indexación y consulta rápida.

```txt
- Autocomplete
- Búsqueda por texto
- Filtros facetados
- Ordenamiento
- Sugerencias
- Sinónimos
- Corrección tolerante
- Read models optimizados
```

Si se usa un motor externo, el backend conserva la verdad en PostgreSQL y sincroniza read models.

### 4.5 Pricing

Responsable de precios, descuentos, listas, vigencias, reglas promocionales y auditoría.

Regla: el frontend nunca manda el precio final confiable. El backend recalcula.

### 4.6 Inventory

Responsable de stock disponible, stock reservado, stock comprometido, movimientos y auditoría.

Debe manejar:

```txt
- Reservas con expiración
- Liberación de reservas
- Confirmación al crear orden
- Prevención de overselling
- Movimientos auditables
- Corrección administrativa con motivo obligatorio
```

### 4.7 Cart

Responsable del carrito persistente o anónimo.

```txt
- Agregar línea
- Actualizar cantidad
- Remover línea
- Merge carrito anónimo con usuario logueado
- Revalidación de precio y stock
- Expiración de líneas inválidas
```

### 4.8 Checkout

Responsable de convertir intención en orden.

Debe ser idempotente. Si el cliente repite la request por timeout, no debe crear dos órdenes.

### 4.9 Orders

Responsable de pedidos, estados, líneas, totales, cancelaciones y eventos.

Estados sugeridos:

```txt
DRAFT
PENDING_CONFIRMATION
CONFIRMED
PREPARING
READY_TO_SHIP
SHIPPED
DELIVERED
CANCELLED
RETURN_REQUESTED
RETURNED
```

Las transiciones deben estar centralizadas en una máquina de estados o policy explícita.

### 4.10 Shipments

Responsable de guías, transportadoras, estados de envío, tracking, ETA, eventos y notas.

### 4.11 Documents

Responsable de remitos, facturas, notas de crédito, PDFs, descargas, firmas, numeración, permisos y retención.

### 4.12 AI Gateway

Responsable de hablar con el servicio IA en Python/Django/Pandas sin mezclar lógica de IA dentro del backend core.

Debe funcionar como un puerto:

```txt
Backend TS/Node -> AI Gateway Port -> AI Service Python/Django/Pandas
```

El backend decide permisos, contexto permitido y datos que pueden viajar. La IA no debe consultar datos privados sin autorización explícita del backend.

## 5. Diseño de API

### 5.1 Estándar REST

Usar REST para recursos del e-commerce.

```txt
GET    /api/v1/catalog/categories
GET    /api/v1/catalog/products
GET    /api/v1/catalog/products/:productId
GET    /api/v1/catalog/products/:productId/recommendations
POST   /api/v1/cart/items
PATCH  /api/v1/cart/items/:itemId
DELETE /api/v1/cart/items/:itemId
POST   /api/v1/checkout/orders
GET    /api/v1/orders
GET    /api/v1/orders/:orderId
GET    /api/v1/shipments/:shipmentId/tracking
GET    /api/v1/customers/me/documents
```

No usar verbos arbitrarios si puede modelarse como recurso. Cuando una acción sea realmente una acción, nombrarla con claridad:

```txt
POST /api/v1/orders/:orderId/cancel
POST /api/v1/shipments/:shipmentId/refresh-tracking
POST /api/v1/documents/:documentId/regenerate
```

### 5.2 Versionado

Usar `/api/v1` desde el inicio. No versionar por header salvo que exista una razón fuerte.

Reglas:

```txt
- Cambios backward compatible no aumentan versión.
- Cambios breaking crean /v2.
- Mantener changelog de API.
- Documentar campos deprecated.
- No borrar campos públicos sin ventana de migración.
```

### 5.3 Contrato OpenAPI

Todo endpoint público debe tener OpenAPI.

OpenAPI debe incluir:

```txt
- Summary y description reales
- Auth requerida
- Parámetros
- Request schema
- Response schema
- Errores esperados
- Ejemplos realistas
- Rate limits si aplica
- Idempotency-Key si aplica
```

El contrato debe generarse desde schemas o validarse contra ellos. Evitar documentación manual divergente.

### 5.4 Paginación

Para listados grandes usar cursor pagination.

Formato recomendado:

```json
{
  "data": [],
  "pageInfo": {
    "nextCursor": "eyJpZCI6...",
    "hasNextPage": true,
    "limit": 24
  }
}
```

Reglas:

```txt
- Nunca devolver listas sin límite.
- Límite default razonable: 24 para catálogo, 20 para pedidos, 50 máximo salvo admin.
- Validar `limit` y `cursor`.
- El cursor debe firmarse o codificarse para evitar manipulación peligrosa.
```

### 5.5 Filtros

Los filtros se validan contra una whitelist.

Ejemplo:

```txt
category
brand
priceMin
priceMax
ratingMin
availability
attributes[color]
attributes[capacity]
sort
```

Nunca convertir query params directamente en cláusulas SQL. Nunca permitir `sort` libre por nombre de columna sin mapping.

### 5.6 Respuesta uniforme

Para éxito:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_..."
  }
}
```

Para error:

```json
{
  "type": "https://api.cloudcommerce.local/errors/validation_failed",
  "title": "Validation failed",
  "status": 400,
  "code": "VALIDATION_FAILED",
  "message": "Algunos campos no son válidos.",
  "requestId": "req_01H...",
  "details": [
    {
      "path": "items.0.quantity",
      "message": "La cantidad debe ser mayor a 0.",
      "code": "too_small"
    }
  ]
}
```

No exponer stack traces, SQL, secrets, nombres internos de tablas ni mensajes crudos del ORM.

## 6. Validaciones impecables

### 6.1 Capas de validación

Validar en cuatro niveles:

| Nivel | Qué valida | Ejemplo |
|---|---|---|
| Transporte | forma, tipos, tamaños, formatos | `email`, `uuid`, `limit <= 50` |
| Aplicación | permisos, estado inicial, existencia | usuario puede modificar su carrito |
| Dominio | invariantes irrompibles | no reservar stock negativo |
| Persistencia | constraints definitivas | unique slug, FK, check constraints |

Ningún nivel reemplaza a los otros.

### 6.2 Validación de entrada

Todo input externo debe pasar por schema.

Validar:

```txt
- body
- params
- query
- headers relevantes
- cookies
- webhooks
- archivos
- datos de terceros
- respuestas de servicios externos antes de confiar en ellas
```

Ejemplo de política:

```ts
const CreateCartItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
});
```

### 6.3 Validación de salida

Los responses importantes deben pasar por presenters tipados. Para endpoints críticos, validar también el output contra schema, al menos en tests y ambientes no productivos.

Motivo: evita fuga de campos internos como `costPrice`, `supplierId`, `deletedAt`, `passwordHash`, `internalNotes`.

### 6.4 Normalización

Antes de persistir:

```txt
- trim de strings
- normalización Unicode cuando aplique
- lowercase para emails
- slugify controlado para slugs
- límites de longitud
- escape/sanitización de HTML si se permite contenido enriquecido
- redondeo/escala decimal para medidas
- dinero en enteros menores
```

### 6.5 Validación de dinero

Nunca usar `number` flotante para representar dinero en dominio persistente.

Modelo recomendado:

```ts
type Currency = 'ARS' | 'USD';

type Money = {
  amountMinor: number; // centavos o unidad menor definida
  currency: Currency;
};
```

Reglas:

```txt
- El backend recalcula totales.
- El frontend puede mostrar, no decidir.
- Todos los descuentos deben ser auditables.
- No aceptar precio final desde cliente.
- Los redondeos deben ser determinísticos.
```

### 6.6 Validación de IDs y propiedad

Validar que el ID sea formalmente correcto no alcanza. También se valida que el actor pueda operar sobre ese ID.

Incorrecto:

```txt
GET /orders/:id -> buscar orden y devolverla si existe
```

Correcto:

```txt
GET /orders/:id -> buscar orden por id + customerId del actor, o evaluar permiso admin explícito
```

Esto evita BOLA/IDOR.

### 6.7 Mass assignment

Nunca mapear `req.body` directo a entidad o actualización ORM.

Incorrecto:

```ts
await prisma.user.update({ data: req.body });
```

Correcto:

```ts
const input = UpdateProfileSchema.parse(req.body);
await updateProfileUseCase.execute(actor, {
  displayName: input.displayName,
  phone: input.phone,
});
```

### 6.8 Validación de archivos

Para imágenes de producto, documentos y adjuntos:

```txt
- tamaño máximo
- MIME real por magic bytes, no solo header
- extensión permitida
- nombre saneado
- storage fuera del webroot
- antivirus si aplica
- metadata EXIF removida si contiene datos sensibles
- URLs firmadas con expiración
- autorización antes de descarga
```

## 7. Autenticación

### 7.1 Principios

```txt
- Contraseñas nunca se guardan en texto plano.
- Password hash con Argon2id o bcrypt con costo actual revisado.
- Access tokens de vida corta.
- Refresh tokens rotativos, hasheados y revocables.
- Sesiones asociadas a dispositivo.
- Logout invalida sesión/token.
- Cambios críticos fuerzan reautenticación.
```

### 7.2 Sesiones recomendadas

Para e-commerce web, preferir una de estas estrategias:

| Estrategia | Ventaja | Riesgo a controlar |
|---|---|---|
| Cookie httpOnly + SameSite + CSRF | Más segura contra robo por JS | CSRF bien configurado |
| Bearer access token + refresh seguro | Simple para apps/API | XSS y almacenamiento inseguro |

Si el frontend es web, una cookie `httpOnly`, `Secure`, `SameSite=Lax/Strict` suele ser más robusta que guardar tokens en `localStorage`.

### 7.3 Refresh token rotation

Cada refresh exitoso emite un nuevo refresh token e invalida el anterior.

Si se detecta reutilización:

```txt
- revocar familia de tokens
- invalidar sesión
- registrar evento de seguridad
- notificar si corresponde
```

### 7.4 Recuperación de cuenta

```txt
- Token de recuperación aleatorio, de un solo uso, hasheado en DB.
- Expiración corta.
- No revelar si el email existe.
- Rate limit por IP, email y fingerprint.
- Registrar evento.
```

## 8. Autorización

### 8.1 RBAC + ABAC + ownership

Usar tres niveles:

```txt
RBAC: rol general, por ejemplo customer, support, catalog_manager, admin.
ABAC: atributos de contexto, por ejemplo país, canal, estado del recurso.
Ownership: el usuario solo accede a sus órdenes, documentos y direcciones.
```

### 8.2 Autorización en use cases

La autorización crítica vive en application/domain, no solo en middleware.

Middleware puede verificar autenticación, pero no alcanza para saber si `customer A` puede leer `order B`.

### 8.3 Permission matrix

Mantener una matriz versionada.

Ejemplo:

| Acción | customer | support | catalog_manager | admin |
|---|---:|---:|---:|---:|
| Ver su pedido | sí | sí, con motivo | no | sí |
| Cancelar su pedido | sí, si estado permite | sí | no | sí |
| Editar producto | no | no | sí | sí |
| Ver costo interno | no | no | no | sí restringido |
| Descargar remito propio | sí | sí, con motivo | no | sí |

### 8.4 Motivos de acceso administrativo

Para datos sensibles de clientes, el panel admin debe registrar motivo cuando soporte accede a información personal o documentos.

```txt
actorId
resourceType
resourceId
action
reason
ip
userAgent
timestamp
```

## 9. Seguridad API

### 9.1 Amenazas prioritarias

El backend debe cubrir explícitamente:

```txt
- Broken Object Level Authorization
- Broken Authentication
- Broken Object Property Level Authorization
- Unrestricted Resource Consumption
- Broken Function Level Authorization
- Unrestricted Access to Sensitive Business Flows
- Server Side Request Forgery
- Security Misconfiguration
- Improper Inventory Management
- Unsafe Consumption of APIs
```

### 9.2 Rate limiting

Aplicar rate limits por tipo de endpoint.

```txt
Login: IP + email + device fingerprint
Registro: IP + email/domain
Search: IP + user + query hash
Cart mutations: user/session
Checkout: user/session + idempotency key
Webhooks: proveedor + firma + IP allowlist si aplica
AI endpoint: user + tenant + costo estimado
Admin: user + IP + rol
```

No usar un único rate limit global.

### 9.3 Protección contra abuso de flujos comerciales

Algunos ataques no explotan bugs técnicos sino flujos legítimos automatizados.

Proteger:

```txt
- creación masiva de cuentas
- scraping de catálogo
- abuso de búsqueda/autocomplete
- reservas de stock falsas
- repetición de checkout
- generación masiva de documentos
- tracking spam
- abuso de IA o recomendaciones
```

Herramientas:

```txt
- rate limits contextuales
- cuotas internas por actor
- captcha solo cuando el riesgo sube
- detección de anomalías
- idempotencia
- costos máximos por operación
- degradación elegante
```

### 9.4 CORS

CORS debe ser allowlist estricto por ambiente.

```txt
Producción: https://cloudcommerce...
Staging: https://staging...
Local: http://localhost:3000 solo en development
```

No usar `origin: *` con credenciales.

### 9.5 Security headers

Aunque muchas cabeceras se configuren en proxy/CDN, el backend debe conocerlas.

```txt
Strict-Transport-Security
X-Content-Type-Options: nosniff
Referrer-Policy
Content-Security-Policy donde aplique
Permissions-Policy
Cache-Control correcto en respuestas sensibles
```

### 9.6 SSRF

Cualquier funcionalidad que reciba URLs externas debe bloquear:

```txt
- localhost
- 127.0.0.0/8
- 10.0.0.0/8
- 172.16.0.0/12
- 192.168.0.0/16
- link-local
- metadata services
- redirects hacia redes privadas
- protocolos no HTTP/HTTPS
```

Nunca permitir que un usuario fuerce al backend a descargar arbitrariamente recursos internos.

### 9.7 Prototype pollution

Validar y sanear objetos. Evitar merge profundo inseguro con objetos controlados por usuario.

Bloquear claves peligrosas:

```txt
__proto__
prototype
constructor
```

### 9.8 Supply chain

```txt
- lockfile obligatorio
- instalación con frozen lockfile en CI
- revisión de paquetes nuevos
- pinning razonable de versiones
- auditoría de dependencias
- bloqueo de scripts de instalación si es viable
- no publicar secrets en npmrc/env
- SCA en pipeline
- Dependabot/Renovate con tests completos
```

### 9.9 Secrets

```txt
- Nunca commitear `.env` real.
- Usar secret manager en producción.
- Rotación documentada.
- Secrets separados por ambiente.
- No loggear secrets ni headers sensibles.
- Validar env vars al boot.
```

### 9.10 Webhooks

Cada webhook debe verificar:

```txt
- firma HMAC o mecanismo oficial del proveedor
- timestamp anti-replay
- idempotencia por eventId
- schema de payload
- origen si aplica
- orden de eventos si importa
```

Nunca asumir que un webhook llega una sola vez ni en orden.

## 10. Seguridad Node.js específica

### 10.1 No bloquear event loop

Evitar operaciones CPU-bound pesadas en request path.

Prohibido en endpoints calientes:

```txt
- loops gigantes sobre arrays sin límite
- JSON.stringify de payloads enormes
- regex vulnerables a ReDoS
- compresión síncrona pesada
- crypto síncrono costoso sin control
- parsing de archivos grandes en memoria
```

Mover trabajos pesados a cola o worker.

### 10.2 Timeouts

Configurar timeouts de servidor y cliente HTTP.

```txt
headersTimeout
requestTimeout
keepAliveTimeout
body size limit
upstream timeout
database statement timeout
redis timeout
job timeout
```

Un backend sin timeouts es un backend esperando fallar.

### 10.3 Reverse proxy

En producción, Node debe vivir detrás de un reverse proxy o load balancer que ayude con TLS, límites, buffering, compresión, WAF y protección DoS.

### 10.4 Manejo de señales

Implementar graceful shutdown:

```txt
SIGTERM recibido
marcar readiness false
cerrar servidor HTTP a nuevas conexiones
esperar requests activas con timeout
cerrar DB/Redis/colas
flush logs/traces
exit 0
```

### 10.5 Permisos del proceso

```txt
- Contenedor no-root.
- Filesystem read-only donde sea posible.
- Variables mínimas.
- No montar docker socket.
- No permisos de escritura fuera de tmp/storage requerido.
```

## 11. Datos y persistencia

### 11.1 PostgreSQL como fuente de verdad

PostgreSQL debe contener la verdad transaccional.

Reglas:

```txt
- FK para integridad referencial.
- Unique constraints para invariantes globales.
- Check constraints para rangos básicos.
- Timestamps `created_at`, `updated_at`.
- `deleted_at` solo si el dominio necesita soft delete.
- Migraciones versionadas.
- Backups probados, no solo configurados.
```

### 11.2 IDs

Usar UUID o UUIDv7/ULID para IDs públicos. No exponer IDs secuenciales internos cuando pueda facilitar scraping o enumeración.

### 11.3 Slugs

```txt
- Slug único por producto/categoría.
- Slug histórico para redirects SEO.
- Cambios de slug crean redirect 301 en frontend/API metadata.
- Slug no es identidad primaria.
```

### 11.4 Índices

Todo endpoint con filtros debe tener estrategia de índices.

Ejemplos:

```sql
CREATE INDEX idx_products_status_category ON products(status, category_id);
CREATE INDEX idx_variants_product_active ON product_variants(product_id, is_active);
CREATE INDEX idx_orders_customer_created ON orders(customer_id, created_at DESC);
CREATE INDEX idx_shipments_order_id ON shipments(order_id);
```

No agregar índices a ciegas. Medir queries.

### 11.5 Transacciones

Usar transacciones para:

```txt
- checkout
- reserva/confirmación de stock
- creación de orden
- generación de documentos comerciales
- cambios de estado de pedido/envío
- operaciones administrativas críticas
```

### 11.6 Idempotencia

Endpoints críticos deben soportar `Idempotency-Key`.

Aplicar a:

```txt
POST /checkout/orders
POST /payments/intents
POST /orders/:id/cancel
POST /documents/:id/regenerate
POST /shipments/:id/refresh-tracking
```

Almacenar:

```txt
key
actorId
route
requestHash
responseStatus
responseBodyHash/result reference
createdAt
expiresAt
```

Si se repite la misma key con payload distinto, responder error.

### 11.7 Outbox pattern

Para eventos importantes, usar outbox transaccional.

```txt
1. Dentro de la transacción se modifica estado y se escribe evento outbox.
2. Worker lee outbox.
3. Publica evento/envía mail/indexa búsqueda.
4. Marca procesado con reintentos seguros.
```

Eventos sugeridos:

```txt
ProductPublished
PriceChanged
StockReserved
StockReleased
OrderCreated
OrderConfirmed
OrderCancelled
ShipmentStatusChanged
DocumentGenerated
CustomerConsentUpdated
```

### 11.8 Auditoría

Auditar operaciones críticas.

```txt
actorId
actorType
action
resourceType
resourceId
before
after
ip
userAgent
requestId
reason
timestamp
```

No auditar contraseñas, tokens, datos secretos ni PII innecesaria.

## 12. Catálogo perfecto desde backend

### 12.1 Producto

Modelo conceptual:

```txt
Product
- id
- slug
- title
- subtitle
- description
- brandId
- categoryId
- status
- seoTitle
- seoDescription
- mainImageId
- gallery
- specificationGroups
- createdAt
- updatedAt

ProductVariant
- id
- productId
- sku
- title
- attributes
- priceRef
- stockRef
- media
- status
```

### 12.2 Estado de producto

```txt
DRAFT
READY_FOR_REVIEW
PUBLISHED
PAUSED
ARCHIVED
```

Solo `PUBLISHED` puede aparecer en el catálogo público.

### 12.3 Reglas de publicación

Un producto no puede publicarse si falta:

```txt
- título
- slug válido
- marca
- categoría
- imagen principal
- precio vigente
- variante activa
- especificaciones mínimas
- descripción pública
- metadata SEO mínima
```

### 12.4 Especificaciones

Las especificaciones deben ser estructuradas, no texto libre solamente.

Ejemplo:

```json
{
  "group": "Dimensiones",
  "items": [
    { "key": "alto", "label": "Alto", "value": 178, "unit": "cm" },
    { "key": "ancho", "label": "Ancho", "value": 91.2, "unit": "cm" }
  ]
}
```

Esto permite filtros, comparaciones, SEO, IA y fichas técnicas coherentes.

### 12.5 Imágenes

```txt
- Imagen principal obligatoria.
- Galería ordenada.
- Alt text descriptivo.
- Dimensiones conocidas.
- Dominant color opcional.
- Blur placeholder opcional.
- Prohibir assets rotos en productos publicados.
```

### 12.6 Facetas

Las facetas públicas deben salir de datos normalizados.

```txt
brand
category
priceRange
availability
rating
attributes relevantes por categoría
```

No generar filtros con strings sucios o duplicados.

## 13. Carrito y checkout sólidos

### 13.1 Carrito

Reglas:

```txt
- Un carrito puede ser anónimo o de usuario.
- Cada línea referencia variantId, no solo productId.
- Al mostrar carrito se revalida precio, stock y estado de producto.
- Cantidades tienen máximo por línea y por carrito.
- Productos no disponibles se marcan como inválidos, no se cobran.
```

### 13.2 Merge de carrito

Cuando un usuario inicia sesión:

```txt
- fusionar carrito anónimo con carrito de cuenta
- combinar líneas iguales
- respetar límites de stock
- registrar evento
- devolver diferencias al frontend
```

### 13.3 Checkout idempotente

El checkout debe ser una operación blindada.

Checklist:

```txt
- actor autenticado o sesión válida
- dirección válida
- carrito no vacío
- precios recalculados
- stock reservado/confirmado
- idempotency key requerida
- transacción DB
- order number único
- evento outbox
- respuesta estable si se repite request
```

### 13.4 Estados de orden

No permitir cambios arbitrarios.

Ejemplo:

```txt
CONFIRMED -> PREPARING -> READY_TO_SHIP -> SHIPPED -> DELIVERED
CONFIRMED -> CANCELLED
PREPARING -> CANCELLED si policy permite
SHIPPED -> RETURN_REQUESTED
```

Cada transición debe validar actor, estado actual y motivo cuando aplique.

## 14. Envíos, tracking y remitos

### 14.1 Tracking

El backend debe exponer una visión clara y segura del envío.

```txt
GET /api/v1/orders/:orderId/shipments
GET /api/v1/shipments/:shipmentId/tracking
```

El cliente solo puede ver sus propios envíos. Soporte/admin requiere permiso.

### 14.2 Eventos de envío

```txt
ShipmentCreated
ShipmentPrepared
ShipmentDispatched
ShipmentInTransit
ShipmentOutForDelivery
ShipmentDelivered
ShipmentDelayed
ShipmentFailedAttempt
```

### 14.3 Remitos y documentos

Reglas:

```txt
- Documento asociado a orden.
- Descarga autorizada.
- URL firmada o streaming controlado.
- Registro de descarga para auditoría si aplica.
- PDFs generados de forma determinística.
- No exponer documentos por URLs públicas permanentes.
```

## 15. Integración con IA

### 15.1 Separación de responsabilidades

El backend TS/Node no implementa la inteligencia analítica principal. El servicio IA en Python/Django/Pandas analiza, recomienda y genera insights. El backend core:

```txt
- autentica al usuario
- autoriza acceso a datos
- reduce contexto a lo mínimo necesario
- llama al servicio IA
- registra auditoría
- aplica rate limits
- normaliza errores
- cachea respuestas seguras si corresponde
```

### 15.2 Contrato con IA

```txt
POST /internal/ai/v1/assist
POST /internal/ai/v1/recommendations
POST /internal/ai/v1/product-insights
POST /internal/ai/v1/price-alerts
```

El backend nunca debe enviar:

```txt
- password hashes
- refresh tokens
- documentos completos sin necesidad
- datos de otros usuarios
- secretos internos
- campos de costo proveedor si el usuario no puede verlos
```

### 15.3 Respuestas IA verificables

Cuando IA devuelva una recomendación, debe incluir evidencia estructurada:

```json
{
  "recommendations": [
    {
      "productId": "...",
      "score": 0.87,
      "reasonCodes": ["same_category", "energy_saving", "viewed_brand"],
      "evidence": {
        "matchedAttributes": ["22kg", "eficiencia A"],
        "basedOn": ["producto_visto", "preferencia_categoria"]
      }
    }
  ]
}
```

El backend puede ocultar o transformar evidencia antes de mostrarla, pero debe conservar trazabilidad.

## 16. Observabilidad

### 16.1 Logs estructurados

Usar JSON. Cada log relevante debe tener:

```txt
level
time
requestId
traceId
spanId
actorId opcional
actorRole opcional
route
method
statusCode
durationMs
module
action
resourceType
resourceId opcional
errorCode opcional
```

No loggear:

```txt
passwords
tokens
cookies completas
documentos completos
números de tarjeta
PII innecesaria
headers sensibles
```

### 16.2 Métricas

Métricas mínimas:

```txt
http_requests_total
http_request_duration_seconds
http_request_errors_total
db_query_duration_seconds
redis_operation_duration_seconds
jobs_processed_total
jobs_failed_total
checkout_attempts_total
checkout_success_total
stock_reservation_failures_total
search_latency_seconds
ai_requests_total
ai_request_duration_seconds
```

### 16.3 Tracing

Cada request debe crear trace. Propagar trace a:

```txt
- DB
- Redis
- jobs
- HTTP clients externos
- servicio IA
- proveedor de envíos
- generación de documentos
```

### 16.4 Alertas

Alertas mínimas:

```txt
- error rate 5xx alto
- p95 latencia alto
- checkout success rate cae
- DB connections cerca del límite
- cola con backlog creciente
- jobs fallando repetidamente
- Redis caído
- stock reservation failures anómalas
- webhooks con firma inválida aumentan
- AI latency o error rate alto
```

## 17. Performance

### 17.1 Budgets

Definir objetivos iniciales:

```txt
GET catálogo público: p95 < 250 ms backend sin CDN
GET producto: p95 < 180 ms backend sin CDN
GET carrito: p95 < 220 ms
POST cart item: p95 < 300 ms
POST checkout order: p95 < 900 ms sin proveedor externo lento
GET tracking: p95 < 250 ms con cache si proveedor externo es lento
```

Los números se ajustan con medición real, pero debe existir presupuesto desde el inicio.

### 17.2 Catálogo

```txt
- Evitar joins gigantes en request path.
- Crear read models para cards de producto.
- Cachear categorías y facetas estables.
- Usar CDN para imágenes.
- No devolver especificaciones completas en cards.
- Separar endpoint de detalle de producto.
```

### 17.3 Search

```txt
- Debounce en frontend no reemplaza rate limit backend.
- Autocomplete con límite pequeño.
- Query timeout.
- Cache de búsquedas populares.
- Ranking determinístico.
- Sanitización de query.
```

### 17.4 Base de datos

```txt
- Medir query count por endpoint.
- Bloquear N+1 en tests si es posible.
- EXPLAIN ANALYZE para queries críticas.
- Statement timeout.
- Pool size calculado.
- Migraciones con índices concurrentes si aplica.
```

### 17.5 Cache

Cachear solo cuando la invalidación esté diseñada.

Buenas candidatas:

```txt
- árbol de categorías
- marcas visibles
- facetas populares
- producto publicado por slug
- landing/home data
- configuración pública
```

No cachear sin cuidado:

```txt
- carrito
- checkout
- documentos
- datos personales
- permisos
```

### 17.6 Degradación elegante

Si un proveedor falla:

```txt
- búsqueda puede mostrar fallback básico
- tracking puede mostrar último estado conocido
- IA puede mostrar recomendaciones precomputadas
- email puede reintentarse por cola
- generación de documento puede quedar en estado pending
```

## 18. Configuración por ambientes

### 18.1 Validación de env

El backend no debe arrancar si falta configuración crítica.

Validar:

```txt
NODE_ENV
PORT
DATABASE_URL
REDIS_URL
JWT_PUBLIC_KEY/JWT_PRIVATE_KEY o secret manager ref
COOKIE_SECRET
CORS_ALLOWED_ORIGINS
LOG_LEVEL
AI_SERVICE_URL
AI_SERVICE_TOKEN
STORAGE_BUCKET
```

### 18.2 Separación

```txt
development != staging != production
```

Nunca usar credenciales productivas en local. Nunca permitir `DEBUG=true` en producción.

### 18.3 Feature flags

Usar feature flags para:

```txt
- nuevas búsquedas
- nuevo checkout
- IA beta
- nuevos proveedores
- promos experimentales
- cambios de ranking
```

Cada flag debe tener owner, fecha de revisión y plan de eliminación.

## 19. Jobs y procesos async

### 19.1 Cuándo usar job

```txt
- emails
- indexación de búsqueda
- generación de documentos
- sincronización de tracking
- limpieza de reservas vencidas
- cálculo de recomendaciones
- exportaciones
- thumbnails
- auditoría pesada
```

### 19.2 Reglas de job perfecto

```txt
- idempotente
- con reintentos limitados
- con backoff
- con dead letter queue
- con timeout
- con logs por jobId
- con trazabilidad al request/evento original
- con métricas de éxito/fallo
```

### 19.3 Reservas expiradas

Un job periódico debe liberar reservas vencidas:

```txt
- buscar reservas `expires_at < now` y estado ACTIVE
- marcar EXPIRED
- liberar stock
- emitir StockReservationExpired
- procesar en lotes
```

## 20. Testing

### 20.1 Pirámide de pruebas

```txt
Unit tests: reglas de dominio y policies
Application tests: use cases con repos fake o test DB
Integration tests: DB real con Testcontainers
HTTP tests: rutas y contratos
Contract tests: OpenAPI y clientes
E2E tests: flujos críticos
Security tests: auth, permisos, rate limits, input malicioso
Load tests: endpoints calientes
Migration tests: subir/bajar migraciones y datos representativos
```

### 20.2 Tests obligatorios por endpoint

Cada endpoint público debe probar:

```txt
- request válido
- body inválido
- params inválidos
- query inválida
- no autenticado si requiere auth
- autenticado sin permiso
- recurso inexistente
- recurso de otro usuario
- límite/rate limit si aplica
- respuesta no filtra campos internos
```

### 20.3 Tests de autorización

Crear tests específicos contra BOLA/IDOR.

Ejemplo:

```txt
customer A crea pedido
customer B intenta leer pedido de A
respuesta debe ser 404 o 403 según política, nunca 200
```

### 20.4 Tests de checkout

```txt
- carrito vacío falla
- producto sin stock falla
- precio cambió: recalcula y avisa
- request duplicada con misma idempotency key no duplica orden
- misma idempotency key con payload distinto falla
- falla parcial no deja stock bloqueado incorrectamente
```

### 20.5 Tests de contrato

```txt
- OpenAPI genera cliente sin errores
- Schemas de request/response están sincronizados
- Campos requeridos no desaparecen
- Errores tienen formato estándar
```

### 20.6 Tests de carga

Escenarios mínimos:

```txt
- catálogo listado
- búsqueda/autocomplete
- página producto
- agregar al carrito
- checkout
- tracking
- documentos cliente
- endpoint IA con cache y sin cache
```

Medir p50, p95, p99, error rate, DB CPU, memory, event loop delay.

## 21. Calidad de código

### 21.1 TypeScript estricto

`tsconfig` debe incluir:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

No usar `any` salvo excepción documentada. Preferir `unknown` y narrowing.

### 21.2 Result pattern

Para errores de negocio esperados, preferir Result/Either o errores tipados controlados. Evitar excepciones para flujos normales.

Ejemplo:

```ts
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

### 21.3 Errores de dominio

```txt
ProductNotPublishable
InsufficientStock
InvalidOrderTransition
UnauthorizedResourceAccess
DocumentNotAvailable
AddressNotDeliverable
PriceChanged
```

Cada error debe mapear a HTTP status y `code` público.

### 21.4 Naming

```txt
Use cases: verbo + recurso -> CreateOrder, ReserveStock
Queries: GetProductDetail, SearchProducts
Policies: CanCancelOrderPolicy
Repositories: ProductRepository
DTOs: CreateOrderInput, OrderSummaryResponse
Events: OrderCreated
```

### 21.5 Sin lógica oculta

Evitar hooks mágicos del ORM para reglas críticas. Las reglas de negocio deben ser visibles en use cases/domain.

## 22. CI/CD

### 22.1 Pipeline mínimo

```txt
1. install con lockfile congelado
2. lint
3. typecheck
4. unit tests
5. integration tests
6. contract/openapi validation
7. build
8. dependency audit/SCA
9. container build
10. vulnerability scan de imagen
11. migration dry-run
12. deploy staging
13. smoke tests
14. deploy production con rollback
```

### 22.2 Branch protection

```txt
- PR obligatorio
- reviews obligatorias para módulos críticos
- CI verde obligatorio
- no force-push en main
- secrets scanning
- CODEOWNERS para security, checkout, auth, documents
```

### 22.3 Migraciones

```txt
- Toda migración tiene nombre claro.
- No hacer cambios destructivos sin plan expand/contract.
- Backfills por lotes.
- Índices grandes concurrentes cuando aplique.
- Rollback o mitigación documentada.
```

## 23. Deploy y runtime

### 23.1 Docker

```dockerfile
# patrón conceptual
FROM node:lts-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:lts-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:lts-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
USER node
COPY --from=build /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
CMD ["node", "dist/main.js"]
```

Ajustar según framework, pero mantener multi-stage y usuario no-root.

### 23.2 Health checks

```txt
GET /health/live -> proceso vivo
GET /health/ready -> DB/Redis/conexiones esenciales OK
GET /health/startup -> inicialización completa
```

Readiness debe fallar durante shutdown.

### 23.3 Rollback

El deploy debe poder revertirse. Las migraciones deben diseñarse para convivir con versión anterior durante transición.

## 24. Documentación viva

### 24.1 ADRs

Cada decisión grande requiere ADR.

```txt
- framework HTTP elegido
- ORM/query builder
- estrategia auth
- patrón de idempotencia
- motor de búsqueda
- estrategia de IA gateway
- cola de jobs
- storage de documentos
```

### 24.2 Runbooks

Runbooks mínimos:

```txt
- checkout fallando
- DB saturada
- Redis caído
- cola trabada
- proveedor de envíos caído
- documentos no generan
- errores 401/403 masivos
- latencia de catálogo alta
- IA no responde
- rotación de secrets
```

### 24.3 API docs

OpenAPI debe ser visible para devs internos y, si aplica, partners. Nunca exponer endpoints internos públicamente sin auth.

## 25. Seguridad de datos y privacidad

### 25.1 Minimización

Guardar solo lo necesario.

```txt
- No guardar datos de pago sensibles si un proveedor puede tokenizarlos.
- No duplicar PII en logs/eventos.
- No enviar datos innecesarios a IA.
- No incluir documentos completos en eventos si basta un documentId.
```

### 25.2 Retención

Definir retención para:

```txt
- logs
- auditoría
- documentos
- sesiones
- tokens revocados
- eventos de analytics
- conversaciones IA
```

### 25.3 Exportación y borrado

Diseñar desde el inicio endpoints/procesos para que el usuario pueda acceder, corregir o eliminar datos cuando aplique legal y operativamente.

## 26. Convenciones de errores

### 26.1 Catálogo base

```txt
VALIDATION_FAILED -> 400
UNAUTHENTICATED -> 401
FORBIDDEN -> 403
RESOURCE_NOT_FOUND -> 404
CONFLICT -> 409
IDEMPOTENCY_CONFLICT -> 409
RATE_LIMITED -> 429
UPSTREAM_UNAVAILABLE -> 502/503
INTERNAL_ERROR -> 500
```

### 26.2 Errores de negocio

```txt
INSUFFICIENT_STOCK -> 409
PRICE_CHANGED -> 409
PRODUCT_NOT_AVAILABLE -> 409
INVALID_ORDER_STATE -> 409
ADDRESS_NOT_DELIVERABLE -> 422
DOCUMENT_NOT_READY -> 409
SHIPMENT_TRACKING_UNAVAILABLE -> 503 con fallback si hay último estado
```

### 26.3 Mensajes públicos

Mensajes al cliente deben ser claros, no técnicos.

```txt
No: "PrismaClientKnownRequestError P2002"
Sí: "No pudimos completar la operación porque el recurso ya existe."
```

## 27. Checklist por módulo

### 27.1 Checklist general

Antes de aprobar un módulo:

```txt
[ ] Tiene README interno.
[ ] Tiene entidades o modelos claros.
[ ] Tiene schemas de entrada.
[ ] Tiene presenters de salida.
[ ] Tiene casos de uso testeados.
[ ] Tiene permisos testeados.
[ ] Tiene errores tipados.
[ ] Tiene OpenAPI.
[ ] Tiene logs relevantes.
[ ] Tiene métricas si es crítico.
[ ] No filtra detalles internos.
[ ] No accede a tablas ajenas sin contrato.
[ ] Tiene migraciones revisadas.
```

### 27.2 Checklist endpoint público

```txt
[ ] Auth definida: pública, cliente, admin, interna.
[ ] Rate limit definido.
[ ] Body size limit definido.
[ ] Params/query/body validados.
[ ] Ownership/permissions validados.
[ ] Response schema definido.
[ ] Error mapping definido.
[ ] RequestId propagado.
[ ] Logs sin PII.
[ ] Tests de éxito y error.
[ ] OpenAPI actualizado.
```

### 27.3 Checklist endpoint interno

```txt
[ ] No está expuesto públicamente.
[ ] Requiere token interno o mTLS/red privada.
[ ] Tiene allowlist de servicio si aplica.
[ ] Tiene rate limit.
[ ] Tiene schema.
[ ] Tiene auditoría si maneja datos sensibles.
```

## 28. Definición de Done global

Una funcionalidad backend no está terminada hasta que:

```txt
[ ] La regla de negocio vive en domain/application, no en controller.
[ ] Todo input externo está validado.
[ ] Todos los errores esperados son tipados.
[ ] Hay tests unitarios y de integración.
[ ] Hay test de autorización negativa.
[ ] El endpoint está en OpenAPI.
[ ] Hay logs con requestId.
[ ] Hay métricas si el flujo es crítico.
[ ] No se loggea PII innecesaria.
[ ] No hay `any` no justificado.
[ ] El módulo funciona con migraciones desde cero.
[ ] El módulo funciona en staging con smoke test.
[ ] Se agregó o actualizó runbook si el flujo es operativo.
```

## 29. Antipatrones prohibidos

```txt
- Controllers con lógica de negocio.
- Repositorios que deciden permisos.
- Frontend enviando precios finales confiables.
- `req.body` directo al ORM.
- Endpoints sin límite de paginación.
- Errores crudos del ORM al cliente.
- Logs con tokens/cookies.
- IDs de otros usuarios accesibles sin ownership check.
- Jobs no idempotentes.
- Webhooks sin firma.
- Variables de entorno no validadas.
- Migrations manuales no versionadas.
- Cachear datos personales sin diseño.
- Usar `any` para evitar pensar tipos.
- Agregar dependencias sin revisar mantenimiento y seguridad.
```

## 30. Referencias técnicas base

Usar estas fuentes como guía de verificación, no como decoración:

```txt
OWASP ASVS 5.0.0 para requerimientos de seguridad de aplicación.
OWASP API Security Top 10 2023 para amenazas API prioritarias.
Node.js Security Best Practices para amenazas específicas de runtime Node.
Django/Python solo para servicio IA separado, no para backend core TS/Node.
```

## 31. Resultado esperado final

Cuando esta skill se use correctamente, el backend de cloudcommerce debe sentirse invisible para el usuario y evidente para el equipo: no estorba, no sorprende con errores absurdos, no pierde datos, no duplica compras, no muestra información ajena, no se cae por payloads tontos, no oculta lo que pasa y no obliga a reescribir todo cada vez que crece el negocio.

La estética del frontend vende la experiencia. Este backend debe sostener la promesa.
