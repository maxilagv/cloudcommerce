---
name: cloudcommerce-seo-producto-skill
description: Skill integral para implementar SEO técnico, SEO de catálogo y SEO de producto en cloudcommerce desde el frontend, con foco en e-commerce, datos estructurados, indexabilidad, rendimiento, Argentina y escalabilidad.
version: 1.0.0
scope: seo, ecommerce, producto, catalogo, frontend, nextjs, react, structured-data, argentina
preferred_stack: Next.js App Router, React, TypeScript, Tailwind CSS, Server Components, JSON-LD
owner_goal: Maximizar probabilidad de posicionamiento orgánico competitivo en Argentina sin comprometer calidad, performance ni experiencia de usuario.
---

# Skill SEO — cloudcommerce

## 0. Principio rector

Esta skill define cómo debe construirse el SEO de **cloudcommerce** desde el código, no como una capa decorativa posterior. El objetivo es que cada página importante del e-commerce nazca con estructura semántica, contenido rastreable, datos estructurados válidos, rendimiento alto, URLs limpias, enlaces internos estratégicos y señales comerciales coherentes.

La meta comercial es competir por posiciones máximas en Argentina para búsquedas transaccionales y comparativas de electrónica y electrodomésticos. La meta técnica es que Google pueda descubrir, rastrear, renderizar, entender, indexar y presentar cada producto y categoría de forma impecable.

No se debe prometer ranking número uno automático. La implementación debe maximizar probabilidad, velocidad de aprendizaje y escalabilidad SEO. El ranking final depende de competencia, autoridad, demanda, contenido, enlaces, marca, satisfacción del usuario, inventario, precio, disponibilidad, reputación, datos comerciales y señales externas. Esta skill busca que el frontend no sea el límite.

## 1. Misión

Implementar una arquitectura SEO de clase enterprise para el catálogo y las fichas de producto de cloudcommerce, orientada a:

1. Posicionar productos, categorías, marcas, comparativas y guías de compra en Argentina.
2. Hacer que Google entienda con precisión qué se vende, a qué precio, con qué disponibilidad, en qué moneda, con qué envío, con qué garantía y bajo qué política comercial.
3. Convertir la UI premium de cloudcommerce en HTML semántico, rápido y accesible, sin depender de contenido invisible o renderizado tardío.
4. Evitar problemas típicos de e-commerce: duplicados por filtros, parámetros infinitos, variantes mal canonicalizadas, productos no enlazados, JavaScript no rastreable, paginación rota, fichas sin contenido único y datos estructurados inconsistentes.
5. Crear una base que permita escalar a miles o millones de productos sin perder control de indexación, performance ni calidad.

## 2. Resultado esperado

Al terminar la implementación, cloudcommerce debe tener:

- Home indexable y orientada a marca + categorías principales.
- Catálogo indexable cuando representa una landing real.
- Categorías y subcategorías con contenido único, enlaces internos y productos rastreables.
- Páginas de producto con metadata dinámica, JSON-LD completo, descripción visible, especificaciones, beneficios, reviews, preguntas, envío, garantías y productos relacionados.
- Filtros visuales potentes, pero controlados SEO-wise para no crear miles de URLs basura.
- Sitemap dinámico con productos, categorías, marcas y guías.
- Robots y meta robots controlados por tipo de ruta.
- Canonicals absolutos correctos.
- Open Graph y Twitter cards útiles para compartir productos.
- Core Web Vitals dentro de umbrales sanos.
- Merchant Center preparado para feeds de producto.
- Search Console medible desde el primer release.
- QA automatizado para evitar que un cambio rompa indexación o structured data.

## 3. Reglas no negociables

1. El contenido principal de producto y categoría debe existir en HTML inicial. No debe depender exclusivamente de `useEffect`, llamadas client-side o botones que Google no ejecuta.
2. Todo producto indexable debe tener URL única, estable y descriptiva.
3. Todo producto indexable debe tener canonical absoluto hacia sí mismo o hacia su variante canónica.
4. El JSON-LD debe coincidir con el contenido visible. Nunca marcar precio, stock, rating, reviews, envío o descuentos que el usuario no pueda ver.
5. Nunca inventar reviews, ratings, precios, GTIN, SKU, stock ni disponibilidad.
6. Nunca crear páginas masivas con texto de IA sin valor diferencial, sin datos reales o sin utilidad para el comprador.
7. Las rutas de carrito, checkout, cuenta, portal de clientes, favoritos, historial, remitos y direcciones deben ser `noindex`.
8. Los filtros arbitrarios deben ser noindex/canonicalizados salvo que se conviertan en landings curadas.
9. Las imágenes deben tener `width`, `height`, `alt` útil y espacio reservado para evitar CLS.
10. Los enlaces internos relevantes deben ser `<a href="...">`, no `div onClick` ni navegación inaccesible.
11. Los botones de “ver más”, infinite scroll o carga incremental no pueden esconder productos importantes sin URLs rastreables.
12. El diseño premium no debe sacrificar rendimiento. Microanimaciones sí; bloqueo de main thread, no.
13. SEO no debe romper UX: el usuario debe encontrar, comparar y comprar mejor gracias a la estructura SEO.

## 4. Arquitectura indexable de cloudcommerce

### 4.1 Mapa de rutas recomendado

```txt
/
/catalogo
/categoria/[categoria]
/categoria/[categoria]/[subcategoria]
/categoria/[categoria]/[subcategoria]/[atributo-curado]
/marca/[marca]
/marca/[marca]/[categoria]
/producto/[slug-producto]
/ofertas
/ofertas/[categoria]
/guias/[slug-guia]
/comparativas/[slug-comparativa]
/buscar?q=[query]
/cuenta
/carrito
/checkout
/portal-cliente
```

### 4.2 Matriz de indexación

| Tipo de página | Ejemplo | Indexación | Canonical | Objetivo SEO |
|---|---|---:|---|---|
| Home | `/` | `index,follow` | propia | Marca + categorías principales |
| Catálogo general | `/catalogo` | `index,follow` si tiene contenido útil | propia | Entrada general al inventario |
| Categoría | `/categoria/electrodomesticos` | `index,follow` | propia | Ranking por categoría amplia |
| Subcategoría | `/categoria/electrodomesticos/heladeras` | `index,follow` | propia | Ranking transaccional |
| Landing curada | `/categoria/electrodomesticos/heladeras-samsung` | `index,follow` solo si tiene demanda y contenido único | propia | Long-tail comercial |
| Marca | `/marca/samsung` | `index,follow` | propia | Marca + catálogo propio |
| Marca + categoría | `/marca/samsung/heladeras` | `index,follow` si es landing curada | propia | Intención específica |
| Producto | `/producto/samsung-family-hub-4-puertas-636l-rf63a977fsg-co` | `index,follow` | propia o variante padre | Venta directa |
| Ofertas | `/ofertas` | `index,follow` si estable | propia | Intención promocional |
| Guía | `/guias/como-elegir-heladera` | `index,follow` | propia | Información + asistencia a compra |
| Comparativa | `/comparativas/heladera-side-by-side-vs-no-frost` | `index,follow` | propia | Investigación comercial |
| Buscador interno | `/buscar?q=heladera` | `noindex,follow` | `/buscar` o ninguna según estrategia | UX, no landing SEO |
| Filtros arbitrarios | `?brand=lg&sort=price_desc` | normalmente `noindex,follow` | categoría base o URL curada | Evitar duplicados |
| Ordenamiento | `?sort=price_asc` | `noindex,follow` | categoría base | Evitar duplicados |
| Paginación | `?page=2` | `index,follow` si lista real | propia | Rastreabilidad de productos |
| Carrito | `/carrito` | `noindex,nofollow` | propia | Privado/transaccional |
| Checkout | `/checkout` | `noindex,nofollow` | propia | Privado/transaccional |
| Cuenta/portal | `/cuenta`, `/portal-cliente` | `noindex,nofollow` | propia | Privado |
| Documentos/remitos | `/portal-cliente/remitos/...` | `noindex,nofollow` | propia | Privado/legal |

## 5. Taxonomía SEO del e-commerce

La taxonomía debe coincidir con cómo compran las personas, no solo con cómo está organizada la base de datos.

