-- H24: almacenamiento transaccional de documentos pequeños del piloto.
CREATE TABLE material_curso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES institucion(id),
  seccion_id uuid NOT NULL,
  titulo text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 200),
  nombre_archivo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('application/pdf','text/plain')),
  contenido bytea NOT NULL CHECK (octet_length(contenido) BETWEEN 1 AND 1048576),
  publicado_por uuid NOT NULL REFERENCES usuario(id),
  publicado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institucion_id,seccion_id) REFERENCES seccion(institucion_id,id)
);
ALTER TABLE material_curso ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_curso FORCE ROW LEVEL SECURITY;
CREATE POLICY material_por_institucion ON material_curso
  USING (institucion_id=nullif(current_setting('app.institucion_id',true),'')::uuid)
  WITH CHECK (institucion_id=nullif(current_setting('app.institucion_id',true),'')::uuid);
CREATE INDEX material_por_seccion ON material_curso(institucion_id,seccion_id,publicado_en);
