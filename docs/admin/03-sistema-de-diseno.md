# 03 · Sistema de diseño

> Extiende `.claude/Skills/frontend/estetica.md` (la estética del store) — misma familia de marca,
> resuelta para un panel de administración: más densidad, dos temas, tablas y formularios en vez de
> tarjetas de producto.

## 1. Personalidad visual

El store comunica "catálogo premium, compra segura". El admin comunica algo distinto:
**"control preciso, información clara, sin fricción"**. Sigue siendo CloudCommerce (mismo azul, misma
tipografía, mismos radios grandes) pero prioriza legibilidad de datos sobre seducción visual — es una
herramienta de trabajo, no una vidriera.

Debe comunicar: precisión, calma, orden, foco. No debe comunicar: la estética de un admin genérico de
plantilla (sidebar gris plano, cards sin personalidad, gráficos por defecto de una librería sin
retocar), ni tampoco "dashboard oscuro por moda" — el modo oscuro tiene que estar tan cuidado como el
claro, no ser un afterthought con `filter: invert()`.

## 2. Los dos temas no son inversos, son dos paletas pensadas

Regla dura: **nunca invertir automáticamente**. Cada color oscuro se elige a mano para mantener el
mismo rol semántico y la misma jerarquía de contraste que su par claro.

### 2.1 Tokens — tema claro (hereda casi 1:1 la paleta del store)

```css
:root {
  /* superficies */
  --admin-bg-canvas: #F6F8FB;      /* fondo de página, = --cc-bg-page */
  --admin-bg-shell: #FFFFFF;       /* sidebar, topbar */
  --admin-bg-surface: #FFFFFF;     /* cards, paneles */
  --admin-bg-surface-soft: #F8FAFD;
  --admin-bg-hover: #F6F9FF;
  --admin-bg-selected: #EAF3FF;

  /* bordes */
  --admin-border-subtle: #EEF2F7;
  --admin-border-default: #E5EAF2;
  --admin-border-strong: #D7DFEA;

  /* texto */
  --admin-text-primary: #101828;
  --admin-text-secondary: #475467;
  --admin-text-muted: #7B8798;
  --admin-text-faint: #98A2B3;
  --admin-text-on-accent: #FFFFFF;

  /* marca */
  --admin-accent: #0B6BFF;
  --admin-accent-hover: #005BE8;
  --admin-accent-active: #004ECC;
  --admin-accent-soft: #EAF3FF;
  --admin-accent-border: #BBD7FF;

  /* semántico — separado del accent, nunca se usa para navegación/foco */
  --admin-success: #16A34A;      --admin-success-soft: #EAFBF0;
  --admin-warning: #F59E0B;      --admin-warning-soft: #FFF7E6;
  --admin-danger:  #EF4444;      --admin-danger-soft:  #FEF2F2;
  --admin-info:    #0B6BFF;      --admin-info-soft:    #EAF3FF;

  /* sombras */
  --admin-shadow-xs: 0 1px 2px rgba(16,24,40,.05);
  --admin-shadow-sm: 0 8px 22px rgba(16,24,40,.05);
  --admin-shadow-md: 0 14px 42px rgba(16,24,40,.075);
  --admin-shadow-focus: 0 0 0 4px rgba(11,107,255,.12);
}
```

### 2.2 Tokens — tema oscuro (elegido a mano, no invertido)

La clave de un dark mode que no se sienta "gris apagado con texto blanco": el fondo no es negro puro
(`#000`), es un azul-carbón muy oscuro (misma familia cromática que el accent, desaturada) — así el
azul de marca sigue sintiéndose parte del mismo sistema en vez de "un color que quedó pegado encima de
gris". Las superficies suben de valor en escalones pequeños para crear profundidad sin usar sombras
(las sombras casi no se ven sobre fondo oscuro).

