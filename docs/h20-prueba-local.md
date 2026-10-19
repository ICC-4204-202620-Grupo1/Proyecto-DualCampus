# H20 · Publicar notas aprobadas

Rama `feature/H20-publicar-notas-aprobadas`, basada en H19. Pendiente de revisión e integración.

## Prueba local

Aplicar `npm run db:migrar` y abrir http://localhost:5173 con API y frontend activos.

1. Entrar como **Profesor Demo**, asignado a la sección (Profesor Prueba). Un administrador sin asignación de profesor no puede publicar.
2. Abrir una evaluación EN_REVISION. Si está DEVUELTA, corregir, guardar y reenviar mediante H19.
3. En la planilla aparece **Publicar notas aprobadas**, con aviso de que los resultados serán oficiales.
4. Pulsar el botón: el estado pasa a PUBLICADA; se muestra la fecha y no se permite editar, devolver ni publicar nuevamente.
5. Cerrar y reabrir: persisten estado, autor y fecha. La API devuelve a un alumno inscrito solo su propia nota publicada; la pantalla específica del alumno queda para H21.

No se publican automáticamente evaluaciones existentes al aplicar la migración.

## API

`POST /api/calificaciones/evaluaciones/:id/publicar`, JSON `{}`. Exige rol PROFESOR vigente y asignación como PROFESOR en equipo_docente de la sección, dentro de la institución activa. Solo admite EN_REVISION. Revalida la nómina actual para impedir publicar filas sin nota válida ni ausencia. Si faltan filas, devolver para corregir.

Migración aditiva 009_evaluacion_publicacion.sql con publicado_por/publicado_en. Evento PUBLICAR_EVALUACION en la misma transacción. Publicación, devolución y guardado bloquean la fila de evaluación para serializar transiciones.

## Verificación

`npm run build`; `npm run test:api` con TEST_DATABASE_URL hacia base exclusiva terminada en `_test`; `git diff --check`.

Suite H20: profesor asignado, denegación de ayudante/alumno/administrador/profesor ajeno, estados, persistencia, bloqueo, aislamiento, acceso únicamente a nota propia, nómina modificada y publicación concurrente.

## Reversión

Revertir la aplicación conservando las columnas y eventos. No convertir automáticamente evaluaciones PUBLICADA en borrador ni eliminar la evidencia. La corrección de una nota ya publicada corresponde a H22.
