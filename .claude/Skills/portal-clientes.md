# Portal del Cliente — CloudCommerce

Documentación visual de las páginas del área privada del cliente.
Basado en imágenes 3, 4 y 5 de referencia.

Ver `estetica.md` para tokens base. Ver `tarjetas.md` para cards específicas.

---

## Layout base del portal (compartido en todas las páginas)

```
┌─────────────┬──────────────────────────────────────────┐
│             │  HEADER (mismo que tienda pública)        │
│  SIDEBAR    ├──────────────────────────────────────────┤
│  240px      │                                          │
│  sticky     │         MAIN CONTENT AREA                │
│             │         (varía por página)               │
│             │                                          │
│             │                                          │
└─────────────┴──────────────────────────────────────────┘
                                         [Widget IA 56px]
```

### Sidebar del portal cliente
```
[Avatar usuario 40px]  Andrés 😊
maxilavagetto@gmail.com

─────────────────
📊  Mi resumen          ← activo: azul + bg azul claro
📦  Mis pedidos
❤️   Mis listas
📍  Mis direcciones
💳  Mis tarjetas
📋  Historial
💰  Mis facturas
🎫  Cupones
⭐  Mis puntos
🔔  Notificaciones
⚙️   Configuración
─────────────────
🏠  Ir a la tienda
🚪  Cerrar sesión
```

- background: white
- border-right: 1px solid #E2E8F0
- padding: 20px 16px
- Item activo: bg #EBF0FF, text #0057FF, border-left 3px solid #0057FF
- Item hover: bg #F8F9FA
- Todos los items: 14px medium, padding 10px 12px, rounded-lg, gap 4px
- Secciones separadas por `<hr>` sutil

---

## Página 1: Dashboard del cliente (imagen 4)

URL: `/account` o `/mi-cuenta`

### Greeting section (top)
```
Hola, Andrés 😊                    ← 24px bold
maxilavagetto@gmail.com            ← 14px text-muted
[Puntos: ★ 3,400  Nivel 3]         ← badge azul inline
```

### Stats row — 5 stat cards en fila
```
[💳 Puntuación de gastos]  [💰 Total Ahorros]  [🎫 Cupones activos]  [📦 Seguimiento activos]  [⭐ Nivel]
   $12,560,000                $3,285,600            2                     3                        3,400 pts
```
Ver especificación en `tarjetas.md` → Stat Card.

### Fila principal (2 columnas: ~65% / 35%)

**Columna izquierda:**

```
[Resumen de puntos]
Gráfico de línea (últimos 6 meses)
- Eje X: meses (Ene, Feb, Mar...)
- Eje Y: pesos gastados
- Línea azul (#0057FF), área fill con gradiente azul 10% opacity
- Puntos en la línea: círculos blancos con borde azul
- Tooltip al hover: valor exacto del mes

[Últimas compras]                    ← tabla
| Producto    | Fecha  | Precio  | Estado     |
|-------------|--------|---------|------------|
| Samsung...  | Jun 14 | $2.3M   | Entregado  |
| LG Lavadora | Jun 10 | $3.2M   | En camino  |
→ botón "Ver todas las compras"
```

**Columna derecha:**

```
[Estado de pedidos]
  Ver tarjeta #3 en tarjetas.md

[Categorías favoritas]
  Electrónica       ████████ 45%
  Electrodomésticos ████████ 32%
  Audio y Video     ███ 23%
  → barras horizontales azules

[Ahorro mensual]
  Jun: $320,000 ↑
  May: $280,000

[CloudEnvíos widget]
  Ver tarjeta #9 en tarjetas.md
```

---

## Página 2: Asistente IA (imagen 3)

URL: `/account/asistente` o integrada en la home del portal

### Header de la página
```
¿En qué puedo ayudarte hoy?         ← 28px bold
(saludo personalizado si aplica)
```

### Chat input central
```
┌──────────────────────────────────────────────────┐
│  🔍  Pregúntame algo, busca productos...          │
│                                              [→]  │
└──────────────────────────────────────────────────┘
border-radius: 16px, shadow media, border azul on focus
height: 56px
```

### Sugerencias rápidas (chips debajo del input)
```
[🔍 Buscar lavadoras]  [📦 Rastrear pedido]  [💰 Ver ofertas de hoy]  [📋 Mi historial]
chips: borde azul claro, text azul, hover bg #EBF0FF
```

### Layout con producto destacado (cuando AI sugiere algo)

```
┌────────────────────────────────┬──────────────────┐
│  Secciones de info:            │  [Producto]       │
│                                │                   │
│  [Seguimiento y alertas]       │  LG Lavadora      │
│  [Disponibilidad]              │  Carga Frontal    │
│  [Historial de compras]        │  23kg             │
│  [Recomendaciones]             │                   │
│                                │  $2,895,900       │
│                                │                   │
│                                │  [Agregar] [Ver]  │
└────────────────────────────────┴──────────────────┘
```

### Grid de Recomendaciones inteligentes
```
[Título sección]  Ver todas →

[Card] [Card] [Card] [Card]   ← scroll horizontal o grid 4 cols
```

### Sección "Comparación Inteligente"

