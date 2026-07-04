# 07 · Finanzas (dominio `finance`)

Backend: [16-modulo-finanzas](../../backend/modulos/16-modulo-finanzas.md). Visible para
`OWNER`/`ADMIN`/`FINANCE`.

## Pantallas

| Ruta | Patrón | Qué hace |
|---|---|---|
| `finanzas` | Lista | Documentos (remito/factura/nota de crédito), filtro por tipo/período, columnas: número, tipo, pedido asociado, monto, fecha |
| `finanzas/[id]` | Detalle | Vista del documento (PDF embebido o preview), metadata, acciones |
| `finanzas/periodos` | Lista simple | Cierres de período, totales agregados |

## Detalle de documento

```
[ preview del PDF (iframe o visor embebido) ]
[ metadata: número, tipo, pedido origen, documento relacionado (nota de crédito → factura que corrige) ]
[ acciones: Descargar, Regenerar (con confirm-dialog — vuelve a renderizar y guardar), Anular (destructiva) ]
```

## Nota de crédito

El formulario de creación de nota de crédito requiere seleccionar la factura que corrige
(`relatedDocumentId`, campo agregado en la corrección de la auditoría) — un `combobox` que busca
facturas por número, no un ID pegado a mano.

## Export

Botón de exportación (CSV/rango de fechas) en la lista — dispara un job asíncrono si el backend lo
maneja así (no bloquear la UI esperando un archivo grande); mostrar el resultado como notificación con
link de descarga cuando esté listo, no un spinner de minutos.

## Números de documento

La UI nunca permite "elegir" un número de documento — siempre lo asigna el backend de forma
secuencial. Si una generación falla, el mensaje de error debe ser claro sobre que el documento no se
emitió (no dejar ambigüedad sobre si el número se usó o no).
