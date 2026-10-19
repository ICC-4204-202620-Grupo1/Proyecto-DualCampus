import { useCallback, useEffect, useState } from 'react';
import { cerrarSesion, obtenerSesion, type UsuarioSesion } from '../../lib/api';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'anonimo' }
  | { tipo: 'autenticado'; usuario: UsuarioSesion }
  | { tipo: 'error' };

/** Consulta la sesión al cargar la página: así la identidad se conserva al recargar. */
export function useSesion() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    obtenerSesion()
      .then((usuario) => setEstado(usuario ? { tipo: 'autenticado', usuario } : { tipo: 'anonimo' }))
      .catch(() => setEstado({ tipo: 'error' }));
  }, []);

  useEffect(() => {
    const expirar = () => setEstado({ tipo: 'anonimo' });
    window.addEventListener('sesion-expirada', expirar);
    return () => window.removeEventListener('sesion-expirada', expirar);
  }, []);

  const salir = useCallback(async () => {
    await cerrarSesion();
    setEstado({ tipo: 'anonimo' });
  }, []);

  const actualizar = useCallback((usuario: UsuarioSesion) => setEstado({ tipo: 'autenticado', usuario }), []);

  return { estado, salir, actualizar };
}
