# 07 · Gráficos y dataviz

> Al implementar cualquier gráfico de este documento, cargar la skill `dataviz` del entorno antes de
> escribir el primer componente — define la heurística de forma, la fórmula de color y las reglas de
> interacción en detalle. Este documento fija **qué gráfico va en qué pantalla y con qué dato**; la
> skill fija **cómo construirlo bien**.

## 1. Principio: cada gráfico responde una pregunta, no decora

Antes de agregar un gráfico a una pantalla, la pregunta que responde tiene que poder decirse en una
frase. Si no, no va. Este documento mapea cada gráfico del admin a esa pregunta y a su fuente exacta
en el backend (todas ya definidas en
[`docs/backend/modulos/18-modulo-dashboard-analytics.md`](../backend/modulos/18-modulo-dashboard-analytics.md)
— el frontend no inventa agregaciones, consume los read models tal cual).

## 2. Paleta de datos (separada del accent de marca)

El accent de marca (`--admin-accent`, azul) se reserva para navegación y acciones. Los gráficos usan
una paleta categórica propia, definida como escala — nunca colores elegidos al azar por serie:

```css
--chart-series-1: #0B6BFF;  /* azul marca — serie principal / "esta" métrica */
--chart-series-2: #16A34A;  /* verde — positivo / segunda serie de comparación */
--chart-series-3: #F59E0B;  /* ámbar — atención */
--chart-series-4: #8B5CF6;  /* violeta — categoría/serie neutra adicional */
--chart-series-5: #06B6D4;  /* cian — categoría/serie neutra adicional */
--chart-series-6: #EC4899;  /* rosa — categoría/serie neutra adicional, uso ocasional */
--chart-grid: var(--admin-border-subtle);
--chart-axis-text: var(--admin-text-muted);
--chart-tooltip-bg: var(--admin-bg-surface);
```

En dark mode estos mismos tokens se redefinen con versiones +10–15% de luminosidad (mismo criterio
que `--admin-accent` en dark — ver [03](./03-sistema-de-diseno.md) §2.2), nunca los mismos hex sobre
fondo oscuro (perderían contraste).

Regla: **series comparativas (actual vs. anterior) usan el mismo hue en dos intensidades**, no dos
colores distintos — el ojo lee "mismo dato, otro período" más rápido que "dos colores distintos que
hay que aprender con la leyenda".

## 3. Gráfico por pantalla

### 3.1 Dashboard — Serie temporal de ventas (`dashboard.getSalesTimeSeries`)

- **Pregunta**: ¿cómo viene el negocio en este período comparado con el anterior?
- **Tipo**: Area chart con gradiente (relleno de `--chart-series-1` a transparente, `stop-opacity`
  0.28→0), línea de 2px encima. Serie de comparación (período anterior) como línea punteada más tenue,
  sin relleno, solo si `compareToPrevious` está activo.
- **Eje X**: bucket diario (rango 7d/30d) o mensual (12m) — mismo bucketing que ya define el backend,
  el chart no re-bucketiza nada.
- **Interacción**: hover muestra tooltip con fecha + valor formateado en ARS + variación vs. período
  anterior si aplica. Un solo punto de foco a la vez (línea vertical guía sutil, `--chart-grid`).
- **Selector de rango**: `7d / 30d / 12m` como pill-tabs arriba a la derecha del gráfico, con
  transición de datos (no de tipo de gráfico) al cambiar — ver entrada de gráficos en
  [04](./04-motion-y-microanimaciones.md) §4.2.
- **Toggle de métrica**: `revenue / income / orders` (según lo que expone el endpoint) como segmented
  control junto al selector de rango.

### 3.2 Dashboard — Ventas por categoría (`dashboard.getSalesByCategory`)

- **Pregunta**: ¿qué categorías mueven la aguja?
- **Tipo**: **Bar chart horizontal**, no torta — con 6-8 categorías (el backend ya agrupa el resto en
  "Otras"), un ranking horizontal se lee más rápido que una torta y permite mostrar el valor exacto al
  lado de cada barra sin superposición.
- **Orden**: descendente por el valor, siempre — el ranking es el punto del gráfico.
- **Color**: una sola serie en `--chart-series-1` con opacidad decreciente muy sutil hacia abajo (o
  color plano si la skill `dataviz` recomienda evitar el degradé de opacidad por categoría — decidir
  al implementar según legibilidad real).

### 3.3 Dashboard — Top productos / Top clientes (`getTopProducts`, `getTopCustomers`)

