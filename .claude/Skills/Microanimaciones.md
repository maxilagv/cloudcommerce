# Microanimaciones y Hover States — CloudCommerce

Especificación de todas las interacciones animadas.
Implementar con Tailwind transitions + Framer Motion donde se indica.

---

## Principios

- **Velocidad**: 150-250ms en la mayoría de las interacciones. Nunca más de 400ms.
- **Easing**: `ease-out` para entradas, `ease-in` para salidas, `ease-in-out` para hover.
- **Intención**: cada animación refuerza la acción, nunca es decorativa pura.
- **Respeto al usuario**: respetar `prefers-reduced-motion`. Usar `@media (prefers-reduced-motion: reduce)` para desactivar.

---

## Product Card hover

```css
/* Card container */
transition: transform 200ms ease-out, box-shadow 200ms ease-out, border-color 200ms ease-out;

hover: {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  border-color: #CBD5E1;
}

/* Imagen dentro de la card */
.card:hover img {
  transform: scale(1.04);
  transition: transform 300ms ease-out;
}

/* Botón "Agregar al carrito" — slide up desde abajo */
.add-to-cart-btn {
  transform: translateY(8px);
  opacity: 0;
  transition: transform 200ms ease-out, opacity 200ms ease-out;
}
.card:hover .add-to-cart-btn {
  transform: translateY(0);
  opacity: 1;
}
```

Alternativa más simple (si se prefiere siempre visible): solo hacer hover en el botón con `bg darken`.

---

## Botón primario (Agregar al carrito)

```css
button {
  transition: background-color 150ms ease, transform 100ms ease, box-shadow 150ms ease;
}

hover: {
  background-color: #0047D9;
  transform: scale(1.01);
}

active: {
  transform: scale(0.97);
  background-color: #003FBB;
}

/* Estado de carga (después de click) */
loading: {
  opacity: 0.85;
  cursor: wait;
  /* spinner icon reemplaza el texto */
}
```

### Feedback de "Agregado al carrito"
Cuando el usuario agrega un producto:
1. Botón se transforma: `[🛒 Agregar al carrito]` → `[✓ Agregado]` (verde, 1.5s)
2. Ícono del carrito en el header hace un bump: `scale(1.2)` → `scale(1)`, 300ms.
3. Badge del carrito incrementa con fade-in del número nuevo.
4. Toast notification aparece desde arriba derecha (ver Toasts).

---

## Wishlist (corazón)

```css
/* Ícono corazón — idle */
color: #94A3B8; /* gris */
transition: color 200ms, transform 200ms;

/* Hover */
.wishlist-btn:hover {
  color: #F43F5E; /* rose */
  transform: scale(1.15);
}

/* Activo (guardado en wishlist) */
.wishlist-btn.active {
  color: #F43F5E;
  fill: #F43F5E;
  animation: heartPop 300ms ease-out;
}

@keyframes heartPop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.3); }
  70%  { transform: scale(0.9); }
  100% { transform: scale(1); }
}
```

---

## Progress bar (seguimiento de envíos)

```css
/* Carga inicial — barras de progreso */
.progress-fill {
  width: 0%;
  transition: width 800ms ease-out;
  /* Al montar el componente, anima hasta el valor real */
}

/* Step tracker — círculos */
.step-circle.completed {
  animation: stepComplete 400ms ease-out;
}

@keyframes stepComplete {
  0%   { transform: scale(0.8); opacity: 0.5; }
  60%  { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}

/* Dot pulsante en el paso actual (En Camino) */
.step-dot-active::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  border: 2px solid #0057FF;
  animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes ping {
  0%   { transform: scale(1); opacity: 0.75; }
  100% { transform: scale(2); opacity: 0; }
}
```

---

## Skeleton loading (carga de productos)

```css
/* Mientras cargan las tarjetas de producto */
.skeleton {
  background: linear-gradient(
    90deg,
    #F1F5F9 25%,
    #E2E8F0 50%,
    #F1F5F9 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
```

Usar skeleton en: grid de productos, imagen PDP, stats del dashboard, tabla de pedidos.

---

## Toast notifications

Librería: Sonner (shadcn/ui default).