### 5.1 Jerarquía base

```txt
Electrodomésticos
├─ Refrigeración
│  ├─ Heladeras
│  ├─ Freezers
│  └─ Cavas
├─ Lavado
│  ├─ Lavarropas
│  ├─ Lavasecarropas
│  └─ Secarropas
├─ Cocina
│  ├─ Hornos
│  ├─ Anafes
│  ├─ Microondas
│  └─ Campanas
└─ Climatización
   ├─ Aires acondicionados
   ├─ Calefactores
   └─ Ventiladores

Electrónica
├─ Televisores
├─ Audio
├─ Celulares
├─ Computadoras
└─ Gaming
```

### 5.2 Atributos SEO prioritarios por categoría

| Categoría | Atributos SEO visibles | Ejemplos de intención |
|---|---|---|
| Heladeras | marca, tipo, litros, eficiencia, color, alto/ancho, freezer, dispenser | “heladera side by side samsung 636 litros” |
| Lavarropas | kg, carga frontal/superior, inverter, rpm, eficiencia, vapor | “lavarropas carga frontal 22kg inverter” |
| TVs | pulgadas, resolución, panel, Hz, smart OS, HDMI, gaming | “smart tv 55 4k qled argentina” |
| Aires | frigorías, inverter, frío/calor, eficiencia, instalación | “aire acondicionado inverter 3000 frigorías” |
| Notebooks | procesador, RAM, SSD, pantalla, placa gráfica, uso | “notebook i5 16gb 512ssd” |
| Celulares | memoria, cámara, batería, 5G, chip, pantalla | “celular 5g 256gb cámara 50mp” |

### 5.3 Página indexable mínima

Una categoría o landing curada solo debe ser indexable si tiene:

- H1 único.
- Descripción introductoria útil.
- Productos visibles y disponibles o explicación si no hay stock.
- Enlaces a subcategorías, marcas y guías relevantes.
- Breadcrumb.
- Metadata única.
- Canonical propia.
- No estar compuesta solo por parámetros arbitrarios.

## 6. Estructura de URLs

### 6.1 Reglas de slug

- Usar minúsculas.
- Usar guiones medios.
- Eliminar tildes en URL, mantener tildes en contenido visible.
- Evitar IDs solos.
- Incluir marca + modelo + atributo diferenciador cuando aplique.
- Mantener estabilidad: si cambia el título comercial, no cambiar el slug salvo necesidad fuerte.
- Si cambia el slug, crear redirect 301 desde el slug anterior.

### 6.2 Patrones recomendados

```txt
/producto/[marca]-[linea-o-modelo]-[atributo-principal]-[sku]
/producto/samsung-family-hub-4-puertas-636l-rf63a977fsg-co
/producto/lg-lavadora-carga-frontal-22kg-ai-dd-fv22wv2s6s
/producto/xiaomi-14-ultra-5g-16gb-512gb

/categoria/electrodomesticos/refrigeracion/heladeras
/categoria/electrodomesticos/lavado/lavarropas
/marca/samsung
/marca/lg/lavarropas
/guias/como-elegir-una-heladera-side-by-side
/comparativas/heladera-side-by-side-vs-no-frost
```

### 6.3 Parámetros permitidos

Los parámetros deben usar `key=value` y tener orden estable.

```txt
Correcto:
/categoria/electrodomesticos/heladeras?page=2
/categoria/electrodomesticos/heladeras?brand=samsung
/categoria/electrodomesticos/heladeras?brand=samsung&color=acero-negro

Incorrecto:
/categoria/electrodomesticos/heladeras?2
/categoria/electrodomesticos/heladeras?samsung
/categoria/electrodomesticos/heladeras?brand=samsung&brand=lg
/categoria/electrodomesticos/heladeras?session=abc123
```

### 6.4 Variantes de producto

Si una variante tiene búsqueda, precio, stock, imágenes o especificaciones relevantes, puede tener URL propia.

```txt
/producto/samsung-family-hub-636l-acero-negro-rf63a977fsg-co
/producto/samsung-family-hub-716l-acero-inoxidable-rf71a977fsg-co
```

Si la variante es solo color menor sin demanda ni contenido diferencial, se mantiene como selector dentro de una página padre y se evita indexar variantes pobres.

## 7. Metadata obligatoria

### 7.1 Principios

La metadata debe ser generada desde datos reales del producto/categoría. No usar textos genéricos repetidos.

Cada página indexable debe tener:

- `<title>` único.
- `meta description` única.
- canonical absoluto.
- Open Graph básico.
- Twitter card.
- locale `es_AR` cuando aplique.
- metadata de robots según matriz de indexación.

### 7.2 Plantillas de title

| Página | Plantilla |
|---|---|
| Home | `cloudcommerce | Tecnología, electrodomésticos y electrónica en Argentina` |
| Catálogo | `Catálogo de tecnología y electrodomésticos | cloudcommerce` |
| Categoría | `{Categoría}: comprar online en Argentina | cloudcommerce` |
| Subcategoría | `{Subcategoría} {atributo opcional}: precios, cuotas y envío | cloudcommerce` |
| Marca | `{Marca}: productos oficiales, precios y ofertas | cloudcommerce` |
| Producto | `{Marca} {Modelo} {Atributo clave} | Precio y envío en Argentina` |
| Oferta | `Ofertas en {categoría}: descuentos, cuotas y envío | cloudcommerce` |
| Guía | `{Tema}: guía para elegir mejor | cloudcommerce` |
| Comparativa | `{Producto A} vs {Producto B}: diferencias y cuál comprar` |

### 7.3 Plantillas de meta description

Producto:

```txt
Comprá {marca} {modelo} en cloudcommerce. {beneficio principal}, {especificación clave}, precio en ARS, cuotas, stock actualizado y envío a Argentina.
```

Categoría:

```txt
Encontrá {categoría} en cloudcommerce: compará marcas, precios, cuotas, stock, envío rápido y especificaciones para elegir mejor.
```

Guía:

```txt
Aprendé cómo elegir {tema}: medidas, consumo, funciones, marcas recomendadas y errores comunes antes de comprar.
```

### 7.4 Reglas para title y description

- El title debe comenzar con la entidad más importante: producto, categoría o marca.
- Evitar repetir “comprar online barato oferta descuento” en todas las páginas.
- La description debe vender el clic, pero reflejar la página real.
- Incluir Argentina, ARS, envío, cuotas o stock solo cuando se muestren en la página.
- No escribir descriptions idénticas para productos similares.
- No ocultar información esencial en imágenes.

## 8. Head técnico obligatorio

Ejemplo conceptual de head para producto:

```html
<title>Samsung Family Hub 4 Puertas 636L | Precio y envío en Argentina</title>
<meta name="description" content="Comprá Samsung Family Hub 4 Puertas 636L en cloudcommerce. Heladera inteligente con pantalla táctil, Wi-Fi, cámaras internas, cuotas, stock y envío rápido." />
<link rel="canonical" href="https://www.cloudcommerce.com.ar/producto/samsung-family-hub-4-puertas-636l-rf63a977fsg-co" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<meta property="og:type" content="product" />
<meta property="og:locale" content="es_AR" />
<meta property="og:site_name" content="cloudcommerce" />
<meta property="og:title" content="Samsung Family Hub 4 Puertas 636L" />
<meta property="og:description" content="Heladera inteligente Samsung 636L con envío rápido, cuotas y garantía oficial." />
<meta property="og:image" content="https://www.cloudcommerce.com.ar/images/products/samsung-family-hub-636l.jpg" />
<meta property="og:url" content="https://www.cloudcommerce.com.ar/producto/samsung-family-hub-4-puertas-636l-rf63a977fsg-co" />
<meta name="twitter:card" content="summary_large_image" />
```

## 9. HTML semántico de catálogo

La estética de la imagen debe conservarse, pero el HTML debe ser rastreable.

### 9.1 Estructura semántica mínima

