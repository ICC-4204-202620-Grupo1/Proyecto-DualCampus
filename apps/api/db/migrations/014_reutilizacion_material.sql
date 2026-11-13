-- H26: una copia se prepara como borrador antes de quedar visible en la sección destino.
ALTER TABLE material_curso
  ADD COLUMN estado text NOT NULL DEFAULT 'PUBLICADO' CHECK (estado IN ('BORRADOR','PUBLICADO')),
  ADD COLUMN origen_material_id uuid,
  ADD COLUMN actualizado_en timestamptz NOT NULL DEFAULT now();

ALTER TABLE material_curso ADD CONSTRAINT material_institucion_id UNIQUE (institucion_id,id);
ALTER TABLE material_curso
  ADD CONSTRAINT material_origen_misma_institucion
  FOREIGN KEY (institucion_id,origen_material_id) REFERENCES material_curso(institucion_id,id);

ALTER TABLE material_curso ALTER COLUMN publicado_en DROP NOT NULL;
ALTER TABLE material_curso ADD CONSTRAINT material_estado_publicacion CHECK (
  (estado='PUBLICADO' AND publicado_en IS NOT NULL)
  OR (estado='BORRADOR' AND publicado_en IS NULL)
);

CREATE INDEX material_borrador_por_seccion
  ON material_curso(institucion_id,seccion_id,actualizado_en DESC)
  WHERE estado='BORRADOR';
