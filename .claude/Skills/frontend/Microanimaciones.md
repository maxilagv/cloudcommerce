---
name: cloudcommerce-microanimaciones
description: Skill para definir microanimaciones, motion tokens y estados interactivos del catálogo cloudcommerce.
version: 1.0.0
scope: motion, css-animation, frontend-interactions, ux-polish
---

# Skill — Microanimaciones cloudcommerce

## 1. Objetivo

Añadir vida a la interfaz sin romper la estética premium. Las microanimaciones deben ser sutiles, rápidas, útiles y coherentes. El usuario debe sentir que la interfaz responde con precisión, no que hay animaciones decorativas innecesarias.

## 2. Principios de movimiento

1. **Sutileza**: no más de `3px` de desplazamiento en hover para tarjetas.
2. **Rapidez**: la mayoría de animaciones duran `120ms–260ms`.
3. **Easing premium**: evitar `linear` para UI, excepto shimmer o loops suaves.
4. **Propósito**: cada movimiento debe indicar estado, disponibilidad, selección, foco o actualización.
5. **Respeto a accesibilidad**: desactivar o reducir movimiento con `prefers-reduced-motion`.

## 3. Tokens de movimiento

```css
:root {
  --cc-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --cc-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --cc-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  --cc-duration-instant: 90ms;
  --cc-duration-fast: 140ms;
  --cc-duration-normal: 220ms;
  --cc-duration-slow: 360ms;
  --cc-duration-loop: 1600ms;
}
```

## 4. Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }
}
```

## 5. Header

### 5.1 Nav hover

```css
.nav-link {
  transition: color var(--cc-duration-fast) var(--cc-ease-out),
              background var(--cc-duration-fast) var(--cc-ease-out);
}
.nav-link:hover {
  color: var(--cc-primary);
  background: var(--cc-primary-softer);
}
```

### 5.2 Search focus

```css
.search-command:focus-within {
  background: #fff;
  border-color: var(--cc-primary-border);
  box-shadow: var(--cc-shadow-focus);
}
```

El buscador debe sentirse activado al enfocar.

### 5.3 Badges de carrito/favoritos

Al cambiar contador:

```css
@keyframes cc-badge-pop {
  0% { transform: scale(.72); opacity: .6; }
  55% { transform: scale(1.16); opacity: 1; }
  100% { transform: scale(1); }
}

.action-badge[data-updated="true"] {
  animation: cc-badge-pop 260ms var(--cc-ease-spring);
}
```

## 6. Hero

### 6.1 Dots flotantes

```css
@keyframes cc-float-soft {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(0, -7px, 0); }
}

.hero-orbit-dot {
  animation: cc-float-soft 3.2s ease-in-out infinite;
}
```

Usar en pequeños puntos decorativos del hero.

### 6.2 CTA hero

```css
.hero-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 34px rgba(11,107,255,.30);
}
.hero-cta:active {
  transform: translateY(0) scale(.985);
}
```

### 6.3 Productos del hero

```css
.hero-product-stack {
  transition: transform 360ms var(--cc-ease-out);
}
.hero-banner:hover .hero-product-stack {
  transform: translateY(-3px) scale(1.008);
}
```

Movimiento casi imperceptible, como si el hero tuviera profundidad.

## 7. Chips de categorías

### 7.1 Hover

```css
.category-chip {
  transition: transform 180ms var(--cc-ease-out),
              border-color 180ms var(--cc-ease-out),
              box-shadow 180ms var(--cc-ease-out),
              background 180ms var(--cc-ease-out);
}

.category-chip:hover {
  transform: translateY(-1px);
  border-color: var(--cc-primary-border);
  box-shadow: 0 10px 24px rgba(16,24,40,.055);
}
```

### 7.2 Active transition

Cuando cambia chip activo:

- icono cambia a azul,
- borde se vuelve azul,
- fondo se aclara,
- contador puede hacer fade.

Duración: `180ms–220ms`.

## 8. Sidebar de filtros

### 8.1 Filas hover

```css
.category-filter-row {
  transition: background var(--cc-duration-fast) var(--cc-ease-out),
              color var(--cc-duration-fast) var(--cc-ease-out);
}
.category-filter-row:hover {
  background: #F8FAFD;
}
```

### 8.2 Accordion

```css
.filter-content {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition: grid-template-rows 220ms var(--cc-ease-out),
              opacity 180ms var(--cc-ease-out);
}