```tsx
<main id="catalogo" aria-labelledby="catalog-title">
  <aside aria-label="Filtros de productos">
    <form>
      {/* filtros */}
    </form>
  </aside>

  <section aria-labelledby="catalog-title">
    <header>
      <h1 id="catalog-title">Electrodomésticos y tecnología en cloudcommerce</h1>
      <p>Compará productos, precios, cuotas, stock y envío en Argentina.</p>
    </header>

    <nav aria-label="Categorías destacadas">
      <a href="/categoria/electronica">Electrónica</a>
      <a href="/categoria/electrodomesticos">Electrodomésticos</a>
    </nav>

    <section aria-label="Listado de productos">
      <article>
        <a href="/producto/samsung-family-hub-4-puertas-636l-rf63a977fsg-co">
          <img src="..." alt="Heladera Samsung Family Hub 4 Puertas 636 litros acero negro" />
          <h2>Samsung Family Hub 4 Puertas 636L</h2>
        </a>
        <p>$ 7.299.900</p>
      </article>
    </section>
  </section>
</main>
```

### 9.2 Reglas para tarjetas de producto

Cada tarjeta debe contener:

- Enlace `<a href>` al producto.
- Imagen con alt descriptivo.
- Marca.
- Nombre/modelo.
- Rating visible si existe.
- Precio actual visible.
- Precio anterior visible si se marca descuento.
- Estado de stock.
- Beneficios breves.
- CTA accesible.

No envolver toda la tarjeta en un botón. El enlace principal debe ser el nombre o la imagen. Botones como favorito/comparar deben tener `aria-label`.

## 10. HTML semántico de producto

### 10.1 Estructura mínima

```tsx
<main id="producto" itemScope itemType="https://schema.org/Product">
  <nav aria-label="Breadcrumb">
    <ol>
      <li><a href="/">Inicio</a></li>
      <li><a href="/categoria/electrodomesticos">Electrodomésticos</a></li>
      <li><a href="/categoria/electrodomesticos/refrigeracion">Refrigeración</a></li>
      <li aria-current="page">Samsung Family Hub 4 Puertas 636L</li>
    </ol>
  </nav>

  <section aria-labelledby="product-title">
    <h1 id="product-title">Samsung Family Hub™ 4 Puertas 636L</h1>
    <p>Refrigerador inteligente con pantalla táctil, conectividad Wi‑Fi, cámaras internas y espacio flexible.</p>
  </section>

  <section aria-label="Galería de producto">
    {/* imágenes */}
  </section>

  <section aria-label="Compra">
    {/* precio, stock, variantes, CTA */}
  </section>

  <section aria-labelledby="descripcion-title">
    <h2 id="descripcion-title">Descripción</h2>
  </section>

  <section aria-labelledby="especificaciones-title">
    <h2 id="especificaciones-title">Especificaciones</h2>
  </section>

  <section aria-labelledby="opiniones-title">
    <h2 id="opiniones-title">Opiniones</h2>
  </section>
</main>
```

### 10.2 H1/H2/H3

- Un solo H1 por página.
- El H1 de producto debe contener marca + modelo + atributo diferenciador.
- H2 recomendados: Descripción, Especificaciones, Beneficios, Envío y devoluciones, Opiniones, Preguntas frecuentes, Productos relacionados.
- H3 para grupos internos: Capacidad, Dimensiones, Consumo, Conectividad, Garantía.

## 11. Datos estructurados JSON-LD

### 11.1 Principios de JSON-LD

- Insertar JSON-LD en el HTML del servidor.
- Usar `application/ld+json`.
- Escapar caracteres peligrosos.
- Usar URLs absolutas.
- Usar `@id` estable para entidades principales.
- Usar `inLanguage: "es-AR"` cuando corresponda.
- El contenido estructurado debe coincidir con el contenido visible.
- Validar con Rich Results Test y Schema Markup Validator antes de producción.

### 11.2 Grafo recomendado por página

Home:

```txt
Organization / OnlineStore
WebSite + SearchAction
BreadcrumbList opcional
ItemList de categorías principales opcional
```

Categoría:

```txt
CollectionPage
BreadcrumbList
ItemList de productos visibles
Organization / WebSite referenciado por @id
```

Producto:

```txt
Product
Offer
AggregateRating si hay reviews reales
Review si hay reviews reales visibles
BreadcrumbList
Organization / OnlineStore
```

Guía:

```txt
Article o BlogPosting
BreadcrumbList
Product referencias si se recomiendan productos concretos
```

Comparativa:

```txt
Article
ItemList de productos comparados
Product para entidades principales si corresponde
```

## 12. JSON-LD de producto completo

Este ejemplo usa una heladera. Debe adaptarse a cada producto desde datos reales.