```css
:root[data-theme="dark"] {
  --admin-bg-canvas: #0B0E14;
  --admin-bg-shell: #10141C;
  --admin-bg-surface: #141925;
  --admin-bg-surface-soft: #171D2A;
  --admin-bg-hover: #1B2230;
  --admin-bg-selected: #17253E;

  --admin-border-subtle: #1C2230;
  --admin-border-default: #262E40;
  --admin-border-strong: #333D54;

  --admin-text-primary: #EEF2F8;
  --admin-text-secondary: #A9B2C3;
  --admin-text-muted: #7C879C;
  --admin-text-faint: #5B6478;
  --admin-text-on-accent: #FFFFFF;

  --admin-accent: #4C8CFF;         /* +luminosidad vs. el claro, para AA sobre fondo oscuro */
  --admin-accent-hover: #6BA1FF;
  --admin-accent-active: #7FADFF;
  --admin-accent-soft: #16233D;
  --admin-accent-border: #2A4270;

  --admin-success: #34D399;      --admin-success-soft: #0F2B20;
  --admin-warning: #FBBF24;      --admin-warning-soft: #332506;
  --admin-danger:  #F87171;      --admin-danger-soft:  #341515;
  --admin-info:    #4C8CFF;      --admin-info-soft:    #16233D;

  /* sombras: casi nulas, la profundidad la da el escalón de --bg-surface, no la sombra */
  --admin-shadow-xs: 0 1px 2px rgba(0,0,0,.24);
  --admin-shadow-sm: 0 8px 22px rgba(0,0,0,.28);
  --admin-shadow-md: 0 14px 38px rgba(0,0,0,.34);
  --admin-shadow-focus: 0 0 0 4px rgba(76,140,255,.22);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* mismo bloque que [data-theme="dark"] */ }
}
```

Implementación real: definir el bloque una sola vez y aplicarlo tanto a `[data-theme="dark"]` como
dentro de `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }` — el
toggle manual del usuario (`data-theme`) siempre gana sobre la preferencia del SO. `next-themes`
resuelve esto de fábrica; solo hay que declarar los dos bloques de tokens.

### 2.3 Regla de proporción — versión admin (no es 80/15/5)

El store usa 80% blanco / 15% azul suave / 5% acento intenso porque es una vidriera. El admin trabaja
con datos, así que la proporción es distinta por pantalla:

- **Vistas de lista/tabla**: 85% superficie neutra, 10% bordes/separadores, 5% acento (fila
  seleccionada, link activo, botón primario). El dato manda, el color no compite con él.
- **Dashboard**: acá sí hay más color — es la única pantalla "expresiva" — pero el color con
  significado (semántico: verde=arriba, rojo=abajo, azul=neutral) siempre pesa más que el color
  decorativo.
- **Formularios de edición**: casi monocromo, con el accent reservado para el campo en foco y el botón
  de guardar.

## 3. Tipografía

Misma familia que el store: **Inter** (o `Geist`/`Plus Jakarta Sans` como alternativa válida, no
mezclar). El admin agrega una escala más completa porque maneja tablas y formularios densos:

```css
--admin-font-2xs: 10.5px;  /* badges, contadores */
--admin-font-xs:  11.5px;
--admin-font-sm:  12.5px;  /* texto de tabla secundario */
--admin-font-base:13.5px;  /* texto de tabla primario, cuerpo de formulario */
--admin-font-md:  15px;    /* labels, subtítulos */
--admin-font-lg:  17px;    /* títulos de card, KPI secundario */
--admin-font-xl:  22px;    /* título de página */
--admin-font-2xl: 28px;    /* número de KPI grande */
--admin-font-numeric: ui-monospace, "SF Mono", Menlo, monospace; /* toda cifra que se alinea en columna */
```

Regla dura: **cualquier columna de números (precios, cantidades, IDs, fechas) usa
`font-variant-numeric: tabular-nums`**, o directamente la pila `--admin-font-numeric` cuando son
montos — para que las cifras se alineen visualmente en la tabla, no bailen por el ancho variable de
cada dígito.

Pesos: título de página `650`, KPI grande `700` con `letter-spacing: -0.02em`, nombre de fila de tabla
`560`, texto secundario `400–450`, badge `600` uppercase con `letter-spacing: 0.04em`.

## 4. Radios, espaciado, elevación

Mismos radios que el store (`--cc-radius-*`, renombrados `--admin-radius-*` con los mismos valores) —
la familia visual tiene que sentirse igual. Diferencia: las cards del admin son más rectas en general
(`--admin-radius-md: 14px` para cards de dashboard, `--admin-radius-sm: 10px` para inputs y filas de
tabla) — menos "orgánico/producto", más "panel de control".

Espaciado: misma base de `4px` con la misma escala suave (`4,6,8,10,12,14,16,20,24,28,32,40`). Las
tablas usan padding de fila `10px–12px` vertical (más compacto que una card de producto) para que
quepan más filas sin scroll.

