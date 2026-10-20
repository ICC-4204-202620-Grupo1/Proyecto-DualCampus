# H21 · Consultar notas propias publicadas

Rama feature/H21-consultar-notas-propias, basada en H20. No agrega migraciones.

## Prueba local

Entrar con **Alumno Demo**, seleccionar Universidad grande, período y sección. La sección muestra **Mis notas publicadas** con evaluación, fecha, ponderación, nota o ausencia, resultado y fecha de publicación. Actualizar notas vuelve a consultar al servidor.

Si no hay resultados oficiales aparece un estado vacío. BORRADOR, EN_REVISION y DEVUELTA no aparecen. El alumno no ve nómina ni controles docentes. Publicar desde Profesor Demo mediante H20 si se necesita preparar un caso; no se publican evaluaciones automáticamente.

## API y seguridad

GET /api/calificaciones/secciones/:id/mis-notas. Exige rol ALUMNO vigente y matrícula en la sección dentro de la institución activa. La identidad se toma únicamente de la sesión; alumnoId/usuarioId enviados por el cliente no seleccionan a otro alumno. Devuelve solo notas propias PUBLICADA y no incluye correos, observaciones ni auditoría docente. El listado heredado de evaluaciones también filtra estados no publicados para alumnos sin acceso docente.

## Verificación

npm run build; npm run test:api con TEST_DATABASE_URL hacia base exclusiva terminada en _test; git diff --check. Suite H21 cubre resultado propio, ausencias, estados ocultos, manipulación de identificadores, roles, matrícula, autenticación y aislamiento.

## Reversión

Revertir el cambio de aplicación; no se alteran tablas ni resultados oficiales.