```tsx
export function buildProductJsonLd(product: ProductSEO) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${product.url}#product`,
    name: product.name,
    description: product.description,
    image: product.images,
    url: product.url,
    sku: product.sku,
    mpn: product.mpn,
    gtin13: product.gtin13,
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    category: product.categoryPath.join(' > '),
    color: product.color,
    model: product.model,
    width: product.dimensions?.width
      ? {
          '@type': 'QuantitativeValue',
          value: product.dimensions.width.value,
          unitCode: product.dimensions.width.unitCode,
        }
      : undefined,
    height: product.dimensions?.height
      ? {
          '@type': 'QuantitativeValue',
          value: product.dimensions.height.value,
          unitCode: product.dimensions.height.unitCode,
        }
      : undefined,
    depth: product.dimensions?.depth
      ? {
          '@type': 'QuantitativeValue',
          value: product.dimensions.depth.value,
          unitCode: product.dimensions.depth.unitCode,
        }
      : undefined,
    weight: product.weight
      ? {
          '@type': 'QuantitativeValue',
          value: product.weight.value,
          unitCode: product.weight.unitCode,
        }
      : undefined,
    additionalProperty: [
      { '@type': 'PropertyValue', name: 'Capacidad', value: '636 L' },
      { '@type': 'PropertyValue', name: 'Tecnología de enfriamiento', value: 'Twin Cooling Plus' },
      { '@type': 'PropertyValue', name: 'Conectividad', value: 'Wi‑Fi / SmartThings' },
      { '@type': 'PropertyValue', name: 'Consumo energético', value: '38.5 kWh/mes' },
      { '@type': 'PropertyValue', name: 'Nivel de ruido', value: '38 dBA' },
    ],
    aggregateRating: product.rating
      ? {
          '@type': 'AggregateRating',
          ratingValue: product.rating.value,
          reviewCount: product.rating.count,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined,
    review: product.reviews?.map((review) => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: review.authorName,
      },
      datePublished: review.datePublished,
      reviewBody: review.body,
      name: review.title,
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
    })),
    offers: {
      '@type': 'Offer',
      '@id': `${product.url}#offer`,
      url: product.url,
      priceCurrency: 'ARS',
      price: product.price.current,
      priceValidUntil: product.priceValidUntil,
      availability: product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'cloudcommerce',
      },
      hasMerchantReturnPolicy: {
        '@type': 'MerchantReturnPolicy',
        applicableCountry: 'AR',
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 30,
        returnMethod: 'https://schema.org/ReturnByMail',
        returnFees: 'https://schema.org/FreeReturn',
      },
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'AR',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 0,
            maxValue: 1,
            unitCode: 'DAY',
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 3,
            unitCode: 'DAY',
          },
        },
        shippingRate: {
          '@type': 'MonetaryAmount',
          value: product.shipping.free ? 0 : product.shipping.price,
          currency: 'ARS',
        },
      },
    },
  };
}
```

### 12.1 Limpieza de JSON-LD

Antes de renderizar, eliminar propiedades `undefined`, `null` o arrays vacíos.

```tsx
export function removeEmpty<T>(input: T): T {
  if (Array.isArray(input)) {
    return input
      .map(removeEmpty)
      .filter((value) => value !== undefined && value !== null && value !== '') as T;
  }

  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .map(([key, value]) => [key, removeEmpty(value)])
        .filter(([, value]) => {
          if (value === undefined || value === null || value === '') return false;
          if (Array.isArray(value) && value.length === 0) return false;
          if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return false;
          return true;
        }),
    ) as T;
  }

  return input;
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(removeEmpty(data)).replace(/</g, '\\u003c'),
      }}
    />
  );
}
```

## 13. BreadcrumbList

Cada página de categoría y producto debe tener breadcrumb visible y JSON-LD equivalente.

```tsx
export function buildBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
```

Ejemplo para producto:

```txt
Inicio > Electrodomésticos > Refrigeración > Heladeras > Samsung Family Hub 4 Puertas 636L
```

## 14. WebSite + SearchAction

La home debe declarar el sitio y su búsqueda interna.

```tsx
export const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://www.cloudcommerce.com.ar/#website',
  name: 'cloudcommerce',
  url: 'https://www.cloudcommerce.com.ar',
  inLanguage: 'es-AR',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://www.cloudcommerce.com.ar/buscar?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
};
```

## 15. Organization / OnlineStore

La entidad de marca debe ser consistente en todo el sitio.

```tsx
export const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'OnlineStore',
  '@id': 'https://www.cloudcommerce.com.ar/#organization',
  name: 'cloudcommerce',
  url: 'https://www.cloudcommerce.com.ar',
  logo: 'https://www.cloudcommerce.com.ar/logo-cloudcommerce.png',
  image: 'https://www.cloudcommerce.com.ar/og/cloudcommerce.jpg',
  sameAs: [
    'https://www.instagram.com/cloudcommerce',
    'https://www.linkedin.com/company/cloudcommerce',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    areaServed: 'AR',
    availableLanguage: ['es-AR'],
  },
};
```

Usar `OnlineStore` cuando corresponda al modelo comercial. Si se agregan sucursales físicas, extender con `LocalBusiness` o entidades por ubicación.

## 16. ItemList para categorías

Las categorías deben declarar los productos principales visibles en la página, no todo el inventario oculto.

```tsx
export function buildCategoryItemListJsonLd(categoryUrl: string, products: ProductSummarySEO[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${categoryUrl}#itemlist`,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: product.url,
      name: product.name,
    })),
  };
}
```

## 17. Modelo de datos SEO de producto

El backend o capa BFF debe entregar los datos SEO completos. No construir SEO con strings improvisados dentro de componentes visuales.

```ts
export type ProductSEO = {
  id: string;
  slug: string;
  url: string;
  canonicalUrl: string;
  name: string;
  title: string;
  metaDescription: string;
  brand: string;
  model?: string;
  sku: string;
  mpn?: string;
  gtin8?: string;
  gtin12?: string;
  gtin13?: string;
  gtin14?: string;
  description: string;
  shortDescription: string;
  categoryPath: string[];
  images: string[];
  color?: string;
  dimensions?: {
    width?: { value: number; unitCode: 'CMT' | 'MMT' | 'MTR' };
    height?: { value: number; unitCode: 'CMT' | 'MMT' | 'MTR' };
    depth?: { value: number; unitCode: 'CMT' | 'MMT' | 'MTR' };
  };
  weight?: { value: number; unitCode: 'KGM' | 'GRM' };
  price: {
    current: number;
    previous?: number;
    currency: 'ARS';
  };
  priceValidUntil?: string;
  stock: number;
  availabilityLabel: 'En stock' | 'Sin stock' | 'Próximamente' | 'Preventa';
  shipping: {
    free: boolean;
    price?: number;
    minDays?: number;
    maxDays?: number;
    regions: string[];
  };
  rating?: {
    value: number;
    count: number;
  };
  reviews?: Array<{
    authorName: string;
    datePublished: string;
    rating: number;
    title: string;
    body: string;
  }>;
  specs: Array<{
    group: string;
    name: string;
    value: string;
    unit?: string;
  }>;
  highlights: string[];
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  updatedAt: string;
};
```

## 18. Next.js: metadata dinámica

### 18.1 Producto

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductSEO } from '@/lib/products';

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductSEO(slug);

  if (!product) {
    return {
      title: 'Producto no encontrado | cloudcommerce',
      robots: { index: false, follow: false },
    };
  }

  return {
    metadataBase: new URL('https://www.cloudcommerce.com.ar'),
    title: product.title,
    description: product.metaDescription,
    alternates: {
      canonical: product.canonicalUrl,
    },
    robots: {
      index: product.stock > 0 || product.allowOutOfStockIndexing,
      follow: true,
      googleBot: {
        index: product.stock > 0 || product.allowOutOfStockIndexing,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'es_AR',
      siteName: 'cloudcommerce',
      title: product.name,
      description: product.shortDescription,
      url: product.canonicalUrl,
      images: product.images.slice(0, 1).map((url) => ({
        url,
        width: 1200,
        height: 630,
        alt: product.name,
      })),
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.shortDescription,
      images: product.images.slice(0, 1),
    },
  };
}

export default async function ProductPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const product = await getProductSEO(slug);
  if (!product) notFound();

  return <ProductView product={product} />;
}
```

### 18.2 Categoría

```tsx
export async function generateMetadata(
  { params, searchParams }: {
    params: Promise<{ category: string[] }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  },
): Promise<Metadata> {
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;
  const category = await getCategorySEO(resolvedParams.category);

  if (!category) {
    return { title: 'Categoría no encontrada | cloudcommerce', robots: { index: false, follow: false } };
  }

  const isIndexableFilter = await isCuratedLanding(resolvedParams.category, resolvedSearch);
  const hasOnlyPagination = Object.keys(resolvedSearch).every((key) => key === 'page');
  const shouldIndex = Object.keys(resolvedSearch).length === 0 || hasOnlyPagination || isIndexableFilter;

  return {
    title: category.title,
    description: category.metaDescription,
    alternates: {
      canonical: shouldIndex ? category.currentCanonicalUrl : category.baseCanonicalUrl,
    },
    robots: {
      index: shouldIndex,
      follow: true,
      googleBot: {
        index: shouldIndex,
        follow: true,
        'max-image-preview': 'large',
      },
    },
  };
}
```

## 19. Sitemap dinámico

### 19.1 Qué incluir

Incluir:

- Home.
- Catálogo.
- Categorías indexables.
- Subcategorías indexables.
- Landings curadas.
- Marcas indexables.
- Productos indexables.
- Guías y comparativas.

Excluir:

- Carrito.
- Checkout.
- Cuenta.
- Portal de cliente.
- Buscador interno.
- Filtros arbitrarios.
- Ordenamientos.
- URLs con session IDs.
- Productos eliminados sin reemplazo.

### 19.2 Ejemplo `app/sitemap.ts`

```tsx
import type { MetadataRoute } from 'next';
import { getIndexableCategories, getIndexableProducts, getIndexableGuides } from '@/lib/seo';

const BASE_URL = 'https://www.cloudcommerce.com.ar';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products, guides] = await Promise.all([
    getIndexableCategories(),
    getIndexableProducts(),
    getIndexableGuides(),
  ]);

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/catalogo`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...categories.map((category) => ({
      url: category.url,
      lastModified: category.updatedAt,
      changeFrequency: 'daily' as const,
      priority: category.priority,
    })),
    ...products.map((product) => ({
      url: product.canonicalUrl,
      lastModified: product.updatedAt,
      changeFrequency: product.stock > 0 ? ('daily' as const) : ('weekly' as const),
      priority: product.stock > 0 ? 0.8 : 0.5,
      images: product.images.slice(0, 3),
    })),
    ...guides.map((guide) => ({
      url: guide.url,
      lastModified: guide.updatedAt,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
```

### 19.3 Sitemaps grandes

Si el catálogo supera 50.000 URLs, dividir por tipo o rango:

```txt
/sitemap.xml
/sitemaps/products-0.xml
/sitemaps/products-1.xml
/sitemaps/categories.xml
/sitemaps/guides.xml
/sitemaps/brands.xml
```

## 20. Robots

### 20.1 Ejemplo `app/robots.ts`

```tsx
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/carrito',
          '/checkout',
          '/cuenta',
          '/portal-cliente',
          '/favoritos',
          '/comparador?*',
          '/buscar?*',
          '/*?sort=',
          '/*?session=',
          '/*?utm_',
        ],
      },
    ],
    sitemap: 'https://www.cloudcommerce.com.ar/sitemap.xml',
    host: 'https://www.cloudcommerce.com.ar',
  };
}
```

### 20.2 Robots no reemplaza noindex

Para evitar indexación de una URL que Google ya conoce, usar `noindex` en la página. Robots.txt controla crawling; si bloquea el crawling, Google puede no ver el `noindex`. Para rutas privadas, usar autenticación + noindex + headers adecuados.

## 21. Canonicalización

### 21.1 Reglas

- Canonical absoluto.
- Canonical en `<head>` del HTML inicial.
- No cambiar canonical con JavaScript después del render.
- No canonicalizar toda la paginación hacia página 1.
- No usar fragmentos `#` como canonical.
- Enlazar internamente hacia la URL canónica.
- Redirigir variantes obsoletas con 301.

