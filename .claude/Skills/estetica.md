# Sistema Visual — CloudCommerce

Fuente de verdad del diseño. Aplica a `apps/store` y `apps/admin`.
Basado en las 5 imágenes de referencia confirmadas.

---

## Paleta de colores

```
Primary blue:       #0057FF   (botones, links, logo, acentos)
Primary hover:      #0047D9   (hover de botones)
Primary light:      #EBF0FF   (backgrounds de chips, badges info)

Background page:    #F4F6FA   (fondo gris muy suave de toda la app)
Surface card:       #FFFFFF   (fondo de tarjetas, paneles, sidebar)
Border:             #E2E8F0   (separadores, bordes de cards)
Border hover:       #CBD5E1

Text primary:       #0F172A   (títulos, precios, texto importante)
Text secondary:     #475569   (descripciones, labels)
Text muted:         #94A3B8   (placeholders, texto deshabilitado)

Success green:      #10B981   (disponible, entregado, ahorro)
Warning amber:      #F59E0B   (alertas, stock bajo)
Error red:          #EF4444   (errores, fuera de stock)
Info blue:          #3B82F6   (informativos, notificaciones)

Price color:        #0F172A   (precio principal, bold)
Price old:          #94A3B8   (precio tachado)
Price discount:     #10B981   (porcentaje de descuento, badge verde)
```

---

## Tipografía

**Font family**: Inter (Google Fonts). Fallback: system-ui, sans-serif.

```
/* Jerarquía de tamaños */
Hero heading:     48px / font-bold / leading-tight / text-white (sobre banner)
Page title:       28px / font-bold / text-primary
Section title:    20px / font-semibold / text-primary
Product title:    15px / font-medium / text-primary / leading-snug (2 líneas max)
Price main:       22px / font-bold / text-primary
Price secondary:  14px / font-normal / text-muted / line-through
Label:            12px / font-medium / text-secondary / uppercase tracking-wide
Body:             14px / font-normal / text-secondary
Caption:          12px / font-normal / text-muted
Nav item:         14px / font-medium / text-secondary
Button:           14px / font-semibold
```

---

## Espaciado y layout

```
/* Contenedor principal */
max-width: 1440px, centrado, padding horizontal: 24px

/* Grid de productos */
Columnas desktop (≥1280px): 4 columnas, gap: 16px
Columnas tablet (768-1279px): 3 columnas, gap: 16px
Columnas mobile (<768px): 2 columnas, gap: 12px

/* Sidebar izquierdo (store) */
width: 240px, sticky top-0, padding: 16px

/* Padding interno de cards */
padding: 16px

/* Gap entre secciones de página */
gap vertical entre secciones: 32px
```

---

## Border radius

```
Cards de producto:      rounded-xl   (12px)
Botones primarios:      rounded-lg   (8px)
Botones pequeños:       rounded-md   (6px)
Badges / chips:         rounded-full (9999px)
Inputs:                 rounded-lg   (8px)
Modales / panels:       rounded-2xl  (16px)
Avatar usuario:         rounded-full
Thumbnails imagen:      rounded-lg   (8px)
```

---

## Sombras

```
Card default:   box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)
Card hover:     box-shadow: 0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)
Dropdown:       box-shadow: 0 8px 24px rgba(0,0,0,0.12)
Modal:          box-shadow: 0 20px 60px rgba(0,0,0,0.15)
Sidebar:        box-shadow: 2px 0 8px rgba(0,0,0,0.06) (solo cuando es overlay)
Button:         ninguna (flat design en botones)
```

---

## Componentes de botón

### Botón primario (Agregar al carrito)
```
bg: #0057FF
text: white
padding: 10px 16px
border-radius: 8px
font: 14px semibold
hover: bg #0047D9, slight scale(1.01)
active: scale(0.98)
width: 100% (dentro de cards)
icon: shopping cart icon izquierda (16px)
```

### Botón secundario (Compare ahora, Ver todos)
```
bg: transparent
border: 1.5px solid #0057FF
text: #0057FF
padding: 10px 16px
border-radius: 8px
hover: bg #EBF0FF
```

### Botón ghost / link
```
text: #0057FF
underline on hover
no background ni border
```

---

## Header / Navbar

Layout: `logo | nav-links | search-bar | location | icons`

- **Logo**: "cloudcommerce" en azul con ícono de nube a la izquierda. Font bold.
- **Nav links**: Inicio, Catálogo, Ofertas, Novedades, Marcas, Capacitaciones — 14px medium, gap 24px, hover text-primary.
- **Search bar**: ocupa el centro, ~380px ancho, rounded-full, bg #F1F5F9, placeholder "Buscar producto, catálogo o más...", lupa icon azul a la derecha. Border: none, focus: ring blue.
- **Localización**: pin icon + "Bogotá, CO" — 13px, text-secondary.
- **Iconos derecha**: usuario (circle icon), corazón (wishlist), carrito (con badge número en rojo). Gap: 20px.
- **Background**: blanco, `border-bottom: 1px solid #E2E8F0`, sticky top-0, z-50.
- **Height**: ~64px.

---

## Sidebar de categorías (store)

Estructura dentro del sidebar izquierdo de 240px:

```
[CATEGORÍAS]              ← label uppercase 11px muted
  ▾ Electrónica           ← item con chevron, 14px medium
      Computadoras        ← subitem indentado 12px
      Celulares
      Consolas
      ...
  ▾ Refrigeradores
  ▾ Lavadoras
  ▾ Audio y Video
  ▾ Imagen
  ▾ Electrodomésticos

[RANGO DE PRECIO]         ← separador + label
  [slider dual range]     ← azul, thumb circular
  $0 ─────────── $5M+

[CALIFICACIONES]
  ★★★★★  (4+)
  ★★★★☆  (3+)

[DISPONIBILIDAD]
  □ En stock
  □ Disponible hoy
```

Fondo blanco, padding 16px, separadores `border-top: 1px solid #E2E8F0`.

---

## Barra de confianza (trust bar) — pie de página interior

4 items horizontales, centrados, separados por divisor vertical:

```
📦 Envíos desde $4.99   |   🔒 Pago seguro   |   ↩ Fácil devoluciones   |   💬 Atención 24/7
```

- Fondo blanco, padding 20px 0, border-top 1px solid #E2E8F0.
- Ícono azul (20px) + texto 13px medium text-secondary.
- Sticky al fondo de la página o dentro del contenido, no footer fijo.

---

## States de interacción globales

```
Focus ring: outline: 2px solid #0057FF, outline-offset: 2px
Disabled: opacity-50, cursor-not-allowed
Loading: skeleton shimmer (#F1F5F9 → #E2E8F0 → #F1F5F9, 1.5s infinite)
Empty state: ilustración centrada + texto muted + CTA
Error state: borde rojo, mensaje debajo en rojo
```
