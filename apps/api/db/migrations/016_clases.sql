-- H34: registro de clases por sección y fecha.
CREATE TABLE clase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL,
  seccion_id uuid NOT NULL,
  fecha date NOT NULL,
  creado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institucion_id, id),
  UNIQUE (institucion_id, seccion_id, fecha),
  FOREIGN KEY (institucion_id, seccion_id) REFERENCES seccion(institucion_id, id)
);
ALTER TABLE clase ENABLE ROW LEVEL SECURITY;
ALTER TABLE clase FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento ON clase USING (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid)
  WITH CHECK (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid);
CREATE INDEX clase_seccion_fecha ON clase(institucion_id, seccion_id, fecha DESC);
