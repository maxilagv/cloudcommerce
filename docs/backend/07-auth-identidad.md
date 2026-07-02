# 07 · Auth e identidad (dominio `identity`)

Cubre la **primera parte del panel: login**, y la autorización de todo el resto. En esta fase los actores
son **usuarios admin** (dueño + staff). El login de clientes del store es fase futura (se deja el gancho).

## Principios

```txt
- Contraseñas nunca en texto plano → hash Argon2id (o bcrypt con costo revisado).
- Access de vida corta; refresh rotativos, hasheados y revocables.
- Sesiones asociadas a dispositivo; logout invalida sesión/token.
- Cambios críticos fuerzan reautenticación.
- Nunca loggear passwords, tokens ni cookies.
```

## Estrategia de sesión (ADR-004)

**Better Auth** con **cookie de sesión** `httpOnly`, `Secure`, `SameSite=Lax` + protección **CSRF**.
Preferida sobre tokens en `localStorage` (inmune a robo por XSS). El admin corre bajo un origin propio con
CORS allowlist estricto ([08](./08-seguridad.md)).

### Refresh token rotation

Cada refresh exitoso emite un refresh nuevo e invalida el anterior (tabla `admin_session`, `family_id`).
Si se detecta **reuse** de un refresh ya rotado:

```txt
- revocar toda la familia de tokens
- invalidar la sesión
- registrar evento de seguridad (access_log)
- notificar si corresponde
```

### MFA para admin

`admin_user.mfa_enabled` + `mfa_secret_enc` (TOTP). Opcional pero recomendado para roles `OWNER`/`ADMIN`/`FINANCE`.
Acciones críticas (borrar productos masivo, emitir/regenerar documentos, cambiar pricing global, exportar
datos de clientes) pueden exigir **reauth** reciente.

### Recuperación de cuenta

```txt
- token aleatorio de un solo uso, hasheado en DB, expiración corta
- no revelar si el email existe
- rate limit por IP + email + fingerprint
- registrar evento
```

## Endpoints (tRPC `identity.*` + REST auth)

```txt
identity.login(email, password, [otp])        → set-cookie sesión
identity.logout()                             → revoca sesión actual
identity.logoutAll()                          → revoca todas las sesiones del usuario
identity.me()                                 → perfil + rol + permisos efectivos
identity.refresh()                            → rota refresh (o transparente por cookie)
identity.listSessions() / revokeSession(id)   → gestión de dispositivos
identity.admin.createUser(...)                → alta de staff (solo OWNER/ADMIN)
identity.admin.updateRole(userId, role)       → cambio de rol (auditar)
identity.startPasswordReset(email) / completePasswordReset(token, newPassword)
identity.enableMfa() / verifyMfa(code) / disableMfa(reauth)
```

Rate limits específicos (login por IP+email+device; reset por IP+email) — ver [08](./08-seguridad.md).

## Autorización: RBAC + ABAC + ownership

```txt
RBAC:      rol general → OWNER, ADMIN, CATALOG_MANAGER, SUPPORT, FINANCE, (customer futuro)
ABAC:      atributos de contexto → estado del recurso, canal, país
Ownership: el actor solo accede a sus recursos (crítico cuando exista login de cliente)
```

La autorización crítica vive en **application/domain**, no solo en middleware. El middleware verifica
autenticación y rol grueso; el caso de uso decide si `SUPPORT` puede leer *ese* pedido y con qué motivo.

## Roles del panel (propuesta)

| Rol | Para qué |
|-----|----------|
| `OWNER` | El dueño. Todo, incluido costos, finanzas, usuarios, configuración. |
| `ADMIN` | Casi todo salvo transferir propiedad / borrar la tienda. |
| `CATALOG_MANAGER` | ABM de productos/categorías/media/pricing (no ve finanzas ni datos sensibles de clientes). |
| `FINANCE` | Finanzas, documentos, reportes; lectura de pedidos. |
| `SUPPORT` | Clientes y pedidos con **motivo** para datos sensibles; sin costos internos. |

## Matriz de permisos (extracto — versionada en `permission_grant`)

| Acción | OWNER | ADMIN | CATALOG_MANAGER | FINANCE | SUPPORT |
|---|:--:|:--:|:--:|:--:|:--:|
| Ver dashboard | ✔ | ✔ | parcial | ✔ | parcial |
| Crear/editar cliente | ✔ | ✔ | ✖ | ✖ | ✔ |
| Ver datos sensibles cliente (WSP, domicilio) | ✔ | ✔ | ✖ | ✖ | con motivo |
| Ver "cuánto invirtió" (costo/margen) | ✔ | ✔ | ✖ | ✔ | ✖ |
| Crear/editar/publicar producto | ✔ | ✔ | ✔ | ✖ | ✖ |
| Ver costo proveedor | ✔ | ✔ | ✖ (o restringido) | ✔ | ✖ |
| Editar pricing/markup global | ✔ | ✔ | ✖ | ✖ | ✖ |
| Emitir/regenerar documento | ✔ | ✔ | ✖ | ✔ | ✖ |
| Usar herramientas IA | ✔ | ✔ | ✔ | ✖ | ✖ |
| Gestionar usuarios admin | ✔ | ✔ | ✖ | ✖ | ✖ |
| Cambiar configuración de tienda | ✔ | ✔ | ✖ | ✖ | ✖ |

## Motivos de acceso administrativo (auditoría)

Cuando `SUPPORT` (o cualquiera con acceso restringido) accede a datos personales o documentos de un cliente,
se registra en `access_log`:

```txt
actorId, resourceType, resourceId, action, reason, ip, userAgent, timestamp
```

## Contexto de auth para casos de uso

Todo caso de uso recibe un `Actor` tipado (nunca el request crudo):

```ts
type Actor =
  | { kind: 'admin'; userId: string; role: AdminRole; sessionId: string }
  | { kind: 'customer'; customerId: string }        // futuro
  | { kind: 'public' }
  | { kind: 'system'; service: string };            // jobs, webhooks internos
```

El caso de uso valida `actor` contra la policy antes de tocar el dominio. Ver [08](./08-seguridad.md) para
amenazas (BOLA, BFLA) y [31](./31-testing.md) para tests de autorización negativa obligatorios.
