import { useCallback, useEffect, useState } from 'react';
import { cerrarSesion, obtenerSesion, obtenerSesionEgresado, type SesionEgresado, type UsuarioSesion } from '../../lib/api';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'anonimo' }
  | { tipo: 'autenticado'; usuario: UsuarioSesion }
  /** H44: ingreso con la cuenta personal vinculada, solo para consultar el historial. */
  | { tipo: 'egresado'; egresado: SesionEgresado }
  | { tipo: 'error' };

/** Consulta la sesión al cargar la página: así la identidad se conserva al recargar. */
export function useSesion() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    obtenerSesion()
      .then(async (usuario): Promise<Estado> => {
        if (usuario) return { tipo: 'autenticado', usuario };
        const egresado = await obtenerSesionEgresado();
        return egresado ? { tipo: 'egresado', egresado } : { tipo: 'anonimo' };
      })
      .then(setEstado)
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