### 21.2 Ejemplos

| URL visitada | Canonical |
|---|---|
| `/producto/lg-lavadora-22kg-ai-dd-fv22wv2s6s` | propia |
| `/producto/lg-lavadora-22kg-ai-dd-fv22wv2s6s?utm_source=ads` | URL limpia del producto |
| `/categoria/electrodomesticos/heladeras?sort=price_asc` | categoría base |
| `/categoria/electrodomesticos/heladeras?page=2` | propia con `?page=2` |
| `/categoria/electrodomesticos/heladeras?brand=samsung` si no es landing curada | categoría base o noindex |
| `/categoria/electrodomesticos/heladeras-samsung` si es landing curada | propia |

## 22. Control de filtros y navegación facetada

Los filtros son excelentes para UX, pero peligrosos para SEO si generan combinaciones infinitas.

### 22.1 Tipos de filtros

| Filtro | Indexar por defecto | Motivo |
|---|---:|---|
| Categoría | Sí | Landing principal |
| Subcategoría | Sí | Alta intención |
| Marca | Depende | Indexar si hay demanda |
| Marca + categoría | Depende | Muy útil si hay inventario y contenido |
| Precio | No | Cambiante y duplicativo |
| Rating | No | UX, no landing estable |
| Stock | No | Cambiante |
| Ordenamiento | No | Duplicado |
| Color | Depende | Solo si tiene demanda y productos suficientes |
| Capacidad/litros/kg/pulgadas | Sí, si es landing curada | Alta intención |
| Envío gratis | No | Promoción variable |
| Cuotas | No | Variable financiera |

### 22.2 Landings curadas

En vez de indexar parámetros infinitos, crear rutas limpias:

```txt
/categoria/electrodomesticos/heladeras-samsung
/categoria/electrodomesticos/heladeras-side-by-side
/categoria/electrodomesticos/lavarropas-carga-frontal
/categoria/televisores/smart-tv-55-pulgadas
/categoria/aires-acondicionados/inverter-3000-frigorias
```

Cada landing curada debe tener:

- Inventario suficiente.
- Demanda de búsqueda comprobable.
- H1 propio.
- Texto propio.
- Productos relevantes.
- Links a guías o categorías vecinas.
- Canonical propia.
- No ser una combinación vacía o pobre.

## 23. Paginación y carga incremental

### 23.1 Reglas

- Cada página paginada debe tener URL única: `?page=2`.
- Usar `<a href>` para página siguiente/anterior y páginas numéricas.
- No depender solo de botón “Cargar más”.
- Infinite scroll solo si además existe paginación rastreable.
- Página 2 no debe canonicalizar a página 1.
- Los productos cargados por scroll deben existir también en URLs accesibles.

### 23.2 Implementación recomendada

Visualmente puede verse como carga premium, pero técnicamente debe haber enlaces.

```tsx
<nav aria-label="Paginación de productos">
  <a href="/categoria/electrodomesticos/heladeras?page=1">1</a>
  <a href="/categoria/electrodomesticos/heladeras?page=2" aria-current="page">2</a>
  <a href="/categoria/electrodomesticos/heladeras?page=3">3</a>
  <a href="/categoria/electrodomesticos/heladeras?page=3">Siguiente</a>
</nav>
```

## 24. Contenido SEO de producto

### 24.1 Bloques obligatorios

Cada producto debe tener contenido visible suficiente para diferenciarse:

1. H1 con marca + modelo + atributo.
2. Resumen comercial real.
3. Beneficios en bullets.
4. Especificaciones técnicas agrupadas.
5. Dimensiones y peso cuando aplique.
6. Consumo energético cuando aplique.
7. Conectividad y compatibilidad.
8. Garantía.
9. Envío, retiro o instalación.
10. Devoluciones.
11. Opiniones reales.
12. Preguntas frecuentes útiles.
13. Productos relacionados.
14. Comparativas cuando aporten valor.
15. Curiosidades o consejos si son verificables y útiles.

### 24.2 Ejemplo de contenido visible para heladera

```txt
La Samsung Family Hub™ 4 Puertas 636L combina capacidad familiar, conectividad Wi‑Fi y pantalla táctil para organizar alimentos, recetas y calendario desde la cocina. Sus cámaras internas permiten revisar el contenido desde el celular y la tecnología Twin Cooling Plus ayuda a conservar mejor la humedad y temperatura de cada compartimiento.
```

### 24.3 Evitar contenido pobre

No usar solo:

```txt
Comprá este producto al mejor precio. Excelente calidad. Envío rápido. Oferta exclusiva.
```

Ese texto no diferencia el producto, no ayuda al usuario y no aporta señales semánticas.

## 25. Especificaciones técnicas como SEO

Las especificaciones son contenido SEO de alta intención. Deben estar en HTML visible, no solo dentro de imágenes o modales.

### 25.1 Tabla recomendada

```tsx
<table>
  <caption>Especificaciones técnicas de Samsung Family Hub 4 Puertas 636L</caption>
  <tbody>
    <tr>
      <th scope="row">Capacidad neta</th>
      <td>636 L</td>
    </tr>
    <tr>
      <th scope="row">Dimensiones</th>
      <td>91.2 x 178 x 72.5 cm</td>
    </tr>
    <tr>
      <th scope="row">Peso</th>
      <td>124 kg</td>
    </tr>
    <tr>
      <th scope="row">Conectividad</th>
      <td>Wi‑Fi / SmartThings</td>
    </tr>
    <tr>
      <th scope="row">Consumo energético</th>
      <td>38.5 kWh/mes</td>
    </tr>
  </tbody>
</table>
```

## 26. Reviews y ratings

### 26.1 Reglas

- Solo mostrar ratings si existen reseñas reales.
- El número de reviews en JSON-LD debe coincidir con el visible.
- No marcar `AggregateRating` si la página no muestra rating.
- No copiar reviews de terceros sin derecho.
- Mostrar fecha, autor visible o alias válido, rating y contenido.
- Permitir filtros de reviews, pero no indexar cada filtro.

### 26.2 Contenido de review útil

Una review útil incluye:

- Contexto de uso.
- Tiempo de uso.
- Pros y contras.
- Problemas detectados.
- Validación de compra.

## 27. Imágenes SEO

### 27.1 Reglas

- Nombre de archivo descriptivo.
- `alt` descriptivo y natural.
- `width` y `height` definidos.
- Hero/producto principal con prioridad controlada.
- Thumbnails lazy-load.
- Formatos modernos: AVIF/WebP cuando sea posible.
- Imágenes OG 1200x630.
- No poner texto importante solo dentro de imágenes.
- Usar CDN con cache y transformación.

### 27.2 Alt text correcto

```txt
Correcto:
Heladera Samsung Family Hub 4 Puertas 636 litros acero negro vista frontal

Incorrecto:
producto
imagen
heladera barata oferta comprar ahora
```

### 27.3 Next Image recomendado

```tsx
import Image from 'next/image';

<Image
  src={product.mainImage.url}
  alt={`Heladera ${product.brand} ${product.model} ${product.capacity} ${product.color}`}
  width={900}
  height={900}
  priority
  sizes="(min-width: 1024px) 46vw, 100vw"
/>
```

## 28. Performance SEO

### 28.1 Objetivos Core Web Vitals

| Métrica | Objetivo cloudcommerce |
|---|---:|
| LCP | ≤ 2.5 s |
| INP | ≤ 200 ms |
| CLS | ≤ 0.1 |
| TTFB | Preferible ≤ 800 ms |
| JS inicial catálogo | Ideal ≤ 180 KB gzip por ruta crítica |
| Imágenes above-the-fold | Optimizadas, con dimensiones y prioridad definida |

### 28.2 Reglas de implementación

