-- H57: permiso global independiente de los roles locales.
CREATE TABLE superadministrador (
  usuario_id uuid PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  concedido_en timestamptz NOT NULL DEFAULT now()
);
-- La unicidad se comprueba independientemente de mayusculas y espacios exteriores.
CREATE UNIQUE INDEX institucion_nombre_normalizado_unico ON institucion (lower(btrim(nombre)));
