# 04 · Pedidos (dominio `orders`)

Backend: [15-modulo-ordenes](../../backend/modulos/15-modulo-ordenes.md). Enum de referencia:
`OrderStatus` (`DRAFT → PENDING_CONFIRMATION → CONFIRMED → PREPARING → READY_TO_SHIP → SHIPPED →
DELIVERED`, con ramas `CANCELLED` y `RETURN_REQUESTED → RETURNED`).

## Pantallas

| Ruta | Patrón | Qué hace |
|---|---|---|
| `pedidos` | Lista | Filtro por estado (tabs o select), búsqueda por número/cliente, columnas: número, cliente, total, estado, fecha |
| `pedidos/nuevo` | Wizard | Alta manual: buscar/crear cliente → agregar productos → dirección/envío → confirmar |
| `pedidos/[id]` | Detalle | Ver layout abajo |

## Detalle de pedido

```
[ header: número + status-badge + acciones de transición válidas desde el estado actual ]
[ columna principal: líneas del pedido (producto, cantidad, precio, subtotal) ]
[ columna lateral: ]
  [ activity-timeline: historial de OrderStatus con fecha/actor de cada transición ]
  [ datos de envío: ShipmentStatus (CREATED → ... → DELIVERED), tracking si existe ]
  [ datos de cliente: link al detalle en el módulo de clientes ]
  [ totales: subtotal, descuentos, envío, total — margen* solo con permiso ]
```
\* margen oculto para roles sin `finance.read_margin`, igual criterio que dashboard.

## Transiciones de estado

El botón de acción muestra **solo** las transiciones válidas desde el estado actual (el backend ya
valida esto con lock optimista — ver auditoría — pero la UI no debe ni ofrecer una transición
inválida). Transiciones que requieren motivo (ej. cancelación, `RETURN_REQUESTED`) abren un
`confirm-dialog` con campo de texto obligatorio antes de confirmar.

## Devoluciones

`DELIVERED → RETURN_REQUESTED` es una transición habilitada (cerrada en la auditoría del backend) —
el detalle de pedido debe ofrecerla incluso después de entregado, con motivo obligatorio.

## Reenvío a proveedor (solo lectura para el admin, informativo)

Si el pedido tiene línea(s) de proveedor con reenvío fallido, mostrar un badge de advertencia con el
último error (`api_not_configured`, `ssrf_blocked`, etc. — mapeados a texto legible, nunca el código
crudo del backend) y quién puede resolverlo (link al módulo de proveedores si el rol lo permite).
