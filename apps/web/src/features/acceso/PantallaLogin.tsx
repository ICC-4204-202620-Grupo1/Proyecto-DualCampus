import { useState } from 'react';
import { URL_INICIAR_SESION } from '../../lib/api';

const MENSAJES: Record<string, string> = {
  no_autorizado:
    'Tu cuenta no está habilitada en DualCampus. Si crees que es un error, contacta a Registro Curricular.',
  fallo_login: 'No se pudo completar el inicio de sesión. Intenta nuevamente.',
};

/** Lee y limpia el ?error= con que vuelve la API tras un intento fallido. */
function leerError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const codigo = params.get('error');
  if (!codigo) return null;
  window.history.replaceState(null, '', window.location.pathname);
  return MENSAJES[codigo] ?? MENSAJES.fallo_login;
}

export function PantallaLogin({ errorServidor }: { errorServidor?: boolean }) {
  const [error] = useState(leerError);

  return (
    <main className="login">
      <div className="login-tarjeta">
        <div className="marca">
          <span className="marca-logo">D</span> DualCampus
        </div>
        <h1>Iniciar sesión</h1>
        <p className="texto-suave">Ingresa con tu cuenta institucional de Google.</p>
        {error && (
          <p className="alerta" role="alert">
            {error}
          </p>
        )}
        {errorServidor && (
          <p className="alerta" role="alert">
            No fue posible contactar al servidor. Intenta más tarde.
          </p>
        )}
        <a className="boton" href={URL_INICIAR_SESION}>
          Continuar con Google
        </a>

        {import.meta.env.DEV && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', textAlign: 'left' }}>
            <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.6rem', fontWeight: 600 }}>
              Acceso local para pruebas (desarrollo):
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <a className="boton boton-secundario" href="/api/auth/dev-login?email=benjamin@dualcampus.test" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}>
                Ingresar como Benjamín (Administrador / Profesor)
              </a>
              <a className="boton boton-secundario" href="/api/auth/dev-login?email=profe@dualcampus.test" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}>
                Ingresar como Profesor Demo
              </a>
              <a className="boton boton-secundario" href="/api/auth/dev-login?email=ayudante@dualcampus.test" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}>
                Ingresar como Ayudante Demo
              </a>
              <a className="boton boton-secundario" href="/api/auth/dev-login?email=alumno.demo1@example.invalid" style={{ fontSize: '0.85rem', padding: '0.5rem 0.75rem' }}>
                Ingresar como Alumno Demo
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
