-- H12: conservar la matricula y sus referencias historicas, sin eliminar notas ni asistencia.
ALTER TABLE matricula ADD COLUMN estado text NOT NULL DEFAULT 'ACTIVA'
  CHECK (estado IN ('ACTIVA','RETIRADA'));
ALTER TABLE matricula ADD COLUMN retirado_fecha date;
ALTER TABLE matricula ADD COLUMN retirado_referencia text;
ALTER TABLE matricula ADD COLUMN retirado_por uuid REFERENCES usuario(id);
ALTER TABLE matricula ADD COLUMN retirado_en timestamptz;
ALTER TABLE matricula ADD CONSTRAINT matricula_retiro_integridad CHECK (
  (estado='ACTIVA' AND retirado_fecha IS NULL AND retirado_referencia IS NULL AND retirado_por IS NULL AND retirado_en IS NULL)
  OR
  (estado='RETIRADA' AND retirado_fecha IS NOT NULL AND retirado_referencia IS NOT NULL
    AND length(btrim(retirado_referencia)) BETWEEN 1 AND 300 AND retirado_por IS NOT NULL AND retirado_en IS NOT NULL)
);
CREATE INDEX matricula_activa_por_seccion ON matricula(institucion_id,seccion_id) WHERE estado='ACTIVA';
