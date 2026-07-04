# 08 · Roadmap y fases

Orden pensado para tener, lo antes posible, algo usable de punta a punta (login → ver el negocio →
operar catálogo/pedidos), y dejar lo más largo (proveedores, IA, configuración fina) para después. Cada
fase es "entregable" — se puede usar en producción al cerrarla, no queda a medio construir.

## Fase 0 · Fundaciones (sin esto, nada más se puede empezar)

```txt
[ ] packages/ui: primitivos completos (button, input, select, dialog, dropdown-menu, switch,
    tooltip, toast, badge, skeleton) con los tokens de 03-sistema-de-diseno.md
[ ] Tema claro/oscuro funcionando (next-themes + tokens), sin flash de tema incorrecto
[ ] packages/ui: data-table sobre TanStack Table (queda vacío de datos, pero funcional)
[ ] apps/admin/lib/trpc.ts conectado a createCloudTRPCClient real (packages/trpc)
[ ] Shell del dashboard: sidebar + topbar + layout responsive, navegación filtrada por rol
    (05-navegacion-y-permisos.md)
[ ] Motion tokens + reduced-motion global (04-motion-y-microanimaciones.md §1)
```
Entregable: un shell vacío pero ya con la identidad visual completa, navegable, en ambos temas.

## Fase 1 · Login y sesión

```txt
[ ] Pantalla de login animada (04-motion-y-microanimaciones.md §2)
[ ] Flujo MFA (si el usuario lo tiene activo)
[ ] Recuperación de contraseña
[ ] Middleware de auth (ya existe apps/admin/src/middleware.ts, conectar a sesión real)
[ ] Pantalla "Mis sesiones activas" + revocar sesión (identity.listSessions / revokeSession)
```
Entregable: se puede entrar y salir del panel de verdad, con la primera impresión ya pulida.
Ver [modulos/00-login-y-auth.md](./modulos/00-login-y-auth.md).

## Fase 2 · Dashboard

```txt
[ ] KPI cards con delta y animación de conteo (dashboard.getOverview)
[ ] Gráfico de serie temporal de ventas
[ ] Ventas por categoría, top productos, top clientes
[ ] Alertas de stock bajo, actividad reciente
[ ] Todo respetando ocultamiento de campos sensibles por rol
```
Entregable: la primera pantalla que ve el dueño al loguearse, con el pulso real del negocio.
Ver [modulos/01-dashboard.md](./modulos/01-dashboard.md).

## Fase 3 · Catálogo, media e inventario

```txt
[ ] Lista de productos (filtros, búsqueda, estado de publicación)
[ ] Alta/edición de producto (wizard o formulario seccionado — decidir según densidad real de campos)
[ ] Editor de variantes
[ ] Categorías (ABM simple)
[ ] Media: subida de imágenes con preview, galería del producto
[ ] Inventario: niveles de stock, ajuste manual, historial de movimientos
```
Entregable: el dueño puede cargar y mantener su catálogo completo sin tocar la base de datos.
Ver [modulos/02-catalogo-y-media.md](./modulos/02-catalogo-y-media.md) y
[modulos/03-inventario.md](./modulos/03-inventario.md).

## Fase 4 · Pedidos y clientes

```txt
[ ] Lista de pedidos con filtros por estado
[ ] Detalle de pedido: timeline de estado, líneas, envío, acciones de transición
[ ] Alta manual de pedido
[ ] Lista y detalle de clientes, con analítica de compra
[ ] Registro de contacto (llamada/WhatsApp/email)
```
Entregable: el ciclo de venta completo es operable desde el panel.
Ver [modulos/04-pedidos.md](./modulos/04-pedidos.md) y [modulos/05-clientes.md](./modulos/05-clientes.md).

## Fase 5 · Pricing y finanzas

```txt
[ ] Reglas de pricing (global/categoría/producto), simulador de margen
[ ] Costos de proveedor por variante
[ ] Documentos financieros (listado, detalle, regenerar, anular)
[ ] Export
```
Entregable: control de rentabilidad y papeles en regla.
Ver [modulos/06-pricing.md](./modulos/06-pricing.md) y [modulos/07-finanzas.md](./modulos/07-finanzas.md).

## Fase 6 · Proveedores

```txt
[ ] Alta de proveedor + configuración de API (secretos siempre enmascarados en UI)
[ ] Mapeo de feed
[ ] Historial de importación, estado de última corrida, errores
[ ] Log de reenvío de pedidos (éxito/fallo, reintento)
```
Entregable: el motor de dropshipping es administrable sin tocar código.
Ver [modulos/08-proveedores.md](./modulos/08-proveedores.md).

## Fase 7 · Herramientas IA

```txt
[ ] Generador de descripciones/SEO desde el detalle de producto
[ ] Sugerencias de pricing
[ ] Panel de uso y costo
```
Entregable: el dueño usa IA para acelerar la carga de catálogo.
Ver [modulos/09-ia-tools.md](./modulos/09-ia-tools.md).

## Fase 8 · Configuración

```txt
[ ] Datos de tienda, métodos de pago (estado de secretos, nunca el valor)
[ ] Feature flags
[ ] Usuarios admin y roles (solo OWNER/ADMIN)
```
Entregable: autonomía total sin depender de un deploy para cambios operativos.
Ver [modulos/10-configuracion.md](./modulos/10-configuracion.md).

## Fase 9 · Pulido final

```txt
[ ] Auditoría de accesibilidad (contraste, foco, navegación por teclado) en ambos temas
[ ] Auditoría de performance (Core Web Vitals, tamaño de bundle de charts/motion)
[ ] Revisión de copy en español consistente en toda la app (tono, formato de fecha/moneda)
[ ] QA cruzado de los 5 roles en cada pantalla (autorización negativa de UI)
[ ] Responsive real en tablet
```

## Definition of Done por pantalla

```txt
[ ] Usa componentes de packages/ui, no HTML/CSS suelto reinventando lo mismo.
[ ] Se ve terminada en claro y en oscuro.
[ ] Tiene los 5 estados de 06-componentes-y-patrones.md §3 (carga, vacío, error, con datos, actualizando).
[ ] Consume el procedimiento tRPC real, sin datos mock, sin `any`.
[ ] Respeta la navegación/campos ocultos por rol (no solo estilo `disabled`, ausencia real).
[ ] Formularios validan con el mismo schema de packages/validators que usa el backend.
[ ] Sin animación sin propósito; respeta prefers-reduced-motion.
```