## 5. Iconografía

`lucide-react`, mismo estilo lineal `1.75px` que el store. En el admin los iconos cargan más peso
funcional (acciones de fila, estados) — reservar el ícono **relleno** (variante `-filled` o `fill`
manual) exclusivamente para indicar estado activo/seleccionado, nunca decorativo.

## 6. Superficies clave del admin (no existen en el store)

### 6.1 Sidebar

```css
.admin-sidebar {
  background: var(--admin-bg-shell);
  border-right: 1px solid var(--admin-border-subtle);
}
.admin-sidebar-item[data-active="true"] {
  background: var(--admin-accent-soft);
  color: var(--admin-accent);
  border-radius: var(--admin-radius-sm);
}
.admin-sidebar-item[data-active="true"]::before {
  /* barra indicadora izquierda, 3px, accent — único lugar del sistema con "accent bar" */
  content: ""; position: absolute; left: 0; width: 3px; border-radius: 0 3px 3px 0;
  background: var(--admin-accent); inset-block: 20%;
}
```

### 6.2 Card de KPI

```css
.kpi-card {
  background: var(--admin-bg-surface);
  border: 1px solid var(--admin-border-default);
  border-radius: var(--admin-radius-md);
  box-shadow: var(--admin-shadow-xs);
  padding: 18px 20px;
}
.kpi-card .delta[data-direction="up"]   { color: var(--admin-success); }
.kpi-card .delta[data-direction="down"] { color: var(--admin-danger); }
```

### 6.3 Fila de tabla

```css
.data-table-row {
  border-bottom: 1px solid var(--admin-border-subtle);
  transition: background 140ms var(--admin-ease-out);
}
.data-table-row:hover { background: var(--admin-bg-hover); }
.data-table-row[data-selected="true"] { background: var(--admin-bg-selected); }
```

### 6.4 Badge de estado (pedidos, stock, documentos)

Un solo componente `<StatusBadge>` mapea cada enum del backend (`OrderStatus`, `StockStatus`,
`ShipmentStatus`, `ProductStatus`) a un color semántico + texto en español. Nunca se decide el color
en el punto de uso — vive en una tabla de mapeo centralizada (`lib/format.ts` o
`components/shared/status-badge.tsx`), así un estado nuevo en el backend no puede quedar sin estilo.

| Familia | Ejemplos | Color |
|---|---|---|
| Positivo / completado | `DELIVERED`, `PUBLISHED`, `IN_STOCK` | `--admin-success` |
| En curso / neutral | `PREPARING`, `SHIPPED`, `PENDING_CONFIRMATION` | `--admin-info` |
| Atención | `SOON` (stock), `READY_FOR_REVIEW` | `--admin-warning` |
| Negativo / detenido | `CANCELLED`, `OUT_OF_STOCK`, `RETURN_REQUESTED` | `--admin-danger` |
| Inactivo | `DRAFT`, `ARCHIVED`, `PAUSED` | `--admin-text-faint` (gris, sin fondo de color) |

## 7. Anti-patrones (heredados y propios)

Evitar todo lo que ya evita `estetica.md` (sombras duras, bordes negros, gradientes neón, cards
cuadradas) **más**:

- Modo oscuro como filtro invertido — cada color se define, nunca `filter: invert(1)`.
- Tablas con zebra-striping de alto contraste — usar `hover`/`selected`, no franjas alternadas fijas.
- Más de un color de acento "compitiendo" en la misma pantalla — el accent es uno solo, el resto es
  semántico.
- Gráficos con la paleta por defecto de la librería (azules/verdes genéricos de Recharts) — siempre
  restyleados según [07-graficos-y-dataviz](./07-graficos-y-dataviz.md).
- Iconos rellenos usados como decoración — reservados para estado activo.

## 8. Checklist antes de dar una pantalla por terminada

- ¿Se ve igual de bien en claro y en oscuro (no solo "funciona", sino que se ve **cuidada**)?
- ¿Las cifras están alineadas con `tabular-nums`?
- ¿El acento aparece solo donde guía una acción, no como decoración?
- ¿Los estados (badges, alertas) usan la tabla de mapeo centralizada, no colores ad hoc?
- ¿Hay al menos un estado vacío y un estado de carga diseñados, no un `<div>Loading...</div>`?
- ¿Pasa el checklist de accesibilidad de foco visible y contraste AA en ambos temas?
