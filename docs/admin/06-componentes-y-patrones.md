# 06 · Componentes y patrones de página

## 1. Inventario de `packages/ui` — qué falta construir

Todos los archivos ya existen como esqueleto vacío. Este es el alcance real de cada uno:

### 1.1 Primitivos (`components/primitives/`)

| Componente | Base Radix | Notas admin |
|---|---|---|
| `button.tsx` | — | Variantes: `primary`, `secondary`, `ghost`, `danger`, `outline`. Tamaños `sm/md/lg`. Estado `loading` incluido (spinner inline, ver [04](./04-motion-y-microanimaciones.md) §5.1). |
| `input.tsx` | — | Incluye variante con ícono a la izquierda (buscador) y con adorno a la derecha (ej. "$" para precio, unidad para stock). |
| `select.tsx` | `Select` | Con soporte de búsqueda interna para listas largas (categorías, proveedores). |
| `dialog.tsx` | `Dialog` | Variante estándar + variante `danger` (confirmación destructiva, ver [04](./04-motion-y-microanimaciones.md) §5.3). |
| `dropdown-menu.tsx` | `DropdownMenu` | Usado para el menú `⋮` de acciones de fila y el menú de usuario. |
| `switch.tsx` | `Switch` | Usado para toggles de publicación, feature flags, activar/desactivar. |
| `tooltip.tsx` | `Tooltip` | Delay estándar 400ms, usado en íconos sin label visible. |
| `toast.tsx` | — | Ver [04](./04-motion-y-microanimaciones.md) §5.2. |
| `badge.tsx` | — | Base del `StatusBadge` semántico ([03](./03-sistema-de-diseno.md) §6.4). |
| `skeleton.tsx` | — | Shimmer, ver [04](./04-motion-y-microanimaciones.md) §4.4. |

### 1.2 Compuestos (`components/composed/`)

| Componente | Qué resuelve |
|---|---|
| `data-table.tsx` | Tabla headless sobre TanStack Table (ver [02, ADR-A04](./02-arquitectura-y-stack.md)): columnas configurables, orden, selección múltiple con acciones en lote, paginación, estado vacío y de carga incluidos. **El componente central de todo el admin** — casi todas las listas lo usan. |
| `pagination.tsx` | Standalone, pero integrado por defecto en `data-table`. |
| `search-input.tsx` | Debounce incluido (`use-debounce.ts` ya existe), usado en filtros de lista y en el command palette. |
| `combobox.tsx` | Base del command palette y de selects con búsqueda remota (ej. buscar producto para agregarlo a un pedido manual). |
| `form-field.tsx` | Wrapper de label + input + mensaje de error, integrado con `react-hook-form`. Todo formulario del admin se arma con esto, no con inputs sueltos. |
| `file-upload.tsx` | Drag & drop + preview, usado en media (subida de imágenes de producto) — respeta la validación de magic bytes que ya hace el backend, muestra el error específico si el backend rechaza el archivo. |

### 1.3 Layouts (`components/layouts/`)

| Componente | Qué resuelve |
|---|---|
| `page-header.tsx` | Breadcrumb + título + hasta 2 acciones ([05](./05-navegacion-y-permisos.md) §6). |
| `section.tsx` | Bloque con título + contenido, usado para segmentar formularios largos (ej. detalle de producto: "Información general", "Precio y stock", "Imágenes", "SEO"). |

### 1.4 Nuevos, no scaffoldeados todavía

