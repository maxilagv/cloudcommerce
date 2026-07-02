---
name: cloudcommerce-tarjetas-producto
description: Skill para implementar tarjetas de producto premium del catálogo cloudcommerce.
version: 1.0.0
scope: product-card, ecommerce, catalog-grid, ui-components
---

# Skill — Tarjetas de producto cloudcommerce

## 1. Objetivo

Crear tarjetas de producto que reproduzcan la estética de la referencia: blancas, limpias, con imagen protagonista, badges sutiles, rating compacto, beneficios con iconos, precio fuerte, envío gratis y CTA azul.

La tarjeta debe ser comercialmente efectiva y visualmente premium. Cada card debe parecer un componente de producto real, no un bloque de información genérico.

## 2. Anatomía obligatoria

```txt
ProductCard
├─ TopBadges
│  ├─ stock / discount / nuevo
│  └─ favorite button
├─ ProductImageArea
│  ├─ image
│  └─ compare / quick action button
├─ ProductContent
│  ├─ brand
│  ├─ product name
│  ├─ rating
│  ├─ features list
│  ├─ price row
│  ├─ shipping row
│  └─ add-to-cart button
```

## 3. Dimensiones

```txt
card min-height: 420px
card radius: 18px
card padding: 14px
image area height: 176px–190px
content gap: 8px
button height: 36px
```

```css
.product-card {
  min-height: 420px;
  display: flex;
  flex-direction: column;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid var(--cc-border-default);
  background: #fff;
  box-shadow: var(--cc-shadow-xs);
  position: relative;
  overflow: hidden;
  transition:
    transform 220ms var(--cc-ease-out),
    box-shadow 220ms var(--cc-ease-out),
    border-color 220ms var(--cc-ease-out);
}
```

## 4. Hover premium

```css
.product-card:hover {
  transform: translateY(-3px);
  border-color: var(--cc-primary-border);
  box-shadow: 0 18px 44px rgba(16,24,40,.08), 0 8px 22px rgba(11,107,255,.06);
}

.product-card:hover .product-image {
  transform: translateY(-2px) scale(1.025);
}

.product-card:hover .quick-action {
  opacity: 1;
  transform: translateY(0) scale(1);
}
```

No elevar más de `3px`. La referencia es sutil, no exagerada.

## 5. Badges

### 5.1 Stock

```txt
En stock
```

```css
.badge-stock {
  height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: var(--cc-success-soft);
  color: var(--cc-success);
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
```

Incluir punto/círculo pequeño o check.

### 5.2 Descuento

```txt
-20%
```

```css
.badge-discount {
  background: var(--cc-primary);
  color: #fff;
  box-shadow: 0 8px 18px rgba(11,107,255,.22);
}
```

### 5.3 Nuevo

```txt
Nuevo
```

- Fondo azul suave.
- Texto azul.
- No usar rojo.

## 6. Botón favorito

Ubicado arriba a la derecha.

```css
.favorite-btn {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: transparent;
  display: grid;
  place-items: center;
  color: #1F2937;
}

.favorite-btn:hover {
  background: #F5F8FF;
  border-color: var(--cc-border-default);
  color: var(--cc-primary);
}
```

Al seleccionar:

- corazón azul o relleno suave,
- pequeño pop `scale(1.12)` durante 120ms.

## 7. Área de imagen

```css
.product-image-wrap {
  height: 184px;
  margin-top: 8px;
  display: grid;
  place-items: center;
  position: relative;
}

.product-image {
  max-width: 88%;
  max-height: 168px;
  object-fit: contain;
  transition: transform 260ms var(--cc-ease-out);
  filter: drop-shadow(0 14px 20px rgba(16,24,40,.12));
}
```

Reglas:

- No deformar imágenes.
- No llenar todo el card con la imagen.
- Mantener alineación vertical entre productos.
- Para productos muy altos, limitar altura.
- Para laptops/TVs, permitir ancho mayor.

## 8. Quick action / comparar

Botón flotante pequeño en la esquina inferior derecha del área de imagen.

```css
.quick-action {
  position: absolute;
  right: 4px;
  bottom: 8px;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: rgba(255,255,255,.88);
  border: 1px solid var(--cc-border-default);
  box-shadow: var(--cc-shadow-sm);
  color: var(--cc-primary);
  opacity: .92;
}
```

## 9. Marca y nombre

