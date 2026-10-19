-- H15 · Ingresar notas en borrador (Épica 3: Calificaciones)
-- Registra las notas parciales de los alumnos de una evaluación con control de escala y RLS.

CREATE TABLE nota (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id  uuid NOT NULL REFERENCES institucion (id),
  evaluacion_id   uuid NOT NULL,
  usuario_id      uuid NOT NULL REFERENCES usuario (id),
  valor           numeric(3,1) CHECK (valor IS NULL OR (valor >= 1.0 AND valor <= 7.0)),
  es_ausente      boolean NOT NULL DEFAULT false,
  modificado_por  uuid NOT NULL REFERENCES usuario (id),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institucion_id, id),
  UNIQUE (evaluacion_id, usuario_id),
  FOREIGN KEY (institucion_id, evaluacion_id) REFERENCES evaluacion (institucion_id, id) ON DELETE CASCADE
);

ALTER TABLE nota ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota FORCE ROW LEVEL SECURITY;

CREATE POLICY nota_por_institucion ON nota
  USING (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid)
  WITH CHECK (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid);

CREATE INDEX nota_evaluacion ON nota (institucion_id, evaluacion_id);
CREATE INDEX nota_usuario ON nota (institucion_id, usuario_id);
