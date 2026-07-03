# 01 · Visión y alcance

## Qué es

`apps/admin` es la herramienta de trabajo diaria del dueño de CloudCommerce (y, según rol, de su
equipo: un encargado de catálogo, alguien de finanzas, soporte). Es donde pasa de "tengo un negocio
de dropshipping" a "opero mi negocio": carga productos, mira si vendió, revisa pedidos, decide precios,
gestiona proveedores, genera contenido con IA, emite facturas.

No es un dashboard de métricas de vanidad. Cada pantalla existe porque resuelve una tarea operativa
real, mapeada a un caso de uso ya construido en `apps/api` (ver `docs/backend/modulos/`).

## Para quién

Cinco roles, ya modelados en el backend (`AdminRole`: `OWNER`, `ADMIN`, `CATALOG_MANAGER`, `FINANCE`,
`SUPPORT` — ver [docs/backend/07-auth-identidad.md](../backend/07-auth-identidad.md)). El panel no es
una sola app con permisos escondidos: **la navegación misma cambia según quién entra** — ver
[05-navegacion-y-permisos](./05-navegacion-y-permisos.md).

- **OWNER**: ve y edita todo, incluyendo costos, márgenes, usuarios admin y configuración de la tienda.
- **ADMIN**: casi todo, salvo transferir propiedad de la cuenta.
- **CATALOG_MANAGER**: vive en catálogo/inventario/media/IA de contenido. No ve finanzas ni costos.
- **FINANCE**: vive en finanzas/pricing/dashboard con margen. Lectura de pedidos, sin editarlos.
- **SUPPORT**: vive en clientes y pedidos, con motivo auditado para datos sensibles. Sin costos.

## Principio rector: cada pantalla es una tarea, no una tabla

Una lista con filtros no es el objetivo, es el punto de partida. Cada módulo tiene que resolver el
ciclo completo: **ver → filtrar → entrar al detalle → editar → confirmar → volver con feedback claro**.
Si una acción requiere cambiar de pantalla más de lo necesario, o perder contexto (por ejemplo, editar
un producto y perder los filtros de la lista), está mal diseñada.

## Alcance de esta fase

**Incluido** (todo lo que ya tiene backend construido y auditado):

- Login con MFA, gestión de sesiones propias.
- Dashboard con KPIs, series temporales, distribución por categoría, top productos/clientes, alertas
  de stock bajo, actividad reciente.
- ABM completo de catálogo (productos, categorías, variantes) y media (subida de imágenes, IA).
- Inventario: niveles de stock, ajustes manuales, historial de movimientos.
- Pedidos: lista, detalle, timeline de estado, envíos, alta manual, devoluciones.
- Clientes: alta, búsqueda, detalle con analítica de compra, registro de contacto.
- Pricing: reglas de markup (global/categoría/producto), costos de proveedor, historial de precio.
- Finanzas: documentos (remito/factura/nota de crédito), períodos, exportación.
- Proveedores: alta, configuración de API (con secretos enmascarados), feeds, historial de importación.
- Herramientas IA: generación de descripciones/SEO, sugerencias de pricing, recomendaciones, panel de
  uso y costo.
- Configuración: datos de tienda, métodos de pago, feature flags, usuarios admin y roles, estado de
  secretos (nunca el valor).

**Fuera de alcance** (explícitamente, para no inflar el scope):

- Portal de autoservicio del cliente final (es una fase futura del backend, no del admin).
- Analítica avanzada / BI histórico (cohortes, forecasting) — el dashboard es el pulso operativo del
  día a día, no un data warehouse.
- Editor visual de emails transaccionales (se editan como código en `packages/email`).
- Cualquier pantalla sin procedimiento tRPC ya construido en `apps/api` — no se inventan endpoints
  desde el frontend.

## Qué hace que esto se sienta bien construido

1. **Consistencia visual real** entre todas las pantallas — un solo sistema de diseño
   ([03](./03-sistema-de-diseno.md)), no estilos ad hoc por página.
2. **Modo oscuro de primera clase**, no un filtro CSS invertido — paleta pensada para ambos temas desde
   el token, no derivada automáticamente.
3. **Movimiento con propósito** — cada animación comunica estado (cargando, guardado, error, nuevo
   dato) — ver [04](./04-motion-y-microanimaciones.md). Nunca decorativo porque sí.
4. **Gráficos que se leen en dos segundos**, no gráficos de librería por defecto — ver
   [07](./07-graficos-y-dataviz.md).
5. **Cero fricción en tareas repetidas**: crear producto, cambiar estado de pedido, ajustar precio son
   los flujos que más se usan — se optimizan primero.
