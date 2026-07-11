# Plan Maestro Visual — CloudCommerce Store

> **Objetivo:** dejar la store visualmente perfecta antes de cargar productos reales. Todo local, sin deploy.
> **División del trabajo:** Bloque 1 = Claude Code. Bloque 2 = Codex (brief exacto en `.codex/BLOQUE-2-CODEX.md`).
> **Fecha:** 2026-07-11

---

## 1. Dirección de diseño (Design Read)

**Leyendo esto como:** e-commerce premium de consumo para compradores hispanohablantes, con lenguaje visual "MercadoLibre premium / Apple-lite" ya establecido (azul `#0B6BFF`, superficies claras, radios 18–28px, sombras ambientales, Inter con tracking negativo). Es un **redesign — preserve**: la identidad existente se conserva y se eleva; NO se cambia paleta, tipografía ni layout general.

**Dials de taste-skill (fijos para todo el proyecto):**

| Dial | Valor | Justificación |
|---|---|---|
| `DESIGN_VARIANCE` | **6** | Premium consumer, identidad ya definida; asimetría controlada, cero caos |
| `MOTION_INTENSITY` | **6** | Microanimaciones ricas + física spring, pero e-commerce = velocidad percibida primero |
| `VISUAL_DENSITY` | **4** | Aireado en marketing (home), medio en panel del cliente |

**Regla de oro (emil-design-eng):** antes de animar CUALQUIER cosa, aplicar el framework de decisión — ¿cuántas veces al día lo ve el usuario? Acciones frecuentes (abrir búsqueda, navegar) = animación mínima o nula. Momentos ocasionales (drawer, modal, add-to-cart) = animación estándar. Momentos raros (checkout success, primer login) = delight permitido.

---

## 2. Skills instaladas y cuándo usar cada una

Instaladas en `.claude/skills/` (Claude) y replicadas en `.codex/skills/` (Codex):

| Skill | Origen | Cuándo usarla |
|---|---|---|
| **impeccable** | pbakaus/impeccable | Skill principal de trabajo. Sub-comandos: `init` (una vez, genera PRODUCT.md/DESIGN.md), `polish` (pulir superficie existente), `animate` (motion de una superficie), `audit`/`critique` (QA visual), `harden` (estados de error/edge). Usarla al INICIO de cada fase sobre la superficie objetivo. |
| **taste-skill** | leonxlnx/taste-skill | Superficies tipo marketing/landing: home, hero, footer, auth, empty states, 404. NO usarla para el panel del cliente ni tablas (ella misma lo dice: "not dashboards"). Declarar el Design Read y los dials de arriba antes de tocar código. |
| **emil-design-eng** | emilkowalski/skills | Filosofía y decisiones de CADA microanimación: framework de frecuencia, easing correcto (`ease-out` para entradas, nunca `ease-in`), duración, `:active` states, transform-origin. Consultarla antes de escribir cualquier `transition`/`animation`. |
| **review-animations** | emilkowalski/skills | QA estricto de animaciones al FINAL de cada fase (formato tabla Before/After). |
| **improve-animations** | emilkowalski/skills | Auditoría global de motion del codebase — se usa una sola vez en la Fase QA final para detectar lo que quedó flojo. |
| **apple-design** | emilkowalski/skills | Gestos y física: drawers con swipe-to-dismiss, springs interrumpibles, momentum, materiales translúcidos. Usar en todo lo que sea drawer/sheet/drag (Bloque 1, fases 4 y 6). |
| **animation-vocabulary** | emilkowalski/skills | Glosario de apoyo para nombrar efectos con precisión en prompts y commits. |
| **ui-ux-pro-max** | ya instalada (usuario) | Checklist transversal: contraste 4.5:1, touch targets 44px, `prefers-reduced-motion`, focus rings, charts. Pasarla como checklist en el QA de cada fase. |
| **Skills propias del proyecto** | `.claude/Skills/frontend/` | `estetica.md`, `Microanimaciones.md`, `tarjetas.md`, `portal-clientes.md`, `store-pages.md`, `home.md` — son la **fuente de verdad del sistema de diseño existente**. SIEMPRE se leen primero; las skills externas elevan, no reemplazan. |