- **Pregunta**: ¿quién/qué es lo más importante ahora mismo?
- **Tipo**: no es un gráfico — es una **lista compacta con barra de progreso inline** (mini bar
  embebida en la fila, proporcional al máximo de la lista) + avatar/thumbnail + valor. Más legible que
  forzar un bar chart tradicional para solo 5 ítems con nombres largos.

### 3.4 Dashboard — Pedidos por estado (`countByStatus`)

- **Pregunta**: ¿dónde está mi negocio operativamente ahora mismo (no en dinero, en flujo)?
- **Tipo**: **Donut chart** (única torta del sistema, justificado: son pocas categorías fijas — los
  10 valores de `OrderStatus` — y lo que importa es la proporción del todo, no un ranking). Centro del
  donut muestra el total de pedidos. Colores = la misma tabla semántica de `StatusBadge`
  ([03](./03-sistema-de-diseno.md) §6.4), no la paleta categórica de §2 — así el gráfico y los badges
  de la tabla de pedidos "hablan el mismo idioma" visual.

### 3.5 Dashboard — Stock bajo (`getLowStockAlerts`)

- **Pregunta**: ¿qué necesito reponer ya?
- **Tipo**: no es un gráfico — lista accionable (producto, disponible, punto de reorden, botón directo
  a "Ajustar stock" o "Ver en catálogo"). Un gráfico acá sería ruido; lo que hace falta es la acción.

### 3.6 Inventario — Movimientos de stock

- **Pregunta**: ¿qué pasó con el stock de este producto a lo largo del tiempo?
- **Tipo**: Step-line chart (el stock cambia en saltos discretos, no gradualmente — una línea suave
  mentiría sobre la forma del dato) con marcadores de color por tipo de movimiento
  (`StockMovementType`: import=verde, sale=azul, adjustment=ámbar, return=violeta) en el eje.

### 3.7 Pricing — Historial de costo/precio

- **Pregunta**: ¿cómo evolucionó el margen de este producto?
- **Tipo**: dos líneas (costo proveedor, precio de venta) sobre el mismo eje, con el área entre ambas
  sombreada sutilmente en verde/rojo según el margen sea positivo o se haya achicado — el área
  **es** la respuesta visual a "¿cuánto estoy ganando", no hace falta leer los dos valores y restar
  mentalmente.

### 3.8 Herramientas IA — Uso y costo

- **Pregunta**: ¿cuánto estoy gastando en IA y en qué?
- **Tipo**: bar chart apilado por tipo de generación (descripción/SEO/pricing/recomendación) sobre
  serie temporal corta (últimos 30 días), con el costo total del período como KPI destacado arriba.

## 4. Reglas transversales de todos los gráficos

1. **Nunca más de 6 series simultáneas** en un mismo gráfico — más que eso, se agrupa el resto en
   "Otros" (mismo criterio que ya aplica el backend en ventas por categoría).
2. **Tooltip siempre presente en hover**, con el valor exacto formateado (ARS con separador de miles,
   nunca notación abreviada tipo "1.2k" en el tooltip — sí puede abreviarse en el eje si el espacio
   aprieta).
3. **Grid sutil, casi invisible** (`--chart-grid`) — el dato es la figura, la grilla es el fondo.
4. **Eje Y con escala que empieza en 0** salvo que la skill `dataviz` indique lo contrario para un caso
   específico — nunca truncar el eje para exagerar una variación.
5. **Estado vacío del gráfico**: si no hay datos en el rango (negocio nuevo, período sin ventas), no se
   muestra un gráfico vacío con grilla — se muestra un estado dedicado ("Todavía no hay ventas en este
   período") dentro del mismo espacio.
6. **Todo gráfico respeta el tema activo** — colores, grid y tooltip leen los tokens, se verifican en
   ambos temas antes de dar por terminada la pantalla (mismo checklist de [03](./03-sistema-de-diseno.md) §8).
7. **Accesible sin color**: cada serie tiene un patrón o forma distinguible además del color (línea
   sólida vs. punteada, marcador distinto) donde el color solo no alcance para diferenciar (daltonismo).

## 5. Librería y arquitectura de componentes

Recharts (ver [02, ADR-A01](./02-arquitectura-y-stack.md)). Un wrapper propio por tipo de gráfico en
`apps/admin/src/components/charts/` (`revenue-area-chart.tsx`, `category-bar-chart.tsx`,
`status-donut-chart.tsx`, etc.) que ya trae los tokens de color, el tooltip custom, y el comportamiento
de entrada de [04](./04-motion-y-microanimaciones.md) §4.2 resuelto — las pantallas nunca configuran
Recharts a mano, consumen el wrapper con solo `data` y props semánticas.
