import { useEffect, useState, type FormEvent } from 'react';
import { api, type Rol } from '../../lib/api';
import { Materiales } from '../materiales/Materiales';
import { ActividadesEntrega } from '../materiales/ActividadesEntrega';
import { MisNotas } from '../calificaciones/MisNotas';
import { Evaluaciones } from '../calificaciones/Evaluaciones';
import { DistribucionNotas } from '../calificaciones/DistribucionNotas';
import { Clases } from './Clases';
import { MiAsistencia } from './MiAsistencia';
import type { DestinoNavegacion } from '../acceso/MenuLateral';
import { AsistenciaAgregada } from './AsistenciaAgregada';
import { AnunciosSeccion } from '../anuncios/AnunciosSeccion';
import { leerPreferencia, guardarPreferencia } from '../acceso/preferencias';
type Curso = {id:string;codigo:string;nombre:string;facultad:string};
type Seccion = {id:string;codigo:string;periodo:string;curso:string;cursoCodigo:string;totalAlumnos:number};
type Persona = {id:string;nombre:string|null;email:string;rol?:string};
type Detalle = {equipo:Persona[];nomina:Persona[];eventos:{id:string;accion:string;fecha:string;autor:string}[]};
type VistaPrevia = {valida:boolean;filas:{fila:number;email:string;motivo:string|null}[]};
type FilaHistorica = {fila:number; identidad:string; curso:string; escala:string; nota:string; motivo:string|null};
const mensaje = (e:unknown) => e instanceof Error ? e.message : 'No se pudo completar la operación';

