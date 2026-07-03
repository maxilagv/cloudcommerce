# 00 · Login y sesión (dominio `identity`)

Backend: [`docs/backend/07-auth-identidad.md`](../../backend/07-auth-identidad.md). Diseño visual y
animación completa en [04-motion-y-microanimaciones.md §2](../04-motion-y-microanimaciones.md).

## Pantallas

| Ruta | Qué hace | Procedimiento tRPC |
|---|---|---|
| `(auth)/login` | Email + password, animado | `identity.login` |
| `(auth)/mfa` | Desafío de 6 dígitos, solo si `mfaEnabled` | `identity.verifyMfa` |
| `(auth)/recuperar` | Solicitar reset por email | `identity.startPasswordReset` |
| `(auth)/recuperar/[token]` | Nueva contraseña | `identity.completePasswordReset` |
| `(dashboard)/configuracion/sesiones` | Lista de sesiones activas propias, revocar | `identity.listSessions`, `identity.revokeSession` |

## Estados a cubrir

- Credenciales inválidas → mensaje genérico (nunca "el email no existe" — el backend ya responde
  genérico, el frontend no debe intentar distinguir por su cuenta).
- Rate limit alcanzado → mensaje con el tiempo de espera (`retryAfterSeconds` que devuelve el backend).
- Código MFA inválido → shake del input, sin resetear los dígitos ya tipeados salvo el último.
- Sesión expirada mientras se navega → redirect a login conservando la ruta de destino (`?next=`).

## Notas de seguridad para el frontend

- El token de sesión vive en cookie httpOnly — el frontend nunca lo lee ni lo guarda en `localStorage`.
- El botón "Cerrar todas las sesiones" (logout global) es una acción destructiva → `confirm-dialog`.
- La lista de sesiones activas muestra IP/dispositivo/último uso pero nunca el token en sí.
