-- El superadministrador administra y consulta todas las universidades activas.
-- Se materializan roles reales (ADMINISTRADOR y DIRECTOR) para que todos los controles
-- existentes, que leen rol_en_institucion, apliquen igual que para cualquier usuario.
-- Las acciones de docente siguen exigiendo pertenecer al equipo docente de la sección.

CREATE FUNCTION roles_de_superadministrador(p_usuario uuid, p_institucion uuid)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO rol_en_institucion (usuario_id, institucion_id, rol)
  SELECT s.usuario_id, i.id, v.rol
    FROM superadministrador s
    JOIN institucion i ON i.activa
    CROSS JOIN (VALUES ('ADMINISTRADOR'::rol), ('DIRECTOR'::rol)) AS v(rol)
   WHERE (p_usuario IS NULL OR s.usuario_id = p_usuario)
     AND (p_institucion IS NULL OR i.id = p_institucion)
  ON CONFLICT DO NOTHING;
$$;

-- Nuevo superadministrador: recibe los roles en todas las universidades activas.
CREATE FUNCTION superadministrador_concedido() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM roles_de_superadministrador(NEW.usuario_id, NULL);
  RETURN NEW;
END $$;
CREATE TRIGGER superadministrador_roles_globales
  AFTER INSERT ON superadministrador
  FOR EACH ROW EXECUTE FUNCTION superadministrador_concedido();

-- Universidad nueva o reactivada: todos los superadministradores reciben los roles en ella.
CREATE FUNCTION institucion_para_superadministradores() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.activa THEN
    PERFORM roles_de_superadministrador(NULL, NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER institucion_roles_superadministradores
  AFTER INSERT OR UPDATE OF activa ON institucion
  FOR EACH ROW EXECUTE FUNCTION institucion_para_superadministradores();

-- Superadministradores ya existentes.
SELECT roles_de_superadministrador(NULL, NULL);
