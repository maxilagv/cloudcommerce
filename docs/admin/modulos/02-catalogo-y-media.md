# 02 · Catálogo y media (dominios `catalog`, `media`)

Backend: [10-modulo-catalogo](../../backend/modulos/10-modulo-catalogo.md),
[12-modulo-media-storage](../../backend/modulos/12-modulo-media-storage.md).

## Pantallas

| Ruta | Patrón | Qué hace |
|---|---|---|
| `productos` | Lista | Tabla: thumbnail, nombre, categoría, precio, stock, estado (`status-badge` con `ProductStatus`), acciones |
| `productos/nuevo` | Wizard o formulario seccionado | Datos generales → specs → precio → imágenes → SEO |
| `productos/[id]` | Detalle/edición | Mismas secciones que alta, más pestaña de variantes y pestaña "Generar con IA" (link al módulo 09) |
| `categorias` | Lista simple | Árbol o lista plana con conteo de productos por categoría |
| `media` | Galería | Grid de imágenes subidas, filtro por producto/origen (`MediaSource`: upload/ai/import) |

## Secciones del formulario de producto

1. **General**: nombre, slug (autogenerado, editable), categoría, descripción corta/larga.
2. **Specs**: tabla de atributos clave-valor dinámica.
3. **Precio y stock inicial**: delega el precio real al módulo de pricing si el backend separa el
   comando (`pricing.setManualPrice` vs. un campo embebido) — verificar contra el router real al
   implementar, no asumir.
4. **Imágenes**: `file-upload` con preview inmediato, reordenable (drag), 1-6 imágenes según límite
   del backend, indicador de cuál es la principal.
5. **SEO**: título meta, descripción meta, con botón "Generar con IA" que abre el panel de herramienta
   IA sin salir de la pantalla (ver [06-componentes-y-patrones §2.4](../06-componentes-y-patrones.md)).

## Editor de variantes

Tabla editable inline (talle/color/SKU/stock por variante) — no una pantalla separada, vive como
pestaña dentro del detalle de producto. Cambios de variante se guardan independientes del resto del
formulario.

## Estados de publicación

`ProductStatus`: `DRAFT → READY_FOR_REVIEW → PUBLISHED → PAUSED/ARCHIVED`. El botón de cambio de
estado en el header del detalle refleja las transiciones válidas únicamente (no se ofrece "publicar"
sobre un producto sin imágenes ni precio, si el backend lo rechaza — mostrar el motivo, no solo
deshabilitar sin explicación).

## Media

Validación en el cliente **solo como UX** (tipo de archivo, tamaño aproximado) — la validación real
(magic bytes, re-encode) la hace el backend; el frontend muestra el error específico que devuelva si
rechaza el archivo, nunca asume que su validación previa es suficiente.
