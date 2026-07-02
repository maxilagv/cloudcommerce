# 08 · Seguridad

Referencias de verificación: **OWASP ASVS 5.0**, **OWASP API Security Top 10 (2023)**, **Node.js Security
Best Practices**. Se usan como checklist, no como decoración.

## Amenazas prioritarias (API Top 10)

El backend cubre explícitamente:

```txt
- BOLA — Broken Object Level Authorization (ownership en cada acceso a recurso)
- Broken Authentication (ver 07)
- BOPLA — Broken Object Property Level Authorization (presenters que ocultan campos internos)
- Unrestricted Resource Consumption (rate limits, paginación, body limits, timeouts)
- BFLA — Broken Function Level Authorization (rol verificado por función, no solo por ruta)
- Unrestricted Access to Sensitive Business Flows (anti-abuso de checkout, IA, documentos)
- SSRF (allowlist de URLs salientes)
- Security Misconfiguration (headers, CORS, env validada)
- Improper Inventory Management (OpenAPI vivo, no endpoints fantasma expuestos)
- Unsafe Consumption of APIs (validar respuestas de terceros)
```

## Rate limiting (contextual, nunca uno global)

| Flujo | Clave de límite |
|-------|-----------------|
| Login | IP + email + device fingerprint |
| Registro/alta | IP + email/dominio |
| Search / autocomplete | IP + user + hash de query |
| Mutaciones de carrito | user/session |
| Checkout | user/session + Idempotency-Key |
| Webhooks | proveedor + firma + IP allowlist |
| IA | user + costo estimado (cuota por actor) |
| Admin | user + IP + rol |

Implementado con Redis (token bucket / sliding window). `429` incluye `Retry-After`.

## Abuso de flujos comerciales

Ataques que usan flujos legítimos automatizados. Proteger:

```txt
creación masiva de cuentas · scraping de catálogo · abuso de autocomplete ·
reservas de stock falsas · repetición de checkout · generación masiva de documentos ·
tracking spam · abuso de IA/recomendaciones
```

Herramientas: rate limits contextuales, cuotas por actor, captcha solo cuando sube el riesgo, detección de
anomalías, idempotencia, costo máximo por operación (IA), degradación elegante.

## CORS

Allowlist estricto por ambiente. Nunca `origin: *` con credenciales.

```txt
Producción:  https://admin.cloudcommerce...  ,  https://cloudcommerce...(store)
Staging:     https://staging-admin...        ,  https://staging...
Local:       http://localhost:3000 (store) , http://localhost:3001 (admin)  — solo development
```

## Security headers

Aunque muchos se apliquen en proxy/CDN, el backend los conoce y setea donde corresponde:

```txt
Strict-Transport-Security
X-Content-Type-Options: nosniff
Referrer-Policy
Content-Security-Policy (donde aplique)
Permissions-Policy
Cache-Control correcto en respuestas sensibles (no cachear carrito/documentos/PII)
```

## SSRF

Toda función que reciba URL externa (feeds de proveedor, importación de imágenes por URL, IA) bloquea:

```txt
localhost · 127.0.0.0/8 · 10.0.0.0/8 · 172.16.0.0/12 · 192.168.0.0/16 ·
link-local · metadata services (169.254.169.254) · protocolos no HTTP/HTTPS ·
redirects hacia redes privadas
```

Validar resolución DNS y bloquear redirects a rangos privados. Nunca dejar que un usuario fuerce al backend
a descargar recursos internos.

## Webhooks (Stripe, proveedores)

Cada webhook verifica:

```txt
firma HMAC / mecanismo oficial · timestamp anti-replay · idempotencia por eventId ·
schema de payload · origen/IP si aplica · orden de eventos si importa
```

Nunca asumir entrega única ni ordenada. `interfaces/webhooks/` verifica antes de tocar el dominio.

## Prototype pollution

Bloquear `__proto__`/`prototype`/`constructor` al parsear objetos del usuario (relevante en `attributes`
y `specs` jsonb). Evitar deep-merge inseguro.

## Node.js runtime

- **No bloquear el event loop**: prohibido en request path → loops gigantes sin límite, `JSON.stringify` de
  payloads enormes, regex vulnerables a ReDoS, crypto síncrono costoso, parsing de archivos grandes en
  memoria. Trabajo pesado → cola/worker.
- **Timeouts** configurados: `headersTimeout`, `requestTimeout`, `keepAliveTimeout`, body size limit,
  upstream timeout, `statement_timeout` de PostgreSQL, timeout de Redis y de jobs. Un backend sin timeouts
  es un backend esperando fallar.
- **Reverse proxy** en producción (TLS, buffering, límites, WAF, DoS).
- **Graceful shutdown** (SIGTERM): readiness=false → cerrar HTTP a nuevas conexiones → drenar activas con
  timeout → cerrar DB/Redis/colas → flush logs/traces → exit 0.
- **Proceso**: contenedor no-root, filesystem read-only donde se pueda, sin docker socket, variables mínimas.

## Secrets

```txt
- Nunca commitear .env real.  - Secret manager en producción.
- Rotación documentada (runbook). - Secrets separados por ambiente.
- No loggear secrets ni headers sensibles. - Validar env vars al boot (falla si falta crítica).
```

Env crítica validada al arranque ([03](./03-stack-y-decisiones.md)): `NODE_ENV, PORT, DATABASE_URL, REDIS_URL,
BETTER_AUTH_SECRET, COOKIE_SECRET, CORS_ALLOWED_ORIGINS, LOG_LEVEL, AI_SERVICE_URL, AI_SERVICE_TOKEN,
STORAGE_*, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY`.

## Supply chain

```txt
lockfile obligatorio · install --frozen-lockfile en CI · revisión de paquetes nuevos ·
pinning razonable · auditoría de dependencias (SCA en pipeline) · bloqueo de install scripts si es viable ·
Dependabot/Renovate con tests completos · nunca secrets en npmrc/env
```

## Auditoría (`audit_log` + `access_log`)

Operaciones críticas registran: `actorId, actorType, action, resourceType, resourceId, before, after, ip,
userAgent, requestId, reason, timestamp`. **No** auditar passwords, tokens ni PII innecesaria.

## Privacidad y datos

- **Minimización**: guardar solo lo necesario; no duplicar PII en logs/eventos; no enviar datos innecesarios
  a IA; usar `documentId` en eventos, no el documento completo.
- **Retención** definida para: logs, auditoría, documentos, sesiones, tokens revocados, analytics,
  conversaciones IA.
- **Exportación/borrado**: diseñar desde el inicio el acceso/corrección/eliminación de datos del cliente
  cuando aplique legal y operativamente.

## Antipatrones prohibidos

```txt
- Controllers con lógica de negocio       - Repos que deciden permisos
- Frontend enviando precios finales       - req.body directo al ORM
- Endpoints sin límite de paginación      - Errores crudos del ORM al cliente
- Logs con tokens/cookies                 - IDs ajenos accesibles sin ownership
- Jobs no idempotentes                    - Webhooks sin firma
- Env vars no validadas                   - Migraciones manuales no versionadas
- Cachear datos personales sin diseño     - `any` para evitar pensar tipos
```
