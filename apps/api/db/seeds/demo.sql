-- Solo alumnos sintéticos para practicar H10/H11; no pueden iniciar Google.
-- Las cuentas de demo con acceso se habilitan por CLI, con aprobación del equipo.
INSERT INTO usuario(email,nombre) VALUES
 ('alumno.demo1@example.invalid','Alumno Demo Uno'),
 ('alumno.demo2@example.invalid','Alumno Demo Dos')
ON CONFLICT (email) DO NOTHING;
INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol)
 SELECT u.id,i.id,'ALUMNO'::rol FROM usuario u CROSS JOIN institucion i
 WHERE u.email IN ('alumno.demo1@example.invalid','alumno.demo2@example.invalid') AND i.nombre='Universidad grande'
ON CONFLICT DO NOTHING;
