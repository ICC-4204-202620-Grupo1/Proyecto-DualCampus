-- H35: una marca por alumno y clase, con autor y fecha de la última edición.
CREATE TABLE asistencia_clase (
  institucion_id uuid NOT NULL,
  clase_id uuid NOT NULL,
  alumno_id uuid NOT NULL REFERENCES usuario(id),
  presente boolean NOT NULL,
  autor_id uuid NOT NULL REFERENCES usuario(id),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (clase_id, alumno_id),
  FOREIGN KEY (institucion_id, clase_id) REFERENCES clase(institucion_id, id)
);
ALTER TABLE asistencia_clase ENABLE ROW LEVEL SECURITY;
ALTER TABLE asistencia_clase FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento ON asistencia_clase USING (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid)
  WITH CHECK (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid);
