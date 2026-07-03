# Panel admin CloudCommerce — Documentación de construcción

> Especificación viva del frontend de `apps/admin`. Sigue la misma convención que
> [`docs/backend/`](../backend/README.md): documentos fundacionales primero, módulos después.
> No reemplaza la estética del store (`.claude/Skills/frontend/estetica.md` y `Microanimaciones.md`) —
> la **extiende** con lo que un panel de administración necesita y el store no: modo oscuro, densidad
> de datos, tablas, gráficos, formularios largos.

## Estado del proyecto (2026-07)

- **`apps/api`**: construido y auditado (12 dominios, ver `docs/backend/`). Es la fuente de verdad —
  el admin **no inventa** endpoints ni shapes de datos, consume `appRouter.*` tal como está.
- **`packages/ui`**: esqueleto vacío (10 primitivos + 5 compuestos + 2 layouts, todos por implementar).
- **`apps/admin`**: esqueleto de rutas vacío (login, dashboard, orders, products, suppliers, settings,
  ai/*, analytics ya tienen archivo pero sin contenido). Faltan las rutas de customers, finance,
  inventory, pricing y media — se agregan en este plan.
- **Este documento**: **planificación**, no implementación. Define qué se construye, en qué orden y
  con qué apariencia antes de escribir el primer componente real.

## Principio rector

El admin es la herramienta que el dueño va a mirar todos los días. Tiene que sentirse **rápida,
precisa y bonita** — no una plantilla de admin genérica. Reutiliza la identidad de marca de
CloudCommerce (azul `#0B6BFF`, tipografía Inter, radios grandes, sombras suaves) pero resuelta para
un contexto distinto: mucha más densidad de información, tablas, filtros, formularios de edición,
gráficos, y **modo oscuro real** (el store lo evita a propósito; el admin lo necesita — se usa de noche,
en escritorio, largas sesiones).

## Cómo leer esta documentación

### Fundacionales

| # | Documento | Qué fija |
|---|-----------|----------|
| 01 | [Visión y alcance](./01-vision-y-alcance.md) | Qué es el panel, para quién, qué NO es |
| 02 | [Arquitectura y stack](./02-arquitectura-y-stack.md) | Next.js App Router, data fetching, estado, ADRs de librerías |
| 03 | [Sistema de diseño](./03-sistema-de-diseno.md) | Paleta claro/oscuro, tipografía, radios, sombras, iconografía |
| 04 | [Motion y microanimaciones](./04-motion-y-microanimaciones.md) | Tokens de movimiento, login animado, transiciones, toasts |
| 05 | [Navegación y permisos](./05-navegacion-y-permisos.md) | Sidebar, mapa del sitio, qué ve cada uno de los 5 roles |
| 06 | [Componentes y patrones](./06-componentes-y-patrones.md) | Inventario de `packages/ui`, patrones de página (lista/detalle/wizard) |
| 07 | [Gráficos y dataviz](./07-graficos-y-dataviz.md) | Librería de charts, paleta de datos, spec por gráfico |

### Módulos (`modulos/`)

Cada uno mapea 1:1 a un dominio de `apps/api` (ver `docs/backend/modulos/`) y describe **solo la capa
de UI**: pantallas, componentes, estados, qué procedimiento tRPC consume cada uno.

| Documento | Dominio backend | Pantallas |
|-----------|-----------------|-----------|
| [00 · Login y sesión](./modulos/00-login-y-auth.md) | `identity` | Login animado, MFA, recuperación, sesiones activas |
| [01 · Dashboard](./modulos/01-dashboard.md) | `dashboard` | Overview, KPIs, gráficos, actividad reciente |
| [02 · Catálogo y media](./modulos/02-catalogo-y-media.md) | `catalog`, `media` | Productos, categorías, variantes, galería |
| [03 · Inventario](./modulos/03-inventario.md) | `inventory` | Stock, reservas, ajustes, movimientos |
| [04 · Pedidos](./modulos/04-pedidos.md) | `orders` | Lista, detalle, timeline de estado, envíos |
| [05 · Clientes](./modulos/05-clientes.md) | `customers` | Lista, detalle, analytics, contactos |
| [06 · Pricing](./modulos/06-pricing.md) | `pricing` | Reglas de precio, costos de proveedor, márgenes |
| [07 · Finanzas](./modulos/07-finanzas.md) | `finance` | Documentos, secuencias, períodos, export |
| [08 · Proveedores](./modulos/08-proveedores.md) | `suppliers` | Alta, feeds, mapeo, historial de importación |
| [09 · Herramientas IA](./modulos/09-ia-tools.md) | `ai` | Generador de descripciones, SEO, pricing, uso/costo |
| [10 · Configuración](./modulos/10-configuracion.md) | `settings`, `identity` | Tienda, pagos, usuarios admin, secretos |

### Transversal

| # | Documento |
|---|-----------|
| 08 | [Roadmap y fases](./08-roadmap-y-fases.md) |

## Decisiones ya tomadas (resumen ejecutivo)

Detalle y justificación en [02-arquitectura-y-stack](./02-arquitectura-y-stack.md).

- **Framework**: Next.js 15 App Router, ya scaffoldeado en `apps/admin`.
- **Datos**: tRPC (`packages/trpc`, ya expone `createCloudTRPCClient` con superjson) + TanStack Query.
- **Estado UI**: Zustand (sidebar colapsado, filtros persistentes, tema).
- **Formularios**: `react-hook-form` + Zod (`packages/validators`, ya existen los schemas).
- **Charts**: Recharts, estilizados a mano siguiendo [07-graficos-y-dataviz](./07-graficos-y-dataviz.md) —
  nada de temas por defecto de librería.
- **Animación**: `motion` (Framer Motion) para orquestación (login, entradas de página) + CSS puro para
  microinteracciones de alta frecuencia (hover, focus) — mismo criterio que `Microanimaciones.md`.
- **Tema**: `next-themes`, tokens CSS custom properties, mismo mecanismo que ya usan los artifacts de
  este proyecto (`prefers-color-scheme` + `data-theme` override).
- **Iconos**: `lucide-react`, coherente con la skill de estética del store.

## Glosario rápido

- **Token de diseño**: variable con nombre semántico (`--admin-bg-canvas`) en vez de un valor crudo,
  para poder redefinirla por tema sin tocar componentes.
- **Read model**: mismo concepto que en el backend — un shape ya armado para una pantalla específica,
  el admin nunca arma sus propios agregados client-side.
