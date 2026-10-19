-- H05 · Período académico. Primer dato académico: pertenece a exactamente una institución.

CREATE TABLE periodo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id  uuid NOT NULL REFERENCES institucion (id),
  nombre          text NOT NULL CHECK (length(btrim(nombre)) BETWEEN 1 AND 100),
  fecha_inicio    date NOT NULL,
  fecha_fin       date NOT NULL,
  creado_por      uuid NOT NULL REFERENCES usuario (id),
  creado_en       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT periodo_fechas_coherentes CHECK (fecha_inicio < fecha_fin)
);

-- Un nombre no se repite dentro de la misma institución (sin distinguir mayúsculas)
CREATE UNIQUE INDEX periodo_nombre_unico ON periodo (institucion_id, lower(btrim(nombre)));

-- Aislamiento por institución (Entrega 3, 3.4.1): solo se ven y crean filas de la
-- institución fijada en app.institucion_id. FORCE aplica también al dueño de la tabla.
-- Nota: un superusuario de PostgreSQL ignora RLS; la API debe conectarse con un rol normal.
ALTER TABLE periodo ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodo FORCE ROW LEVEL SECURITY;
CREATE POLICY periodo_por_institucion ON periodo
  USING (institucion_id = current_setting('app.institucion_id', true)::uuid)
  WITH CHECK (institucion_id = current_setting('app.institucion_id', true)::uuid);