**Jerarquía cuando hay conflicto:** tokens/skills del proyecto (`--cc-*`, `estetica.md`) > emil-design-eng (motion) > impeccable (craft general) > taste-skill (dirección estética).

---

## 3. Estado actual (relevado 2026-07-11)

Lo que ya está bien: hamburguesa animada con drawer (`mobile-menu.tsx`), product card rica (`product/card.tsx`), drawers de carrito/wishlist, hero con blobs y floats, tokens de motion (`--ease-cc-*`, duraciones 90–360ms), `.cc-stagger`, `.cc-skeleton`, respeto de `prefers-reduced-motion`.

Gaps a cerrar (los 12 detectados):

1. Sin `loading.tsx` por ruta (ninguna) → saltos bruscos con `force-dynamic`
2. Sin `error.tsx` / `not-found.tsx` / `global-error.tsx`
3. Sin page transitions (`template.tsx` / View Transitions)
4. Sin librería de motion en la store (todo CSS; admin sí tiene framer-motion)
5. Sin gestos (swipe-to-close en drawers)
6. Chart del panel cliente casero y sin animación (`spending-chart.tsx`)
7. `packages/ui` acoplado a admin (`--admin-*`), store reimplementa todo
8. Sin componente `<Skeleton>` reutilizable en la store
9. Sin efecto 3D en producto
10. Footer estático (sin newsletter/social/pagos)
11. `next/image` sin `placeholder="blur"`
12. Toaster/modal caseros sin polish de accesibilidad

Dark mode: **fuera de alcance** de este plan (fase futura, decisión explícita para no duplicar todos los tokens ahora).

---

## 4. Fase 0 — Fundaciones compartidas (Claude, ANTES de que arranque Codex)

Esto desbloquea ambos bloques. Nada más se toca hasta que Fase 0 esté mergeada.

| # | Tarea | Detalle | Skill |
|---|---|---|---|
| 0.1 | `impeccable init` | Generar `PRODUCT.md` y `DESIGN.md` en la raíz con registro del sistema `--cc-*`, para que todos los sub-comandos posteriores (de Claude Y de Codex) conozcan audiencia, marca y tokens. | impeccable `init` |
| 0.2 | Instalar `motion` | `pnpm --filter store add motion` (motion v12, sucesor de framer-motion — usar SIEMPRE `motion/react`). El admin conserva su framer-motion; no se toca. | — |
| 0.3 | Presets de motion | Crear `apps/store/src/lib/motion.ts`: springs nombrados (`spring.snappy` \{stiffness: 400, damping: 30\}, `spring.gentle`, `spring.bouncy` solo para delight), variants comunes (`fadeSlideUp`, `staggerContainer`), y `<MotionProvider>` con `MotionConfig reducedMotion="user"` montado en el root layout. | emil-design-eng |
| 0.4 | `<Skeleton>` de store | `apps/store/src/components/ui/skeleton.tsx` sobre `.cc-skeleton` + variantes (text, card, image, chart, avatar). Ambos bloques lo consumen. | impeccable |
| 0.5 | Tokens de motion extendidos | En `globals.css`: agregar `--ease-cc-spring-soft`, keyframes `cc-scale-in`, `cc-check-draw`, `cc-count-up` si faltan. Documentar en comentario del archivo. | emil-design-eng |

---

## 5. BLOQUE 1 — Claude (shell, navegación, producto, motion global)

**Superficies:** root layout, estados de ruta, header/nav, product card + grid + detalle, carrito (drawer y página), wishlist, home completa.
**Archivos prohibidos para Codex** (los toco solo yo): `app/layout.tsx`, `app/template.tsx`, todo `app/**/loading|error|not-found`, `components/layout/*` (salvo `footer.tsx`), `components/product/*`, `components/cart/*`, `components/home/*`, `globals.css`, `lib/motion.ts`.

### Fase 1 — Estados de ruta y pantalla de carga moderna
*Skills: impeccable `harden` + `polish`; taste-skill para 404/error (superficie de marca); ui-ux-pro-max checklist.*

