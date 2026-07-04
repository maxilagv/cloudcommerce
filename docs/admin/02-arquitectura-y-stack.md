# 02 · Arquitectura y stack (ADRs)

## 1. Estructura de carpetas

Extiende el esqueleto ya existente en `apps/admin/src` (App Router). Regla: **carpeta por dominio**,
espejando `apps/api/src/domains/*`, no por tipo de archivo.

```
apps/admin/src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx              # shell sin sidebar, fondo animado
│   │   ├── login/page.tsx
│   │   ├── mfa/page.tsx            # nuevo — desafío MFA post-login
│   │   └── recuperar/page.tsx      # nuevo — recuperación de contraseña
│   ├── (dashboard)/
│   │   ├── layout.tsx              # shell con sidebar + topbar + theme
│   │   ├── page.tsx                # overview
│   │   ├── productos/              # renombrar "products" no requerido, mantener inglés por consistencia con rutas ya scaffoldeadas
│   │   ├── categorias/
│   │   ├── inventario/
│   │   ├── pedidos/
│   │   ├── clientes/
│   │   ├── pricing/
│   │   ├── finanzas/
│   │   ├── proveedores/
│   │   ├── ai/
│   │   ├── media/
│   │   └── configuracion/
│   └── api/trpc/[trpc]/route.ts    # ya existe
├── components/
│   └── <dominio>/                  # un folder por dominio, igual que ya hay orders/products
├── hooks/
│   └── use-<dominio>.ts            # wrappers de TanStack Query sobre el router tRPC del dominio
├── lib/
│   ├── trpc.ts                     # cliente, ya scaffoldeado — usar createCloudTRPCClient de packages/trpc
│   ├── auth.ts
│   ├── theme.ts                    # helpers de tema, ver 03
│   └── format.ts                   # nuevo — formatARS, formatDate, formatOrderStatus, etc.
└── stores/
    └── ui-store.ts                 # nuevo — Zustand: sidebar colapsado, tema, filtros persistentes
```

> Nota: el scaffold actual usa nombres de ruta en inglés (`products`, `orders`, `suppliers`). Se
> mantienen así por consistencia con el código ya existente; el resto de las carpetas nuevas puede
> seguir el mismo criterio (inglés) al implementarse — este documento usa español solo para describir
> el propósito de cada una.

## 2. Server Components vs Client Components

- **Server Components por defecto** para todo lo que es solo lectura inicial (listas, detalle):
  hacen el primer fetch server-side vía el cliente tRPC de servidor, evitan el waterfall de loading
  spinners en la carga inicial.
- **Client Components** para todo lo interactivo: formularios, tablas con filtros/orden client-side,
  gráficos (Recharts necesita DOM), modals, el layout del dashboard (sidebar colapsable, theme toggle).
- Patrón estándar de página: `page.tsx` (server) hace el fetch inicial y pasa `initialData` a un
  Client Component que monta `useQuery` con ese `initialData` — así no hay parpadeo de loading en la
  primera carga pero las mutaciones/refetch quedan reactivas.

## 3. Data fetching

- **Cliente**: `packages/trpc`'s `createCloudTRPCClient` (ya construido y con `superjson` — ver la
  auditoría de `apps/api`, hallazgo #10 cerrado). El admin es el primer consumidor real de este paquete.
- **Cache/estado de queries**: TanStack Query (`@tanstack/react-query`), integrado vía
  `@trpc/react-query`. Reglas:
  - `staleTime` corto (30s) para vistas de alta frecuencia (dashboard, pedidos).
  - Invalidación explícita post-mutación (crear producto invalida `catalog.list`, no polling).
  - Optimistic updates **solo** en acciones reversibles y de bajo riesgo (favoritos, toggle de
    publicación) — nunca en dinero (precio, stock, documentos fiscales): ahí se espera confirmación
    del server antes de reflejar el cambio, con estado de carga explícito en el botón.

## 4. Estado de UI (no de servidor)

Zustand, un store por preocupación, no un store gigante:

- `ui-store`: tema (claro/oscuro/sistema), sidebar colapsado, último módulo visitado.
- `filters-store` (por módulo, o namespaced): filtros de tabla persistidos en `sessionStorage` para
  que volver del detalle a la lista no resetee la búsqueda.

## 5. Formularios

