-- H19: preservar el primer envío y registrar autor/fecha del último reenvío.
ALTER TABLE evaluacion
  ADD COLUMN reenviado_por uuid REFERENCES usuario(id),
  ADD COLUMN reenviado_en timestamptz;
