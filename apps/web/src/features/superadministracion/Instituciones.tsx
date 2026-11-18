import { useEffect, useState, type FormEvent } from 'react';
import { crearInstitucionGlobal, listarInstitucionesGlobales, type InstitucionGlobal } from '../../lib/api';

export function Instituciones() {
  const [instituciones, setInstituciones] = useState<InstitucionGlobal[]>([]);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [recargar, setRecargar] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCargando(true); setError('');
    listarInstitucionesGlobales().then(datos => { if (vigente) setInstituciones(datos); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo cargar el listado'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [recargar]);
  async function crear(e: FormEvent) {
    e.preventDefault();setError('');setGuardando(true);
    try {
      const creada = await crearInstitucionGlobal(nombre);
      setInstituciones(actual => [...actual, creada].sort((a,b) => a.nombre.localeCompare(b.nombre, 'es')));
      setNombre('');
    } catch(e) { setError(e instanceof Error ? e.message : 'No se pudo crear la universidad'); }
    finally { setGuardando(false); }
  }
  return <section className="panel" id="instituciones" aria-label="Administracion global de universidades">
    <p className="etiqueta">Administración global · H57</p>
    <h2>Universidades</h2>
    <p className="texto-suave">Registra nuevas instituciones. Los superadministradores reciben automáticamente los roles de administrador y director en cada universidad activa.</p>
    <form className="formulario-fila" onSubmit={crear}>
      <label>Nombre de la universidad
        <input required minLength={3} maxLength={120} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre de la universidad" />
      </label>
      <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Crear universidad'}</button>
    </form>
    {error && <p role="alert" className="alerta">{error} <button type="button" onClick={() => setRecargar(n=>n+1)}>Reintentar</button></p>}
    <h3>Instituciones registradas</h3>
    {cargando ? <p role="status">Cargando universidades…</p> : !instituciones.length ? <p className="vacio">No hay universidades registradas.</p> :
      <div className="tabla-scroll"><table><thead><tr><th>Universidad</th><th>Estado</th><th>Registrada</th></tr></thead><tbody>
        {instituciones.map(i => <tr key={i.id}><td>{i.nombre}</td><td>{i.activa ? 'Activa' : 'Inactiva'}</td><td>{new Date(i.creadoEn).toLocaleDateString('es-CL')}</td></tr>)}
      </tbody></table></div>}
  </section>;
}
