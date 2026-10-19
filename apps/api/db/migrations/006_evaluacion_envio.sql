-- H17 · Enviar evaluación a revisión (Épica 3: Calificaciones)
-- CA3: Se conservan autor y fecha del envío.
-- Agrega columnas de auditoría de envío a la tabla evaluacion.

ALTER TABLE evaluacion
  ADD COLUMN IF NOT EXISTS enviado_por  uuid REFERENCES usuario (id),
  ADD COLUMN IF NOT EXISTS enviado_en   timestamptz;
