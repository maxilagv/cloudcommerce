# 09 · Herramientas IA (dominio `ai`)

Backend: [17-modulo-ia-gateway](../../backend/modulos/17-modulo-ia-gateway.md). Visible para
`OWNER`/`ADMIN`/`CATALOG_MANAGER`. Patrón de pantalla: "Panel de herramienta", ver
[06-componentes-y-patrones §2.4](../06-componentes-y-patrones.md).

## Pantallas

| Ruta | Qué hace |
|---|---|
| `ai/descripciones` | Generador de descripción/specs/SEO a partir de un producto |
| `ai/pricing` | Sugerencias de pricing basadas en costos/competencia |
| `ai` (overview) | Panel de uso: generaciones recientes, costo acumulado del período, alertas |

También embebido como acción dentro del detalle de producto (botón "Generar con IA" en la sección
SEO/descripción — ver [02-catalogo-y-media](./02-catalogo-y-media.md)), no exclusivamente como
pantalla dedicada.

## Flujo de generación

```
[ selector de producto/contexto (si no viene ya preseleccionado desde el detalle de producto) ]
[ parámetros: tono, longitud, palabras clave a incluir ]
[ botón "Generar" → estado de carga con skeleton de contenido (la IA tarda unos segundos) ]
[ resultado: contenido generado, editable inline antes de aplicar ]
[ acciones: "Usar este contenido", "Regenerar" (cuenta como nueva generación/costo), "Descartar" ]
```

## Panel de uso y costo

Bar chart apilado por tipo de generación + KPI de costo total del período — ver
[07-graficos-y-dataviz §3.8](../07-graficos-y-dataviz.md). Incluye alertas si se acerca al límite de
cuota diario que el backend define por actor.

## Confianza y transparencia

Todo contenido generado por IA se marca visualmente como tal (badge "Generado con IA") hasta que el
admin lo edita manualmente — una vez editado, el badge cambia a "Editado" para que quede claro qué
pasó por revisión humana.
