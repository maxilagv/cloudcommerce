# Dashboard Cache

El dominio `dashboard` es solo lectura. Compone datos por ports/read models propietarios de cada dominio:
finance para KPIs financieros, orders para ventas/pedidos, catalog para metadata de productos, inventory
para stock bajo y customers para etiquetas/altas recientes.

Cache Redis cache-aside:

- `dash:overview:{role}:{range}` TTL 120s.
- `dash:series:{role}:{range}:{metric}` TTL 120s.
- `dash:category:{role}:{range}:{metric}:{limit}` TTL 300s.
- `dash:top-products:{role}:{range}:{limit}:{metric}` TTL 300s.
- No se cachea actividad reciente ni top customers para evitar PII cacheada.

La clave incluye rol para no servir margen/cache financiero a roles de catalogo o soporte. La invalidacion por
eventos vive en `DashboardCacheInvalidator`: orders/finance/catalog/customers/stock borran prefijos afectados.
Redis caido degrada a lectura directa por ports.

Desviacion documentada: `finance.getKpis` hoy agrega por periodos mensuales. El dashboard lo consume como fuente
unica de revenue/margen; `7d` se resuelve contra el rango financiero disponible mas cercano hasta que finance
exponga KPIs diarios.
