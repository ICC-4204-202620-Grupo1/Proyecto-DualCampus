-- H45: reversión auditable y reversible de un lote histórico.
ALTER TABLE lote_historico ADD COLUMN revertido_en timestamptz;
ALTER TABLE lote_historico ADD COLUMN revertido_por uuid REFERENCES usuario(id);
ALTER TABLE lote_historico ADD COLUMN motivo_reversion text;