export function Academico({periodoId,roles,navegacionDestino,usuarioId,institucionId,onNavegar}:{periodoId:string;roles:Rol[];navegacionDestino:DestinoNavegacion;usuarioId:string;institucionId:string;onNavegar:(destino:DestinoNavegacion)=>void}) {
  const claveSeccion = usuarioId + ':' + institucionId + ':' + periodoId + ':seccion';
  const admin=roles.includes('ADMINISTRADOR');
  const [cursos,setCursos]=useState<Curso[]>([]);
  const [secciones,setSecciones]=useState<Seccion[]>([]);
  const [docentes,setDocentes]=useState<Persona[]>([]);
  const [seleccion,setSeleccion]=useState(()=>leerPreferencia(claveSeccion));
  const [curso,setCurso]=useState({codigo:'',nombre:'',facultad:''});
  const [seccion,setSeccion]=useState({cursoId:'',codigo:''});
  const [error,setError]=useState('');
  const [aviso,setAviso]=useState('');
  const [ocupado,setOcupado]=useState(false);
  const [cargando,setCargando]=useState(true);
  const [version,setVersion]=useState(0);
  const [historicoEntrada,setHistoricoEntrada]=useState('');
  const [historicoPrevia,setHistoricoPrevia]=useState<FilaHistorica[]|null>(null);
  useEffect(()=>{
    let vigente=true;
    setCargando(true); setError('');
    Promise.all([
      api<Seccion[]>('/academico/secciones?periodoId='+periodoId),
      admin ? api<Curso[]>('/academico/cursos?periodoId='+periodoId) : Promise.resolve([]),
      admin ? api<Persona[]>('/academico/docentes') : Promise.resolve([]),
    ]).then(([s,c,d])=>{if(vigente){setSecciones(s);setCursos(c);setDocentes(d);}})
      .catch(e=>{if(vigente)setError(mensaje(e));}).finally(()=>{if(vigente)setCargando(false);});
    return ()=>{vigente=false;};
  },[periodoId,admin,version]);
  useEffect(()=>{ if(seleccion) guardarPreferencia(claveSeccion,seleccion); },[seleccion,claveSeccion]);
  useEffect(()=>{ if(secciones.length && seleccion && !secciones.some(s=>s.id===seleccion)) setSeleccion(''); },[secciones,seleccion]);
  useEffect(() => {
    // Al abrir un módulo desde el lateral, se muestra la primera sección disponible
    // si todavía no se eligió una. El usuario siempre puede cambiarla después.
    const requiereSeccion = ['espacio-seccion', 'detalle-seccion', 'modulo-notas', 'distribucion-notas', 'modulo-materiales', 'modulo-entregas', 'modulo-asistencia', 'asistencia-agregada', 'modulo-anuncios'].includes(navegacionDestino);
    if (requiereSeccion && !seleccion && secciones.length) setSeleccion(secciones[0].id);
  }, [navegacionDestino, secciones, seleccion]);
  async function crear(e:FormEvent,tipo:'cursos'|'secciones') {
    e.preventDefault();setOcupado(true);setError('');setAviso('');
    try {
      await api('/academico/'+tipo,'POST',tipo==='cursos'?{...curso,periodoId}:{...seccion,periodoId});
      if(tipo==='cursos')setCurso({codigo:'',nombre:'',facultad:''});else setSeccion({cursoId:'',codigo:''});
      setAviso(tipo==='cursos'?'Curso creado. Ahora puedes registrar su sección.':'Sección creada. Selecciónala para asignar docentes.');
      setVersion(v=>v+1);
    }catch(e){setError(mensaje(e));}finally{setOcupado(false);}
  }
  function validarHistorico(e:FormEvent) {
    e.preventDefault();
    const filas: FilaHistorica[] = historicoEntrada.split(/\r?\n/).slice(1).map((linea, indice) => {
      const [identidad='', curso='', escala='', nota=''] = linea.split(',').map(v => v.trim());
      let motivo: string | null = null;
      if (!identidad || !/^\S+@\S+\.\S+$/.test(identidad)) motivo = 'Identidad inválida: usa un correo institucional.';
      else if (!curso) motivo = 'Curso obligatorio.';
      else if (!/^\d+(\.\d+)?$/.test(escala)) motivo = 'Escala inválida: indica un número entre 1 y 7.';
      else if (Number(escala) < 1 || Number(escala) > 7) motivo = 'Escala fuera de rango (1 a 7).';
      else if (nota && (!/^\d+(\.\d+)?$/.test(nota) || Number(nota) < 1 || Number(nota) > 7)) motivo = 'Nota fuera de rango (1 a 7).';
      return {fila: indice + 2, identidad, curso, escala, nota, motivo};
    }).filter(f => f.identidad || f.curso || f.escala || f.nota);
    setHistoricoPrevia(filas);
  }
  const vistaOferta = navegacionDestino === 'oferta-academica';
  const tituloModulo: Record<string, string> = {
    'espacio-seccion': 'Sección de trabajo',
    'detalle-seccion': 'Equipo y nómina',
    'modulo-notas': roles.every(r=>r==='ALUMNO') ? 'Mis calificaciones' : 'Evaluaciones y notas',
    'distribucion-notas': 'Distribución de notas',
    'modulo-materiales': 'Materiales de clase',
    'modulo-entregas': 'Actividades y entregas',
    'asistencia-agregada': 'Asistencia agregada por sección',
    'modulo-asistencia': roles.every(r=>r==='ALUMNO') ? 'Mi asistencia' : 'Asistencia',
    'modulo-anuncios': 'Anuncios de sección',
  };
  return <section id="oferta-academica" className="panel">
    {!vistaOferta && <div className="encabezado-seccion"><div><p className="etiqueta">Módulo académico</p><h2>{tituloModulo[navegacionDestino] ?? 'Sección'}</h2></div></div>}
    {vistaOferta && <div className="encabezado-seccion"><div><p className="etiqueta">02 · Oferta académica</p><h2>{admin?'Cursos y secciones':'Mis secciones'}</h2></div>
      <span className="insignia">{secciones.length} secciones</span></div>}
    {vistaOferta && admin && <div className="dos-columnas">
      <form onSubmit={e=>crear(e,'cursos')}><h3>Registrar curso</h3>
        <label>Código del curso<input required maxLength={30} placeholder="ICC-4204" value={curso.codigo} onChange={e=>setCurso({...curso,codigo:e.target.value})}/></label>
        <label>Nombre<input required maxLength={150} placeholder="Introducción al software" value={curso.nombre} onChange={e=>setCurso({...curso,nombre:e.target.value})}/></label>
        <label>Facultad<input maxLength={150} placeholder="Ingeniería" value={curso.facultad} onChange={e=>setCurso({...curso,facultad:e.target.value})}/></label>
        <button disabled={ocupado}>Crear curso</button>
      </form>
      <form onSubmit={e=>crear(e,'secciones')}><h3>Abrir sección en este período</h3>
        <label>Curso<select required value={seccion.cursoId} onChange={e=>setSeccion({...seccion,cursoId:e.target.value})}>
          <option value="">Selecciona un curso</option>{cursos.map(c=><option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
        </select></label>
        <label>Código de sección<input required maxLength={30} placeholder="01" value={seccion.codigo} onChange={e=>setSeccion({...seccion,codigo:e.target.value})}/></label>
        <button disabled={ocupado || !cursos.length}>Crear sección</button>
      </form>
      <form onSubmit={validarHistorico}><h3>Validar lote histórico</h3>
        <p className="texto-suave">Pega CSV sin guardar registros. Encabezado requerido: identidad,curso,escala,nota.</p>
        <label>Registros históricos<textarea required rows={5} value={historicoEntrada} onChange={e=>{setHistoricoEntrada(e.target.value);setHistoricoPrevia(null);}} placeholder={'identidad,curso,escala,nota\nalumno@institucion.cl,ICC-4204,7,6.2'}/></label>
        <button disabled={ocupado}>Previsualizar lote</button>
      </form>
    </div>}
    {error && <p className="alerta" role="alert">{error} <button type="button" onClick={()=>setVersion(v=>v+1)}>Reintentar carga</button></p>}
    {aviso && <p className="exito" role="status">{aviso}</p>}
    {vistaOferta && historicoPrevia && <div className="preview" aria-label="Vista previa del lote histórico">
      <h3>Vista previa del lote histórico</h3>
      <p>{historicoPrevia.length} filas · {historicoPrevia.filter(f=>!f.motivo).length} válidas · {historicoPrevia.filter(f=>f.motivo).length} rechazadas</p>
      <div className="tabla-contenedor"><table><thead><tr><th>Fila</th><th>Identidad</th><th>Curso</th><th>Escala</th><th>Nota</th><th>Resultado</th></tr></thead><tbody>
        {historicoPrevia.map(f=><tr key={f.fila}><td>{f.fila}</td><td>{f.identidad}</td><td>{f.curso}</td><td>{f.escala}</td><td>{f.nota || '—'}</td><td>{f.motivo || 'Válida'}</td></tr>)}
      </tbody></table></div>
    </div>}
    {cargando?<p role="status">Cargando secciones…</p>:!error && !secciones.length?<p className="vacio">No hay secciones disponibles en este período.</p>:
      vistaOferta ? <div className="tarjetas-secciones">{secciones.map(s=><button type="button" className={'tarjeta-seccion '+(s.id===seleccion?'seleccionada':'')} key={s.id} onClick={()=>{setSeleccion(s.id);onNavegar('espacio-seccion');}}>
        <span className="etiqueta">{s.cursoCodigo} · Sección {s.codigo}</span><strong>{s.curso}</strong><span>{s.totalAlumnos} alumnos · {s.periodo}</span>
      </button>)}</div> : <label className="selector-periodo">Sección de trabajo<select value={seleccion} onChange={e=>setSeleccion(e.target.value)}>
        <option value="">Selecciona una sección</option>
        {secciones.map(s=><option key={s.id} value={s.id}>{s.cursoCodigo} · {s.curso} · Sección {s.codigo}</option>)}
      </select></label>}
    {seleccion && secciones.some(s=>s.id===seleccion) && !vistaOferta && <div className="ux-espacio">
      <p className="etiqueta">Espacio de trabajo · {secciones.find(s=>s.id===seleccion)?.cursoCodigo}</p>
      <h3>{secciones.find(s=>s.id===seleccion)?.curso} · Sección {secciones.find(s=>s.id===seleccion)?.codigo}</h3>
      <div className="ux-pestanas" role="navigation" aria-label="Herramientas de la sección">
        {([
          ['espacio-seccion','Resumen'],
          ['modulo-notas', roles.every(r=>r==='ALUMNO') ? 'Mis notas' : 'Notas'],
          ['modulo-materiales','Materiales'],
          ['modulo-entregas','Actividades'],
          ['modulo-asistencia','Asistencia'],
          ...(admin ? [['detalle-seccion','Nómina']] : []),
          ...(roles.includes('PROFESOR') ? [['distribucion-notas','Distribución'], ['asistencia-agregada','Asistencia agregada']] : []),
          ...((roles.includes('PROFESOR') || roles.includes('ALUMNO')) ? [['modulo-anuncios','Anuncios']] : []),
        ] as [DestinoNavegacion,string][]).map(([id,etiqueta])=><button key={id} type="button" className={'ux-pestana'+(navegacionDestino===id?' ux-pestana-activa':'')} aria-current={navegacionDestino===id?'page':undefined} onClick={()=>onNavegar(id)}>{etiqueta}</button>)}
      </div>
    </div>}
    {seleccion && secciones.some(s=>s.id===seleccion) && navegacionDestino==='espacio-seccion' && <div className="ux-resumen-seccion">
      <div className="ux-metricas"><div><span>Estudiantes</span><strong>{secciones.find(s=>s.id===seleccion)?.totalAlumnos ?? 0}</strong></div><div><span>Período</span><strong>{secciones.find(s=>s.id===seleccion)?.periodo}</strong></div></div>
      <p className="texto-suave">Selecciona una pestaña para trabajar con esta sección. No necesitas volver a elegir el curso en cada módulo.</p>
      <div className="ux-acciones"><button type="button" onClick={()=>onNavegar('modulo-notas')}>Ver calificaciones</button><button type="button" className="ux-boton-secundario" onClick={()=>onNavegar('modulo-materiales')}>Consultar materiales</button></div>
    </div>}
    {seleccion && !secciones.some(s=>s.id===seleccion) && <p className="alerta">Esta sección ya no está disponible en el período seleccionado.</p>}
    {seleccion && secciones.some(s=>s.id===seleccion) && navegacionDestino === 'detalle-seccion' && admin && <GestionSeccion key={seleccion} id={seleccion} nombre={secciones.find(s=>s.id===seleccion)?.curso+' · Sección '+secciones.find(s=>s.id===seleccion)?.codigo} admin={admin} docentes={docentes} actualizar={()=>setVersion(v=>v+1)}/>}
    {seleccion && secciones.some(s=>s.id===seleccion) && navegacionDestino === 'modulo-notas' && (roles.every(r=>r==='ALUMNO') ? <MisNotas key={seleccion} seccionId={seleccion} /> : <Evaluaciones key={seleccion} seccionId={seleccion} roles={roles} />)}
    {seleccion && secciones.some(s=>s.id===seleccion) && navegacionDestino === 'distribucion-notas' && roles.includes('PROFESOR') && <DistribucionNotas key={seleccion} seccionId={seleccion} />}
    {seleccion && secciones.some(s=>s.id===seleccion) && navegacionDestino === 'modulo-materiales' && <Materiales key={seleccion} seccionId={seleccion} />}
    {seleccion && secciones.some(s=>s.id===seleccion) && navegacionDestino === 'modulo-entregas' && <ActividadesEntrega key={seleccion} seccionId={seleccion} />}
    {seleccion && secciones.some(s=>s.id===seleccion) && navegacionDestino === 'modulo-asistencia' && (roles.every(r=>r==='ALUMNO') ? <MiAsistencia key={seleccion} seccionId={seleccion} /> : <Clases key={seleccion} seccionId={seleccion} roles={roles} />)}
    
    {seleccion &&
      secciones.some(s => s.id === seleccion) &&
      navegacionDestino === 'modulo-anuncios' &&
      (roles.includes('PROFESOR') || roles.includes('ALUMNO')) && (
        <AnunciosSeccion
          key={seleccion}
          seccionId={seleccion}
          puedePublicar={roles.includes('PROFESOR')}
        />
      )}

    {seleccion &&
        secciones.some(s => s.id === seleccion) &&
        navegacionDestino === 'asistencia-agregada' &&
        roles.includes('PROFESOR') && (
          <AsistenciaAgregada
            key={seleccion}
            seccionId={seleccion}
          />
        )}
  </section>;
}

function GestionSeccion({id,nombre,admin,docentes,actualizar}:{id:string;nombre:string;admin:boolean;docentes:Persona[];actualizar:()=>void}) {
  const [detalle,setDetalle]=useState<Detalle|null>(null);
  const [profesor,setProfesor]=useState('');
  const [ayudantes,setAyudantes]=useState<string[]>([]);
  const [entrada,setEntrada]=useState('');
  const [previa,setPrevia]=useState<VistaPrevia|null>(null);
  const [error,setError]=useState('');
  const [aviso,setAviso]=useState('');
  const [ocupado,setOcupado]=useState(false);
  const [version,setVersion]=useState(0);
  const url='/academico/secciones/'+id;
  useEffect(()=>{
    let vigente=true;
    api<Detalle>(url).then(d=>{if(vigente){setDetalle(d);setProfesor(d.equipo.find(x=>x.rol==='PROFESOR')?.id || '');setAyudantes(d.equipo.filter(x=>x.rol==='AYUDANTE').map(x=>x.id));}})
      .catch(e=>{if(vigente)setError(mensaje(e));});
    return ()=>{vigente=false;};
  },[url,version]);
  async function operar(accion:'equipo'|'validar'|'confirmar',e?:FormEvent) {
    e?.preventDefault();setOcupado(true);setError('');setAviso('');
    try {
      const emails=entrada.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
      if(accion==='equipo') {
        await api(url+'/equipo','PUT',{profesorId:profesor,ayudanteIds:ayudantes});
        setAviso('Equipo docente guardado.');setVersion(v=>v+1);
      } else if(accion==='validar') {
        setPrevia(await api<VistaPrevia>(url+'/nomina/validar','POST',{emails}));
      } else {
        const r=await api<{agregados:number;total:number}>(url+'/nomina','POST',{emails});
        setAviso('Nómina guardada: '+r.agregados+' alumnos nuevos; '+r.total+' en total.');
        setPrevia(null);setEntrada('');setVersion(v=>v+1);actualizar();
      }
    }catch(e){setError(mensaje(e));if(accion!=='equipo')setPrevia(null);}
    finally{setOcupado(false);}
  }
  return <div id="detalle-seccion" className="detalle-seccion">
    <p className="etiqueta">03 · Equipo y nómina</p><h2>{nombre}</h2>
    {error && <p role="alert" className="alerta">{error}</p>}
    {aviso && <p role="status" className="exito">{aviso}</p>}
    {!detalle ? <p>Cargando detalle…</p>:<>
      {admin ? <div className="dos-columnas">
        <form onSubmit={e=>operar('equipo',e)}><h3>Equipo docente</h3>
          <label>Profesor<select required value={profesor} onChange={e=>setProfesor(e.target.value)}><option value="">Selecciona un profesor</option>
            {docentes.filter(d=>d.rol==='PROFESOR').map(d=><option key={d.id} value={d.id}>{d.nombre || d.email}</option>)}</select></label>
          <fieldset><legend>Ayudantes</legend>{docentes.filter(d=>d.rol==='AYUDANTE').map(d=><label className="check" key={d.id}>
            <input type="checkbox" checked={ayudantes.includes(d.id)} onChange={e=>setAyudantes(e.target.checked?[...ayudantes,d.id]:ayudantes.filter(x=>x!==d.id))}/>{d.nombre || d.email}
          </label>)}{!docentes.some(d=>d.rol==='AYUDANTE') && <p>No hay ayudantes habilitados.</p>}</fieldset>
          <button disabled={ocupado}>Guardar equipo</button>
        </form>
        <form onSubmit={e=>operar('validar',e)}><h3>Cargar nómina oficial</h3>
          <p className="texto-suave">Pega un correo por línea. Se agregan alumnos habilitados; los existentes se conservan.</p>
          <label>Correos de alumnos<textarea required rows={5} value={entrada} onChange={e=>{setEntrada(e.target.value);setPrevia(null);}} placeholder={'alumno1@institucion.cl\nalumno2@institucion.cl'}/></label>
          <button disabled={ocupado}>Validar nómina</button>
        </form>
      </div>:<p>Equipo: {detalle.equipo.map(d=>(d.nombre || d.email)+' ('+(d.rol || '').toLowerCase()+')').join(', ') || 'Sin asignar'}</p>}
      {previa && <div className="preview"><h3>Vista previa de la carga</h3><p>{nombre} · {previa.filas.length} filas</p><div className="tabla-contenedor"><table><thead><tr><th>Fila</th><th>Correo</th><th>Resultado</th></tr></thead><tbody>
        {previa.filas.map(f=><tr key={f.fila}><td>{f.fila}</td><td>{f.email}</td><td>{f.motivo || 'Válido'}</td></tr>)}
      </tbody></table></div><button type="button" disabled={!previa.valida || ocupado} onClick={()=>operar('confirmar')}>Confirmar carga</button></div>}
      <h3>Nómina de la sección <span className="insignia">{detalle.nomina.length}</span></h3>
      {!detalle.nomina.length?<p className="vacio">Todavía no hay alumnos en la nómina.</p>:<div className="tabla-contenedor"><table><thead><tr><th>Nombre</th><th>Correo institucional</th></tr></thead><tbody>
        {detalle.nomina.map(a=><tr key={a.id}><td>{a.nombre || 'Sin nombre'}</td><td>{a.email}</td></tr>)}
      </tbody></table></div>}
      <details style={{ marginTop: '1.5rem' }}><summary>Actividad de la sección</summary><ul>{detalle.eventos.map(a=><li key={a.id}>{new Date(a.fecha).toLocaleString('es-CL')} · {a.autor} · {a.accion.replaceAll('_',' ').toLowerCase()}</li>)}</ul></details>
    </>}
  </div>;
}
