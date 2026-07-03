# 08 · Proveedores (dominio `suppliers`)

Backend: [20-modulo-suppliers](../../backend/modulos/20-modulo-suppliers.md). El dominio más sensible
en seguridad de todo el backend (SSRF guard, credenciales cifradas) — la UI tiene que reflejar esa
seriedad: nunca mostrar secretos en claro, siempre confirmar antes de acciones que disparan tráfico
saliente real.

## Pantallas

| Ruta | Patrón | Qué hace |
|---|---|---|
| `proveedores` | Lista | Nombre, estado de conexión (última corrida OK/error), cantidad de productos mapeados |
| `proveedores/nuevo` | Wizard | Datos generales → configuración de API → primer feed (opcional, puede posponerse) |
| `proveedores/[id]` | Detalle | Ver layout abajo |

## Configuración de API (paso sensible del wizard/detalle)

- El campo de API key/secret es un `input` tipo password con toggle de visibilidad **solo al
  escribir uno nuevo** — al editar un proveedor existente, el campo se muestra vacío con placeholder
  "•••• configurado" y un botón "Reemplazar", nunca trae el valor real desde el backend (que de hecho
  no lo devuelve — está cifrado en reposo).
- Guardar la configuración de API dispara una validación de conectividad (si el backend la ofrece)
  antes de confirmar — feedback inmediato de "conexión OK" o el motivo de fallo.

## Detalle de proveedor

```
[ header: nombre + badge de estado de conexión ]
[ pestaña "General": datos, config de API ]
[ pestaña "Feed": mapeo de columnas, URL de origen, última corrida (fecha, filas procesadas, errores) ]
[ pestaña "Historial de importación": tabla de corridas pasadas, cada una expandible con su log de errores ]
[ pestaña "Reenvío de pedidos": log de intentos de reenvío (éxito/fallo/reintento), con el motivo de fallo legible ]
```

## Acciones sensibles

"Ejecutar feed ahora" y "Reintentar reenvío" son acciones que disparan tráfico real hacia el
proveedor — siempre con `confirm-dialog`, nunca un botón de un solo click sin confirmación, incluso
para `OWNER`.

## Errores de SSRF / conexión

Si una corrida de feed o un reenvío falla por el guard de SSRF (URL del proveedor resuelve a una IP
no permitida), el mensaje al admin es genérico y accionable ("No se pudo conectar con el proveedor,
verificá la URL configurada") — nunca se expone el detalle técnico de por qué el guard lo bloqueó.
