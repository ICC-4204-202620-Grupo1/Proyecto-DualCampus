-- H18: observación de devolución y trazabilidad; el historial se conserva en evento_academico.
ALTER TABLE evaluacion
  ADD COLUMN observacion text CHECK (observacion IS NULL OR length(btrim(observacion)) BETWEEN 1 AND 2000),
  ADD COLUMN devuelto_por uuid REFERENCES usuario(id),
  ADD COLUMN devuelto_en timestamptz;
