# H44 · Acceder al historial tras el egreso

Rama `feature/H44-historial-egresado`, creada desde `origin/develop`. Depende de H39 (historial por período) y H43 (cuenta personal vinculada). No agrega migraciones: usa `cuenta_personal` (023).

## Decisión de modelo

El egreso se representa con la cuenta institucional inactiva (`usuario.activo = false`). El rol `ALUMNO` en la institución se conserva como antecedente: de él salen las instituciones cuyo historial puede consultar el egresado. Si se quita ese rol, la institución deja de aparecer en la consulta.

## Flujo local

1. Entrar como alumno demo y, en **Mi perfil**, usar **Vincular cuenta personal de prueba (desarrollo)** (H43). Esto crea la cuenta `personal.demo@example.invalid`.
2. Simular el egreso: `UPDATE usuario SET activo = false WHERE email = 'alumno.demo1@example.invalid';`. El ingreso institucional queda rechazado.
3. En la pantalla de inicio, usar **Ingresar como egresado (cuenta personal de prueba)**, que llama a `/api/auth/dev-egresado`. Igual que `dev-login`, responde 404 en producción. Con Google real se usa **Ingresar con mi cuenta personal vinculada** (`/api/auth/egresado`).
4. Se abre **Mis antecedentes académicos**: el historial de cada institución en que fue alumno, sin menú, sin selector de institución y sin acciones.
5. Con una cuenta personal sin vincular, el inicio muestra el mensaje con el canal de asistencia (Registro Curricular).

## Seguridad

- **CA1.** La persona se identifica por el `google_sub` de la cuenta personal, nunca por el correo declarado, y con correo verificado por Google. No se exige `usuario.activo`.
- **CA2.** Se emite una cookie propia, `dc_egresado`, con una audiencia JWT distinta de `dc_sesion`. El guard institucional no la reconoce, por lo que cualquier otra ruta responde 401. Solo `GET /api/egresado/sesion` y `GET /api/egresado/historial` la aceptan (`EgresadoGuard`, que además rechaza todo método que no sea lectura). En cada consulta se vuelve a comprobar que la cuenta sigue vinculada a la misma persona: si se reemplaza (H43), la sesión anterior deja de servir. El historial se lee con RLS en el contexto de cada institución, con la misma consulta de H39.
- **CA3.** Sin vinculación, la API vuelve con `?error=sin_vinculacion` sin emitir sesión, y la interfaz informa el canal de asistencia.

Al ingresar como egresado se borra cualquier `dc_sesion`. Al iniciar sesión institucional se borra `dc_egresado`. El cierre de sesión borra ambas.

## Verificación

`npm run build`, `npm run test:api` y `git diff --check`. La suite `h44-acceso-egresado.spec.ts` cubre el flujo HTTP con Google simulado (CA1, CA2 y CA3) y, con `TEST_DATABASE_URL`, el historial del egresado sobre PostgreSQL con RLS: dos instituciones, cuenta institucional inactiva y sin notas de otro alumno.
