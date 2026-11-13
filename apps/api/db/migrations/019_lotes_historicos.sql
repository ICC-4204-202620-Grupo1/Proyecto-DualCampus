-- H41: lote histórico validado, responsable y totales. La huella evita duplicados.
CREATE TABLE lote_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES institucion(id),
  huella text NOT NULL,
  filas jsonb NOT NULL,
  total_filas integer NOT NULL CHECK (total_filas >= 0),
  total_validas integer NOT NULL CHECK (total_validas >= 0),
  responsable_id uuid NOT NULL REFERENCES usuario(id),
  confirmado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institucion_id, huella)
);
