# 05 · Clientes (dominio `customers`)

Backend: [11-modulo-clientes](../../backend/modulos/11-modulo-clientes.md). Enum de referencia:
`CustomerTier` (`CloudBase`, `CloudPlus`, `CloudPrime`).

## Pantallas

| Ruta | Patrón | Qué hace |
|---|---|---|
| `clientes` | Lista | Búsqueda por nombre/teléfono, filtro por tier, columnas: nombre, tier (badge), última compra, total gastado* |
| `clientes/nuevo` | Formulario simple | Nombre, apellido, WhatsApp (opcional), domicilio AR |
| `clientes/[id]` | Detalle | Ver layout abajo |

\* total gastado visible según permiso — `SUPPORT` puede necesitar motivo, ver matriz en
[05-navegacion-y-permisos](../05-navegacion-y-permisos.md).

## Detalle de cliente

```
[ header: nombre + tier badge + acciones (editar, registrar contacto) ]
[ columna principal: ]
  [ analítica: compras totales, gasto total, ticket promedio — gráfico simple de compras en el tiempo ]
  [ historial de pedidos del cliente (data-table reducida, reutiliza columnas del módulo pedidos) ]
[ columna lateral: ]
  [ domicilios (uno o más, AR) ]
  [ consentimientos: CustomerConsentKind (marketing WhatsApp/email, tratamiento de datos) como switches ]
  [ log de contactos: CustomerContactChannel (llamada/WhatsApp/email/otro) × dirección (entrante/saliente) ]
```

## Registrar contacto

Modal rápido (no rompe el flujo de estar viendo el pedido/cliente): canal, dirección, nota. Pensado
para uso frecuente durante una llamada — mínima fricción, campos mínimos.

## Motivo de acceso (SUPPORT)

Cuando el rol requiere motivo para ver datos sensibles (WhatsApp, domicilio), el frontend pide el
motivo **antes** de llamar al procedimiento (un `Dialog` simple con un textarea), no después — el
backend lo registra en `access_log` con ese motivo adjunto.
