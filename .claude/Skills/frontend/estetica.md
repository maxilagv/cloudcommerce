---
name: cloudcommerce-estetica-visual
description: Skill de estética visual para reproducir la apariencia blanca, premium y tecnológica del catálogo cloudcommerce.
version: 1.0.0
scope: design-tokens, visual-system, frontend-style
---

# Skill — Estética visual cloudcommerce

## 1. Objetivo

Definir el sistema visual que debe gobernar todos los componentes del catálogo. Esta skill evita que el frontend se vuelva inconsistente. Cada componente debe parecer parte de una misma plataforma premium: blanco dominante, azul nítido, bordes suaves, sombras delicadas, tipografía limpia y detalles refinados.

## 2. Personalidad visual

La interfaz debe comunicar:

- tecnología confiable,
- compra segura,
- catálogo premium,
- claridad extrema,
- ligereza,
- sofisticación,
- movimiento sutil,
- alto nivel de detalle.

No debe comunicar:

- marketplace barato,
- plantilla genérica,
- diseño corporativo pesado,
- dashboard oscuro,
- exceso de color,
- saturación visual,
- sombras duras,
- botones enormes sin refinamiento.

## 3. Paleta de color

### 3.1 Colores base

```css
:root {
  --cc-bg-page: #F6F8FB;
  --cc-bg-shell: #FFFFFF;
  --cc-bg-surface: #FFFFFF;
  --cc-bg-surface-soft: #F8FAFD;
  --cc-bg-surface-blue: #F3F8FF;
  --cc-bg-hover: #F6F9FF;

  --cc-border-subtle: #EEF2F7;
  --cc-border-default: #E5EAF2;
  --cc-border-strong: #D7DFEA;

  --cc-text-primary: #101828;
  --cc-text-secondary: #475467;
  --cc-text-muted: #7B8798;
  --cc-text-faint: #98A2B3;

  --cc-primary: #0B6BFF;
  --cc-primary-hover: #005BE8;
  --cc-primary-active: #004ECC;
  --cc-primary-soft: #EAF3FF;
  --cc-primary-softer: #F4F8FF;
  --cc-primary-border: #BBD7FF;

  --cc-success: #16A34A;
  --cc-success-soft: #EAFBF0;
  --cc-warning: #F59E0B;
  --cc-warning-soft: #FFF7E6;
  --cc-danger: #EF4444;
  --cc-danger-soft: #FEF2F2;

  --cc-star: #FFB020;
}
```

### 3.2 Regla de proporción cromática

Usar la regla 80/15/5:

- 80% blanco y grises muy claros.
- 15% azul suave o superficies celestes.
- 5% acentos intensos: CTA azul, badges, rating, stock, descuentos.

Si el azul ocupa demasiado espacio, la interfaz se vuelve menos premium. El azul debe guiar la atención, no dominarla.

### 3.3 Uso correcto del azul

Usar azul intenso para:

- botón `Agregar al carrito`,
- link activo de navegación,
- chip seleccionado,
- slider de precio,
- puntos de carousel,
- badges numéricos,
- iconos de beneficios,
- foco visual.

Usar azul suave para:

- fondos de chips activos,
- hover de filas,
- panel cloudplus,
- hero gradient,
- tarjetas de información secundaria.

No usar azul intenso como fondo de todas las tarjetas.

## 4. Tipografía

### 4.1 Familia

Preferir una fuente moderna de UI:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Alternativas válidas: `Geist`, `SF Pro`, `Plus Jakarta Sans`, `Manrope`. No mezclar más de una familia principal.

### 4.2 Escala tipográfica

```css
--cc-font-xs: 11px;
--cc-font-sm: 12px;
--cc-font-md: 13px;
--cc-font-base: 14px;
--cc-font-lg: 16px;
--cc-font-xl: 20px;
--cc-font-2xl: 24px;
--cc-font-hero: 30px;

--cc-leading-tight: 1.15;
--cc-leading-normal: 1.35;
--cc-leading-relaxed: 1.55;
```

### 4.3 Pesos

- Logo: `700`.
- Navegación activa: `650`.
- Hero headline: `760–800`.
- Títulos de sección: `650–700`.
- Nombre de producto: `580–650`.
- Precio: `760–800`.
- Texto normal: `400–500`.

### 4.4 Letter spacing

- Títulos grandes: `-0.035em`.
- Precios: `-0.025em`.
- Navegación y etiquetas: `-0.01em`.

La referencia visual tiene una sensación compacta y precisa. Evitar textos demasiado espaciados.

## 5. Radios

```css
--cc-radius-xs: 8px;
--cc-radius-sm: 10px;
--cc-radius-md: 14px;
--cc-radius-lg: 18px;
--cc-radius-xl: 22px;
--cc-radius-2xl: 28px;
--cc-radius-pill: 999px;
```

Uso:

- Inputs: `12px–14px`.
- Chips: `14px–16px` o pill.
- Product card: `18px`.
- Hero: `22px–26px`.
- Shell: `20px`.
- Botón principal: `11px–13px`.
- FAB: `999px`.