Tabla comparativa auto-generada por IA:
```
                Samsung Galaxy  Xiaomi 12T  Apple...
Precio          $2,349,900     $1,899,900  $4,499,900
RAM             8GB            8GB         6GB
Cámara          108MP          108MP       12MP
Batería         5000mAh        5000mAh     3227mAh
Rating          ★★★★½          ★★★★☆       ★★★★★
```
Header de la tabla: azul, celdas alternadas: white / #F8F9FA.

---

## Página 3: Seguimiento de envíos (imagen 5)

URL: `/account/pedidos/[id]/seguimiento`

### Header de la página
```
Seguimiento de envíos               ← 24px bold

Encontramos tu pedido más reciente  ← 14px text-muted

Pedido: #CC-2025-45872   |   Entrega estimada: Lun 17, 2025
```

### Step progress tracker (barra de progreso de etapas)

```
●────────●────────●────────●────────○
Coordinación  Procesado  Listo  En Camino  Entregado
  ✓ Jun 12    ✓ Jun 13  ✓ Jun 14  ● actual   pending

```

Especificación:
- Círculos completados: fondo #0057FF, ícono check blanco, 36px
- Círculo actual: borde 3px #0057FF, fondo white, dot azul interno
- Círculos pending: borde 2px #E2E8F0, fondo #F8F9FA, 36px
- Línea conectora: 3px, completada #0057FF, pendiente #E2E8F0
- Labels: 12px medium debajo de cada círculo
- Fecha pequeña: 11px text-muted debajo del label

### Layout principal (3 columnas)

**Columna izquierda (mapa) ~50%:**
```
┌──────────────────────────────────┐
│                                  │
│     [MAPA Colombia]              │
│     Google Maps / Mapbox         │
│                                  │
│     • Bogotá (origen)            │
│     • Medellín (destino)         │
│     ——línea de ruta punteada—    │
│                                  │
│     [camión animado en ruta]     │
│                                  │
└──────────────────────────────────┘
border-radius: 16px, overflow hidden
height: ~360px
```

Mapa spec:
- Estilo: mapa limpio, colores suaves (no el mapa por defecto de Google, usar estilo personalizado claro)
- Markers: pin azul (origen), pin verde (destino), ícono camión en ruta
- Línea de ruta: punteada azul
- Controles de zoom: minimales, esquina inferior derecha

**Columna central-derecha (actividad) ~30%:**
```
[Actividad del pedido]
│
├─● Jun 14, 10:42am
│   Paquete en camino
│   Centro Logístico Bogotá
│
├─● Jun 13, 3:15pm
│   Paquete listo para despacho
│
├─● Jun 13, 11:00am
│   Pedido procesado
│
└─○ Jun 12, 9:30am
    Pedido recibido

Timeline:
- Línea vertical izquierda: 2px solid #E2E8F0
- Puntos: 10px circles, completados #0057FF, pending #E2E8F0
- Fecha: 12px text-muted
- Descripción: 14px text-primary
- Sub-text: 12px text-muted (ubicación)
```

**Columna derecha (detalles) ~20%:**
```
[Notas de entrega]
  Dejar en portería / recepción
  Llamar al llegar

[Detalles del paquete]
  Dimensiones: 60 × 45 × 32 cm
  Peso: 25 kg
  Cajas: 2

[Transportista]
  TCC Colombia
  [logo pequeño]
```

### Tabla inferior: Items del pedido
```
| # | Producto       | Código       | Cantidad | Estado   |
|---|----------------|--------------|----------|----------|
| 1 | Samsung Family | CCB001-2847  | 1        | En camino|
| 2 | Kit Instalación| CCB001-2847B | 1        | En camino|
```

### Resumen de entrega (esquina inferior derecha)
```
┌────────────────────────────────┐
│  Resumen de entrega            │
│                                │
│  [Gráfico de dona]             │
│  92% - A tiempo                │  ← dona con 92% fill azul
│                                │
│  Completados: 47               │
│  En proceso: 3                 │
│  Cancelados: 1                 │
│  Retrasados: 0                 │
└────────────────────────────────┘
```

---

## Estados del pedido (badge colors)

```
Coordinación:  bg #FEF3C7, text #92400E, dot amber
Procesado:     bg #DBEAFE, text #1E40AF, dot blue
Listo:         bg #E0E7FF, text #3730A3, dot indigo
En camino:     bg #DBEAFE, text #0057FF, dot blue (animado pulse)
Entregado:     bg #D1FAE5, text #065F46, dot green
Cancelado:     bg #FEE2E2, text #991B1B, dot red
Retrasado:     bg #FEF3C7, text #92400E, dot amber (con ⚠)
```

---

## Notas de implementación del portal

- Todas las páginas del portal tienen el mismo sidebar izquierdo (240px, sticky).
- El mapa en seguimiento usa Mapbox GL JS (más customizable que Google Maps para estilos).
- Los gráficos (línea de gastos, dona de entrega) usar Recharts o Chart.js.
- El widget de IA flotante aparece en TODAS las páginas del portal.
- Las tablas de pedidos e historial usan el componente `DataTable` de `packages/ui`.
- El progress tracker de etapas es un componente custom: `StepTracker`.
