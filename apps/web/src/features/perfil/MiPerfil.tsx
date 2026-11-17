import { useEffect, useState } from 'react';
import {
  API_URL,
  consultarCuentaPersonal,
  URL_VINCULAR_CUENTA_PERSONAL,
  type CuentaPersonal,
  type UsuarioSesion,
} from '../../lib/api';

/** Mensajes para el ?vinculacion= con que vuelve la API tras verificar la cuenta en Google. */
const RESULTADOS: Record<string, { texto: string; exito?: boolean }> = {
  vinculada: { texto: 'Cuenta personal verificada y vinculada.', exito: true },
  sesion_requerida: { texto: 'Tu sesión venció antes de terminar. Vuelve a iniciar sesión e intenta otra vez.' },
  no_alumno: { texto: 'Solo un alumno puede vincular una cuenta personal.' },
  no_verificada: { texto: 'Google no confirmó el correo de esa cuenta. Usa una cuenta con correo verificado.' },
  cuenta_institucional: { texto: 'Esa es una cuenta institucional. Elige una cuenta personal que conserves al egresar.' },
  cuenta_ocupada: { texto: 'Esa cuenta ya está asociada a otra persona. Elige otra cuenta personal.' },
  fallo: { texto: 'No se pudo verificar la cuenta. Intenta nuevamente.' },
};

/** Lee el resultado de la vinculación sin modificar la URL (se limpia en Inicio). */
export function leerResultadoVinculacion(): string | null {
  return new URLSearchParams(window.location.search).get('vinculacion');
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' });

/** H43 · Perfil del alumno con su cuenta personal para después del egreso. */
export function MiPerfil({ usuario, resultado }: { usuario: UsuarioSesion; resultado: string | null }) {
  const [cuenta, setCuenta] = useState<CuentaPersonal | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    consultarCuentaPersonal()
      .then((r) => { if (vigente) setCuenta(r.cuentaPersonal); })
      .catch((e) => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo cargar tu perfil'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [version]);

  const aviso = resultado ? (RESULTADOS[resultado] ?? RESULTADOS.fallo) : null;

  return <section className="panel" id="mi-perfil">
    <p className="etiqueta">Mi perfil</p>
    <h2>{usuario.nombre}</h2>
    <p className="texto-suave">Cuenta institucional: {usuario.email}</p>

    <div className="detalle-seccion">
      <h3>Cuenta personal para después del egreso</h3>
      <p className="texto-suave">
        Al egresar pierdes tu cuenta institucional. Vincula ahora una cuenta personal de Google para
        conservar el acceso a la consulta de tu historial académico.
      </p>
      {aviso && <p className={aviso.exito ? 'exito' : 'alerta'} role={aviso.exito ? 'status' : 'alert'}>{aviso.texto}</p>}
      {cargando ? <p role="status">Cargando tu cuenta personal…</p>
        : error ? <p className="alerta" role="alert">{error} <button onClick={() => setVersion((v) => v + 1)}>Reintentar</button></p>
        : cuenta ? <p><strong>{cuenta.email}</strong><br /><span className="texto-suave">Verificada el {fecha(cuenta.verificadoEn)}</span></p>
        : <p className="vacio">Todavía no tienes una cuenta personal vinculada.</p>}
      {!cargando && !error && <>
        <div className="perfil-acciones">
          <a className={cuenta ? 'boton boton-claro' : 'boton'} href={URL_VINCULAR_CUENTA_PERSONAL}>
            {cuenta ? 'Cambiar cuenta personal' : 'Vincular cuenta personal'}
          </a>
          {import.meta.env.DEV && <a className="boton boton-claro" href={`${API_URL}/cuenta-personal/dev-vincular?email=personal.demo@example.invalid`}>
            Vincular cuenta personal de prueba (desarrollo)
          </a>}
        </div>
        <p className="texto-suave" style={{ marginTop: '.75rem' }}>
          Google te pedirá elegir la cuenta para confirmar que te pertenece. Tu sesión actual no cambia.
        </p>
      </>}
    </div>
  </section>;
}
