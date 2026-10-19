-- H20: trazabilidad de la publicación oficial.
ALTER TABLE evaluacion
  ADD COLUMN publicado_por uuid REFERENCES usuario(id),
  ADD COLUMN publicado_en timestamptz;
