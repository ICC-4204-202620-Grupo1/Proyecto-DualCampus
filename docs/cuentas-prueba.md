# Crear y probar usuarios (cuentas de prueba)

Herramienta para probar la plataforma con distintos roles sin depender de Google ni de un administrador, durante la etapa de pruebas.

Rama `feature/usuarios-prueba`, creada desde `origin/develop`. No requiere migraciones.

## Uso

En el login, pestaña **Institucional**, bajo «Continuar con Google» aparece **Crear y probar usuarios**:

- **Crear cuenta**: usuario (se completa con `@testing.com`), nombre visible opcional, rol (Alumno, Ayudante, Profesor, Director, Administrador o Superadministrador) e institución. El superadministrador no pide institución: recibe automáticamente los roles de administrador y director en todas las instituciones activas. Tras crearla se puede ingresar directamente.
- **Iniciar sesión**: se escribe el correo (o solo el usuario) de una cuenta `@testing.com`, sin contraseña.

Si no hay instituciones activas, se crea primero un superadministrador y se registra una institución desde «Universidades».

## Disponibilidad

Está disponible en todos los entornos, incluido el despliegue, sin configuración. **Mientras exista, cualquier persona que abra la página puede crear un superadministrador** y ver o modificar todas las instituciones, por lo que el despliegue debe usarse solo con datos de prueba.

Para retirarla: eliminar `cuentas-prueba.controller.ts` y `cuentas-prueba.service.ts` (y su registro en `autenticacion.module.ts`), `autorizarCuentaPrueba` de `autenticacion.service.ts`, el componente `CuentasPrueba.tsx` y su botón en `PantallaLogin.tsx`. Las cuentas creadas se identifican por el dominio `@testing.com`.

## Límites

- Solo se crean y solo ingresan cuentas que terminan en `@testing.com`: no sirve para entrar sin contraseña a una cuenta real, aunque exista.
- Una cuenta existente no se vuelve a crear (409). Una cuenta desactivada no obtiene sesión.
- La sesión es la misma que la de Google (cookie `dc_sesion`), así que las reglas de roles e institución activa se aplican igual.
- Las cuentas de prueba quedan en la tabla `usuario`; se identifican por el dominio `@testing.com`.

## API

`GET /api/cuentas-prueba/opciones` · `GET /api/cuentas-prueba/instituciones` · `POST /api/cuentas-prueba` · `POST /api/cuentas-prueba/ingresar`

## Verificación

`npm run build`, suite completa de API con `TEST_DATABASE_URL`, `npm run test:e2e` y `git diff --check`. `apps/api/test/cuentas-prueba.spec.ts` cubre la disponibilidad con configuración de producción, la creación de cada rol, el superadministrador, duplicados, validaciones y el rechazo de cuentas reales. El e2e «crear y probar usuarios desde el login» recorre ambos formularios.
