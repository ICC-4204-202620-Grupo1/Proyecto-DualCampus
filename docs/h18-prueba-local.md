# H18 · Devolver evaluación observada

Rama `feature/H18-devolver-evaluacion-observada`, basada en H17 (PR #10). Pendiente de revisión e integración. H19 todavía no está implementada.

## Preparación y prueba local

Aplicar `npm run db:migrar` con la base local iniciada. Mantener `npm run dev:api` y `npm run dev:web` activos; abrir http://localhost:5173.

1. Usar una cuenta de profesor asignado o administrador. Elegir sección y abrir una evaluación en revisión (enviar un borrador completo con H17 si hace falta).
2. Escribir el comentario obligatorio y pulsar **Devolver evaluación**. Un comentario vacío, compuesto solo por espacios o superior a 2000 caracteres se rechaza en API. La interfaz limita la longitud.
3. Verificar estado DEVUELTA, observación y fecha. Cerrar y reabrir: los datos persisten.
4. Entrar como ayudante asignado: ver la observación y corregir notas o ausencias; guardar conserva el estado DEVUELTA y la observación.
5. Entrar como alumno: no puede consultar notas ni observaciones de una evaluación sin publicar.
6. Un profesor ajeno o ayudante no puede devolver. Un docente ajeno tampoco puede corregir.

## API y persistencia

`POST /api/calificaciones/evaluaciones/:id/devolver` con JSON `{ "observacion": "Revisar la ausencia del alumno" }`.

Solo admite EN_REVISION; exige profesor asignado en equipo_docente o administrador institucional. Bloquea la fila de evaluación para serializar devoluciones y guardados concurrentes. Migración aditiva `007_evaluacion_devolucion.sql`: observacion, devuelto_por y devuelto_en. Auditoría `DEVOLVER_EVALUACION` conserva observación y fecha; no se borran eventos anteriores.

La lectura autorizada de la planilla devuelve `puedeDevolver`, observación, autor y fecha. El cliente usa el permiso calculado en el servidor para mostrar la acción. Las correcciones solo se admiten en BORRADOR o DEVUELTA. El reenvío de DEVUELTA queda para H19.

## Verificación

`npm run build`, `npm run test:api` con TEST_DATABASE_URL hacia base exclusiva terminada en `_test`, y `git diff --check`. La suite H18 verifica comentario, persistencia, correcciones del ayudante, estados, permisos, aislamiento, privacidad y doble devolución simultánea. Sin TEST_DATABASE_URL se omiten pruebas PostgreSQL.

## Reversión

Revertir los cambios de aplicación conservando las columnas aditivas y la auditoría; revisar evaluaciones DEVUELTA antes de desplegar una versión que no permita corregirlas. No eliminar datos de devolución.
