import { useEffect, useState } from 'react';
import { api, descargarReporteAgregado } from '../../lib/api';

type Motivo = 'grupo_pequeno' | 'unanime' | 'complementaria' | 'sin_datos';
type Valor = { valor: number | null; motivo: Motivo | null };
type Indicadores = {
  alumnos: number | null;
  motivo: Motivo | null;
  promedioNotas: Valor;
  aprobacion: Valor;
  asistencia: Valor;
  distribucion: { motivo: Motivo | null; rangos: { rango: string; cantidad: number | null; motivo: Motivo | null }[] };
};
type Respuesta = {
  periodo: { id: string; nombre: string; fechaInicio: string; fechaFin: string };
  filtros: { facultad: string | null };
  facultades: string[];
  minimoAlumnos: number;
  denominadores: { alumnos: number | null; notas: number | null; asistencia: number | null };
  institucion: Indicadores;
  cursos: (Indicadores & { codigo: string; nombre: string })[];
};
type Programacion = { id: string; periodoId: string; periodo: string; facultad: string | null;
  frecuencia: string; destinoEmail: string; estado: string; proximaEjecucion: string;
  ultimoEstado: string | null; ultimoIntento: string | null; ultimoError: string | null };

const MOTIVOS: Record<Motivo, string> = {
  grupo_pequeno: 'Oculto: menos de cinco alumnos',
  unanime: 'Oculto: revelaría el resultado de cada alumno',
  complementaria: 'Oculto: permitiría deducir otro valor oculto',
  sin_datos: 'Sin datos',
};

function Cifra({ v, sufijo = '' }: { v: Valor; sufijo?: string }) {
  if (v.valor !== null) return <>{v.valor.toLocaleString('es-CL')}{sufijo}</>;
  const texto = MOTIVOS[v.motivo ?? 'sin_datos'];
  return <span className="texto-suave" title={texto}>{v.motivo === 'sin_datos' ? '—' : 'Oculto'}</span>;
}

/**
 * H48 · Indicadores agregados de la institución para el director.
 * La API ya entrega los datos anonimizados; esta vista solo los muestra (CA3).
 */
