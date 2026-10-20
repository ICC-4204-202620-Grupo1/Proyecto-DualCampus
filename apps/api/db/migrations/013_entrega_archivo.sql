-- H29: un archivo vigente por alumno y actividad, conservado en PostgreSQL.
CREATE TABLE entrega_archivo (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institucion_id uuid NOT NULL REFERENCES institucion(id),
 actividad_id uuid NOT NULL REFERENCES actividad_entrega(id),
 alumno_id uuid NOT NULL REFERENCES usuario(id),
 nombre_archivo text NOT NULL,
 extension text NOT NULL,
 tipo text NOT NULL,
 contenido bytea NOT NULL,
 tamano_bytes bigint NOT NULL CHECK (tamano_bytes > 0 AND tamano_bytes <= 52428800),
 recibido_en timestamptz NOT NULL DEFAULT now(),
 UNIQUE(actividad_id,alumno_id)
);
ALTER TABLE entrega_archivo ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrega_archivo FORCE ROW LEVEL SECURITY;
CREATE POLICY entrega_archivo_institucion ON entrega_archivo
 USING (institucion_id=nullif(current_setting('app.institucion_id',true),'')::uuid)
 WITH CHECK (institucion_id=nullif(current_setting('app.institucion_id',true),'')::uuid);
CREATE INDEX entrega_archivo_actividad ON entrega_archivo(institucion_id,actividad_id);