- Server-render del contenido SEO crítico.
- Server Components para producto, categoría, metadata y JSON-LD.
- Client Components solo para interacción real: filtros dinámicos, favoritos, carrito, comparador.
- Lazy-load de widgets no críticos: IA, recomendaciones, tracking, cross-sell avanzado.
- Evitar librerías pesadas para sliders si CSS/JS pequeño alcanza.
- Microanimaciones con `transform` y `opacity`, no con layout properties.
- Reservar espacio para imágenes, banners y skeletons.
- Preload de fuente principal solo si es crítica.
- Usar `font-display: swap` o sistema equivalente.
- Evitar layout shifts por badges, precios o imágenes tardías.
- Split de bundle por ruta.
- Cachear productos y categorías con invalidación controlada.

### 28.3 Microanimaciones compatibles con SEO

Las microanimaciones no deben cambiar estructura semántica ni ocultar contenido esencial.

Permitido:

```css
.product-card {
  transition: transform 180ms cubic-bezier(.2,.8,.2,1), box-shadow 180ms ease;
}

.product-card:hover {
  transform: translateY(-3px);
}

@media (prefers-reduced-motion: reduce) {
  .product-card {
    transition: none;
  }
}
```

Evitar:

```css
/* No animar layout crítico */
.product-card:hover {
  width: 110%;
  height: 120%;
}
```

## 29. Accesibilidad como señal de calidad

Aunque accesibilidad y SEO no son lo mismo, una estructura accesible suele ser más rastreable y usable.

Requisitos:

- H1 único.
- Labels en filtros.
- Botones con nombre accesible.
- Breadcrumb navegable.
- Focus visible.
- Contraste suficiente.
- Enlaces reales.
- Modales con foco controlado.
- Imágenes con alt útil o `alt=""` si son decorativas.
- No bloquear navegación por teclado.

## 30. SEO local para Argentina

### 30.1 Localización técnica

- Usar idioma `es-AR`.
- Usar moneda `ARS`.
- Mostrar precios en formato local visible: `$ 7.299.900`.
- En datos estructurados, usar precio numérico sin separador de miles: `7299900`.
- Usar `priceCurrency: "ARS"`.
- Usar `addressCountry: "AR"` en shipping y organization.
- Incluir disponibilidad de envío por región cuando el dato exista.
- Evitar decir “envío a todo el país” si no es real.

### 30.2 Contenido local

Crear landings y guías para búsquedas argentinas:

```txt
heladeras no frost en argentina
lavarropas carga frontal con envío en buenos aires
smart tv 55 pulgadas 4k cuotas
aires acondicionados inverter precio argentina
notebooks para programar argentina
```

### 30.3 Confianza comercial local

Mostrar de forma indexable y visible:

- Métodos de pago.
- Cuotas.
- Garantía oficial.
- Política de devolución.
- Envíos por provincia o principales zonas.
- Soporte local.
- Factura/remito cuando aplique.
- Datos legales de la empresa en páginas institucionales.

## 31. Merchant Center y producto orgánico

El SEO de producto debe prepararse para feed de Merchant Center.

### 31.1 Campos mínimos para feed

```txt
id
item_group_id si hay variantes
title
description
link
image_link
additional_image_link
availability
availability_date si preventa
price
sale_price
sale_price_effective_date
gtin
mpn
brand
condition
google_product_category
product_type
shipping
shipping_weight
return_policy_label
```

### 31.2 Consistencia obligatoria

El feed, la página visible y el JSON-LD deben coincidir en:

- Precio.
- Moneda.
- Stock.
- Link/canonical.
- Imagen principal.
- Marca.
- GTIN/MPN/SKU.
- Variante.
- Envío.
- Devolución.

Si el feed dice “en stock” y la página dice “sin stock”, se pierde confianza algorítmica y puede haber rechazos.

## 32. Contenido editorial: guías, comparativas y curiosidades

La página de IA y las curiosidades sobre electrodomésticos pueden convertirse en una ventaja SEO si el contenido es útil, verificable y enlazado a productos.

### 32.1 Tipos de contenido recomendados

```txt
/guias/como-elegir-heladera
/guias/heladera-side-by-side-medidas-consumo
/guias/lavarropas-carga-frontal-vs-carga-superior
/guias/que-es-ai-dd-en-lavadoras-lg
/guias/cuanto-consume-un-smart-tv-55
/comparativas/samsung-family-hub-vs-lg-instaview
/comparativas/lavarropas-22kg-lg-vs-samsung
```

### 32.2 Estructura de guía

Cada guía debe tener:

- H1 claro.
- Respuesta corta al inicio.
- Tabla comparativa.
- Explicaciones con experiencia real o datos técnicos.
- Errores comunes.
- Productos recomendados con enlaces.
- Preguntas frecuentes.
- Fecha de actualización cuando haya cambios reales.
- Autor o responsable editorial si aplica.

### 32.3 IA generativa

La IA puede ayudar a estructurar contenido, pero no debe publicar páginas automáticamente sin revisión. Para contenido de producto, priorizar datos reales, specs del fabricante, pruebas propias, experiencia de usuario y edición humana.

## 33. SEO para AI Overviews / búsqueda generativa

No crear “archivos mágicos para IA” ni schema especial inventado. La estrategia debe ser que las páginas sean excelentes para búsqueda clásica y para respuestas asistidas.

Requisitos prácticos:

- Contenido importante en texto visible.
- Respuestas directas a preguntas comunes.
- Tablas de especificaciones claras.
- Comparativas útiles.
- Entidades bien nombradas: marca, modelo, categoría, capacidad, tecnología.
- Structured data consistente.
- Imágenes de calidad con alt útil.
- Enlaces internos que conecten guías, categorías y productos.
- Datos comerciales actualizados.

## 34. Linking interno

### 34.1 Desde home

La home debe enlazar a:

- Categorías principales.
- Ofertas relevantes.
- Marcas principales.
- Guías de compra principales.
- Productos destacados con demanda.

### 34.2 Desde categoría

Cada categoría debe enlazar a:

- Subcategorías.
- Marcas relevantes.
- Landings curadas.
- Guías asociadas.
- Productos populares.
- Categorías complementarias.

Ejemplo para heladeras:

```txt
Heladeras Samsung
Heladeras LG
Heladeras Side by Side
Heladeras No Frost
Freezers
Cavas
Guía: cómo elegir una heladera
```

### 34.3 Desde producto

Cada producto debe enlazar a:

- Categoría padre.
- Marca.
- Productos similares.
- Accesorios compatibles.
- Guía de compra.
- Comparativa si existe.
- Productos vistos recientemente no deberían ser la única fuente de enlaces.

## 35. Manejo de productos sin stock

### 35.1 Producto temporalmente sin stock

Si el producto volverá:

- Mantener indexable.
- Mostrar “sin stock temporalmente”.
- Ofrecer alerta de stock.
- Mostrar productos alternativos.
- JSON-LD con `OutOfStock`.
- Mantener canonical propia.

### 35.2 Producto discontinuado

Si tiene tráfico o enlaces:

- Mantener página informativa si aporta valor.
- Mostrar discontinuado claramente.
- Recomendar reemplazo.
- Usar `OutOfStock` o estado equivalente.
- Si hay reemplazo directo, considerar 301 tras evaluar intención.

### 35.3 Producto eliminado sin valor

- 410 si no hay reemplazo ni tráfico.
- 301 a categoría si hay intención genérica.
- 301 a reemplazo si coincide intención.
- No redirigir todo a home.

## 36. Estados HTTP

| Caso | Estado recomendado |
|---|---:|
| Producto existente | 200 |
| Producto sin stock pero útil | 200 |
| Producto discontinuado con alternativas | 200 |
| Producto reemplazado uno a uno | 301 al reemplazo |
| Slug viejo | 301 al slug nuevo |
| Producto eliminado sin reemplazo | 410 |
| Categoría vacía temporal | 200 con explicación y alternativas |
| Categoría inexistente | 404 |
| Parámetro inválido | 404 o canonical/noindex según caso |

## 37. Redirecciones

Crear tabla de redirecciones para:

- Slugs antiguos.
- Cambios de marca/modelo.
- Migración desde plataforma anterior.
- Normalización con o sin slash final.
- Normalización www/no-www.
- HTTP a HTTPS.
- Mayúsculas a minúsculas.

