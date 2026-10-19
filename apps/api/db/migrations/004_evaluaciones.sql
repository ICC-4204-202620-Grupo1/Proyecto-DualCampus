-- H14 · Crear una evaluación presencial (Épica 3: Calificaciones)
-- Una evaluación pertenece a exactamente una sección y respeta el aislamiento institucional (RLS).

CREATE TABLE evaluacion (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id    uuid NOT NULL REFERENCES institucion (id),
  seccion_id        uuid NOT NULL,
  nombre            text NOT NULL CHECK (length(btrim(nombre)) BETWEEN 1 AND 100),
  fecha             date NOT NULL,
  ponderacion       numeric(5,2) NOT NULL DEFAULT 0 CHECK (ponderacion >= 0 AND ponderacion <= 100),
  escala_minima     numeric(3,1) NOT NULL DEFAULT 1.0,
  escala_maxima     numeric(3,1) NOT NULL DEFAULT 7.0,
  escala_aprobacion numeric(3,1) NOT NULL DEFAULT 4.0,
  estado            text NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR', 'EN_REVISION', 'PUBLICADA', 'DEVUELTA')),
  creado_por        uuid NOT NULL REFERENCES usuario (id),
  creado_en         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institucion_id, id),
  FOREIGN KEY (institucion_id, seccion_id) REFERENCES seccion (institucion_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX evaluacion_seccion_nombre ON evaluacion (seccion_id, lower(btrim(nombre)));

ALTER TABLE evaluacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluacion FORCE ROW LEVEL SECURITY;

CREATE POLICY evaluacion_por_institucion ON evaluacion
  USING (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid)
  WITH CHECK (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid);

CREATE INDEX evaluacion_seccion ON evaluacion (institucion_id, seccion_id);
