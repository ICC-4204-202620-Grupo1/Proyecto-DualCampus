# DualCampus — Entrega 6

Aplicación web de gestión académica: períodos, cursos y secciones, equipo docente, nóminas, materiales, actividades, evaluaciones, notas, asistencia, anuncios e indicadores. El acceso usa cuentas Google habilitadas y los permisos dependen del rol y de la institución activa.

**Para el cliente:** [abrir DualCampus](https://proyecto-dualcampus.vercel.app/) · [manual de inicio y operación](docs/manual-inicio-cliente.md). El manual explica el ingreso y los flujos por rol. Use la aplicación publicada y cuentas autorizadas para trabajar con datos reales; `localhost` y las semillas de demostración son solo para desarrollo.

- [Repositorio](https://github.com/ICC-4204-202620-Grupo1/Proyecto-DualCampus)
- [Tablero](https://trello.com/b/V2a6wZ1z/dualcampus)
- [Integración de ramas](docs/integracion-develop-main.md)

## Ejecutar localmente

Necesita Node.js **22.x**, npm, Docker con Compose (PostgreSQL 16) y un cliente OAuth de Google de tipo **Aplicación web**. Configure en Google la URI de redirección `http://localhost:5173/api/auth/google/callback`.

Desde la raíz del repositorio:

```bash
npm ci
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run db:up
npm run db:migrar
```

En PowerShell use `Copy-Item` en lugar de `cp`. Copie los `.env` solo si aún no existen. Complete `apps/api/.env` con `SESSION_SECRET` (mínimo 32 caracteres), `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. Genere el secreto con:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Los ejemplos ya apuntan a `APP_URL=http://localhost:5173` y PostgreSQL local en el puerto **5433**. La web usa `VITE_API_URL=/api`; Vite redirige `/api` a la API local en el puerto **3000**. No suba archivos `.env` al repositorio.

Para crear una institución inicial **solo en desarrollo**, ejecute `npm run db:migrar -- --seed`. Esta semilla contiene datos de desarrollo: no la use en una base del cliente. Habilite una cuenta Google real en la institución inicial y concédale el permiso inicial de superadministrador si administrará universidades y usuarios desde la interfaz:

```bash
npm run usuario:habilitar -- correo@dominio.cl ADMINISTRADOR "Universidad grande" "Nombre Apellido"
npm run superadmin:habilitar -- correo@dominio.cl
```

El correo debe coincidir con la cuenta usada para entrar con Google. Después, el superadministrador puede crear universidades y registrar usuarios y roles desde la aplicación. `npm run demo:preparar` carga datos sintéticos para una demostración local y es **opcional**.

Inicie la API y la web en terminales separadas:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Abra [http://localhost:5173](http://localhost:5173). Para detener PostgreSQL local use `npm run db:down`.

## Pruebas y cobertura

La API usa **Vitest** y mide cobertura con **`@vitest/coverage-v8`**. La medición incluye `apps/api/src/**/*.ts`, excluye los archivos de prueba y genera un resumen en consola, un informe HTML y un resumen JSON. Estas cifras corresponden a la **API**, no a la interfaz ni a los recorridos E2E. En una ejecución local del 17-11-2026 **sin PostgreSQL**, el resultado fue **34,62 % de sentencias, 28,07 % de ramas, 42,34 % de funciones y 35 % de líneas**; pasaron 121 pruebas y se omitieron 131, principalmente las de integración. Repita la medición con `TEST_DATABASE_URL` para informar la cobertura completa de la entrega.

```bash
npm ci
npm run build
npm run test:api
npm run test:coverage
npm run test:e2e
```

Para incluir las pruebas de integración con PostgreSQL, cree una base separada cuyo nombre termine en `_test` y configure `TEST_DATABASE_URL` antes de `test:api` o `test:coverage`:

```bash
npm run db:up
docker compose exec -T db psql -U postgres -c "CREATE DATABASE dualcampus_test OWNER dualcampus;"
export TEST_DATABASE_URL=postgres://dualcampus:dualcampus@localhost:5433/dualcampus_test
npm run test:coverage
```

En PowerShell use `$env:TEST_DATABASE_URL='postgres://dualcampus:dualcampus@localhost:5433/dualcampus_test'` en lugar de `export`. Cree la base una sola vez. Sin `TEST_DATABASE_URL`, las pruebas de integración se omiten y la cobertura no representa todos los flujos. Abra `apps/api/coverage/index.html` para ver el informe HTML; el resumen legible por herramientas queda en `apps/api/coverage/coverage-summary.json`. El directorio `coverage/` está ignorado por Git. Para E2E, instale Chromium con `npx playwright install chromium`, deje libres los puertos 3000 y 5173 y compile la API antes de ejecutar la suite.

## Estructura

- `apps/web`: interfaz React/TypeScript y cliente HTTP.
- `apps/api/src`: API NestJS, autenticación, permisos y módulos académicos.
- `apps/api/db/migrations`: cambios versionados de PostgreSQL.
- `apps/api/test` y `tests/e2e`: pruebas de API y recorridos de navegador.
- `docs/manual-inicio-cliente.md`: guía para el cliente, sin comandos de desarrollo.
- `.github/workflows/ci.yml`: compilación y pruebas automáticas de los PR.
