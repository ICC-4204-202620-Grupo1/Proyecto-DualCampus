-- H28: condiciones de entrega; H27 sigue siendo independiente de calificaciones.
ALTER TABLE actividad_entrega
  ADD COLUMN apertura_en timestamptz,
  ADD COLUMN cierre_en timestamptz,
  ADD COLUMN formatos_permitidos text[],
  ADD COLUMN tamano_maximo_mb integer;

ALTER TABLE actividad_entrega
  ADD CONSTRAINT actividad_fechas_entrega CHECK (
    (apertura_en IS NULL AND cierre_en IS NULL)
    OR (apertura_en IS NOT NULL AND cierre_en IS NOT NULL AND apertura_en < cierre_en)
  ),
  ADD CONSTRAINT actividad_formatos_entrega CHECK (
    formatos_permitidos IS NULL OR
    (cardinality(formatos_permitidos) BETWEEN 1 AND 4 AND
     formatos_permitidos <@ ARRAY['pdf','docx','txt','png']::text[])
  ),
  ADD CONSTRAINT actividad_tamano_entrega CHECK (
    tamano_maximo_mb IS NULL OR tamano_maximo_mb BETWEEN 1 AND 50
  ),
  ADD CONSTRAINT actividad_configuracion_completa CHECK (
    (apertura_en IS NULL AND cierre_en IS NULL AND formatos_permitidos IS NULL AND tamano_maximo_mb IS NULL)
    OR (apertura_en IS NOT NULL AND cierre_en IS NOT NULL AND formatos_permitidos IS NOT NULL AND tamano_maximo_mb IS NOT NULL)
  );