- `loading.tsx` por ruta con skeletons fieles al layout real (no genéricos): home (hero + strip + grid), `products/` (toolbar + grid de cards 420px), `products/[slug]` (galería + panel compra), `cart`, `checkout`, `orders`, `account` (delegado a Codex el contenido interno, pero el archivo `loading.tsx` lo creo yo con su skeleton).
- **Pantalla de carga de marca**: componente `BrandLoader` — logo CloudCommerce con trazo animado (SVG path draw) + shimmer sutil; se usa en `global-error` recovery y primeras cargas. Nada de spinners genéricos.
- `not-found.tsx`: 404 con personalidad (ilustración CSS de "nube perdida", búsqueda inline, links a categorías). `error.tsx` + `global-error.tsx` con retry.

### Fase 2 — Transiciones de página
*Skills: emil-design-eng (framework: navegación es frecuente → transición CORTA, 150–200ms máx); apple-design (interrumpibilidad).*

- `app/(shop)/template.tsx` con fade+rise de 8px, 180ms `ease-out`, solo entrada (exit animations en App Router bloquean navegación — no usarlas).
- **View Transitions API** para el par card→detalle: `view-transition-name` compartido en imagen de producto (card) e imagen principal (detalle) — el efecto "el producto viaja a su página". Fallback silencioso donde no hay soporte.
- Barra de progreso superior fina (2px, gradiente azul) en navegaciones lentas.

### Fase 3 — Header y navegación
*Skills: emil-design-eng (acciones frecuentes = restraint); impeccable `polish`.*

- Hamburguesa: refinar el morph a X con spring interrumpible (motion), drawer con física spring + **swipe-to-close** (drag), stagger de items del menú (30ms/item, solo primera apertura).
- SearchCommand: apertura sin animación de escala (se usa decenas de veces/día — regla Raycast), solo fade 120ms; resultados con stagger sutil.
- Underline animado en `MainNav` (layoutId compartido que se desliza entre links activos).
- Badge del carrito: mantener `cc-badge-pop`, agregar tick de número (rollover vertical del dígito).

### Fase 4 — Producto: 3D, microtransiciones de selección
*Skills: emil-design-eng + apple-design (física); taste-skill NO (es product UI); animation-vocabulary para nombrar.*

- **Efecto 3D tilt** en `ProductCard`: perspectiva CSS + rotateX/Y siguiendo el mouse (máx 6°), specular highlight radial que sigue el cursor, `transform-style: preserve-3d` con la imagen a `translateZ(20px)`. Desactivado en touch y con reduced-motion. Spring de retorno al salir.
- **Micro-transición de producto elegido**: al agregar al carrito → botón hace morph (icono → check con path draw, 300ms), **fly-to-cart** (clon de la imagen vuela al badge con curva bezier), badge pop + rollover del contador, toast de confirmación con imagen del producto.
- Grid del catálogo: entrada stagger con `whileInView` (una sola vez, no en cada scroll).
- Detalle de producto: galería con crossfade + zoom-on-hover magnífico, selector de variantes con layout animation, precio con transición al cambiar variante.

### Fase 5 — Carrito y wishlist con física
*Skills: apple-design (esta fase entera es su territorio: sheets, springs, gestos); review-animations al cerrar.*

- Drawers migrados a motion: spring de entrada `snappy`, **drag-to-dismiss** con velocity threshold, backdrop con opacidad ligada al drag (interrumpible).
- Items: layout animations en add/remove (el resto de la lista se reacomoda con spring, item saliente colapsa altura + fade).
- Stepper de cantidad con rollover numérico; subtotal con count-up suave (200ms).
- Empty state del carrito animado (nube + parallax sutil al mover el mouse).

### Fase 6 — Home flagship
*Skills: taste-skill (dials 6/6/4, es LA superficie de marketing) + impeccable `polish`; emil-design-eng para calibrar.*

