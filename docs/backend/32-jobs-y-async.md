# 32 · Jobs y procesos async

Trabajo pesado o diferido **nunca** vive en el request path. Se mueve a **BullMQ** (Redis). Los productores
viven en `apps/api/infrastructure/queue`; los consumers en **`apps/workers`** (proceso separado).

## Cuándo usar un job

```txt
- emails transaccionales (confirmación, tracking)
- indexación de búsqueda (sync read model de catálogo)
- generación de documentos (PDF de remito/factura/NC)
- procesamiento de imágenes (thumbnails, dominant_color, blur)
- import de feeds de proveedor
- reenvío de pedidos al proveedor (dropshipping)
- sincronización de tracking de envíos
- limpieza de reservas de stock vencidas
- cálculo/recompute de read models del dashboard y snapshots financieros
- generaciones IA no interactivas (alertas de precio/stock/trend)
- exportaciones
```

## Reglas de un job perfecto

```txt
- idempotente (reejecución no duplica efectos)
- reintentos limitados con backoff exponencial
- dead-letter queue (DLQ) para fallos definitivos
- timeout por job
- logs por jobId, correlacionados al requestId/evento original
- métricas de éxito/fallo (jobs_processed_total, jobs_failed_total)
- sin acceso a datos que no necesita
```

## Patrón Outbox (fuente de los jobs de dominio)

Para efectos que cruzan el límite transaccional:

```txt
1. Dentro de la transacción del caso de uso: se muta estado + se inserta fila en `outbox`
   (aggregate_type, aggregate_id, event_type, payload, status=pending, available_at).
2. Un worker "outbox dispatcher" lee filas pending, publica el evento / encola el job.
3. Marca processed (o failed con reintentos seguros).
```

Garantiza que "orden creada" y "reenviar a proveedor / enviar email" nunca se desincronicen. Tabla `outbox`
en [04](./04-modelo-de-datos.md).

## Eventos → jobs (mapa)

| Evento de dominio | Job disparado |
|-------------------|---------------|
| `OrderConfirmed` | reenviar pedido al proveedor · generar documento · email de confirmación · recompute dashboard/finanzas |
| `ProductPublished` | indexar en búsqueda · warm cache de card |
| `PriceChanged` | reindexar · invalidar cache de producto |
| `MediaUploaded` | procesar imagen (thumbnails/color/blur) |
| `ShipmentStatusChanged` | email de tracking |
| `StockReservationExpired` | liberar stock (emitido por el propio job de expiración) |

## Jobs programados (cron)

```txt
- liberar reservas vencidas: buscar stock_reservation (status=ACTIVE, expires_at<now),
  marcar EXPIRED, liberar stock, emitir StockReservationExpired. Procesar en lotes.
- import de feeds de proveedor según supplier_feed.schedule
- sync de tracking de envíos activos
- recompute de finance_period_snapshot del período en curso
- limpieza de idempotency_key / tokens expirados
```

## Degradación elegante

Si un proveedor falla, el sistema no cae:

```txt
- búsqueda → fallback básico
- tracking → último estado conocido
- IA → recomendaciones precomputadas / mensaje de no disponible
- email → reintento por cola
- generación de documento → queda en estado pending (DOCUMENT_NOT_READY hasta completar)
```

## Relación con módulos

Cada módulo declara sus jobs en su doc: catálogo (indexación, thumbnails), inventario (expiración),
finanzas (PDF), suppliers (import/reenvío/tracking), ia-gateway (alertas), dashboard (recompute). Este
documento es el contrato transversal que todos referencian.
