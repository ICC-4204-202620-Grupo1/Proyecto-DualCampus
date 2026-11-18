import { useEffect, useState, type FormEvent } from 'react';
import {
  crearCuentaPrueba,
  ingresarCuentaPrueba,
  listarInstitucionesPrueba,
  type CuentaPruebaCreada,
  type RolPrueba,
} from '../../lib/api';

const NOMBRE_ROL: Record<RolPrueba, string> = {
  ALUMNO: 'Alumno',
  AYUDANTE: 'Ayudante',
  PROFESOR: 'Profesor',
  DIRECTOR: 'Director',
  ADMINISTRADOR: 'Administrador',
  SUPERADMINISTRADOR: 'Superadministrador',
};

const mensajeDe = (e: unknown) => (e instanceof Error ? e.message : 'No se pudo completar la acción. Intenta nuevamente.');

/** Tras ingresar se recarga la aplicación, que lee la sesión nueva igual que tras volver de Google. */
async function ingresarYEntrar(email: string) {
  await ingresarCuentaPrueba(email);
  window.location.assign('/');
}

/**
 * «Crear y probar usuarios»: crea cuentas @testing.com de cualquier rol sin administrador
 * e ingresa con ellas sin Google ni contraseña. Solo para probar; no es parte de la versión final.
 */
export function CuentasPrueba({ dominio, roles }: { dominio: string; roles: RolPrueba[] }) {
  const [modo, setModo] = useState<'crear' | 'ingresar'>('crear');
  return <section className="cuentas-prueba" aria-label="Crear y probar usuarios">
    <p className="cuentas-prueba-aviso">Solo para pruebas: estas cuentas terminan en {dominio} y no usan contraseña.</p>
    <div className="login-opciones" role="group" aria-label="Acción con cuentas de prueba">
      <button type="button" className={modo === 'crear' ? 'login-opcion activa' : 'login-opcion'}
        aria-pressed={modo === 'crear'} onClick={() => setModo('crear')}>Crear cuenta</button>
      <button type="button" className={modo === 'ingresar' ? 'login-opcion activa' : 'login-opcion'}
        aria-pressed={modo === 'ingresar'} onClick={() => setModo('ingresar')}>Iniciar sesión</button>
    </div>
    {modo === 'crear' ? <CrearCuenta dominio={dominio} roles={roles} /> : <IngresarCuenta dominio={dominio} />}
  </section>;
}

function CrearCuenta({ dominio, roles }: { dominio: string; roles: RolPrueba[] }) {
  const [usuario, setUsuario] = useState('');
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<RolPrueba>('ALUMNO');
  const [institucionId, setInstitucionId] = useState('');
  const [instituciones, setInstituciones] = useState<{ id: string; nombre: string }[] | null>(null);
  const [creada, setCreada] = useState<CuentaPruebaCreada | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const requiereInstitucion = rol !== 'SUPERADMINISTRADOR';

  useEffect(() => {
    let vigente = true;
    listarInstitucionesPrueba()
      .then((lista) => { if (vigente) { setInstituciones(lista); setInstitucionId((id) => id || lista[0]?.id || ''); } })
      .catch((e) => { if (vigente) { setInstituciones([]); setError(mensajeDe(e)); } });
    return () => { vigente = false; };
  }, []);

  async function crear(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setCreada(null);
    setEnviando(true);
    try {
      const cuenta = await crearCuentaPrueba({ usuario, nombre, rol, ...(requiereInstitucion ? { institucionId } : {}) });
      setCreada(cuenta);
      setUsuario('');
      setNombre('');
    } catch (e) {
      setError(mensajeDe(e));
    } finally {
      setEnviando(false);
    }
  }

  async function entrar(email: string) {
    setError('');
    setEnviando(true);
    try { await ingresarYEntrar(email); } catch (e) { setError(mensajeDe(e)); setEnviando(false); }
  }

  const sinInstituciones = requiereInstitucion && instituciones !== null && instituciones.length === 0;

  return <form className="cuentas-prueba-form" onSubmit={crear}>
    <label>Usuario
      <span className="campo-con-sufijo">
        <input value={usuario} onChange={(e) => setUsuario(e.target.value)} required maxLength={64 + dominio.length}
          autoComplete="off" spellCheck={false} placeholder="ana.prueba" aria-describedby="sufijo-prueba" />
        <span id="sufijo-prueba" className="sufijo">{dominio}</span>
      </span>
    </label>
    <label>Nombre visible (opcional)
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={150} placeholder="Ana Prueba" />
    </label>
    <label>Rol
      <select value={rol} onChange={(e) => setRol(e.target.value as RolPrueba)}>
        {roles.map((r) => <option key={r} value={r}>{NOMBRE_ROL[r] ?? r}</option>)}
      </select>
    </label>
    {requiereInstitucion && <label>Institución
      <select value={institucionId} onChange={(e) => setInstitucionId(e.target.value)} required disabled={!instituciones?.length}>
        {instituciones === null && <option value="">Cargando…</option>}
        {instituciones?.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
      </select>
    </label>}
    {sinInstituciones && <p className="login-ayuda">No hay instituciones activas. Crea primero un superadministrador y registra una institución desde «Universidades».</p>}
    {error && <p className="alerta" role="alert">{error}</p>}
    {creada && <div className="exito" role="status">
      Cuenta <strong>{creada.email}</strong> creada como {NOMBRE_ROL[creada.rol] ?? creada.rol}
      {creada.institucion ? ` en ${creada.institucion}` : ''}.
      <button type="button" className="boton login-accion" disabled={enviando} onClick={() => entrar(creada.email)}>
        Ingresar con esta cuenta
      </button>
    </div>}
    <button type="submit" className="boton-claro boton login-accion" disabled={enviando || sinInstituciones}>
      {enviando ? 'Creando…' : 'Crear cuenta de prueba'}
    </button>
  </form>;
}

function IngresarCuenta({ dominio }: { dominio: string }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function ingresar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setEnviando(true);
    try { await ingresarYEntrar(email); } catch (e) { setError(mensajeDe(e)); setEnviando(false); }
  }

  return <form className="cuentas-prueba-form" onSubmit={ingresar}>
    <label>Correo de la cuenta de prueba
      <input type="text" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required
        autoComplete="username" spellCheck={false} placeholder={`ana.prueba${dominio}`} />
    </label>
    <p className="login-ayuda">Sin contraseña. Puedes escribir solo el usuario, sin {dominio}.</p>
    {error && <p className="alerta" role="alert">{error}</p>}
    <button type="submit" className="boton login-accion" disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>
  </form>;
}
