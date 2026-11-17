-- H49 · Facultad de pertenencia para filtrar la reportería institucional.
ALTER TABLE curso ADD COLUMN facultad text NOT NULL DEFAULT 'General'
  CHECK (length(btrim(facultad)) BETWEEN 1 AND 150);

CREATE INDEX curso_institucion_periodo_facultad
  ON curso (institucion_id, periodo_id, facultad);
