# Páginas de la Tienda Pública — CloudCommerce

Especificación visual de `apps/store`.
Basado en imágenes de referencia 1 (homepage) y 2 (PDP).

Ver `estetica.md` para tokens. Ver `tarjetas.md` para cards. Ver `Microanimaciones.md` para interacciones.

---

## Página 1: Homepage / Listing (imagen 1)

URL: `/` o `/(shop)`

### Layout general
```
[HEADER — sticky]
───────────────────────────────────────────────
[SIDEBAR 240px]  │  [HERO BANNER]
                 │  [FILTER CHIPS]
                 │  [PRODUCT GRID 4 cols]
                 │  [PAGINACIÓN]
[TRUST BAR]
[FOOTER]
```

---

### Hero Banner

```
┌─────────────────────────────────────────────────────┐
│                                              [img]  │
│  Tecnología que                        [Monitor]   │
│  eleva tu vida.                        [Laptop]     │
│                                        [Tablet]    │
│  Descubrí lo último en electrónica y              │
│  electrodomésticos al mejor precio.               │
│                                                   │
│  [Ver catálogo completo →]                        │
└─────────────────────────────────────────────────────┘

Specs:
- Background: gradiente horizontal de izquierda a derecha
  from: #0047D9 (azul intenso)
  to:   #0084FF (azul cielo / eléctrico)
- Border-radius: 16px (dentro del contenedor)
- Padding: 40px 48px
- Altura: ~200px
- Texto: blanco
- Heading: 36px bold
- Subtítulo: 15px normal, opacity 0.9
- CTA: botón blanco sólido, text #0057FF, hover bg #F0F4FF
- Imágenes (derecha): float / absolute, 2-3 productos superpuestos ligeramente
  con sombras y diferente escala para dar profundidad
- Las imágenes tienen drop-shadow blanca suave
```

---

### Filter Chips (categorías horizontales)

```
[Todo] [Recomendados] [Computadoras] [Celulares] [Consolas] [Audio y Video] [Imagen] [Electrodomésticos]

Posición: debajo del hero, encima del grid
Scroll horizontal sin barra en mobile
Gap: 8px
```
Ver especificación completa en `tarjetas.md` → Category Chip.

### Barra de resultados + ordenamiento

```
4,871 productos encontrados                   Ordenar por: Relevancia ▼
```
- Texto izquierda: 14px text-muted
- Dropdown derecha: select o custom dropdown, 14px, border 1px solid #E2E8F0, rounded-lg

---

### Product Grid

```
DESKTOP (≥1280px): 4 columnas, gap 16px
TABLET  (768-1279px): 3 columnas, gap 16px
MOBILE  (<768px): 2 columnas, gap 12px
```

Ver especificación de Product Card en `tarjetas.md`.

### Paginación

```
[←]  1  2  3  ...  48  [→]

- Estilo: botones simples, activo fondo #0057FF blanco
- Rounded: 8px
- Gap: 4px
```

---

### Sidebar de filtros (izquierda, sticky)

Ver especificación completa en `estetica.md` → Sidebar de categorías.

Comportamiento:
- En desktop: siempre visible, 240px fijo
- En tablet/mobile: colapsable, abre como drawer desde la izquierda
  botón "Filtros ☰" que lo abre
- Categorías: expandibles con animación de chevron rotate

---

### Trust Bar (barra de confianza)

```
📦 Envíos desde $4.99   |   🔒 Pago seguro   |   ↩ Fácil devoluciones   |   💬 Atención 24/7
```
Ver especificación en `estetica.md` → Trust Bar.

---

## Página 2: Product Detail Page — PDP (imagen 2)

URL: `/(shop)/products/[slug]`

### Breadcrumb

```
Inicio > Catálogo > Refrigeradores > Samsung > Samsung Family Hub 636L

- 13px text-muted
- separador: `>` con padding horizontal 6px
- último item: text-primary (no link)
- items anteriores: link hover text-blue
```

### Layout PDP

```
[BREADCRUMB]

[GALLERY 45%]  │  [INFO CENTRAL 35%]  │  [PURCHASE PANEL 20%]

[TABS DE CONTENIDO — ancho completo]
```

---

### Galería de imágenes (izquierda, ~45% ancho)

```
┌──────────────────────────────────────┐
│ [thumb] │                            │
│ [thumb] │     IMAGEN PRINCIPAL       │
│ [thumb] │        (grande)            │
│ [thumb] │                            │
│ [thumb] │                            │
└──────────────────────────────────────┘

Thumbnails:
- Columna vertical izquierda, ~70px × 70px cada una
- Seleccionada: borde 2px #0057FF, rounded-lg
- No seleccionada: borde 1px #E2E8F0
- Gap: 8px

Imagen principal:
- Cuadrada o rectangular según el producto
- Máx 500px × 500px
- object-contain, fondo #F8F9FA
- Border-radius: 12px
- Hover: cursor zoom-in → abrir lightbox modal
```

