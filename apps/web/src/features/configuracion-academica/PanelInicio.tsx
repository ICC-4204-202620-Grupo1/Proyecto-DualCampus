import { useEffect, useState } from 'react';
import { api, type Periodo, type Rol } from '../../lib/api';
import type { DestinoNavegacion } from '../acceso/MenuLateral';
import { guardarPreferencia, leerPreferencia } from '../acceso/preferencias';

type SeccionResumen = { id: string; codigo: string; curso: string; cursoCodigo: string; periodo: string; totalAlumnos: number };

export function PanelInicio({ roles, periodoId, periodos, cargando, onSeleccionarPeriodo, onNavegar, usuarioId, institucionId }: {
  roles: Rol[];
  periodoId: string;
  periodos: Periodo[];
  cargando: boolean;
  onSeleccionarPeriodo: (id: string) => void;
  onNavegar: (destino: DestinoNavegacion) => void;
  usuarioId: string;
  institucionId: string;
}) {
  const [secciones, setSecciones] = useState<SeccionResumen[]>([]);
  const [cargandoSecciones, setCargandoSecciones] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const esAdmin = roles.includes('ADMINISTRADOR');
  const esDocente = roles.includes('PROFESOR') || roles.includes('AYUDANTE');
  const esAlumno = roles.includes('ALUMNO') && !esAdmin && !esDocente;
  const puedeVerSecciones = esAdmin || esDocente || esAlumno;
  const periodo = periodos.find(p => p.id === periodoId);

  useEffect(() => {
    if (!periodoId || !puedeVerSecciones) { setSecciones([]); return; }
    let vigente = true;
    setCargandoSecciones(true);
    setError('');
    api<SeccionResumen[]>('/academico/secciones?periodoId=' + encodeURIComponent(periodoId))
      .then(datos => { if (vigente) setSecciones(datos); })
      .catch(() => { if (vigente) setError('No pudimos cargar las secciones de este período.'); })
      .finally(() => { if (vigente) setCargandoSecciones(false); });
    return () => { vigente = false; };
  }, [periodoId, puedeVerSecciones, version]);

  function abrirSeccion(id: string) {
    guardarPreferencia(usuarioId + ':' + institucionId + ':' + periodoId + ':seccion', id);
    onNavegar('espacio-seccion');
  }

  const seccionPreferida = leerPreferencia(usuarioId + ':' + institucionId + ':' + periodoId + ':seccion');
  const elegida = secciones.find(s => s.id === seccionPreferida) ?? secciones[0];
  return <section className="panel ux-inicio" aria-label="Inicio de DualCampus">
    <div className="ux-titulo-panel">
      <div>
        <p className="etiqueta">Tu espacio de trabajo</p>
        <h2>{esAdmin ? 'Resumen de gestión académica' : esDocente ? 'Tus secciones y herramientas' : esAlumno ? 'Tu actividad académica' : 'Consulta institucional'}</h2>
        <p className="texto-suave">Accede directamente a lo que necesitas, sin buscar entre varios formularios.</p>
      </div>
      <label className="ux-selector-compacto">Período académico
        <select value={periodoId} disabled={cargando || !periodos.length} onChange={e=>onSeleccionarPeriodo(e.target.value)}>
          {periodos.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </label>
    </div>
    {cargando ? <p role="status">Cargando períodos…</p> : !periodos.length ? <div className="vacio">Sin datos. Todavía no hay períodos académicos para esta institución.</div> : <>
      <div className="ux-metricas">
        <div><span>Período seleccionado</span><strong>{periodo?.nombre ?? 'Sin selección'}</strong></div>
        {puedeVerSecciones && <div><span>{esAlumno ? 'Mis cursos' : 'Secciones disponibles'}</span><strong>{cargandoSecciones ? '…' : secciones.length}</strong></div>}
        <div><span>Calendario</span><strong className="ux-metrica-fecha">{periodo?.fechaInicio ?? '—'} / {periodo?.fechaFin ?? '—'}</strong></div>
      </div>
      <div className="ux-acciones">
        <button type="button" onClick={()=>onNavegar('calendario-periodo')} className="ux-boton-secundario">Consultar calendario</button>
        {esAdmin && <button type="button" onClick={()=>onNavegar('periodos-academicos')} className="ux-boton-secundario">Administrar períodos</button>}
        {puedeVerSecciones && <button type="button" onClick={()=>onNavegar('oferta-academica')} className="ux-boton-secundario">{esAdmin ? 'Administrar cursos' : 'Ver todas mis secciones'}</button>}
      </div>
      {puedeVerSecciones && <>
        <div className="ux-titulo-lista"><h3>{esAlumno ? 'Mis cursos' : 'Secciones del período'}</h3><span className="insignia">{secciones.length}</span></div>
        {error && <p className="alerta" role="alert">{error} <button type="button" onClick={()=>setVersion(v=>v+1)}>Reintentar</button></p>}
        {cargandoSecciones ? <p role="status">Cargando secciones…</p> : !error && !secciones.length ? <p className="vacio">No hay secciones disponibles para este período.</p> :
        <div className="ux-lista-secciones">{secciones.map(s=><button key={s.id} type="button" onClick={()=>abrirSeccion(s.id)} className="ux-tarjeta-curso">
          <span className="etiqueta">{s.cursoCodigo} · Sección {s.codigo}</span>
          <strong>{s.curso}</strong><span>{s.totalAlumnos} estudiantes</span>
          <b>Abrir espacio de trabajo →</b>
        </button>)}</div>}
        {elegida && <div className="ux-acceso-rapido"><strong>Continuar con {elegida.curso}</strong><button type="button" onClick={()=>abrirSeccion(elegida.id)}>Abrir sección →</button></div>}
      </>}
    </>}
  </section>;
}
