-- Datos sintéticos para desarrollo local (nunca datos reales de alumnos).
INSERT INTO institucion (nombre) VALUES ('Universidad grande'), ('Instituto de Ciencias de la Salud')
ON CONFLICT (nombre) DO NOTHING;