```
Posición: top-right, offset 20px desde el borde
Duración: 3000ms (3s)
Animación entrada: slide-in-right + fade-in (200ms)
Animación salida: fade-out + slide-up (150ms)

Tipos:
✓ Éxito:  bg white, borde-left 4px #10B981, ícono check verde
ℹ Info:   bg white, borde-left 4px #0057FF, ícono info azul
⚠ Aviso:  bg white, borde-left 4px #F59E0B, ícono warning amber
✗ Error:  bg white, borde-left 4px #EF4444, ícono x rojo

Ejemplos de texto:
- "✓ Samsung Galaxy añadido al carrito"
- "✓ Guardado en tu lista de deseos"
- "ℹ Sesión iniciada correctamente"
```

---

## Cart drawer (panel lateral)

```css
/* Overlay */
.cart-overlay {
  background: rgba(0,0,0,0.4);
  animation: fadeIn 200ms ease-out;
}

/* Drawer panel */
.cart-panel {
  transform: translateX(100%);
  transition: transform 300ms cubic-bezier(0.32, 0.72, 0, 1);
}

.cart-panel.open {
  transform: translateX(0);
}
```

---

## Navegación sidebar (portal cliente)

```css
/* Item de sidebar al hacer click */
.sidebar-item {
  transition: background-color 150ms ease, color 150ms ease;
}

/* Indicador activo — borde izquierdo */
.sidebar-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  width: 3px;
  height: 100%;
  background: #0057FF;
  border-radius: 0 2px 2px 0;
  animation: slideInBar 200ms ease-out;
}

@keyframes slideInBar {
  from { height: 0%; opacity: 0; }
  to   { height: 100%; opacity: 1; }
}
```

---

## Gráfico de línea (dashboard — gastos)

```
Con Recharts:
- Línea se dibuja de izquierda a derecha al montar
- strokeDasharray animado: totalLength → 0
- Duración: 1000ms ease-out
- Puntos (dots) aparecen con delay escalonado: 50ms × index
- Área fill: fadeIn 600ms delay 400ms
```

---

## Mapa (página de seguimiento)

```
Al cargar la página:
1. Mapa hace zoom-in desde vista continental → vista de ruta (1500ms)
2. Marcadores de origen y destino: drop-in con bounce (300ms cada uno)
3. Línea de ruta se "dibuja" de origen a destino (1000ms)
4. Ícono de camión aparece y hace la animación de movimiento a lo largo de la ruta

Camión en movimiento:
- Framer Motion path animation
- Loop suave en el trayecto actual
- Rotación del ícono sigue la dirección de la ruta
```

---

## Número counter (stats del dashboard)

```
Al montar las stat cards:
- Los números cuentan desde 0 hasta el valor real
- Duración: 1200ms, ease-out
- Delay escalonado: card 1 → 0ms, card 2 → 100ms, card 3 → 200ms...

Implementar con: useCountUp hook custom o react-countup
```

---

## Imagen de producto en PDP

```css
/* Thumbnail → imagen principal */
Al hacer click en thumbnail:
  imagen principal: crossfade (opacity 0 → 1, 200ms)
  thumbnail activo: borde 2px solid #0057FF

/* Zoom en hover (desktop) */
.product-image:hover {
  cursor: zoom-in;
}
/* Lupa: mostrar imagen 2x en un panel flotante al lado */
/* Implementar con react-medium-image-zoom */
```

---

## Badge counter del carrito

```css
@keyframes cartBump {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.4); }
  100% { transform: scale(1); }
}

.cart-badge {
  animation: cartBump 300ms ease-out;
  /* Se dispara cada vez que se agrega un item */
}
```

---

## Tabla de pedidos (row hover)

```css
tr {
  transition: background-color 100ms ease;
}

tr:hover {
  background-color: #F8F9FA;
}

/* Click → feedback */
tr:active {
  background-color: #EBF0FF;
}
```

---

## Implementación en Next.js

```ts
// tailwind.config.ts — asegurar que las transiciones estén habilitadas
// Framer Motion para animaciones complejas (mapa, gráficos, counters)
// CSS puro para hover states simples (más performante)
// Intersection Observer para animar elementos al entrar al viewport

// Ejemplo: animar stats al entrar al viewport
const { ref, inView } = useInView({ threshold: 0.1, triggerOnce: true })
// Solo arrancar el counter cuando la card es visible
```
