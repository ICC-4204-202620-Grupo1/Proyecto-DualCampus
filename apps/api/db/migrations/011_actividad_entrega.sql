-- H27: actividades de entrega independientes de las evaluaciones de notas.
CREATE TABLE actividad_entrega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES institucion(id),
  seccion_id uuid NOT NULL,
  titulo text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 0 AND 200 AND length(btrim(titulo)) > 0),
  instrucciones text NOT NULL CHECK (length(btrim(instrucciones)) BETWEEN 1 AND 10000),
  creado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (institucion_id,seccion_id) REFERENCES seccion(institucion_id,id)
);
ALTER TABLE actividad_entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividad_entrega FORCE ROW LEVEL SECURITY;
CREATE POLICY actividad_por_institucion ON actividad_entrega
  USING (institucion_id=nullif(current_setting('app.institucion_id',true),'')::uuid)
  WITH CHECK (institucion_id=nullif(current_setting('app.institucion_id',true),'')::uuid);
CREATE INDEX actividad_por_seccion ON actividad_entrega(institucion_id,seccion_id,creado_en DESC);
