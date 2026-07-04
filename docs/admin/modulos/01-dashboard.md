# 01 · Dashboard (dominio `dashboard`)

Backend: [`docs/backend/modulos/18-modulo-dashboard-analytics.md`](../../backend/modulos/18-modulo-dashboard-analytics.md)
— fuente exacta de cada KPI y gráfico, no se recalcula nada en el frontend. Gráficos:
[07-graficos-y-dataviz.md](../07-graficos-y-dataviz.md). Es la pantalla `(dashboard)/page.tsx` —
ya scaffoldeada.

## Layout

```
[ selector de rango: 7d / 30d / 12m ]
[ fila de KPI cards: ventas, margen*, pedidos, ticket promedio*, clientes nuevos, productos publicados ]
[ gráfico grande: serie temporal de ventas (2/3 ancho) | donut de pedidos por estado (1/3 ancho) ]
[ fila: ventas por categoría (bar) | top productos (lista con barra) | top clientes* (lista con barra) ]
[ fila: alertas de stock bajo (lista accionable) | actividad reciente (3 columnas: pedidos, clientes, IA) ]
```
\* oculto para roles sin `finance.read_margin` — el shape que llega del backend ya no trae el campo.

## Componentes usados

`kpi-card`, `revenue-area-chart`, `status-donut-chart`, `category-bar-chart`, lista con
mini-progreso (§3.3 de dataviz), `activity-timeline` (para actividad reciente, o una versión compacta
de 3 listas paralelas), `status-badge`.

## Procedimientos

```txt
dashboard.getOverview({ range, compareToPrevious? })
dashboard.getSalesTimeSeries({ range, metric })
dashboard.getSalesByCategory({ range, limit?, metric })
dashboard.getTopProducts({ range, limit?, metric })
dashboard.getTopCustomers({ range, limit? })
dashboard.getRecentActivity({ limit? })
dashboard.getLowStockAlerts({ limit?, threshold? })
```

Se piden en paralelo (no en cascada) desde el server component de la página — el layout ya define
qué bloque depende de qué query, y cada card/gráfico maneja su propio estado de carga/error de forma
independiente (si falla `getTopCustomers`, el resto del dashboard sigue mostrándose).

## Casos por rol (autorización negativa de UI)

- `CATALOG_MANAGER` y `SUPPORT`: KPIs de margen/ticket promedio ausentes; el grid de KPIs se reacomoda
  (no deja huecos vacíos).
- `SUPPORT`: nombres de clientes en "top clientes" pueden venir anonimizados/iniciales según motivo de
  acceso — el frontend renderiza lo que reciba, no decide el nivel de detalle.