export function IndicadoresInstitucionales({ periodoId }: { periodoId: string }) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [facultad, setFacultad] = useState('');
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [exportando, setExportando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState('');
  const [programaciones, setProgramaciones] = useState<Programacion[]>([]);
  const [frecuencia, setFrecuencia] = useState('SEMANAL');
  const [guardando, setGuardando] = useState(false);
  const [errorProgramacion, setErrorProgramacion] = useState('');

  async function actualizarProgramaciones() {
    try { setProgramaciones(await api<Programacion[]>('/reporteria/reportes-programados')); }
    catch (e) { setErrorProgramacion(e instanceof Error ? e.message : 'No se pudieron cargar las programaciones.'); }
  }

  useEffect(() => { void actualizarProgramaciones(); }, [version]);

  useEffect(() => {
    let vigente = true;
    setDatos(null);
    setError('');
    const params = new URLSearchParams({ periodoId });
    if (facultad) params.set('facultad', facultad);
    api<Respuesta>('/reporteria/indicadores-institucionales?' + params)
      .then(d => { if (vigente) setDatos(d); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudieron cargar los indicadores.'); });
    return () => { vigente = false; };
  }, [periodoId, facultad, version]);

  if (error) return <section className="panel"><p role="alert" className="alerta">{error} <button type="button" onClick={() => setVersion(v => v + 1)}>Reintentar</button></p></section>;
  if (!datos) return <section className="panel"><p role="status">Cargando indicadores…</p></section>;

  const inst = datos.institucion;
  async function exportar() {
    if (!datos) return;
    setExportando(true);
    setErrorDescarga('');
    try {
      await descargarReporteAgregado(datos.periodo.id, datos.filtros.facultad);
    } catch (e) {
      setErrorDescarga(e instanceof Error ? e.message : 'No se pudo descargar el reporte.');
    } finally {
      setExportando(false);
    }
  }
  async function programar() {
    if (!datos) return;
    setGuardando(true); setErrorProgramacion('');
    try {
      await api('/reporteria/reportes-programados', 'POST', {
        periodoId: datos.periodo.id, facultad: datos.filtros.facultad, frecuencia,
      });
      await actualizarProgramaciones();
    } catch (e) { setErrorProgramacion(e instanceof Error ? e.message : 'No se pudo programar el reporte.'); }
    finally { setGuardando(false); }
  }
  async function cancelar(id: string) {
    setErrorProgramacion('');
    try { await api('/reporteria/reportes-programados/' + encodeURIComponent(id) + '/cancelar', 'POST', {}); await actualizarProgramaciones(); }
    catch (e) { setErrorProgramacion(e instanceof Error ? e.message : 'No se pudo cancelar la programación.'); }
  }
  return <section id="indicadores-institucionales" className="panel" aria-label="Indicadores institucionales">
    <p className="etiqueta">Reportería institucional</p>
    <h2>Indicadores del período {datos.periodo.nombre}</h2>
    <button type="button" className="boton-secundario" disabled={exportando} onClick={() => void exportar()}>
      {exportando ? 'Preparando CSV…' : 'Descargar reporte CSV'}
    </button>
    {errorDescarga && <p className="alerta" role="alert">{errorDescarga}</p>}
    <div className="formulario-fila">
      <label>Facultad
        <select value={facultad} onChange={e => setFacultad(e.target.value)}>
          <option value="">Todas las facultades</option>
          {datos.facultades.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </label>
    </div>
    <p className="texto-suave">Filtro aplicado: {datos.filtros.facultad ?? 'todas las facultades'} · Período: {datos.periodo.nombre}.</p>
    <p className="texto-suave">
      Cifras agregadas, sin nombres ni identificadores. Se ocultan los grupos con menos de {datos.minimoAlumnos} alumnos
      y los valores que revelarían el resultado de alguien. Los totales consideran solo datos publicables.
    </p>

    <div className="tabla-contenedor"><table>
      <caption className="texto-suave">Institución</caption>
      <thead><tr><th>Alumnos</th><th>Promedio de notas</th><th>Notas aprobadas</th><th>Asistencia</th></tr></thead>
      <tbody><tr>
        <td>{inst.alumnos ?? <span className="texto-suave" title={MOTIVOS.grupo_pequeno}>Oculto</span>}</td>
        <td><Cifra v={inst.promedioNotas} /></td>
        <td><Cifra v={inst.aprobacion} sufijo="%" /></td>
        <td><Cifra v={inst.asistencia} sufijo="%" /></td>
      </tr></tbody>
    </table></div>
    <p className="texto-suave">
      Denominadores del total: {datos.denominadores.alumnos ?? 'oculto'} alumnos, {datos.denominadores.notas ?? 'oculto'} notas y {datos.denominadores.asistencia ?? 'oculto'} marcas de asistencia.
    </p>

    <h3>Distribución de notas publicadas</h3>
    {inst.distribucion.motivo ? <p className="vacio">{MOTIVOS[inst.distribucion.motivo]}.</p> :
      <div className="tabla-contenedor"><table>
        <thead><tr>{inst.distribucion.rangos.map(c => <th key={c.rango}>{c.rango}</th>)}</tr></thead>
        <tbody><tr>{inst.distribucion.rangos.map(c => <td key={c.rango}>
          {c.cantidad ?? <span className="texto-suave" title={MOTIVOS[c.motivo ?? 'sin_datos']}>Oculto</span>}
        </td>)}</tr></tbody>
      </table></div>}

    <h3>Por curso</h3>
    {datos.cursos.length === 0 ? <p className="vacio">Sin cursos en este período.</p> :
      <div className="tabla-contenedor"><table>
        <thead><tr><th>Curso</th><th>Alumnos</th><th>Promedio</th><th>Notas aprobadas</th><th>Asistencia</th></tr></thead>
        <tbody>{datos.cursos.map(c => <tr key={c.codigo + c.nombre}>
          <td>{c.codigo} · {c.nombre}</td>
          {c.motivo ? <td colSpan={4} className="texto-suave">{MOTIVOS[c.motivo]}</td> : <>
            <td>{c.alumnos}</td>
            <td><Cifra v={c.promedioNotas} /></td>
            <td><Cifra v={c.aprobacion} sufijo="%" /></td>
            <td><Cifra v={c.asistencia} sufijo="%" /></td>
          </>}
        </tr>)}</tbody>
      </table></div>}
    <p className="texto-suave">Pasa el cursor sobre «Oculto» para ver el motivo.</p>
    <h3>Reportes periódicos</h3>
    <p className="texto-suave">Se enviarán a tu correo institucional los indicadores actualizados con los filtros seleccionados. Cada envío vuelve a comprobar tu permiso y las reglas de privacidad.</p>
    <div className="formulario-fila">
      <label>Frecuencia
        <select value={frecuencia} onChange={e => setFrecuencia(e.target.value)}>
          <option value="DIARIA">Diaria</option><option value="SEMANAL">Semanal</option><option value="MENSUAL">Mensual</option>
        </select>
      </label>
      <button type="button" disabled={guardando} onClick={() => void programar()}>{guardando ? 'Guardando…' : 'Programar reporte'}</button>
    </div>
    {errorProgramacion && <p className="alerta" role="alert">{errorProgramacion}</p>}
    {programaciones.length === 0 ? <p className="vacio">No hay reportes programados.</p> :
      <div className="tabla-contenedor"><table>
        <thead><tr><th>Período y facultad</th><th>Frecuencia</th><th>Destino</th><th>Próxima ejecución</th><th>Último resultado</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>{programaciones.map(p => <tr key={p.id}>
          <td>{p.periodo} · {p.facultad ?? 'Todas'}</td><td>{p.frecuencia.toLowerCase()}</td><td>{p.destinoEmail}</td>
          <td>{p.estado === 'ACTIVO' ? new Date(p.proximaEjecucion).toLocaleString('es-CL') : '—'}</td>
          <td>{p.ultimoEstado ?? 'Aún no ejecutado'}{p.ultimoError ? `: ${p.ultimoError}` : ''}</td>
          <td>{p.estado}</td><td>{p.estado === 'ACTIVO' && <button type="button" onClick={() => void cancelar(p.id)}>Cancelar</button>}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
