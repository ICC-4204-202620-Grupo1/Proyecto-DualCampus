-- H33: identifica un intento para que repetir una petición interrumpida sea idempotente.
ALTER TABLE entrega_archivo
  ADD COLUMN clave_idempotencia uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE entrega_archivo
  ADD CONSTRAINT entrega_intento_unico
  UNIQUE (institucion_id,actividad_id,alumno_id,clave_idempotencia);
