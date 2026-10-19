# DualCampus — Entrega 5

Primera iteración funcional del Grupo 1 · presentación del 20 de octubre de 2026.

Incremento: acceso con Google e institución activa, permisos en API, períodos,
cursos por período, secciones, equipo docente y nómina con validación/confirmación.
La aplicación persiste en PostgreSQL. Catálogo vigente: **56 historias, 29 MVP y 67 dependencias**.

**Estado:** cambios locales preparados para revisión. No hay commit de esta iteración,
PR nuevo ni producción verificada. El destino de API heredado en vercel.json respondió
404 el 18-10-2026. El equipo debe confirmar proyecto/URL de hosting, PostgreSQL y Google OAuth.

- [Repositorio](https://github.com/ICC-4204-202620-Grupo1/Proyecto-DualCampus)
- [Tablero](https://trello.com/b/V2a6wZ1z/dualcampus)
- [Alcance, decisiones y pendientes](docs/entrega-5/alcance.md)
- [Arquitectura y actualización de documentación del semestre](docs/entrega-5/arquitectura.md)
- [Despliegue y recuperación](docs/entrega-5/despliegue.md)
- [Guion de demo](docs/entrega-5/demo.md)
- [Evidencia por historia y criterio](docs/entrega-5/evidencia.md)
- [Preparación del PR](docs/entrega-5/pr.md) · [Actualización pendiente de Trello](docs/entrega-5/tablero.md)

## Puesta en marcha

Requisitos: Node **22.x** (versión acordada), npm, Docker Desktop iniciado y un cliente
Google OAuth de tipo aplicación web. Frontend React/TypeScript/Vite; API NestJS; PostgreSQL 16.
La verificación final usa Node 22.23.3; CI está configurada con Node 22.
Se realizó también una ejecución previa con Node 24.21.0.

Desde la raíz, en PowerShell:

```powershell
npm ci
Copy-Item apps/api/.env.example apps/api/.env  # solo si todavía no existe
npm run db:up
npm run db:migrar -- --seed
npm run demo:preparar
```

Completar apps/api/.env sin subirlo al repositorio: SESSION_SECRET aleatorio (mínimo 32
caracteres), GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET. APP_URL=http://localhost:5173.
Redirección Google: http://localhost:5173/api/auth/google/callback.

Habilitar únicamente las cuentas de prueba acordadas:

```powershell
npm run usuario:habilitar -- correo.institucional@dominio.cl ADMINISTRADOR "Universidad grande" "Administración Demo"
npm run dev:api
# En otra terminal:
npm run dev:web
```

Abrir http://localhost:5173. Repetir usuario:habilitar para PROFESOR, AYUDANTE, ALUMNO
o DIRECTOR con cuentas de prueba distintas. Para mostrar cambio institucional, habilitar al
administrador y al profesor también en "Instituto de Ciencias de la Salud".

demo:preparar crea dos alumnos sintéticos (alumno.demo1@example.invalid y
alumno.demo2@example.invalid) para cargar nóminas. **No son cuentas Google**.
Para demostrar la vista de alumno se necesita una cuenta Google de prueba habilitada e inscrita.

## Verificación

```powershell
npm run build
docker compose exec -T db psql -U postgres -c "CREATE DATABASE dualcampus_test OWNER dualcampus;"
$env:TEST_DATABASE_URL = 'postgres://dualcampus:dualcampus@localhost:5433/dualcampus_test'
npm run test:api
$env:PLAYWRIGHT_CHANNEL = 'msedge' # Windows con Edge; omitir para Chromium de Playwright
npm run test:e2e
git diff --check
```

Crear dualcampus_test solo una vez. Sin TEST_DATABASE_URL se omiten las pruebas de
integración; no confundirlas con una ejecución completa. Las suites generan esquemas
aislados únicamente dentro de una base cuyo nombre termina en _test.
Para Chromium: npx playwright install chromium. La prueba e2e necesita los puertos
3000 y 5173 libres y la API ya compilada. Firma sesiones solo dentro del harness;
no prueba el proveedor Google real ni instala un acceso simulado en producción.

Si npm falla con UNABLE_TO_VERIFY_LEAF_SIGNATURE en esta instalación de Windows:
usar $env:NODE_USE_SYSTEM_CA='1' antes de npm ci. Mantener la verificación TLS activa.

## Estructura

- apps/web: interfaz y cliente HTTP.
- apps/api/src: autenticación, autorización y gestión académica.
- apps/api/db/migrations: 001 identidad/roles; 002 períodos; 003 cursos/secciones/nómina/auditoría.
- apps/api/test: reglas y API; integración contra PostgreSQL con RLS forzada.
- tests/e2e: recorrido de navegador; scripts/e2e-server.cjs: entorno aislado.
- docs/tarjetas.md, indice-trello.md, dependencias.json y PERT*: catálogo actualizado.
- .github/workflows/ci.yml: compilación y verificaciones del PR.

El resto de los módulos del diseño C4 continúa planificado. No hay todavía calificaciones,
archivos, asistencia, historial, reportería ni correo implementados en esta iteración.
