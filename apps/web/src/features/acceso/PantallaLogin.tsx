import { useEffect, useState } from 'react';
import { consultarOpcionesCuentasPrueba, URL_INGRESAR_EGRESADO, URL_INICIAR_SESION, type OpcionesCuentasPrueba } from '../../lib/api';
import { CuentasPrueba } from './CuentasPrueba';

/** H44 · CA3: canal al que se deriva a quien no puede ingresar con su cuenta personal. */
const CANAL_ASISTENCIA = 'Registro Curricular de tu institución';

const MENSAJES: Record<string, string> = {
  no_autorizado:
    'Tu cuenta no está habilitada en DualCampus. Si crees que es un error, contacta a Registro Curricular.',
  fallo_login: 'No se pudo completar el inicio de sesión. Intenta nuevamente.',
  sin_vinculacion:
    `Esa cuenta personal no está vinculada a ningún alumno de DualCampus. Para recuperar el acceso a tu historial, contacta a ${CANAL_ASISTENCIA} e indica tu nombre y el correo institucional que usabas.`,
  no_verificada:
    `Google no confirmó el correo de esa cuenta. Verifícalo en Google e intenta nuevamente, o contacta a ${CANAL_ASISTENCIA}.`,
};

/** Lee y limpia el ?error= con que vuelve la API tras un intento fallido. */
function leerError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const codigo = params.get('error');
  if (!codigo) return null;
  window.history.replaceState(null, '', window.location.pathname);
  return MENSAJES[codigo] ?? MENSAJES.fallo_login;
}

const ACCESOS_DEMO = [
  { nombre: 'Administrador y profesor', detalle: 'Benjamín', ruta: '/api/auth/dev-login?email=benjamin@dualcampus.test' },
  { nombre: 'Profesor', detalle: 'Profesor Demo', ruta: '/api/auth/dev-login?email=profe@dualcampus.test' },
  { nombre: 'Ayudante', detalle: 'Ayudante Demo', ruta: '/api/auth/dev-login?email=ayudante@dualcampus.test' },
  { nombre: 'Alumno', detalle: 'Alumno Demo', ruta: '/api/auth/dev-login?email=alumno.demo1@example.invalid' },
  { nombre: 'Egresado', detalle: 'Cuenta personal de prueba', ruta: '/api/auth/dev-egresado?email=personal.demo@example.invalid' },
];

export function PantallaLogin({ errorServidor }: { errorServidor?: boolean }) {
  const [error] = useState(leerError);
  const [tipoAcceso, setTipoAcceso] = useState<'institucional' | 'egresado'>('institucional');
  // Cuentas de prueba @testing.com: el botón aparece cuando la API entrega sus opciones.
  const [cuentasPrueba, setCuentasPrueba] = useState<OpcionesCuentasPrueba | null>(null);
  const [pruebasAbiertas, setPruebasAbiertas] = useState(false);
  useEffect(() => {
    let vigente = true;
    consultarOpcionesCuentasPrueba().then((o) => { if (vigente) setCuentasPrueba(o); }).catch(() => {});
    return () => { vigente = false; };
  }, []);

  return (
    <main className="login login-renovado">
      <div className="login-presentacion" aria-hidden="true">
        <div className="marca"><span className="marca-logo">D</span> DualCampus</div>
        <p className="login-pretitulo">TU ESPACIO ACADÉMICO</p>
        <h1>Todo tu semestre, en un solo lugar.</h1>
        <p>Consulta tus cursos, calificaciones y materiales sin perder el contexto de tu institución.</p>
        <div className="login-beneficios">
          <span>✓ Cursos y secciones</span>
          <span>✓ Notas y actividades</span>
          <span>✓ Materiales y asistencia</span>
        </div>
      </div>
      <div className="login-tarjeta login-tarjeta-renovada">
        <div className="marca login-marca-movil"><span className="marca-logo">D</span> DualCampus</div>
        <p className="etiqueta">BIENVENIDO A DUALCAMPUS</p>
        <h1>Iniciar sesión</h1>
        <p className="texto-suave">Selecciona el tipo de cuenta con el que ingresarás.</p>
        {error && <p className="alerta" role="alert">{error}</p>}
        {errorServidor && <p className="alerta" role="alert">No fue posible contactar al servidor. Intenta más tarde.</p>}
        <div className="login-opciones" role="group" aria-label="Tipo de cuenta">
          <button type="button" className={tipoAcceso === 'institucional' ? 'login-opcion activa' : 'login-opcion'}
            aria-pressed={tipoAcceso === 'institucional'} onClick={() => setTipoAcceso('institucional')}>
            Institucional
          </button>
          <button type="button" className={tipoAcceso === 'egresado' ? 'login-opcion activa' : 'login-opcion'}
            aria-pressed={tipoAcceso === 'egresado'} onClick={() => setTipoAcceso('egresado')}>
            Egresados
          </button>
        </div>
        {tipoAcceso === 'institucional' ? <section className="login-metodo" aria-label="Ingreso institucional">
          <h2>Cuenta de la universidad</h2>
          <p className="texto-suave">Para alumnos, profesores, ayudantes y administradores con acceso institucional.</p>
          <a className="boton login-accion" href={URL_INICIAR_SESION}>Continuar con Google</a>
          {cuentasPrueba && <>
            <button type="button" className="boton boton-claro login-accion-secundaria" aria-expanded={pruebasAbiertas}
              onClick={() => setPruebasAbiertas((v) => !v)}>
              Crear y probar usuarios
            </button>
            {pruebasAbiertas && <CuentasPrueba dominio={cuentasPrueba.dominio} roles={cuentasPrueba.roles} />}
          </>}
        </section> : <section className="login-metodo" aria-label="Ingreso de egresados">
          <h2>Cuenta personal vinculada</h2>
          <p className="texto-suave">Para egresados que vincularon previamente su correo personal y desean consultar su historial.</p>
          <a className="boton login-accion" href={URL_INGRESAR_EGRESADO}>Ingresar como egresado</a>
          <p className="login-ayuda">¿No tienes tu cuenta vinculada? Contacta a Registro Curricular de tu institución.</p>
        </section>}
        {import.meta.env.DEV && <details className="login-desarrollo">
          <summary>Accesos de prueba <span className="login-dev-marca">Solo desarrollo</span></summary>
          <p className="texto-suave">Estos accesos de prueba no aparecen en producción.</p>
          <div className="login-demo-lista">
            {ACCESOS_DEMO.map(acceso => <a key={acceso.ruta} href={acceso.ruta} className="login-demo-acceso">
              <span><strong>{acceso.nombre}</strong><small>{acceso.detalle}</small></span>
              <span aria-hidden="true">→</span>
            </a>)}
          </div>
        </details>}
        <p className="login-pie">Acceso seguro a la plataforma académica.</p>
      </div>
    </main>
  );
}
