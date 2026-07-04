# 06 · Pricing (dominio `pricing`)

Backend: [14-modulo-pricing](../../backend/modulos/14-modulo-pricing.md). Solo visible para
`OWNER`/`ADMIN` — ver matriz de permisos.

## Pantallas

| Ruta | Patrón | Qué hace |
|---|---|---|
| `pricing/reglas` | Lista | Reglas de markup por `PricingScope` (global/categoría/producto), tipo `PricingValueKind` (%/fijo) |
| `pricing/reglas/nueva` | Formulario | Alcance, tipo de valor, vigencia (desde/hasta) |
| `pricing/[variantId]` | Detalle | Costo de proveedor actual + histórico (gráfico de dataviz §3.7), precio manual vs. computado (`PriceOrigin`) |

## Simulador de margen

Componente embebido en el detalle de variante: input de costo hipotético + regla aplicable → muestra
precio resultante y margen %, **antes** de guardar — para que cambiar una regla global no sea a
ciegas. Puramente client-side sobre la misma fórmula que expone el backend (o, si el backend expone un
endpoint de "preview", usarlo — no reimplementar la fórmula de negocio en el frontend si existe un
procedimiento equivalente).

## Precio manual vs. computado

`PriceOrigin.MANUAL` vs `PriceOrigin.COMPUTED` se muestra siempre como un badge junto al precio — un
precio manual "pisa" la regla automática hasta que se borra explícitamente; la UI lo deja inequívoco
para evitar que alguien piense que cambiar la regla global va a mover ese precio.

## Multi-moneda (costo de proveedor)

El costo de proveedor puede tener filas abiertas simultáneas en distintas monedas (ARS/USD, ver
auditoría del backend — corregido para permitir esto). El historial de costo agrupa por moneda, no
las mezcla en una sola línea de tiempo.
