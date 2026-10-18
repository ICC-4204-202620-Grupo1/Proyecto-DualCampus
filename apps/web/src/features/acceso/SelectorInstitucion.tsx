import { useEffect, useState } from 'react';
import {
  obtenerInstituciones,
  seleccionarInstitucion,
  type InstitucionAutorizada,
  type UsuarioSesion,
} from '../../lib/api';

/** H02 · Lista solo las instituciones autorizadas y cambia la activa. */
export function SelectorInstitucion({
  usuario,
  onCambio,
}: {
  usuario: UsuarioSesion;
  onCambio: (u: UsuarioSesion) => void;
}) {
  const [instituciones, setInstituciones] = useState<InstitucionAutorizada[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerInstituciones().then(setInstituciones).catch(() => setError('No se pudieron cargar las instituciones'));
  }, []);

  async function cambiar(id: string) {
    setError(null);
    try {
      onCambio(await seleccionarInstitucion(id));
    } catch {
      setError('No se pudo cambiar de institución');
    }
  }

  return (
    <label>
      Institución activa:{' '}
      <select
        aria-label="Institución activa"
        value={usuario.institucionActivaId ?? ''}
        onChange={(e) => cambiar(e.target.value)}
      >
        {!usuario.institucionActivaId && <option value="">Selecciona una institución…</option>}
        {instituciones.map((i) => (
          <option key={i.id} value={i.id}>
            {i.nombre}
          </option>
        ))}
      </select>
      {error && <span role="alert"> {error}</span>}
    </label>
  );
}