Nunca generar cadenas largas de redirects.

```txt
http://cloudcommerce.com.ar/product/123
301 -> https://www.cloudcommerce.com.ar/producto/samsung-family-hub-4-puertas-636l-rf63a977fsg-co
```

## 38. Página de búsqueda interna

La búsqueda interna es útil para conversión, pero por defecto no debe indexarse.

```tsx
export const metadata = {
  title: 'Buscar productos | cloudcommerce',
  robots: {
    index: false,
    follow: true,
  },
};
```

Excepción: si una búsqueda tiene demanda estable, convertirla en landing curada con URL limpia.

```txt
/buscar?q=heladera+side+by+side  -> noindex
/categoria/electrodomesticos/heladeras-side-by-side -> index
```

## 39. Open Graph y social SEO

Cada producto debe poder compartirse con una vista premium.

### 39.1 Requisitos

- Imagen OG 1200x630.
- Nombre del producto legible.
- Marca.
- Precio opcional si se mantiene actualizado.
- Fondo blanco premium consistente con cloudcommerce.
- No incluir descuentos que cambien si la imagen no se regenera.

### 39.2 Generación dinámica opcional

```txt
/api/og/producto/[slug]
```

La imagen OG puede generarse con template visual de cloudcommerce: producto, badge de stock, precio y logo.

## 40. Internacionalización futura

Aunque el foco inicial sea Argentina, preparar estructura para expansión.

```txt
/es-ar/producto/...
/es-cl/producto/...
/es-uy/producto/...
```

Solo usar `hreflang` cuando existan versiones reales y localizadas, no traducciones vacías.

Ejemplo conceptual:

```html
<link rel="alternate" hreflang="es-AR" href="https://www.cloudcommerce.com.ar/producto/..." />
<link rel="alternate" hreflang="es-UY" href="https://www.cloudcommerce.com.uy/producto/..." />
<link rel="alternate" hreflang="x-default" href="https://www.cloudcommerce.com/producto/..." />
```

## 41. Seguridad, confianza y páginas institucionales

El SEO de e-commerce necesita confianza visible.

Crear e indexar páginas como:

```txt
/sobre-cloudcommerce
/ayuda/envios
/ayuda/devoluciones
/ayuda/garantia
/ayuda/metodos-de-pago
/ayuda/facturacion-y-remitos
/contacto
/terminos-y-condiciones
/politica-de-privacidad
```

Estas páginas deben enlazarse desde footer y desde producto cuando corresponda.

## 42. Publicidad + SEO

La publicidad puede acelerar aprendizaje y demanda, pero no debe usarse como excusa para landings pobres.

### 42.1 Usos correctos de Ads para potenciar SEO

- Validar keywords antes de crear landings SEO.
- Detectar términos con alta conversión.
- Testear propuestas de valor en titles y descriptions.
- Impulsar productos nuevos mientras SEO madura.
- Hacer remarketing a usuarios orgánicos.
- Reforzar marca para aumentar búsquedas directas.

### 42.2 Reglas

- Las campañas deben apuntar a URLs canónicas, rápidas y de alta calidad.
- No crear una landing por cada keyword si no aporta valor real.
- No duplicar categorías solo para anuncios.
- Medir conversión por cluster: categoría, marca, producto, guía.

## 43. Medición y monitoreo

### 43.1 Herramientas mínimas

- Google Search Console.
- Google Merchant Center.
- GA4 o alternativa equivalente.
- PageSpeed Insights / Lighthouse.
- Rich Results Test.
- Schema Markup Validator.
- Logs de servidor o CDN.
- Dashboard de URLs indexables/noindex.

### 43.2 KPIs SEO

| KPI | Objetivo |
|---|---|
| URLs válidas indexables | Crecimiento controlado |
| Productos descubiertos por Google | Cercano al sitemap/feed |
| Errores structured data | 0 críticos |
| Merchant listings válidos | Crecimiento estable |
| Impresiones por categoría | Tendencia ascendente |
| CTR orgánico | Mejorar por title/meta/OG |
| Posición media por cluster | Mejorar por contenido/autoridad |
| Core Web Vitals | Good en páginas principales |
| Crawled currently not indexed | Reducir con calidad y linking |
| Duplicate without user-selected canonical | Reducir con canonical/linking |
| Conversión orgánica | Medir por categoría y producto |

### 43.3 Alertas recomendadas

- Aumento de páginas `noindex` inesperadas.
- Caída de productos en sitemap.
- Errores 5xx.
- Aumento de 404 de productos con tráfico.
- JSON-LD inválido.
- Price mismatch feed vs página.
- Stock mismatch feed vs página.
- LCP p75 superior a 2.5s.
- INP p75 superior a 200ms.
- CLS p75 superior a 0.1.

## 44. QA SEO antes de merge

Checklist obligatorio para PRs que modifiquen catálogo, producto, rutas, filtros o metadata.

```txt
[ ] La página tiene un H1 único.
[ ] El contenido principal aparece en HTML inicial.
[ ] Los links internos son <a href>.
[ ] El title es único y generado desde datos reales.
[ ] La meta description es única.
[ ] El canonical es absoluto y correcto.
[ ] Robots index/noindex coincide con la matriz.
[ ] JSON-LD es válido.
[ ] JSON-LD coincide con contenido visible.
[ ] Precio en JSON-LD coincide con precio visible.
[ ] Stock en JSON-LD coincide con stock visible.
[ ] Breadcrumb visible coincide con BreadcrumbList.
[ ] Producto aparece en sitemap si es indexable.
[ ] Página privada no aparece en sitemap.
[ ] Filtros arbitrarios no se indexan.
[ ] Paginación usa URLs únicas.
[ ] Imágenes tienen width/height/alt.
[ ] No hay CLS por imágenes o banners.
[ ] Lighthouse no detecta problemas graves.
[ ] No se agregó contenido IA masivo sin revisión.
[ ] No se rompió navegación por teclado.
```

## 45. Tests automatizados recomendados

### 45.1 Test de metadata de producto

```ts
import { describe, expect, it } from 'vitest';
import { buildProductMetadata } from '@/lib/seo/metadata';

const product = createMockProductSEO();

describe('product metadata', () => {
  it('generates unique title, description and canonical', () => {
    const metadata = buildProductMetadata(product);

    expect(metadata.title).toContain(product.brand);
    expect(metadata.description).toContain(product.model);
    expect(metadata.alternates?.canonical).toBe(product.canonicalUrl);
    expect(metadata.robots?.index).toBe(true);
  });
});
```

### 45.2 Test de JSON-LD

```ts
import { describe, expect, it } from 'vitest';
import { buildProductJsonLd } from '@/lib/seo/jsonld';

const product = createMockProductSEO({ price: 7299900, stock: 12 });

describe('product json ld', () => {
  it('matches price and availability', () => {
    const jsonLd = buildProductJsonLd(product);

    expect(jsonLd.offers.price).toBe(7299900);
    expect(jsonLd.offers.priceCurrency).toBe('ARS');
    expect(jsonLd.offers.availability).toBe('https://schema.org/InStock');
  });
});
```

### 45.3 Test Playwright de HTML rastreable

```ts
import { test, expect } from '@playwright/test';

test('product page exposes SEO-critical HTML', async ({ page }) => {
  await page.goto('/producto/samsung-family-hub-4-puertas-636l-rf63a977fsg-co');

  await expect(page.locator('h1')).toContainText('Samsung Family Hub');
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCountGreaterThan(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/producto\//);
  await expect(page.locator('text=$ 7.299.900')).toBeVisible();
});
```

## 46. CI/CD SEO gate

Ningún deploy a producción debe pasar si:

- Falta canonical en páginas indexables.
- Producto indexable tiene `noindex` accidental.
- Página privada aparece en sitemap.
- JSON-LD crítico es inválido.
- Sitemap genera URLs 404.
- Robots bloquea assets críticos.
- Hay más de X errores 5xx en smoke tests.
- LCP sintético sube por encima del presupuesto definido.

Ejemplo de script conceptual:

```json
{
  "scripts": {
    "seo:lint": "tsx scripts/seo-lint.ts",
    "seo:sitemap-check": "tsx scripts/check-sitemap.ts",
    "seo:jsonld-check": "tsx scripts/check-jsonld.ts",
    "seo:lighthouse": "lhci autorun"
  }
}
```

