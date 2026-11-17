-- H55: aviso de corrección confirmado, persistido con su evento académico.
CREATE TABLE aviso_correo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES institucion(id),
  evento_id uuid NOT NULL UNIQUE REFERENCES evento_academico(id),
  destinatario_id uuid NOT NULL REFERENCES usuario(id),
  destinatario_email text NOT NULL,
  tipo text NOT NULL CHECK (tipo = 'CORRECCION_NOTA'),
  estado text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','ENVIADO','FALLIDO')),
  intentos integer NOT NULL DEFAULT 0,
  ultimo_error text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  ultimo_intento_en timestamptz,
  enviado_en timestamptz
);
CREATE INDEX aviso_correo_institucion_estado ON aviso_correo(institucion_id, estado);
ALTER TABLE aviso_correo ENABLE ROW LEVEL SECURITY;
ALTER TABLE aviso_correo FORCE ROW LEVEL SECURITY;
CREATE POLICY aislamiento_aviso_correo ON aviso_correo
  USING (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid)
  WITH CHECK (institucion_id = nullif(current_setting('app.institucion_id', true), '')::uuid);
