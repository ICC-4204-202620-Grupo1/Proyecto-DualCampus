-- H51: programación institucional y trazabilidad de cada ejecución.
CREATE TABLE reporte_programado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES institucion(id),
  creador_id uuid NOT NULL REFERENCES usuario(id),
  periodo_id uuid NOT NULL REFERENCES periodo(id),
  facultad text,
  frecuencia text NOT NULL CHECK (frecuencia IN ('DIARIA', 'SEMANAL', 'MENSUAL')),
  destino_email text NOT NULL,
  estado text NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'CANCELADO')),
  proxima_ejecucion timestamptz NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  cancelado_en timestamptz,
  CHECK (facultad IS NULL OR length(facultad) BETWEEN 1 AND 150)
);
CREATE INDEX reporte_programado_pendientes ON reporte_programado(institucion_id, proxima_ejecucion) WHERE estado = 'ACTIVO';
CREATE TABLE ejecucion_reporte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES institucion(id),
  reporte_id uuid NOT NULL REFERENCES reporte_programado(id),
  estado text NOT NULL CHECK (estado IN ('EJECUTANDO', 'ENVIADO', 'FALLIDO')),
  iniciado_en timestamptz NOT NULL DEFAULT now(),
  terminado_en timestamptz,
  error text
);
CREATE INDEX ejecucion_reporte_reciente ON ejecucion_reporte(reporte_id, iniciado_en DESC);
ALTER TABLE reporte_programado ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporte_programado FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento_reporte_programado ON reporte_programado
  USING (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid)
  WITH CHECK (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid);
ALTER TABLE ejecucion_reporte ENABLE ROW LEVEL SECURITY;
ALTER TABLE ejecucion_reporte FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento_ejecucion_reporte ON ejecucion_reporte
  USING (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid)
  WITH CHECK (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid);