## 6. Sombras

Las sombras son una de las claves para que la UI se vea premium.

```css
--cc-shadow-xs: 0 1px 2px rgba(16, 24, 40, 0.05);
--cc-shadow-sm: 0 8px 22px rgba(16, 24, 40, 0.05);
--cc-shadow-md: 0 14px 42px rgba(16, 24, 40, 0.075);
--cc-shadow-lg: 0 24px 70px rgba(11, 107, 255, 0.10), 0 8px 24px rgba(16, 24, 40, 0.06);
--cc-shadow-focus: 0 0 0 4px rgba(11, 107, 255, 0.12);
```

Regla: si se nota demasiado la sombra, está mal. Debe sentirse como profundidad ambiental, no como sombra de tarjeta antigua.

## 7. Bordes

```css
border: 1px solid var(--cc-border-default);
```

Estados:

- default: `#E5EAF2`.
- hover: `#CFE0FF`.
- active/selected: `#0B6BFF` o `#BBD7FF` según importancia.

No usar bordes negros ni grises muy oscuros.

## 8. Spacing

Base `4px`, pero la UI trabaja con múltiplos suaves:

```txt
4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40
```

Aplicación:

- Padding card pequeña: `14px–16px`.
- Padding card grande: `18px–24px`.
- Gaps internos: `8px–12px`.
- Gaps entre cards: `16px–20px`.
- Padding shell: `22px`.

## 9. Superficies

### 9.1 Card normal

```css
.cc-card {
  background: #fff;
  border: 1px solid var(--cc-border-default);
  border-radius: var(--cc-radius-lg);
  box-shadow: var(--cc-shadow-xs);
}
```

### 9.2 Card elevada / hover

```css
.cc-card:hover {
  border-color: var(--cc-primary-border);
  box-shadow: var(--cc-shadow-md);
  transform: translateY(-2px);
}
```

### 9.3 Glass panel sutil

Usar solo en hero, trust bar, panel cloudplus o badges flotantes.

```css
.cc-glass {
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(220, 230, 245, 0.75);
  backdrop-filter: blur(18px);
  box-shadow: 0 12px 36px rgba(16, 24, 40, 0.06);
}
```

## 10. Iconografía

- Estilo lineal, grosor `1.75px–2px`.
- Esquinas redondeadas.
- Tamaños comunes: `16px`, `18px`, `20px`, `22px`.
- Iconos dentro de chips: `22px` con contenedor `36px`.
- Iconos de header: `22px–24px`.
- Iconos dentro del sidebar: `16px`.

Recomendación: `lucide-react` o un set lineal equivalente.

## 11. Imágenes de producto

- Fondo de producto transparente o blanco.
- Producto centrado.
- Sombras propias suaves, no sombras CSS agresivas.
- `object-fit: contain`.
- Altura visual constante entre tarjetas.
- Dejar aire alrededor del producto.
- Electrodomésticos negros/grises funcionan muy bien contra blanco.

## 12. Jerarquía visual obligatoria

Orden de atención:

1. Hero headline.
2. CTA del hero.
3. Producto destacado visual del hero.
4. Chips de categorías.
5. Producto/imagen en tarjeta.
6. Precio.
7. CTA `Agregar al carrito`.
8. Filtros.
9. Trust bar.

Si el sidebar compite más que el hero, reducir contraste de filtros.

## 13. Detalles estéticos pequeños

Incluir de forma moderada:

- puntos verdes de stock,
- badges azules de descuento,
- dots de carousel,
- chips con conteos,
- iconos de acciones rápidas,
- badge numérico en favoritos/carrito,
- micro-glow en botón primario,
- mini divisores internos,
- tooltip ligero en controles,
- barra inferior con beneficios,
- botón flotante IA con sparkle.

Estos detalles deben sentirse intencionales, no decorativos sin función.

## 14. Anti-patrones

Evitar:

- fondos `#F0F0F0` planos y fríos,
- tarjetas con `box-shadow: 0 4px 8px rgba(0,0,0,.25)`,
- bordes muy oscuros,
- cards cuadradas,
- tipografía gigante en todo,
- CTA de múltiples colores,
- gradientes fuertes tipo neón,
- iconos rellenos sin consistencia,
- imágenes desalineadas,
- exceso de texto en la tarjeta,
- sidebar demasiado ancho,
- grid de 3 columnas en desktop amplio.

## 15. Checklist estética

Antes de finalizar una pantalla:

- ¿El blanco domina la interfaz?
- ¿El azul aparece donde guía una acción?
- ¿Las tarjetas tienen radio grande y sombra casi invisible?
- ¿Los textos secundarios son grises, no negros?
- ¿Los precios tienen peso y contraste?
- ¿Las imágenes están centradas y limpias?
- ¿Los badges se ven como parte del sistema?
- ¿El layout respira sin perder densidad?
- ¿La pantalla se ve como producto premium, no como plantilla?
