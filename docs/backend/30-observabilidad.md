# 30 · Observabilidad

Un backend serio permite **detectar problemas antes de que el cliente los reporte**. Tres pilares: logs,
métricas y traces; más health checks y alertas.

## Logs estructurados (Pino, JSON)

Cada log relevante lleva:

```txt
level, time, requestId, traceId, spanId, actorId?, actorRole?,
route, method, statusCode, durationMs, module, action,
resourceType, resourceId?, errorCode?
```

**Nunca** loggear: passwords, tokens, cookies completas, documentos completos, números de tarjeta, PII
innecesaria, headers sensibles, `supplier_cost` en contextos no autorizados.

`pino-http` para el log de request/response. Un `requestId` por request, propagado a DB, Redis, jobs,
clientes HTTP externos e IA.

## Métricas (OpenTelemetry / Prometheus)

Mínimas:

```txt
http_requests_total, http_request_duration_seconds, http_request_errors_total
db_query_duration_seconds, redis_operation_duration_seconds
jobs_processed_total, jobs_failed_total
checkout_attempts_total, checkout_success_total
stock_reservation_failures_total
search_latency_seconds
ai_requests_total, ai_request_duration_seconds, ai_cost_estimate_total
```

Métricas de negocio derivables del dashboard ([18](./modulos/18-modulo-dashboard-analytics.md)) no reemplazan
las técnicas.

## Tracing

Cada request crea un trace. Se propaga a: DB, Redis, jobs (BullMQ), clientes HTTP externos, servicio IA,
proveedor de envíos, generación de documentos. Permite reconstruir un checkout end-to-end.

## Health checks

```txt
GET /health/live     → proceso vivo
GET /health/ready    → DB/Redis/conexiones esenciales OK (falla durante shutdown)
GET /health/startup  → inicialización completa
```

`readiness=false` al recibir SIGTERM (parte del graceful shutdown, [08](./08-seguridad.md)).

## Alertas mínimas

```txt
- error rate 5xx alto
- p95 de latencia alto
- checkout success rate cae
- conexiones DB cerca del límite
- backlog de cola creciente
- jobs fallando repetidamente
- Redis caído
- stock_reservation_failures anómalas
- webhooks con firma inválida en aumento
- latencia/error rate de IA alto
```

## Correlación

`requestId` (HTTP) ↔ `traceId` (otel) ↔ `jobId` (BullMQ) ↔ `outbox.id` (eventos) ↔ `audit_log.request_id`.
Un incidente se investiga siguiendo esa cadena. Los runbooks ([33](./33-devops-y-deploy.md)) asumen esta correlación.
