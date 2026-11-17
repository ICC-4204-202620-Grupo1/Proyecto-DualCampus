# H43 · Vincular una cuenta personal verificada

Rama `feature/H43-asociar-cuenta-personal`, creada desde `origin/develop`. Requiere la migración `023_cuenta_personal.sql`.

## Flujo local

1. Aplicar la migración: `npm run db:migrar`.
2. Entrar como alumno y abrir **Mi perfil** en el menú lateral. Sin vinculación se muestra «Todavía no tienes una cuenta personal vinculada».
3. **Vincular cuenta personal** abre la selección de cuentas de Google, sin limitarla al dominio institucional. Al volver, el perfil muestra la cuenta y su fecha de verificación. La sesión institucional no cambia.
4. Sin credenciales de Google, en desarrollo se puede usar **Vincular cuenta personal de prueba (desarrollo)**, que llama a `/api/cuenta-personal/dev-vincular`. Igual que `dev-login`, responde 404 en producción.
5. Entrar como otro alumno e intentar vincular la misma cuenta: se rechaza con «Esa cuenta ya está asociada a otra persona».

## Verificación de propiedad

La vinculación reutiliza la redirección ya registrada en Google (`/api/auth/google/callback`), por lo que no requiere cambios en la consola de Google. La cookie OIDC firmada guarda el propósito `vincular` y el usuario que inició el flujo. Al volver de Google se exige:

- la misma sesión institucional vigente que inició el flujo (CA1); si venció o es de otra persona, no se vincula ni se emite sesión;
- `state` y `nonce` válidos y un correo verificado por Google (CA1);
- que la cuenta no sea del dominio institucional ni la cuenta institucional de nadie, y que no esté vinculada a otra persona (CA2).

Una cookie de vinculación no sirve para iniciar sesión y un fallo de vinculación no cierra la sesión institucional.

## Datos

`cuenta_personal` pertenece a la persona y no a una institución: no lleva `institucion_id` ni RLS, igual que `usuario`. La persona siempre sale de la sesión; la API no acepta un `usuarioId` del cliente. `google_sub` y `email` son únicos, de modo que dos vinculaciones simultáneas de la misma cuenta dejan solo una (CA2). Volver a vincular reemplaza la cuenta anterior de la misma persona y la libera.

El ingreso con la cuenta vinculada después del egreso corresponde a H44.

## Verificación

`npm run build`, suite completa de API con `TEST_DATABASE_URL`, `npm run test:e2e` y `git diff --check`. La suite `h43-vincular-cuenta-personal.spec.ts` cubre el flujo HTTP completo con Google simulado y las reglas de la tabla sobre PostgreSQL real, incluida la vinculación simultánea. La prueba e2e recorre **Mi perfil** como alumno y verifica que el profesor no ve el enlace.
