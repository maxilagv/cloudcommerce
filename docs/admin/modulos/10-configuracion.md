# 10 · Configuración (dominios `settings`, `identity`)

Backend: [19-modulo-configuracion](../../backend/modulos/19-modulo-configuracion.md). Solo
`OWNER`/`ADMIN` (gestión de usuarios y algunos campos, solo `OWNER` — ver matriz de permisos).

## Pantallas (sub-navegación con tabs dentro de `configuracion`, no rutas separadas en el sidebar)

| Tab | Qué hace |
|---|---|
| General | Nombre de tienda, moneda base, datos de contacto |
| Pagos | Métodos de pago habilitados, estado de credenciales (nunca el valor — ver abajo) |
| Envíos | Configuración de zonas/costos de envío |
| Usuarios admin | ABM de usuarios, asignación de rol (solo `OWNER`/`ADMIN`, y con la restricción ya
  corregida en el backend: no se puede degradar a un par del mismo rango) |
| Feature flags | Toggles con estado owner/review/plan |
| Secretos | Estado de configuración (✓ configurado / ✗ falta) de cada integración — nunca el valor |

## Regla dura: nunca se muestra un secreto

Todo lo relacionado a `STRIPE_SECRET_KEY`, tokens de proveedor, `ANTHROPIC_API_KEY`, etc. se
representa en la UI como **estado**, no como valor — el backend ya expone esto como booleano
(`env-secret-probe`, auditado y confirmado sin fugas). El campo de "reemplazar credencial" sigue el
mismo patrón que en [proveedores](./08-proveedores.md): vacío por defecto, nunca prellenado.

## Usuarios admin

Tabla: nombre, email, rol (`AdminRole` como `select`, con las opciones ya filtradas por lo que el
actor actual puede asignar), estado (activo/inactivo), MFA habilitado (badge), última sesión.
Acciones: invitar nuevo usuario, cambiar rol, desactivar (nunca "eliminar" — el backend probablemente
solo desactiva, no borra, por trazabilidad de auditoría — confirmar contra el router real).

## Feature flags

Lista simple con switch + descripción de qué controla cada flag — sin categorización compleja en esta
fase, son pocos.
