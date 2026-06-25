# Tarjetas y Cards — CloudCommerce

Especificación visual de todos los tipos de tarjeta que aparecen en las referencias.
Ver `estetica.md` para tokens de color, tipografía y sombras base.

---

## 1. Product Card (tarjeta de producto — grilla principal)

Usada en: homepage grid, búsqueda, recomendaciones, dashboard cliente.

```
┌─────────────────────────┐
│   [♡ wishlist]          │  ← ícono corazón top-right, absoluto
│                         │
│      [imagen producto]  │  ← cuadrado, object-contain, bg #F8F9FA
│      150px × 150px      │
│                         │
│  Samsung Galaxy Tab...  │  ← 15px medium, max 2 líneas, ellipsis
│  ★★★★☆  (241)          │  ← estrellas amarillas + count 12px muted
│                         │
│  $ 2.349.900            │  ← 22px bold text-primary
│  ~~$ 2.800.000~~        │  ← 13px muted, line-through (si hay descuento)
│  [badge: -16%]          │  ← badge verde rounded-full, 11px
│                         │
│  [🛒 Agregar al carrito]│  ← botón azul full-width, 40px height
└─────────────────────────┘

Card specs:
- background: white
- border: 1px solid #E2E8F0 (muy sutil)
- border-radius: 12px
- padding: 16px
- hover: border-color #CBD5E1, shadow elevada, traducción Y -2px (ver microanimaciones.md)
- width: auto (fill grid column)
```

### Badge de descuento
```
bg: #D1FAE5 (verde claro)
text: #065F46 (verde oscuro)
padding: 2px 8px
border-radius: 9999px
font: 11px semibold
contenido: "-16%" o "OFERTA"
posición: inline debajo del precio viejo, o absoluto top-left sobre imagen
```

### Badge "Nuevo"
```
bg: #DBEAFE
text: #1D4ED8
mismo tamaño que badge descuento
```

---

## 2. Stat Card (tarjeta de estadística — dashboard cliente)

Usada en: dashboard del cliente (imagen 4), panel de admin.

```
┌──────────────────────────────┐
│  💳  Puntuación de gastos    │  ← ícono + label 12px muted
│                              │
│  $ 12.560.000                │  ← valor 26px bold
│  ↑ +8.2% vs mes anterior     │  ← tendencia 12px verde o rojo
└──────────────────────────────┘

Specs:
- background: white
- border-radius: 16px
- padding: 20px 24px
- border: none
- shadow: suave (ver estetica.md)
- ícono en circle de color suave (bg del color del tema, 36px)
- grid: 4-5 cards en fila (dashboard)
```

