# H19 · Reenviar evaluación corregida

Rama `feature/H19-reenviar-evaluacion-corregida`, basada en H18 (PR #11). Pendiente de revisión e integración.

## Prueba local

Aplicar `npm run db:migrar`; mantener API y frontend activos y abrir http://localhost:5173.

1. Abrir una evaluación DEVUELTA como ayudante o profesor asignado (también administrador).
2. Ver la observación del profesor y corregir notas o ausencias. Guardar los cambios.
3. Pulsar **Reenviar a revisión**. Solo se habilita con todas las filas resueltas y sin cambios pendientes.
4. Ver estado En revisión y planilla bloqueada. La observación y la fecha del último reenvío permanecen visibles, también al cerrar y reabrir.
5. El alumno sigue sin poder consultar notas ni observaciones antes de publicación.

Para preparar el caso: enviar un borrador completo con H17 y devolverlo con observación mediante H18.

## API y persistencia

`POST /api/calificaciones/evaluaciones/:id/reenviar-revision` con JSON `{}`. Solo admite DEVUELTA; aplica los mismos permisos de equipo e institución que H17. Revalida una nota válida o ausencia explícita por alumno. Bloquea la misma fila que guardado y devolución para serializar operaciones.

Migración aditiva `008_evaluacion_reenvio.sql`: reenviado_por y reenviado_en. El primer enviado_por/enviado_en se conserva; la observación no se borra. Se registra cada reenvío en evento_academico con acción REENVIAR_A_REVISION. Cada devolución anterior conserva su observación en la auditoría aunque una nueva devolución actualice la observación visible.

## Verificación

Compilar con `npm run build`; ejecutar `npm run test:api` con TEST_DATABASE_URL hacia una base exclusiva terminada en `_test`. La suite H19 cubre filas pendientes, corrección, persistencia, primer envío, bloqueo, permisos, privacidad, estados, aislamiento, concurrencia y varios ciclos de devolución/reenvío. Sin variable las pruebas PostgreSQL se omiten.

## Reversión

Revertir el cambio funcional conservando las columnas aditivas y la auditoría. Las evaluaciones EN_REVISION permanecen bloqueadas. La publicación de notas corresponde a H20.
