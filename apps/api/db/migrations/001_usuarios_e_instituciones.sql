-- H01 · Identidad y roles necesarios para iniciar sesión
-- Una cuenta "habilitada" es un usuario activo con al menos un rol en una institución activa.

CREATE TABLE institucion (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  activa      boolean NOT NULL DEFAULT true,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuario (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE CHECK (email = lower(email)),
  nombre         text,
  google_sub     text UNIQUE,
  activo         boolean NOT NULL DEFAULT true,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  ultimo_acceso  timestamptz
);

CREATE TYPE rol AS ENUM ('ADMINISTRADOR', 'PROFESOR', 'AYUDANTE', 'ALUMNO', 'DIRECTOR');

CREATE TABLE rol_en_institucion (
  usuario_id      uuid NOT NULL REFERENCES usuario (id) ON DELETE CASCADE,
  institucion_id  uuid NOT NULL REFERENCES institucion (id),
  rol             rol  NOT NULL,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, institucion_id, rol)
);
