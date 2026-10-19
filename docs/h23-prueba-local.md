# H23 · Consultar auditoría de calificaciones

Rama feature/H23-consultar-auditoria-calificaciones, basada en H21. Sin migraciones nuevas.

## Recorrido local

Entrar como Benjamín (administrador), seleccionar institución, período, sección y abrir una planilla. Pulsar **Ver auditoría** en **Historial de la evaluación**. Se muestran eventos en orden cronológico con acción, autor, fecha y detalles pertinentes. Actualizar historial vuelve a consultar. Profesor, ayudante y alumno no tienen acceso a esta consulta administrativa.

## API

GET /api/calificaciones/evaluaciones/:id/auditoria. Exige ADMINISTRADOR vigente y evaluación visible en la institución activa (RLS). Recupera tanto eventos directos como creación heredada registrada en la sección, filtrando datos.evaluacionId. No mezcla evaluaciones vecinas. No hay rutas PUT/DELETE; el trigger evento_inmutable impide alterar antecedentes en PostgreSQL.

## Correcciones posteriores (CA3)

La consulta conserva y devuelve datos del evento, incluidos valorPrevio, valorNuevo, motivo y referencia. La interfaz los presenta cuando existen. H22 está pendiente: H23 no habilita correcciones ni inventa antecedentes de notas ya publicadas. El test de CA3 inserta un evento sintético de corrección para verificar su consulta y conservación del evento anterior.

## Verificación

npm run build; npm run test:api con TEST_DATABASE_URL hacia base exclusiva terminada en _test; git diff --check. Suite H23: ciclo completo, autor/fecha, eventos heredados, aislamiento, permisos, ausencia de rutas de edición y protección de base, datos de corrección y separación entre evaluaciones.

## Reversión

Revertir cambios de aplicación. No eliminar ni reescribir eventos existentes.
