import { useEffect, useState } from 'react';
import { api, type SesionEgresado } from '../../lib/api';
import { ListaPeriodos, type Periodo } from './HistorialAcademico';

type HistorialInstitucion = { institucionId: string; institucion: string; periodos: Periodo[] };

/**
 * H44 · Acceso del egresado con su cuenta personal vinculada.
 * Solo consulta (CA2): no hay menú, selector de institución ni acciones de escritura.
 */
export function VistaEgresado({ egresado, onSalir }: { egresado: SesionEgresado; onSalir: () => Promise<void> }) {
  const [historial, setHistorial] = useState<HistorialInstitucion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    api<HistorialInstitucion[]>('/egresado/historial')
      .then(datos => { if (vigente) setHistorial(datos); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [version]);

  async function salir() {
    try { await onSalir(); } catch { setError('No se pudo cerrar la sesión. Reintenta.'); }
  }

  return <>
    <header className="barra"><div className="marca"><span className="marca-logo">D</span>DualCampus</div>
      <div className="barra-usuario"><span>{egresado.nombre}</span><button className="boton-secundario" onClick={salir}>Cerrar sesión</button></div>
    </header>
    <main className="contenido" id="contenido-principal">
      <div className="encabezado"><div>
        <p className="etiqueta">Acceso de egresado · Solo consulta</p>
        <h1>Mis antecedentes académicos</h1>
        <p className="texto-suave">
          Ingresaste con tu cuenta personal <strong>{egresado.emailPersonal}</strong>, vinculada a {egresado.emailInstitucional}
          {egresado.cuentaInstitucionalActiva ? '.' : ', que ya no está activa.'}
        </p>
      </div></div>
      <section className="panel" aria-label="Mi historial académico">
        <div className="encabezado-seccion">
          <div><p className="etiqueta">Historial académico</p><h2>Mi historial académico</h2></div>
          <button type="button" className="boton boton-claro" disabled={cargando} onClick={() => setVersion(v => v + 1)}>
            Actualizar historial
          </button>
        </div>
        {cargando ? <p role="status">Cargando historial…</p> : error ?
          <p role="alert" className="alerta">{error}</p> : historial.length === 0 ?
          <p className="vacio">Sin datos: no encontramos instituciones en que hayas sido alumno. Si crees que es un error, contacta a Registro Curricular de tu institución.</p> :
          historial.map(h => <div key={h.institucionId}>
            <h3>{h.institucion}</h3>
            {h.periodos.length === 0 ? <p className="vacio">Sin datos: no hay períodos académicos en esta institución.</p> :
              <ListaPeriodos periodos={h.periodos} />}
          </div>)}
      </section>
    </main>
    <footer>DualCampus · Primera iteración funcional · Grupo 1</footer>
  </>;
}
