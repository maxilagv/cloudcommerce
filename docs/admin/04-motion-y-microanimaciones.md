# 04 · Motion y microanimaciones

> Extiende `.claude/Skills/frontend/Microanimaciones.md`. Mismos principios (sutileza, rapidez,
> propósito, `prefers-reduced-motion`), mismos tokens de tiempo/easing — reutilizados tal cual, no
> reinventados — más los patrones que el admin necesita y el store no: login orquestado, transiciones
> de layout, entrada de datos en gráficos, feedback de guardado.

## 1. Tokens (idénticos a los del store, namespace admin)

```css
:root {
  --admin-ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --admin-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --admin-ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  --admin-duration-instant: 90ms;
  --admin-duration-fast: 140ms;
  --admin-duration-normal: 220ms;
  --admin-duration-slow: 360ms;
  --admin-duration-page: 420ms;   /* nuevo: transiciones de layout/página */
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

Regla de herramienta (ver [02-arquitectura-y-stack, ADR-A02](./02-arquitectura-y-stack.md)): CSS para
un elemento con un solo estado, `motion` para secuencias/orquestación entre varios elementos.

## 2. Login animado (la pantalla que más pediste)

Objetivo: la primera impresión del panel. Tiene que sentirse premium y **rápida** — no un video de 5
segundos que estorbe a alguien que loguea 10 veces por día. Toda la secuencia de entrada dura ≤900ms;
después queda estático hasta que el usuario interactúa.

### 2.1 Estructura visual

Split screen en desktop (≥1024px): panel izquierdo con el formulario, panel derecho con una escena de
marca animada. En mobile/tablet, solo el formulario con un fondo animado sutil detrás (el panel de
escena no cabe ni aporta).

```
┌──────────────────────┬───────────────────────────────┐
│                       │                                │
│   Logo CloudCommerce  │     Escena de marca animada    │
│   "Bienvenido de      │     (gradiente vivo + grid     │
│    nuevo"             │      de puntos + orbes         │
│                       │      flotantes en azul,        │
│   [ Email ]           │      muy sutil, en loop)        │
│   [ Password ]  👁    │                                │
│   [ ] Recordarme      │                                │
│   ¿Olvidaste tu       │                                │
│   contraseña?         │                                │
│                       │                                │
│   [  Ingresar  ]      │                                │
│                       │                                │
└──────────────────────┴───────────────────────────────┘
```

### 2.2 Secuencia de entrada (orquestada con `motion`, on mount)

| Paso | Elemento | Delay | Duración | Movimiento |
|---|---|---|---|---|
| 1 | Panel de escena (derecha) | 0ms | 500ms | fade + `scale(0.98→1)`, `ease-out` |
| 2 | Grid de puntos + orbes de fondo | 100ms | loop infinito | `cc-float-soft` adaptado (translateY ±8px, 4-6s, offsets distintos por orbe) |
| 3 | Logo | 80ms | 320ms | fade + `translateY(8px→0)` |
| 4 | Título "Bienvenido de nuevo" | 160ms | 320ms | fade + `translateY(8px→0)` |
| 5 | Campo email | 240ms | 280ms | fade + `translateY(6px→0)` |
| 6 | Campo password | 300ms | 280ms | fade + `translateY(6px→0)` |
| 7 | Checkbox + link "olvidé contraseña" | 360ms | 280ms | fade |
| 8 | Botón "Ingresar" | 420ms | 280ms | fade + `translateY(6px→0)` |

Con `motion`, esto es un `staggerChildren: 0.06` sobre un `variants` compartido — no 8 animaciones
manuales. El panel de escena entra en paralelo, no bloquea el formulario.

### 2.3 Estados de interacción post-carga

- **Focus de input**: mismo patrón que `search-command:focus-within` del store —
  `box-shadow: var(--admin-shadow-focus)`, borde pasa a `--admin-accent-border`, 140ms.
- **Submit**: el botón se transforma en estado de carga — el texto se desvanece, aparece un spinner de
  línea fina (no reemplaza el tamaño del botón, evita layout shift), `scale(0.985)` breve al click
  como feedback táctil.
- **Error de credenciales**: el formulario entero hace un `shake` sutil (`translateX` ±4px, 3
  oscilaciones, 260ms, `ease-in-out` — nunca `ease-spring`, un error no "rebota alegre") + el mensaje
  de error aparece con fade+slide desde arriba del botón, en `--admin-danger`.
- **Éxito**: no hay una animación de "check" grande — el formulario hace fade-out (200ms) mientras la
  siguiente pantalla (MFA o dashboard) ya está montándose debajo, para que la transición se sienta
  continua, no un salto de página en blanco.

### 2.4 Pantalla de MFA (si el usuario la tiene activada)

Aparece como continuación del mismo layout (el panel de escena no se re-anima, solo el panel
izquierdo cambia de contenido con un cross-fade de 220ms). Input de 6 dígitos con auto-advance entre
casillas y un borde que "viaja" al dígito activo (`translateX` sobre un indicador absoluto, 160ms).

## 3. Layout del dashboard

### 3.1 Sidebar colapsar/expandir

```css
.admin-shell {
  display: grid;
  grid-template-columns: var(--sidebar-w, 240px) 1fr;
  transition: grid-template-columns var(--admin-duration-page) var(--admin-ease-in-out);
}
```

Al colapsar (`--sidebar-w: 72px`), las etiquetas de texto de cada ítem hacen fade+width collapse
(`grid-template-columns: 0fr` sobre un wrapper, mismo patrón que el accordion de filtros del store en
`Microanimaciones.md` §8.2) — nunca `display:none` abrupto.

### 3.2 Transición entre secciones (rutas)

Cross-fade + `translateY(4px→0)` de 200ms en el contenido principal al cambiar de ruta (usar
`motion`'s `AnimatePresence` con `mode="wait"` solo si el salto visual entre secciones es grande —
p. ej. dashboard → configuración; entre pestañas de un mismo detalle, sin transición de página, solo
la del contenido interno).

## 4. Datos: KPIs, gráficos, tablas

### 4.1 Números que cuentan

Los KPIs grandes del dashboard (ventas del período, margen, pedidos) animan desde 0 (o desde el valor
anterior si ya había uno) hasta el valor real al cargar o refrescar, 600–800ms, `ease-out`, con
`tabular-nums` para que no salte el layout mientras cuenta. No usar en tablas (sería ruido), solo en
los 4-6 KPIs principales del overview.

### 4.2 Entrada de gráficos

- **Área/línea**: el trazo se dibuja de izquierda a derecha (`stroke-dashoffset` animado, 700ms,
  `ease-out`) en la primera carga; en refetch, solo cross-fade de los puntos (200ms) — redibujar todo
  el trazo en cada refresh de datos sería ruidoso.
- **Barras**: crecen desde `scaleY(0)` con origen abajo, stagger de 30ms entre barras, 360ms total.
- **Torta/dona** (ventas por categoría): cada segmento entra con `stroke-dasharray` animado en
  sentido horario, 500ms.
- Detalle completo de estilo de cada gráfico en [07-graficos-y-dataviz](./07-graficos-y-dataviz.md).

### 4.3 Tabla de datos

- Fila nueva (ej. pedido recién creado que aparece por realtime/refetch): entra con
  `background: var(--admin-accent-soft)` que se desvanece a transparente en 1200ms — el mismo
  lenguaje que "flash de actualización" en herramientas de trading, pero mucho más sutil.
- Orden/filtro aplicado: cross-fade de 140ms del cuerpo de la tabla, nunca un salto brusco.
- Fila expandible (detalle inline): `grid-template-rows: 0fr → 1fr`, mismo patrón que el accordion.

### 4.4 Skeleton de carga

Mismo shimmer que el store (`cc-shimmer`), adaptado a los tokens de superficie del admin — en dark
mode el gradiente del shimmer usa `--admin-bg-surface` → `--admin-bg-surface-soft` → `--admin-bg-surface`,
nunca un gris que no pertenezca a la paleta oscura.

```css
@keyframes admin-shimmer {
  0% { background-position: 120% 0; }
  100% { background-position: -120% 0; }
}
.admin-skeleton {
  background: linear-gradient(90deg, var(--admin-bg-surface-soft) 0%, var(--admin-bg-hover) 50%, var(--admin-bg-surface-soft) 100%);
  background-size: 220% 100%;
  animation: admin-shimmer 1.35s linear infinite;
}
```

## 5. Feedback de acciones

### 5.1 Guardar (formularios)

Botón de guardar: `Guardar` → estado de carga (spinner inline, mismo patrón que login) → `Guardado ✓`
con el check apareciendo en `ease-spring` (260ms) → vuelve a `Guardar` después de 1600ms. Sin toast
adicional para guardados de formulario completo (el botón ya es el feedback); el toast se reserva
para acciones que no tienen un botón visible en el momento (ej. una mutación disparada desde un menú
contextual).

### 5.2 Toasts

Mismo estilo que el store (`Microanimaciones.md` §13): entra desde abajo-derecha con
`translateY(8px)+fade`, 2400ms de vida salvo que sea un error (se queda hasta que el usuario lo
cierra). Iconografía: check verde (éxito), triángulo ámbar (advertencia), X roja (error), i azul
(info) — nunca el ícono decorativo, siempre el semántico de la acción.

### 5.3 Confirmación destructiva

Toda acción irreversible (eliminar producto, revocar sesión de otro admin, anular documento) usa un
`Dialog` (no un `confirm()` nativo) con el botón de confirmar en `--admin-danger` y un pequeño
`shake` si el usuario intenta cerrar con la acción a medio completar (poco frecuente, solo si hay un
submit en curso).

## 6. Presupuesto de movimiento

Igual que el store: no más de 3-5 animaciones infinitas simultáneas visibles (los orbes del login
cuentan como una sola "familia"). Pausar loops decorativos si el tab pierde foco
(`document.visibilityState`), relevante acá porque el admin queda abierto en una pestaña de fondo
durante horas.

## 7. Checklist

- ¿El login se siente premium pero no lento (≤900ms de secuencia)?
- ¿Cada animación de dato (KPI, gráfico, fila) comunica algo (nuevo valor, nuevo registro), no decora?
- ¿Los guardados dan feedback en el mismo lugar donde el usuario hizo la acción, sin forzarlo a mirar
  otra parte de la pantalla?
- ¿Las transiciones de layout (sidebar, rutas) son fluidas y no generan salto de contenido (CLS)?
- ¿Se respeta `prefers-reduced-motion` en absolutamente todo, incluyendo el login?