| Componente | Dónde vive | Qué resuelve |
|---|---|---|
| `status-badge.tsx` | `packages/ui/composed` | Mapeo centralizado enum → color+texto ([03](./03-sistema-de-diseno.md) §6.4). |
| `kpi-card.tsx` | `apps/admin/components/dashboard` | Tarjeta de KPI con delta animado ([04](./04-motion-y-microanimaciones.md) §4.1). |
| `chart-*.tsx` | `apps/admin/components/charts` | Wrappers de Recharts restyleados, uno por tipo — ver [07](./07-graficos-y-dataviz.md). |
| `theme-toggle.tsx` | `packages/ui/composed` | Switch de 3 estados (claro/oscuro/sistema) con ícono animado (sol↔luna con rotación+fade, 260ms). |
| `command-palette.tsx` | `apps/admin/components/layout` | `⌘K`, ver [05](./05-navegacion-y-permisos.md) §5. |
| `empty-state.tsx` | `packages/ui/composed` | Ilustración simple (línea, no stock photo) + texto + CTA — usado en toda lista sin resultados. |
| `confirm-dialog.tsx` | `packages/ui/composed` | Wrapper de `dialog.tsx` para confirmaciones destructivas, con el texto de la acción inyectado ("¿Eliminar el producto **Heladera XYZ**?"). |
| `activity-timeline.tsx` | `apps/admin/components/shared` | Línea de tiempo vertical — usado en detalle de pedido (estados) y detalle de cliente (contactos). |

## 2. Patrones de página

### 2.1 Patrón "Lista"

Usado por: productos, categorías, pedidos, clientes, proveedores, documentos de finanzas.

```
[ page-header: título + "Nuevo X" + acción secundaria ]
[ barra de filtros: search-input + selects de filtro + chips de filtro activo ]
[ data-table: columnas relevantes, orden, selección múltiple ]
[ acciones en lote (aparecen solo con selección activa): ej. "Publicar (3)", "Exportar" ]
[ pagination ]
```

Estado vacío: si no hay filtros aplicados y la lista está genuinamente vacía → `empty-state` con CTA
de creación. Si hay filtros aplicados y no matchean nada → mensaje distinto ("no hay resultados para
estos filtros" + botón "limpiar filtros"), nunca el mismo empty-state que "todavía no creaste nada".

### 2.2 Patrón "Detalle / edición"

Usado por: producto, pedido, cliente, proveedor, documento.

```
[ page-header: breadcrumb + nombre/ID de la entidad + acciones (guardar, eliminar, más) ]
[ layout de 2 columnas en desktop: ]
  [ columna principal (2/3): secciones editables del recurso ]
  [ columna lateral (1/3): metadata, timeline de actividad, acciones rápidas ]
```

Cada `section.tsx` del formulario guarda de forma independiente cuando el backend expone comandos
parciales (evita perder cambios de una sección por un error en otra). Si el backend solo expone un
comando único de actualización, el formulario es uno solo pero conserva la segmentación visual.

### 2.3 Patrón "Wizard" (creación multi-paso)

Usado por: alta de producto (si tiene muchos campos obligatorios), alta de proveedor (datos + config
de API + primer feed), importación de feed.

```
[ stepper horizontal con pasos nombrados, paso activo resaltado con --admin-accent ]
[ contenido del paso actual ]
[ "Atrás" / "Continuar" — el estado de cada paso se conserva al ir atrás ]
```

No usar wizard para formularios que caben cómodos en una sola pantalla — es para flujos genuinamente
secuenciales donde un paso depende del anterior (ej. no se puede configurar el mapeo de un feed sin
haber guardado antes la conexión al proveedor).

### 2.4 Patrón "Panel de herramienta" (IA)

Usado por: generador de descripciones, optimizador de SEO, sugerencias de pricing.

```
[ panel de input: qué producto/contexto, parámetros ]
[ botón "Generar" con estado de carga largo (la IA tarda) — usar skeleton de contenido, no solo spinner ]
[ panel de resultado: contenido generado + acciones "Usar este", "Regenerar", "Editar antes de usar" ]
[ historial reciente de generaciones para ese recurso, colapsable ]
```

## 3. Estados que toda pantalla de datos necesita (no opcionales)

1. **Cargando** (primera carga): skeleton con la forma real del contenido, no un spinner centrado
   genérico — reduce el salto de layout cuando llega el dato real.
2. **Vacío**: ver 2.1.
3. **Error**: mensaje claro + acción de reintentar, nunca un stack trace ni un mensaje técnico del
   backend expuesto crudo (el backend ya redacta errores internos — ver auditoría de `apps/api`,
   hallazgo del error-formatter tRPC).
4. **Con datos**: el estado normal.
5. **Actualizando** (refetch en background): indicador sutil, no bloqueante (ej. una barra de progreso
   finísima en la parte superior del contenido, no un overlay que tape la data ya visible).
