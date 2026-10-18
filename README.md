# DualCampus — Entrega 4

Propuesta de proceso del Grupo 1 para validar y aplicar en el proyecto.

- Repositorio indicado por el equipo: https://github.com/ICC-4204-202620-Grupo1/Proyecto-DualCampus
- Tablero configurado: https://trello.com/b/V2a6wZ1z/dualcampus

## Estado de la configuración

Trello fue verificado con 38 historias en Refinamiento, 8 épicas de referencia,
114 criterios de aceptación sin marcar y 42 dependencias enlazadas. Hay seis
estados de trabajo y una lista de referencia que no cuenta en WIP.

## Estructura del repositorio

Monorepo con npm workspaces (Node 22):

```
apps/
  web/   React + TypeScript + Vite (interfaz)
         src/features/   una carpeta por épica
         src/components/ componentes compartidos
         src/lib/        cliente de la API
  api/   NestJS + TypeScript (API)
         src/modules/    un módulo por componente C4: autenticacion, autorizacion,
                         gestion-academica, calificaciones, material-entregas,
                         reporteria, auditoria
         src/common/     guards, decoradores e interceptores transversales
         db/migrations/  SQL de PostgreSQL 16 (tablas y Row-Level Security)
docs/    proceso, tarjetas y PERT
```

## Desarrollo local

```
npm install
npm run db:up                     # PostgreSQL 16 en Docker
npm run db:migrar -- --seed       # crea tablas e instituciones de prueba
npm run usuario:habilitar -- tu.correo@gmail.com PROFESOR "Universidad grande" "Tu Nombre"
npm run dev:api                   # http://localhost:3000/api/health
npm run dev:web                   # http://localhost:5173
npm run test:api                  # pruebas de la API (Vitest)
```

Antes, copiar `apps/api/.env.example` a `apps/api/.env` y completar:

- `SESSION_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`: en Google Cloud Console → APIs y servicios →
  Credenciales → ID de cliente OAuth → *Aplicación web*. URI de redirección autorizada:
  `http://localhost:5173/api/auth/google/callback` (y la de producción, `https://<web>/api/auth/google/callback`).
- `DOMINIOS_PERMITIDOS`: vacío en desarrollo; en producción, los dominios de Google Workspace de las instituciones.

Solo inician sesión las cuentas habilitadas: usuario activo con al menos un rol en una institución activa.

La API debe conectarse a PostgreSQL con un rol **no superusuario**: un superusuario se salta el
Row-Level Security que aísla los datos por institución. El `docker-compose` local ya crea el rol
`dualcampus` así; si levantaste la base antes de este cambio, recréala con `npm run db:reset`
(borra los datos locales) y vuelve a correr `db:migrar` y `usuario:habilitar`.

## Despliegue en Vercel

- **Web:** `vercel.json` en la raíz construye `apps/web` y publica `apps/web/dist`. Las rutas `/api/*`
  se reenvían a la API, así web y API comparten origen y la cookie de sesión es de primera parte.
- **API:** segundo proyecto de Vercel desde este repositorio, Root Directory `apps/api` (NestJS se detecta
  solo). Variables: `NODE_ENV=production`, `APP_URL` (URL de la web), `DATABASE_URL` (Postgres hosteado,
  p. ej. Neon desde el Marketplace de Vercel), `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `DOMINIOS_PERMITIDOS`. Luego ajustar en `vercel.json` el destino del rewrite `/api` con la URL de la API
  y correr `npm run db:migrar` apuntando a esa base.

## Archivos

- CONTRIBUTING.md: ramas, PR, Conventional Commits, DoR y DoD propuestos.
- .github/pull_request_template.md: plantilla de pull request.
- docs/proceso-tablero.md: políticas y transiciones del tablero.
- docs/tarjetas.md: 38 historias con contexto, criterios y enlace real a Trello.
- docs/indice-trello.md: enlaces a épicas e historias.
- docs/PERT.mmd: red de precedencias editable.
- docs/PERT_E1.svg a docs/PERT_E8.svg: diagramas por épica.
- docs/dependencias.json: catálogo de dependencias.


## Pendientes de cierre

1. Incorporar los archivos, confirmar main como rama predeterminada y disponer de develop.
2. Configurar reglas de revisión y protección compatibles con el plan.
3. Confirmar acceso del profesor y ayudante a GitHub y Trello.
4. Ratificar el proceso, asignar responsables y resolver decisiones aplicables.
5. Registrar PR revisados y fusionados; comprobar la plantilla en un PR posterior.
6. Actualizar informe y presentación con configuración y evidencia reales.

