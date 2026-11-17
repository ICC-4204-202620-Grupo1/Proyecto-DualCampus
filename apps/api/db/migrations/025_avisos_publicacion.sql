-- H54: permitir avisos individuales de publicación de notas.
ALTER TABLE aviso_correo DROP CONSTRAINT aviso_correo_tipo_check;
ALTER TABLE aviso_correo ADD CONSTRAINT aviso_correo_tipo_check
  CHECK (tipo IN ('CORRECCION_NOTA', 'PUBLICACION_NOTA'));