## 47. Lint SEO conceptual

```ts
type SEOIssue = {
  severity: 'error' | 'warning';
  route: string;
  message: string;
};

export function validateSEOPage(page: SEOPageSnapshot): SEOIssue[] {
  const issues: SEOIssue[] = [];

  if (page.indexable && !page.title) {
    issues.push({ severity: 'error', route: page.url, message: 'Missing title' });
  }

  if (page.indexable && !page.canonical?.startsWith('https://')) {
    issues.push({ severity: 'error', route: page.url, message: 'Canonical must be absolute HTTPS URL' });
  }

  if (page.type === 'product' && page.indexable && !page.jsonLdTypes.includes('Product')) {
    issues.push({ severity: 'error', route: page.url, message: 'Product page missing Product JSON-LD' });
  }

  if (page.private && page.indexable) {
    issues.push({ severity: 'error', route: page.url, message: 'Private page cannot be indexable' });
  }

  return issues;
}
```

## 48. Generación de contenido asistida por IA

### 48.1 Permitido

- Crear borradores de descripciones.
- Normalizar fichas técnicas.
- Generar FAQs basadas en datos reales.
- Sugerir comparativas.
- Resumir manuales propios o documentación del fabricante con revisión.
- Crear textos de ayuda para el usuario.

### 48.2 Prohibido

- Publicar contenido masivo sin revisión.
- Inventar beneficios.
- Inventar especificaciones.
- Inventar opiniones.
- Cambiar fechas para simular frescura.
- Crear páginas por keywords sin inventario ni utilidad.
- Copiar descripciones de fabricante sin aportar valor.

### 48.3 Formato recomendado de bloque “Curiosidades”

```txt
Curiosidad útil: una lavadora con motor inverter suele regular mejor velocidad y consumo que un motor convencional, pero el ahorro real depende del programa usado, carga, temperatura y frecuencia de lavado. Revisá siempre la etiqueta de eficiencia y el consumo por ciclo informado.
```

Debe ser educativo, verificable y relacionado con decisión de compra.

## 49. Estructura editorial de producto perfecta

Para productos estratégicos, usar esta secuencia:

```txt
H1: Samsung Family Hub™ 4 Puertas 636L
Resumen de 2 líneas
Precio / stock / envío / CTA
Galería
Beneficios principales
Descripción completa
Especificaciones técnicas
Medidas y compatibilidad con espacio
Consumo energético
Conectividad / app / ecosistema
Instalación y envío
Garantía y devoluciones
Opiniones verificadas
Preguntas frecuentes
Comparar con productos similares
Productos relacionados
Guías relacionadas
```

## 50. Estructura SEO de categoría perfecta

```txt
H1: Heladeras en Argentina
Intro útil: 80-140 palabras
Chips: No Frost, Side by Side, Samsung, LG, Inverter, con dispenser
Filtros UX noindex
Grilla de productos con enlaces rastreables
Bloque: cómo elegir una heladera
Bloque: marcas destacadas
Bloque: capacidades populares
Bloque: preguntas frecuentes
Links internos a guías y comparativas
Paginación crawlable
```

## 51. Ejemplo de categoría con contenido útil

```txt
Encontrá heladeras para hogares, oficinas y cocinas familiares en cloudcommerce. Compará modelos No Frost, Side by Side y con freezer superior según capacidad, medidas, eficiencia energética, color, conectividad y tipo de enfriamiento. Revisá stock actualizado, cuotas, envío y especificaciones técnicas antes de elegir.
```

## 52. Guía de keywords por intención

### 52.1 Transaccional

```txt
comprar heladera samsung argentina
lavarropas lg 22kg precio
smart tv 55 4k cuotas
notebook i7 16gb 512ssd argentina
aire acondicionado inverter precio
```

### 52.2 Comparativa

```txt
heladera side by side vs no frost
lavarropas carga frontal vs carga superior
qled vs oled para tv
notebook gamer vs notebook de trabajo
```

### 52.3 Informacional con intención comercial

```txt
cómo elegir una heladera
cuánto consume un lavarropas
qué tamaño de tv comprar para living
cuántas frigorías necesito
qué significa inverter en electrodomésticos
```

### 52.4 Marca + modelo

```txt
samsung family hub 636l precio
lg fv22wv2s6s opiniones
xiaomi 14 ultra 512gb precio argentina
macbook air m2 13 precio
```

## 53. Componentes SEO reutilizables

```txt
SEOHead
JsonLd
Breadcrumbs
ProductStructuredData
CategoryStructuredData
OrganizationStructuredData
ProductSpecTable
ProductFAQ
ProductReviewList
InternalLinkBlock
RelatedProducts
CanonicalAwarePagination
IndexationGuard
```

## 54. Separación de responsabilidades

```txt
/lib/seo/metadata.ts        -> titles, descriptions, canonical, robots
/lib/seo/jsonld.ts          -> builders de structured data
/lib/seo/routes.ts          -> definición de rutas indexables/noindex
/lib/seo/sitemap.ts         -> obtención de URLs indexables
/lib/seo/canonical.ts       -> reglas de canonicalización
/lib/seo/facets.ts          -> reglas de filtros indexables
/lib/seo/content.ts         -> plantillas editoriales
/components/seo/JsonLd.tsx  -> render seguro de JSON-LD
/app/sitemap.ts             -> sitemap Next.js
/app/robots.ts              -> robots Next.js
```

## 55. Definición de listo

Una página de producto está lista para SEO cuando cumple:

```txt
[ ] URL descriptiva y estable.
[ ] H1 con marca + modelo + atributo.
[ ] Metadata única.
[ ] Canonical absoluto.
[ ] Robots correcto.
[ ] Breadcrumb visible.
[ ] BreadcrumbList válido.
[ ] Product JSON-LD válido.
[ ] Offer con ARS, precio, stock y URL.
[ ] Shipping/returns si están visibles.
[ ] Specs visibles en HTML.
[ ] Imágenes optimizadas.
[ ] Reviews reales o sin rating marcado.
[ ] Links a categoría, marca y productos relacionados.
[ ] Presente en sitemap si indexable.
[ ] No bloqueada por robots.txt.
[ ] Pasa Rich Results Test sin errores críticos.
[ ] Pasa Lighthouse/PageSpeed dentro del presupuesto.
```

Una categoría está lista para SEO cuando cumple:

```txt
[ ] H1 único.
[ ] Intro útil.
[ ] Productos enlazados con <a href>.
[ ] Paginación rastreable.
[ ] Filtros no generan indexación basura.
[ ] Canonical correcto.
[ ] ItemList opcional válido.
[ ] BreadcrumbList válido.
[ ] Links a subcategorías y guías.
[ ] Sitemap la incluye si indexable.
[ ] No tiene contenido duplicado de otra categoría.
```

## 56. Fuentes base para esta skill

Esta skill está alineada con la documentación oficial y referencias primarias siguientes:

```txt
Google Search Central — SEO Starter Guide
Google Search Central — Ecommerce SEO best practices
Google Search Central — Product structured data
Google Search Central — Merchant listing structured data
Google Search Central — Canonicalization
Google Search Central — Ecommerce URL structure
Google Search Central — Pagination and incremental loading
Google Search Central — Ecommerce site structure
Google Search Central — Page Experience
Google Search Central — AI features and websites
Google Search Central — Helpful, reliable, people-first content
web.dev — Core Web Vitals
Schema.org — Product, Offer, BreadcrumbList, WebSite
Next.js Docs — Metadata API, sitemap.ts, robots.ts
```

## 57. Recordatorio final

El SEO perfecto para cloudcommerce no es repetir keywords. Es construir una arquitectura donde cada producto sea una entidad clara, cada categoría sea una landing útil, cada enlace interno ayude al usuario, cada dato comercial sea confiable, cada imagen cargue rápido, cada ficha responda dudas reales y cada señal técnica permita que Google entienda el negocio sin fricción.

La estética premium de cloudcommerce debe ser visible para el usuario. La estructura SEO debe ser visible para Google. Ambas capas deben salir del mismo sistema de datos y reforzarse entre sí.
