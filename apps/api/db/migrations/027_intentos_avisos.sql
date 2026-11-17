-- H56: un intento por envío y bloqueo explícito de los envíos en curso.
ALTER TABLE aviso_correo DROP CONSTRAINT aviso_correo_estado_check;
ALTER TABLE aviso_correo ADD CONSTRAINT aviso_correo_estado_check
  CHECK (estado IN ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'FALLIDO'));
CREATE TABLE intento_aviso_correo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES institucion(id),
  aviso_id uuid NOT NULL REFERENCES aviso_correo(id),
  numero integer NOT NULL CHECK (numero > 0),
  resultado text NOT NULL CHECK (resultado IN ('ENVIADO', 'FALLIDO')),
  fecha timestamptz NOT NULL DEFAULT now(),
  error text,
  UNIQUE (aviso_id, numero)
);
CREATE INDEX intento_aviso_correo_por_aviso ON intento_aviso_correo(aviso_id, fecha DESC);
ALTER TABLE intento_aviso_correo ENABLE ROW LEVEL SECURITY;
ALTER TABLE intento_aviso_correo FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento_intento_aviso ON intento_aviso_correo
  USING (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid)
  WITH CHECK (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid);
