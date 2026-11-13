-- H37: historial inmutable de correcciones de asistencia.
CREATE TABLE asistencia_correccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL,
  clase_id uuid NOT NULL,
  alumno_id uuid NOT NULL REFERENCES usuario(id),
  estado_anterior boolean NOT NULL,
  estado_nuevo boolean NOT NULL,
  motivo text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 1 AND 500),
  autor_id uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institucion_id, clase_id) REFERENCES clase(institucion_id, id)
);
ALTER TABLE asistencia_correccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia_correccion FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento ON asistencia_correccion USING (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid)
  WITH CHECK (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid);
