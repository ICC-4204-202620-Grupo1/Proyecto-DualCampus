import { useEffect, useState } from 'react';
import { obtenerContexto, type ContextoInstitucion, type UsuarioSesion } from '../../lib/api';
import { Periodos } from '../configuracion-academica/Periodos';
import { SelectorInstitucion } from './SelectorInstitucion';

/** Vista provisoria tras iniciar sesión: identidad, institución activa y su contexto. */
export function Inicio({
  usuario,
  onSalir,
  onCambio,
}: {
  usuario: UsuarioSesion;
  onSalir: () => void;
  onCambio: (u: UsuarioSesion) => void;
}) {
  const [contexto, setContexto] = useState<ContextoInstitucion | null>(null);

  // Cada cambio de institución vuelve a consultar con el nuevo contexto
  useEffect(() => {
    setContexto(null);
    if (usuario.institucionActivaId) obtenerContexto().then(setContexto).catch(() => setContexto(null));
  }, [usuario.institucionActivaId]);

  return (
    <div style={{ padding: '1rem', fontFamily: 'system-ui, sans-serif' }}>
      <p>
        <strong>DualCampus</strong> · {usuario.nombre} ({usuario.email}) ·{' '}
        <button onClick={onSalir}>Cerrar sesión</button>
      </p>
      <p>
        <SelectorInstitucion usuario={usuario} onCambio={onCambio} />
      </p>
      <hr />
      {!usuario.institucionActivaId && <p>Elige una institución para continuar.</p>}
      {contexto && (
        <div>
          <h2>Trabajando en: {contexto.institucion}</h2>
          <p>Tus roles aquí: {contexto.roles.join(', ')}</p>
          <p>
            <small>Contexto de las consultas (app.institucion_id): {contexto.institucionContexto}</small>
          </p>
          <hr />
          <Periodos
            institucionId={contexto.institucionActivaId}
            esAdministrador={contexto.roles.includes('ADMINISTRADOR')}
          />
        </div>
      )}
    </div>
  );
}