.filter-section[data-collapsed="true"] .filter-content {
  grid-template-rows: 0fr;
  opacity: 0;
}

.filter-content > div {
  overflow: hidden;
}
```

### 8.3 Slider

- Thumb crece de `14px` a `16px` en hover.
- Al arrastrar, mostrar sombra azul suave.
- La pista activa se actualiza sin jitter.

## 9. Product cards

### 9.1 Card hover

```css
.product-card {
  will-change: transform;
}
.product-card:hover {
  transform: translateY(-3px);
}
```

### 9.2 Imagen hover

```css
.product-image {
  transition: transform 260ms var(--cc-ease-out), filter 260ms var(--cc-ease-out);
}
.product-card:hover .product-image {
  transform: translateY(-2px) scale(1.025);
  filter: drop-shadow(0 18px 24px rgba(16,24,40,.14));
}
```

### 9.3 Quick action reveal

```css
.quick-action {
  transform: translateY(4px) scale(.96);
  transition: transform 180ms var(--cc-ease-out), opacity 180ms var(--cc-ease-out);
}
.product-card:hover .quick-action {
  transform: translateY(0) scale(1);
  opacity: 1;
}
```

### 9.4 Add-to-cart click

Al click:

- botón hace `scale(.985)`,
- icono carrito puede desplazarse 2px,
- badge de carrito en header hace pop,
- opcional toast mini `Agregado al carrito`.

No bloquear la UI con modales.

## 10. Skeleton y carga

```css
@keyframes cc-shimmer {
  0% { background-position: 120% 0; }
  100% { background-position: -120% 0; }
}

.skeleton {
  background: linear-gradient(90deg, #F1F4F8 0%, #FAFBFD 50%, #F1F4F8 100%);
  background-size: 220% 100%;
  animation: cc-shimmer 1.35s linear infinite;
}
```

## 11. Trust bar

### 11.1 Iconos de beneficios

Hover suave:

```css
.trust-item:hover .trust-icon {
  transform: translateY(-1px) scale(1.04);
  background: var(--cc-primary-soft);
  color: var(--cc-primary);
}
```

### 11.2 Cloudplus panel

Puede tener un gradiente animado casi imperceptible:

```css
.cloudplus-panel::before {
  content: "";
  position: absolute;
  inset: -40%;
  background: radial-gradient(circle, rgba(11,107,255,.16), transparent 40%);
  animation: cc-slow-drift 8s ease-in-out infinite;
}

@keyframes cc-slow-drift {
  0%, 100% { transform: translateX(-4%) translateY(0); }
  50% { transform: translateX(4%) translateY(-3%); }
}
```

## 12. Floating assistant

### 12.1 Idle pulse

```css
@keyframes cc-assistant-pulse {
  0%, 100% { box-shadow: 0 18px 45px rgba(11,107,255,.32); }
  50% { box-shadow: 0 18px 55px rgba(11,107,255,.44); }
}

.floating-assistant {
  animation: cc-assistant-pulse 2.8s ease-in-out infinite;
}
```

### 12.2 Estado online

```css
.online-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #22C55E;
  border: 2px solid #fff;
  position: absolute;
  top: 3px;
  right: 3px;
}
```

## 13. Toasts

Para acciones como carrito/favorito:

```txt
Producto agregado al carrito
Ver carrito
```

Estilo:

- fondo blanco/glass,
- borde suave,
- icono verde o azul,
- sombra media,
- entra desde abajo con `translateY(8px)` y fade.

Duración: `2400ms`.

## 14. Performance

- Animar `transform` y `opacity` siempre que sea posible.
- Evitar animar `width`, `height`, `left`, `top` en loops.
- Usar `will-change` solo en elementos animados frecuentemente.
- No tener más de 3–5 animaciones infinitas visibles simultáneamente.
- Pausar loops decorativos si el tab no está visible, si aplica.

## 15. Checklist de microanimaciones

- ¿Los hover se sienten rápidos y suaves?
- ¿No hay movimientos exagerados?
- ¿El hero parece vivo pero no distrae?
- ¿Las tarjetas elevan suavemente?
- ¿El botón de carrito responde al click?
- ¿El buscador tiene focus premium?
- ¿Los filtros colapsan sin salto brusco?
- ¿Se respeta `prefers-reduced-motion`?
