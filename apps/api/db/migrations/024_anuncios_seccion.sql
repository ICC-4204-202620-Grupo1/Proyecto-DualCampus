CREATE TABLE anuncio_seccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL,
  seccion_id uuid NOT NULL,
  titulo text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 200),
  mensaje text NOT NULL CHECK (length(btrim(mensaje)) BETWEEN 1 AND 5000),
  publicado_por uuid NOT NULL REFERENCES usuario(id),
  publicado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institucion_id, seccion_id) REFERENCES seccion(institucion_id, id)
);

ALTER TABLE anuncio_seccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE anuncio_seccion FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento ON anuncio_seccion
  USING (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid)
  WITH CHECK (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid);
CREATE INDEX anuncio_seccion_fecha ON anuncio_seccion(institucion_id, seccion_id, publicado_en DESC, id DESC);