```css
.product-brand {
  font-size: 12px;
  line-height: 1.2;
  color: var(--cc-text-primary);
  font-weight: 700;
}

.product-name {
  margin-top: 2px;
  font-size: 13px;
  line-height: 1.28;
  color: var(--cc-text-primary);
  font-weight: 500;
  min-height: 34px;
}
```

Nombre máximo: dos líneas. Usar line clamp.

```css
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

## 10. Rating

```txt
★ 4.8 (320)
```

```css
.rating {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--cc-text-secondary);
}

.rating-star {
  color: var(--cc-star);
  font-size: 13px;
}
```

## 11. Lista de beneficios

Cada tarjeta debe mostrar 2–3 beneficios pequeños.

Ejemplos:

- Tecnología SpaceMax™
- Twin Cooling Plus™
- Ahorro de energía
- Chip Apple M2
- Hasta 18h de batería
- Inteligencia Artificial AI DD™
- Cámara Leica 50MP
- Carga rápida 90W

```css
.product-features {
  display: grid;
  gap: 4px;
  margin-top: 6px;
}

.product-feature {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: var(--cc-text-secondary);
}
```

Iconos de beneficios: `12px–13px`, gris/azul desaturado.

## 12. Precio

```css
.product-price-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: auto;
  padding-top: 10px;
}

.product-price {
  font-size: 19px;
  line-height: 1.1;
  font-weight: 800;
  color: var(--cc-text-primary);
  letter-spacing: -0.025em;
}

.product-old-price {
  font-size: 12px;
  color: var(--cc-text-faint);
  text-decoration: line-through;
}
```

El precio debe ser uno de los puntos de mayor contraste después de la imagen.

## 13. Envío gratis

```css
.shipping-free {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 650;
  color: var(--cc-success);
}
```

## 14. CTA agregar al carrito

```css
.add-to-cart {
  height: 36px;
  margin-top: 10px;
  border: none;
  border-radius: 11px;
  background: linear-gradient(180deg, #1374FF 0%, #005FEF 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  box-shadow: 0 10px 22px rgba(11,107,255,.24);
  transition:
    transform 160ms var(--cc-ease-out),
    box-shadow 160ms var(--cc-ease-out),
    filter 160ms var(--cc-ease-out);
}

.add-to-cart:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
  box-shadow: 0 14px 28px rgba(11,107,255,.32);
}

.add-to-cart:active {
  transform: translateY(0) scale(.99);
}
```

## 15. Datos mínimos del producto

```ts
export type ProductCardData = {
  id: string;
  brand: string;
  name: string;
  sku?: string;
  image: string;
  imageAlt: string;
  badge?: {
    type: 'stock' | 'discount' | 'new' | 'soon';
    label: string;
  };
  rating: number;
  reviewCount: number;
  features: string[];
  price: number;
  oldPrice?: number;
  shipping?: 'free' | 'paid' | 'pickup';
  stockStatus: 'in-stock' | 'soon' | 'out-of-stock';
  isFavorite?: boolean;
};
```

## 16. Contenido de referencia para la primera fila

1. Samsung — Nevera Side by Side 655L — `RS67A8811B1/CO` — $ 5.299.900.
2. Apple — MacBook Air M2 13” — `8GB – 256GB SSD` — $ 5.499.900.
3. LG — Lavadora Carga Frontal 22kg — `AI DD™ – FV22WV2S6S` — $ 2.899.900.
4. Xiaomi — Xiaomi 14 Ultra 5G — `16GB – 512GB` — $ 4.499.900.

## 17. Skeleton loading

Mientras cargan productos:

- card con mismo tamaño,
- imagen placeholder suave,
- líneas skeleton para nombre/precio,
- shimmer horizontal muy sutil.

```css
.skeleton {
  background: linear-gradient(90deg, #F2F5FA 0%, #F8FAFD 50%, #F2F5FA 100%);
  background-size: 220% 100%;
  animation: cc-shimmer 1.4s infinite linear;
}
```

## 18. Estado sin resultados

Mantener estética premium:

- ilustración suave,
- título: `No encontramos productos`,
- texto: `Probá ajustar los filtros o buscar otra categoría.`,
- botón: `Limpiar filtros`.

## 19. Checklist

- ¿La imagen es protagonista?
- ¿El precio se lee inmediatamente?
- ¿El CTA azul está alineado abajo?
- ¿Los badges son sutiles y consistentes?
- ¿El hover eleva sin exagerar?
- ¿Las tarjetas de una fila tienen altura consistente?
- ¿El texto no se desborda?
- ¿El botón favorito no compite con el CTA?
- ¿La card parece premium, no una ficha genérica?
