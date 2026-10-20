# Integración de develop con las correcciones de producción

Rama preparada: `fix/integrar-develop-main`.
Directorio de trabajo: `Proyecto-DualCampus-integracion`, junto al repositorio original.
Se combinó origin/main (66004b0) con origin/develop (7dd701e) sin crear commit ni hacer push.
Git conserva un merge pendiente, sin conflictos. Oscar debe crear el commit de integración.

## Resultado

Se incorporan H14-H21, H23 y H24 desde develop: evaluaciones, notas, ausencias,
revisión, devolución, reenvío, publicación, consulta de notas propias, auditoría y materiales.
También se conserva el acceso rápido local de develop, bloqueado en producción.
Se mantienen ESM, Node 22, instalación con dependencias de compilación y el dominio real de la API de main.
Se adaptaron las importaciones nuevas a ESM (.js) y se diferenciaron las claves React de notas y materiales.

## Validación local

- Node 22.23.3, instalación limpia y compilación de web/API aprobadas.
- 128 pruebas de API aprobadas (15 archivos), con PostgreSQL local y esquemas aislados.
- Una prueba de navegador aprobada con Edge; sin la advertencia de claves repetidas tras corregirla.
- API compilada arranca con NODE_ENV=production y --no-experimental-require-module.
- /api/health responde 200; /api/auth/dev-login responde 404 y no emite cookie.
- git diff --check y git diff --cached --check sin errores.
- No se conectó a Neon, no se probó Google real y no se desplegó esta integración.

## Commit y PR

Ejecutar desde esta carpeta de integración, no desde el repositorio original:

```powershell
git status
git diff --cached --stat
git commit -m "merge: integrar develop con correcciones de produccion"
git push -u origin fix/integrar-develop-main
```

PR 1: `fix/integrar-develop-main` hacia `develop`.
Título: Integrar funciones académicas con las correcciones de producción.
Descripción: Integra evaluaciones, notas y materiales de develop con el arranque ESM,
Node 22 y configuración Vercel de main. Adapta las importaciones y corrige claves
repetidas en la vista del alumno. Build, 128 pruebas de API, un E2E y comprobación
local de arranque de producción aprobados. Migraciones 004-010 pendientes en Neon.

Después de revisión independiente y CI aprobada, fusionar con merge commit.
PR 2: `develop` hacia `main`, para publicar la entrega integrada.
No fusionar el PR 2 hasta aplicar las migraciones necesarias.

## Base de datos antes de publicar

Las migraciones 004-010 crean evaluacion, nota y material_curso, y añaden columnas
para envío, devolución, reenvío y publicación. Son aditivas; no borran los datos existentes.
Preparar un punto de recuperación en Neon antes de aplicarlas.

Desde esta carpeta, usando Node 22 y el .env privado que ya existe en la carpeta original:

```powershell
node --env-file="../Proyecto-DualCampus/apps/api/.env" apps/api/scripts/migrar.js
```

Confirmar primero que DATABASE_URL en ese archivo apunta a la base Neon deseada
con la conexión directa y el usuario dualcampus_app. No copiar la conexión al PR.
Una DATABASE_URL definida en la terminal tiene prioridad sobre --env-file.
El runner mostrará el destino con contraseña oculta y aplicará solo migraciones pendientes.
No ejecutar db:reset. No repetir los seeds ni habilitar cuentas nuevamente si ya existen.

Tras publicar, comprobar ambas rutas de salud y recorrer con Google real:
crear evaluación, cargar notas, enviar/revisar/publicar, consultar notas propias y publicar material.
El E2E automatizado cubre configuración académica; los flujos nuevos tienen pruebas de API.
La ruta /api/health/ready heredada comprueba la migración 003: su HTTP 200 por sí solo
no confirma la aplicación de 004-010. Revisar la salida del runner o schema_migraciones.

La documentación no versionada docs/entrega-5 de la carpeta original no se copió
ni se incluyó automáticamente; debe revisarse y actualizarse para reflejar este alcance.
