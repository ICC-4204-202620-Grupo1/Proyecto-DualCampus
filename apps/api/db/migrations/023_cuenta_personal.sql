-- H43 · Cuenta personal verificada, vinculada antes del egreso para la consulta posterior (H44).
-- Pertenece a la persona y no a una institución: no lleva institucion_id ni RLS, igual que usuario.
-- Una persona tiene a lo sumo una cuenta personal y una cuenta personal identifica a una sola persona.
CREATE TABLE cuenta_personal (
  usuario_id     uuid PRIMARY KEY REFERENCES usuario (id) ON DELETE CASCADE,
  google_sub     text NOT NULL UNIQUE,
  email          text NOT NULL UNIQUE CHECK (email = lower(email)),
  verificado_en  timestamptz NOT NULL DEFAULT now()
);
