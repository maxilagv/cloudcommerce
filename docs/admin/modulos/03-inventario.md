# 03 · Inventario (dominio `inventory`)

Backend: [13-modulo-inventario](../../backend/modulos/13-modulo-inventario.md).

## Pantallas

| Ruta | Patrón | Qué hace |
|---|---|---|
| `inventario` | Lista | Por variante: producto, SKU, disponible (`onHand - reserved`), reservado, punto de reorden, `status-badge` con `StockStatus` |
| `inventario/[variantId]` | Detalle | Ajuste manual + historial de movimientos (gráfico step-line, ver dataviz §3.6) |

## Ajuste manual de stock

Modal (no pantalla completa) con: cantidad (+/-), motivo (texto libre requerido — queda en el log de
auditoría del backend), y una vista previa del resultado ("Disponible pasará de 12 a 8") antes de
confirmar. Es una acción sensible a condiciones de carrera (ya resuelta atómicamente en el backend —
ver auditoría, `adjustStock` corregido) — el frontend no necesita lógica especial más que mostrar el
error si el backend rechaza el ajuste (ej. resultaría en stock negativo).

## Historial de movimientos

Tabla + gráfico combinados: `StockMovementType` (`IMPORT`, `SALE`, `RETURN`, `ADJUSTMENT`,
`RESERVATION`, `RELEASE`) cada uno con su color fijo (ver dataviz §3.6), filtrable por tipo y rango de
fecha.

## Alertas de stock bajo

Reutiliza el mismo read model que el dashboard (`dashboard.getLowStockAlerts`) pero sin límite de
20 — acá es la vista completa, con acción directa "Ajustar" por fila.