---

### Info central (~35% ancho)

```
[Badge marca: SAMSUNG]               ← chip pequeño azul claro, 12px
Samsung Family Hub™ 4 Puertas 636L  ← 24px bold, max 3 líneas

★★★★☆  4.3  (1,247 opiniones)       ← estrellas + número link
SKU: SAM-RF636-BLK                   ← 12px text-muted

─────────────────────────────────────

$ 7,299,900                          ← precio actual, 28px bold
~~$ 8,199,900~~   Ahorrás $900,000   ← precio original + ahorro verde

─────────────────────────────────────

Color:
  [■ Negro Mate ✓]  [□ Acero]  [□ Blanco]  ← botones con muestra de color

Capacidad:
  [590L]  [636L ✓]  [750L]              ← chips de variante

─────────────────────────────────────

Cantidad:  [−] [1] [+]                  ← contador compacto

─────────────────────────────────────

[🛒 Agregar al carrito]                 ← botón azul full-width 48px
[♡ Agregar a favoritos]                 ← botón outline full-width 48px
[⚖ Compare ahora]                       ← link text azul, centrado

─────────────────────────────────────

Compartir: [Facebook] [Twitter] [Link]  ← íconos pequeños 20px
```

---

### Purchase Panel — sticky (derecha, ~20% ancho)

Ver especificación en `tarjetas.md` → Product Detail Card.

Contenido adicional:
```
🚚 Envío gratis
   Ingresa tu código postal: [_____] [Calcular]

⚡ Disponible hoy para retiro en tienda

🔒 Compra protegida
   Garantía de satisfacción 30 días

💳 Financiación disponible
   Hasta 36 cuotas sin interés
   (con Visa, MC o PSE)

[VISA] [Mastercard] [Amex] [PSE] [Nequi]
```

---

### Tabs de contenido (ancho completo)

```
[Descripción] [Especificaciones] [Servicios] [Opiniones (1247)] [Preguntas (34)]
```

Estilo de tabs:
- Borde inferior activo: 2px solid #0057FF
- Tab activo: texto #0057FF, bold
- Tab inactivo: texto #475569, hover texto #0F172A

#### Tab: Descripción
```
Párrafo introductorio del producto + lista de características destacadas:

✓ Pantalla táctil 21" integrada para organizar tu hogar
✓ Cámaras interiores con visión desde tu smartphone
✓ Tecnología inverter — Ahorra hasta 40% de energía
✓ Dispensador de agua y hielo automático
✓ Capacidad total: 636 litros

Imagen opcional de lifestyle del producto
```

#### Tab: Especificaciones
```
| Característica      | Valor                    |
|---------------------|--------------------------|
| Capacidad           | 636L                     |
| Color               | Negro Mate               |
| Dimensiones         | 178.5 × 91.2 × 71.6 cm  |
| Peso neto           | 127 kg                   |
| Consumo energético  | 390 kWh/año              |
| Garantía            | 1 año compresora 10 años |

Header: bg #F1F5F9
Filas alternadas: white / #F8F9FA
Border: 1px solid #E2E8F0
```

#### Tab: Opiniones
```
Resumen:
4.3/5  ★★★★☆         Distribución:
(basado en 1,247)      ★★★★★  64%  ████████████
                       ★★★★☆  21%  ████
                       ★★★☆☆   9%  ██
                       ★★☆☆☆   4%  ▌
                       ★☆☆☆☆   2%  ▌

[Escribir opinión]

Listado de reviews:
  [Avatar] Ana G. ★★★★★  "Excelente refrigerador..."
  Hace 3 días · Compra verificada ✓
  [👍 Útil (12)]
```

---

## Páginas secundarias de la tienda

### Carrito (`/cart`)

```
┌──────────────────────────────┬──────────────────┐
│  Tu carrito (3 items)        │  Resumen         │
│                              │                  │
│  [img] Samsung Galaxy...     │  Subtotal        │
│        Cantidad: [−][1][+]   │  $7,049,700      │
│        $2,349,900    [🗑]    │  Descuento -5%   │
│                              │  -$352,485       │
│  [img] LG Lavadora...        │  ────────────    │
│        ...                   │  Total           │
│                              │  $6,697,215      │
│  [img] Apple AirPods...      │                  │
│        ...                   │  [Ir al pago →]  │
│                              │                  │
│  [← Seguir comprando]        │  🔒 Pago seguro  │
└──────────────────────────────┴──────────────────┘
```

### Checkout (`/checkout`)

Pasos como stepper horizontal:
```
① Dirección → ② Envío → ③ Pago → ④ Confirmación
```

### Búsqueda (`/search`)

Misma estructura que homepage pero con:
- Header con "Resultados para: [término]" en vez de hero banner
- Filtros más específicos según la categoría
- Sin hero banner (se reemplaza por la barra de resultados directamente)