- Hero: parallax multicapa sutil en scroll (blobs a distinta velocidad), chips flotantes con delay orgánico, CTA con shine-on-hover, imagen hero con tilt 3D leve.
- Secciones (`featured-products`, `category-showcase`, `promo-grid`, `curated-collections`): scroll-reveal escalonado con `whileInView`, hover states diferenciados por tipo de tarjeta.
- `placeholder="blur"` en todas las `next/image` de home y cards (blurDataURL generado).

### QA Bloque 1
- `review-animations` sobre todo lo tocado (tabla Before/After obligatoria).
- `impeccable audit` de home + catálogo + carrito.
- Checklist ui-ux-pro-max: contraste, touch targets, reduced-motion, teclado.

---

## 6. BLOQUE 2 — Codex (portal del cliente, conversión, contenido)

**Brief completo y autocontenido en `.codex/BLOQUE-2-CODEX.md`** — Codex debe leerlo entero antes de empezar, junto con sus skills replicadas en `.codex/skills/`.

Resumen del alcance (detalle exacto en el brief):

| Fase | Superficie | Skills que Codex debe cargar |
|---|---|---|
| C1 | Panel del cliente: dashboard, metric cards con count-up, sidebar con indicador animado | impeccable `polish` + emil-design-eng + `portal-clientes.md` |
| C2 | `SpendingChart`: animación de trazado del path, tooltip con spring, gradiente vivo + nuevo donut de estados | ui-ux-pro-max (charts) + emil-design-eng |
| C3 | CloudPoints/CloudDigital: progress ring animado, niveles, celebración al subir de nivel | emil-design-eng (delight permitido: evento raro) |
| C4 | Orders/tracking: timeline de envío animada (línea que se dibuja, checkpoints con pop) | impeccable `animate` |
| C5 | Checkout + success: stepper animado, success con checkmark draw + confetti único | emil-design-eng + apple-design |
| C6 | Auth (login/register): rediseño split-screen de marca | taste-skill (dials 6/5/3) |
| C7 | Footer completo: newsletter, social, medios de pago, mega-footer | taste-skill + impeccable `polish` |
| C8 | Empty states ilustrados (search sin resultados, wishlist vacía, sin pedidos, sin direcciones) + página cart | taste-skill + impeccable `harden` |

**Archivos prohibidos para Codex:** los listados en §5 (todo lo del Bloque 1). Codex consume `ProductCard`, `lib/motion.ts` y `<Skeleton>` como dependencias de solo lectura.

---

## 7. Orden de ejecución y reglas anti-conflicto

```
Fase 0 (Claude) ──► Bloque 1 (Claude)  ──┐
                └─► Bloque 2 (Codex)   ──┴──► QA final conjunto
```

1. **Fase 0 primero, siempre.** Codex no arranca hasta que `lib/motion.ts`, `<Skeleton>` y los tokens extendidos existan en master.
2. Cada bloque trabaja en su propia rama (`visual/bloque-1-claude`, `visual/bloque-2-codex`). Los mapas de archivos no se solapan por diseño; si alguno necesita tocar un archivo del otro bloque, se pide, no se toca.
3. Ambos bloques usan EXCLUSIVAMENTE tokens `--cc-*` y presets de `lib/motion.ts`. Prohibido hardcodear colores, easings o duraciones nuevas sin agregarlas primero a tokens.
4. Duraciones máximas: microinteracción 200ms, drawer/modal 300ms, delight raro 600ms. Easing: `ease-out` para todo lo que entra; springs solo vía presets.
5. `prefers-reduced-motion` obligatorio en TODA animación nueva (viene gratis con `MotionConfig reducedMotion="user"`; en CSS puro, envolver en `@media (prefers-reduced-motion: no-preference)`).

## 8. QA final conjunto (Claude, al cierre de ambos bloques)

1. `improve-animations` — auditoría global de motion de toda la store, plan priorizado de lo que quedó flojo.
2. `impeccable audit` de punta a punta (home → producto → carrito → checkout → cuenta).
3. Pasada responsive completa (360px, 768px, 1024px, 1440px) + teclado + reduced-motion activado.
4. `pnpm typecheck && pnpm lint && pnpm build` en verde.
