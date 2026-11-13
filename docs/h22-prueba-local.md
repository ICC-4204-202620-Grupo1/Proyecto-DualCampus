# H22 · Corregir una nota publicada

Rama feature/H22-corregir-nota-publicada, creada desde origin/develop actualizado. Sin migraciones nuevas para H22.

## Flujo local

1. Entrar como Benjamín (administrador), elegir institución, período, sección y abrir una evaluación PUBLICADA.
2. En la fila del alumno, pulsar Corregir nota de…; el formulario aparece debajo de la tabla.
3. Ingresar nueva nota válida (un decimal como máximo), motivo y referencia de la solicitud formal. Confirmar corrección publicada.
4. La nota queda vigente inmediatamente, manteniendo PUBLICADA y la fecha original de publicación. Cerrar el formulario para otra corrección.
5. Abrir Ver auditoría: se conservan valor previo/nuevo, ausencia previa/nueva, alumno, motivo, referencia, autor y fecha. No se reescriben eventos anteriores.
6. Entrar como el alumno: Mis notas publicadas e historial por período muestran el valor vigente. Profesor y ayudante no disponen del formulario administrativo ni pueden usar su ruta.

Una ausencia puede convertirse a una nota numérica; el antecedente de ausencia se conserva. Esta historia no incorpora convertir una nota publicada en ausencia. No aplica correcciones automáticas a datos existentes.

## API y consistencia

POST /api/calificaciones/evaluaciones/:id/notas/:alumnoId/correcciones. JSON: valor (número), motivo (1–2000 caracteres), referencia (1–200), valorPrevio, ausentePrevio y actualizadoEn recibidos al consultar la planilla. No acepta autor desde el cliente.

Exige ADMINISTRADOR vigente, institución activa, evaluación publicada y nota de alumno matriculado en su sección. Valida escala y precisión; rechaza cambio sin modificación. Bloquea evaluación y nota, comprueba que el valor y fecha observados sigan vigentes, actualiza nota y añade evento CORREGIR_NOTA_PUBLICADA en la misma transacción. Una planilla obsoleta responde 409. La consulta de H23 presenta el evento. Un fallo de auditoría revierte la actualización.

## Verificación

npm run build; npm run test:api con TEST_DATABASE_URL apuntando a una base local exclusiva terminada en _test; git diff --check. Suite H22 cubre datos obligatorios, escala, trazabilidad, lectura del alumno/historial, permisos, aislamiento, ausencia previa, concurrencia y rollback.

La base local debe tener las migraciones del equipo hasta 013 si se actualiza desde la antigua versión H24. Revisar el destino local antes de usar npm run db:migrar. No ejecutar db:reset ni sembrar datos ficticios en el entorno del cliente.

## Reversión

Revertir la aplicación conserva notas corregidas e historial. No revertir valores ni borrar eventos automáticamente; cualquier corrección posterior requiere su propia solicitud formal.
