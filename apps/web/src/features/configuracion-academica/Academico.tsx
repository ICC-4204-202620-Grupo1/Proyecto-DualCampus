import { useEffect, useState, type FormEvent } from 'react';
import { api, type Rol } from '../../lib/api';
import { MisNotas } from '../calificaciones/MisNotas';
import { Evaluaciones } from '../calificaciones/Evaluaciones';
type Curso = {id:string;codigo:string;nombre:string};
type Seccion = {id:string;codigo:string;periodo:string;curso:string;cursoCodigo:string;totalAlumnos:number};
type Persona = {id:string;nombre:string|null;email:string;rol?:string};
type Detalle = {equipo:Persona[];nomina:Persona[];eventos:{id:string;accion:string;fecha:string;autor:string}[]};
type VistaPrevia = {valida:boolean;filas:{fila:number;email:string;motivo:string|null}[]};
const mensaje = (e:unknown) => e instanceof Error ? e.message : 'No se pudo completar la operación';

export function Academico({periodoId,roles}:{periodoId:string;roles:Rol[]}) {
  const admin=roles.includes('ADMINISTRADOR');
  const [cursos,setCursos]=useState<Curso[]>([]);
  const [secciones,setSecciones]=useState<Seccion[]>([]);
  const [docentes,setDocentes]=useState<Persona[]>([]);
  const [seleccion,setSeleccion]=useState('');
  const [curso,setCurso]=useState({codigo:'',nombre:''});
  const [seccion,setSeccion]=useState({cursoId:'',codigo:''});
  const [error,setError]=useState('');
  const [aviso,setAviso]=useState('');
  const [ocupado,setOcupado]=useState(false);
  const [cargando,setCargando]=useState(true);
  const [version,setVersion]=useState(0);
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
  async function crear(e:FormEvent,tipo:'cursos'|'secciones') {
    e.preventDefault();setOcupado(true);setError('');setAviso('');
    try {
      await api('/academico/'+tipo,'POST',tipo==='cursos'?{...curso,periodoId}:{...seccion,periodoId});
      if(tipo==='cursos')setCurso({codigo:'',nombre:''});else setSeccion({cursoId:'',codigo:''});
      setAviso(tipo==='cursos'?'Curso creado. Ahora puedes registrar su sección.':'Sección creada. Selecciónala para asignar docentes.');
      setVersion(v=>v+1);
    }catch(e){setError(mensaje(e));}finally{setOcupado(false);}
  }
  return <section className="panel">
    <div className="encabezado-seccion"><div><p className="etiqueta">02 · Oferta académica</p><h2>{admin?'Cursos y secciones':'Mis secciones'}</h2></div>
      <span className="insignia">{secciones.length} secciones</span></div>
    {admin && <div className="dos-columnas">
      <form onSubmit={e=>crear(e,'cursos')}><h3>Registrar curso</h3>
        <label>Código del curso<input required maxLength={30} placeholder="ICC-4204" value={curso.codigo} onChange={e=>setCurso({...curso,codigo:e.target.value})}/></label>
        <label>Nombre<input required maxLength={150} placeholder="Introducción al software" value={curso.nombre} onChange={e=>setCurso({...curso,nombre:e.target.value})}/></label>
        <button disabled={ocupado}>Crear curso</button>
      </form>
      <form onSubmit={e=>crear(e,'secciones')}><h3>Abrir sección en este período</h3>
        <label>Curso<select required value={seccion.cursoId} onChange={e=>setSeccion({...seccion,cursoId:e.target.value})}>
          <option value="">Selecciona un curso</option>{cursos.map(c=><option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
        </select></label>
        <label>Código de sección<input required maxLength={30} placeholder="01" value={seccion.codigo} onChange={e=>setSeccion({...seccion,codigo:e.target.value})}/></label>
        <button disabled={ocupado || !cursos.length}>Crear sección</button>
      </form>
    </div>}
    {error && <p className="alerta" role="alert">{error} <button type="button" onClick={()=>setVersion(v=>v+1)}>Reintentar carga</button></p>}
    {aviso && <p className="exito" role="status">{aviso}</p>}
    {cargando?<p role="status">Cargando secciones…</p>:!error && !secciones.length?<p className="vacio">No hay secciones disponibles en este período.</p>:
      <div className="tarjetas-secciones">{secciones.map(s=><button type="button" className={'tarjeta-seccion '+(s.id===seleccion?'seleccionada':'')} key={s.id} onClick={()=>setSeleccion(s.id)}>
        <span className="etiqueta">{s.cursoCodigo} · Sección {s.codigo}</span><strong>{s.curso}</strong><span>{s.totalAlumnos} alumnos · {s.periodo}</span>
      </button>)}</div>}
    {seleccion && !roles.every(r=>r==='ALUMNO') && <GestionSeccion key={seleccion} id={seleccion} nombre={secciones.find(s=>s.id===seleccion)?.curso+' · Sección '+secciones.find(s=>s.id===seleccion)?.codigo} admin={admin} docentes={docentes} roles={roles} actualizar={()=>setVersion(v=>v+1)}/>}
    {seleccion && roles.every(r=>r==='ALUMNO') && <div className="detalle-seccion"><p className="exito">Estás en la nómina de esta sección.</p><MisNotas key={seleccion} seccionId={seleccion} /></div>}
  </section>;
}

function GestionSeccion({id,nombre,admin,docentes,roles,actualizar}:{id:string;nombre:string;admin:boolean;docentes:Persona[];roles:Rol[];actualizar:()=>void}) {
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
  return <div className="detalle-seccion">
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
      <Evaluaciones seccionId={id} roles={roles} />
      <details style={{ marginTop: '1.5rem' }}><summary>Actividad de la sección</summary><ul>{detalle.eventos.map(a=><li key={a.id}>{new Date(a.fecha).toLocaleString('es-CL')} · {a.autor} · {a.accion.replaceAll('_',' ').toLowerCase()}</li>)}</ul></details>
    </>}
  </div>;
}
