# H33 · Reintentar una carga interrumpida

Rama `feature/H33-reintentar-carga`, creada desde `origin/develop`. Requiere la migración `015_reintento_entrega.sql`.

## Flujo local

1. Entrar como alumno, abrir una sección y ubicar una actividad con condiciones vigentes.
2. Seleccionar un archivo permitido y enviarlo. Cada selección genera una clave de intento que se conserva mientras no haya confirmación.
3. Si el servidor o la red rechazan el envío, la interfaz muestra la causa, conserva el archivo y cambia la acción a **Reintentar envío**.
4. Reintentar. Si el servidor ya había guardado ese mismo intento antes del corte de respuesta, devuelve el comprobante existente sin crear otra entrega ni cambiar su fecha.
5. Si el plazo terminó, el reintento se rechaza y no genera comprobante. Un profesor asignado puede reabrir la actividad cambiando sus condiciones; después el alumno puede reintentar con la misma selección.

## Consistencia

`entrega_archivo.clave_idempotencia` identifica el intento. La actividad se bloquea durante el envío y la restricción existente de una entrega por actividad y alumno sigue siendo la autoridad final. Un mismo intento devuelve la fila ya confirmada; seleccionar otro archivo crea una clave nueva y reemplaza la entrega vigente sin duplicarla.

Las validaciones de matrícula, período de apertura, plazo, formato, contenido y tamaño se ejecutan también en cada reintento. Un rechazo no inserta una entrega y, por tanto, no aparece ningún comprobante.

## Verificación

`npm run build`, suite completa de API y `git diff --check`. La suite H33 cubre reintentos simultáneos idempotentes, causa de rechazo sin comprobante, plazo cerrado y reapertura autorizada, y reemplazo con una selección nueva.