Variantes de color del ícono:
- Gastos: blue (#EBF0FF bg, #0057FF icon)
- Ahorros: green (#D1FAE5 bg, #10B981 icon)  
- Cupones: amber (#FEF3C7 bg, #F59E0B icon)
- Seguimiento: purple (#EDE9FE bg, #7C3AED icon)
- Nivel/Puntos: indigo (#E0E7FF bg, #4F46E5 icon)

---

## 3. Order Status Card (estado de pedido — dashboard)

```
┌─────────────────────────────────────────┐
│  Estado de pedidos                      │
│                                         │
│  [imagen]  Pedido #CC-001-2847          │
│  Samsung...                             │
│            En camino ──────● [badge]    │
│            Entrega estimada: Jun 18     │
│                                         │
│  [imagen]  Pedido #CC-001-2831          │
│  LG...                                  │
│            Entregado        [badge ✓]   │
│                                         │
│  [Ver todos los pedidos →]              │
└─────────────────────────────────────────┘

Badge estados:
- "En camino":   bg #DBEAFE, text #1D4ED8
- "Entregado":   bg #D1FAE5, text #065F46
- "Procesando":  bg #FEF3C7, text #92400E
- "Cancelado":   bg #FEE2E2, text #991B1B
```

---

## 4. Product Detail Card (panel derecho en PDP)

Panel lateral de compra en la página de producto (imagen 2).

```
┌──────────────────────────────┐
│  Comprar ahora               │
│                              │
│  Color: Negro Mate  ▼        │  ← selector de variante
│                              │
│  $ 7.299.900                 │  ← precio 28px bold
│  $ 6.999.936  Ahorra 4%      │  ← precio cuotas / promo
│                              │
│  [🛒 Agregar al carrito]     │  ← botón azul, 48px height
│                              │
│  ──────────────────────────  │
│  🚚 Envío sin costo          │  ← ícono + texto 14px
│     Ingresa tu código postal │
│                              │
│  ⚡ Disponible hoy           │
│                              │
│  💳 Hasta 36 cuotas          │
│     sin interés              │
│                              │
│  [VISA] [MC] [Amex] [PSE]   │  ← logos de pago pequeños
└──────────────────────────────┘

- Sticky mientras scrolleas (position sticky top-80px)
- border-radius: 16px
- border: 1px solid #E2E8F0
- padding: 24px
- shadow: media
```

---

## 5. Recommendation Card (recomendaciones IA — dashboard cliente)

Más compacta que la product card normal. Usada en sección "Recomendaciones inteligentes".

```
┌────────────────────────────┐
│  [imagen 80px]             │
│  Samsung 55"...            │  ← 14px medium, 1 línea
│  $ 3,299,900               │  ← 16px bold
│  ★★★★☆                    │
│  [Agregar] [♡]             │  ← botones pequeños
└────────────────────────────┘

- Scroll horizontal en mobile
- Gap: 12px
- min-width: 180px por card
```

---

## 6. Alert / Tracking Card (seguimiento — dashboard cliente)

```
┌──────────────────────────────────────┐
│  📦  Seguimiento y alertas           │
│                                      │
│  Pedido #CC-2025-45872               │
│  ━━━━━━━━━━━━━━━━ ← progress bar    │
│  En camino · Llega el 17 Jun         │
│                                      │
│  Pedido #CC-2025-45831              │
│  ━━━━━━━━━━━━━━━━━━━━━ (completo)  │
│  Entregado el 14 Jun ✓              │
└──────────────────────────────────────┘

Progress bar:
- height: 4px
- background: #E2E8F0
- fill: #0057FF
- border-radius: 2px
- animado (ver microanimaciones.md)
```

---

## 7. AI Assistant Card (widget flotante)

Botón flotante azul en esquina inferior derecha:

```
[●]  ← círculo azul 56px, shadow elevada
     ícono sparkle/chat blanco 24px
     Badge numérico si hay mensajes nuevos

Al hacer click → panel lateral 320px:
┌────────────────────────────┐
│  ✨ CloudIA                │  ← header azul
│  ¿En qué puedo ayudarte?  │
│  ────────────────────────  │
│  [input text]             │
│  Sugerencias:             │
│  · Buscar productos        │
│  · Rastrear pedido         │
│  · Ver ofertas             │
└────────────────────────────┘
```

---

## 8. Category Chip / Filtro horizontal

```
[Todo] [Recomendados] [Computadoras] [Celulares] ...

Estado activo:
  bg: #0057FF, text: white, border: none

Estado inactivo:
  bg: white, text: #475569, border: 1px solid #E2E8F0
  hover: bg #F1F5F9

Specs:
  padding: 8px 16px
  border-radius: 9999px
  font: 13px medium
  scroll horizontal sin barra en mobile
```

---

## 9. CloudEnvíos Widget (sidebar dashboard)

Widget especial con branding propio dentro del dashboard cliente (imagen 4, bottom left).

```
┌──────────────────────────────┐
│  📦 CloudEnvíos              │  ← header azul suave
│  maxilava... ✉               │
│                              │
│  3 paquetes en camino        │
│  ──────────────────────────  │
│  [Rastrear envíos]           │
│  [¿Necesitas ayuda?]         │
│                              │
│  [avatar asistente]          │
└──────────────────────────────┘

- border-radius: 16px
- border: 1px solid #E2E8F0
- fondo: gradiente suave azul muy claro (#F0F4FF → white)
- texto header: 14px semibold
```
