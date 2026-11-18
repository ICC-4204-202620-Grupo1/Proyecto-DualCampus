-- Nota corregida: las vistas de notas buscan la última corrección de cada nota publicada
-- (evento CORREGIR_NOTA_PUBLICADA) para mostrar el valor anterior junto al nuevo.
CREATE INDEX evento_academico_recurso_accion ON evento_academico (recurso_id, accion, creado_en DESC);