`react-hook-form` + `zodResolver` sobre los schemas ya existentes en `packages/validators` — **el
mismo schema que valida en el backend valida en el form**, sin duplicar reglas. Los formularios largos
(producto, proveedor) usan `FormField` compuesto de `packages/ui` con validación inline y estado de
"guardando" por sección, no un único submit gigante cuando el dominio ya expone comandos parciales
(ej. `catalog.updateProduct` vs `catalog.updateProductPricing` si están separados en el backend).

## 6. ADRs (decisiones con alternativas consideradas)

### ADR-A01 — Charts: Recharts, estilizado a mano

**Decisión**: Recharts sobre Tremor, visx o Nivo.

**Por qué**: Tremor viene con su propio sistema de diseño (choca con el nuestro, difícil de
desmarcar). visx es más flexible pero es de bajo nivel — mucho más tiempo de desarrollo para el mismo
resultado. Nivo es pesado y sus defaults son muy "librería de gráficos genérica". Recharts da
componentes declarativos de nivel medio (`AreaChart`, `BarChart`, `PieChart`) que se pueden restylear
completamente vía props (`stroke`, `fill`, gradientes SVG custom, tooltips custom) sin pelear contra
un tema. Detalle de estilo en [07-graficos-y-dataviz](./07-graficos-y-dataviz.md).

### ADR-A02 — Animación: `motion` (Framer Motion) + CSS

**Decisión**: `motion` para orquestación (secuencias, entradas de página, layout animations) y CSS
puro (transitions/keyframes) para microinteracciones de alta frecuencia (hover, focus, active).

**Por qué**: el store ya usa CSS puro (`Microanimaciones.md`) — se mantiene igual para consistencia y
performance en elementos que se repiten cientos de veces (filas de tabla, ítems de sidebar). Pero el
admin tiene necesidades que CSS no resuelve bien: el login animado con timeline de varios pasos,
transiciones de layout cuando el sidebar colapsa, entrada escalonada (stagger) de tarjetas del
dashboard, animación de números que cuentan hacia arriba en los KPIs. Ahí `motion` es la herramienta
correcta. Regla: **si es un solo elemento con un solo estado, CSS. Si es una secuencia u orquestación
entre varios elementos, `motion`.**

### ADR-A03 — Tema: tokens CSS + `next-themes`

**Decisión**: variables CSS custom properties en `:root` (namespace `--admin-*` para no chocar con
`--cc-*` del store), redefinidas bajo `@media (prefers-color-scheme: dark)` y
`[data-theme="dark"]`/`[data-theme="light"]`, con `next-themes` manejando la persistencia y el
`data-theme` en `<html>`.

**Por qué**: es el mismo mecanismo ya usado y probado en este proyecto (ver los artifacts de
auditoría). Evita el flash de tema incorrecto (`next-themes` inyecta un script inline pre-hidratación)
y permite que **cada componente lea el token, nunca un valor crudo** — cambiar de tema no toca ni un
componente.

### ADR-A04 — Tabla de datos: TanStack Table sobre `DataTable` de `packages/ui`

**Decisión**: `packages/ui/composed/data-table.tsx` (ya scaffoldeado, vacío) se construye sobre
`@tanstack/react-table` (headless) en vez de una tabla HTML a mano o una librería con UI incluida
(ej. MUI DataGrid).

**Por qué**: headless da control total del estilo (coherente con el sistema de diseño propio),
soporta paginación/orden/selección/columnas configurables sin pelear contra el look de una librería
ajena, y es lo que ya usan la mayoría de los proyectos Next.js/shadcn de referencia — hay ecosistema y
patrones conocidos.

### ADR-A05 — Iconos: `lucide-react`

**Decisión**: mismo set que el store (`estetica.md` §10). Un solo lenguaje de iconos en toda la
plataforma.

## 7. Accesibilidad y responsividad

- El admin es **desktop-first** (se opera desde una PC, largas sesiones) pero debe ser usable en
  tablet para revisar pedidos/stock desde el piso de venta. Mobile no es objetivo de esta fase (el
  sidebar colapsa a íconos, no a drawer completo — eso queda para una fase posterior si se pide).
- Todos los componentes interactivos de `packages/ui` son wrappers de Radix — accesibilidad de teclado
  y ARIA vienen dados; no se reimplementan desde cero.
- Contraste mínimo AA en ambos temas — ver tokens en [03](./03-sistema-de-diseno.md).
- `prefers-reduced-motion` respetado globalmente (mismo bloque que ya define `Microanimaciones.md`).
