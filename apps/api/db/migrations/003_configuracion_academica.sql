-- J1: claves compuestas impiden referencias cruzadas incluso antes de aplicar RLS.
ALTER TABLE periodo ADD CONSTRAINT periodo_institucion_id UNIQUE (institucion_id, id);
CREATE TABLE curso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES institucion(id),
  periodo_id uuid NOT NULL,
  FOREIGN KEY (institucion_id, periodo_id) REFERENCES periodo(institucion_id, id),
  codigo text NOT NULL CHECK (length(codigo) BETWEEN 1 AND 30),
  nombre text NOT NULL CHECK (length(nombre) BETWEEN 1 AND 150),
  creado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institucion_id, id),
  UNIQUE (institucion_id, periodo_id, id),
  UNIQUE (institucion_id, periodo_id, codigo)
);
CREATE TABLE seccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES institucion(id),
  periodo_id uuid NOT NULL,
  curso_id uuid NOT NULL,
  codigo text NOT NULL CHECK (length(codigo) BETWEEN 1 AND 30),
  creado_por uuid NOT NULL REFERENCES usuario(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institucion_id, id),
  UNIQUE (institucion_id, periodo_id, curso_id, codigo),
  FOREIGN KEY (institucion_id, periodo_id) REFERENCES periodo(institucion_id, id),
  FOREIGN KEY (institucion_id, periodo_id, curso_id) REFERENCES curso(institucion_id, periodo_id, id)
);
CREATE TABLE equipo_docente (
  institucion_id uuid NOT NULL,
  seccion_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  rol rol NOT NULL CHECK (rol IN ('PROFESOR','AYUDANTE')),
  PRIMARY KEY (seccion_id, usuario_id, rol),
  FOREIGN KEY (institucion_id, seccion_id) REFERENCES seccion(institucion_id, id),
  FOREIGN KEY (usuario_id, institucion_id, rol) REFERENCES rol_en_institucion(usuario_id, institucion_id, rol)
);
CREATE UNIQUE INDEX un_profesor_por_seccion ON equipo_docente(seccion_id) WHERE rol = 'PROFESOR';
CREATE TABLE matricula (
  institucion_id uuid NOT NULL,
  seccion_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  rol rol NOT NULL DEFAULT 'ALUMNO' CHECK (rol = 'ALUMNO'),
  creado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (seccion_id, usuario_id),
  FOREIGN KEY (institucion_id, seccion_id) REFERENCES seccion(institucion_id, id),
  FOREIGN KEY (usuario_id, institucion_id, rol) REFERENCES rol_en_institucion(usuario_id, institucion_id, rol)
);
CREATE TABLE evento_academico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institucion_id uuid NOT NULL REFERENCES institucion(id),
  recurso_id uuid NOT NULL,
  actor_id uuid NOT NULL REFERENCES usuario(id),
  accion text NOT NULL,
  datos jsonb NOT NULL DEFAULT '{}',
  creado_en timestamptz NOT NULL DEFAULT now()
);
-- Impide alterar antecedentes desde el rol normal de la aplicación.
CREATE FUNCTION impedir_edicion_evento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora es de solo lectura';
END $$;
CREATE TRIGGER evento_inmutable BEFORE UPDATE OR DELETE ON evento_academico
  FOR EACH ROW EXECUTE FUNCTION impedir_edicion_evento();
DO $$
DECLARE tabla text;
BEGIN
  FOREACH tabla IN ARRAY ARRAY['curso','seccion','equipo_docente','matricula','evento_academico'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tabla);
    EXECUTE format(
      'CREATE POLICY aislamiento ON %I USING (institucion_id = nullif(current_setting(''app.institucion_id'', true), '''')::uuid) WITH CHECK (institucion_id = nullif(current_setting(''app.institucion_id'', true), '''')::uuid)', tabla);
  END LOOP;
END $$;
CREATE INDEX seccion_periodo ON seccion(institucion_id, periodo_id);
CREATE INDEX equipo_usuario ON equipo_docente(usuario_id, institucion_id);
CREATE INDEX matricula_usuario ON matricula(usuario_id, institucion_id);
