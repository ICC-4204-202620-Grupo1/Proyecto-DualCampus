import { useEffect, useState, type FormEvent } from 'react';
import { api, type Rol } from '../../lib/api';

type Clase = { id:string; fecha:string; creadoEn:string };
type Alumno = { id:string; nombre:string|null; email:string; presente:boolean; autorId:string|null; actualizadoEn:string|null };
const hoy = () => new Date().toISOString().slice(0, 10);

export function Clases({seccionId, roles}:{seccionId:string;roles:Rol[]}) {
  const puedeCrear = roles.includes('ADMINISTRADOR') || roles.includes('PROFESOR');
  const [clases,setClases] = useState<Clase[]>([]);
  const [fecha,setFecha] = useState(hoy());
  const [error,setError] = useState('');
  const [aviso,setAviso] = useState('');
  const [ocupado,setOcupado] = useState(false);
  const [version,setVersion] = useState(0);
  const [seleccion,setSeleccion] = useState('');
  const [alumnos,setAlumnos] = useState<Alumno[]>([]);
  useEffect(()=>{ let vigente=true; api<Clase[]>(`/academico/secciones/${seccionId}/clases`).then(r=>{if(vigente){setClases(r);if(!seleccion&&r[0])setSeleccion(r[0].id);}}).catch(e=>{if(vigente)setError(e instanceof Error?e.message:'No se pudieron cargar las clases');}); return ()=>{vigente=false;}; },[seccionId,version]);
  useEffect(()=>{if(!seleccion)return;let vigente=true;api<Alumno[]>(`/academico/secciones/${seccionId}/clases/${seleccion}/asistencia`).then(r=>{if(vigente)setAlumnos(r);}).catch(e=>{if(vigente)setError(e instanceof Error?e.message:'No se pudo cargar la asistencia');});return()=>{vigente=false;};},[seccionId,seleccion,version]);
  async function crear(e:FormEvent){e.preventDefault();setOcupado(true);setError('');setAviso('');try{await api(`/academico/secciones/${seccionId}/clases`,'POST',{fecha});setAviso('Clase registrada.');setVersion(v=>v+1);}catch(e){setError(e instanceof Error?e.message:'No se pudo registrar la clase');}finally{setOcupado(false);}}
  async function guardar(){setOcupado(true);setError('');setAviso('');try{await api(`/academico/secciones/${seccionId}/clases/${seleccion}/asistencia`,'PUT',{marcas:alumnos.map(a=>({alumnoId:a.id,presente:a.presente}))});setAviso('Asistencia guardada.');setVersion(v=>v+1);}catch(e){setError(e instanceof Error?e.message:'No se pudo guardar la asistencia');}finally{setOcupado(false);}}
  return <section className="detalle-seccion"><p className="etiqueta">04 · Asistencia</p><h3>Registro de clases</h3>
    {error&&<p className="alerta" role="alert">{error}</p>}{aviso&&<p className="exito" role="status">{aviso}</p>}
    {puedeCrear&&<form onSubmit={crear} className="formulario-linea"><label>Fecha de la clase<input required type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></label><button disabled={ocupado}>Registrar clase</button></form>}
    {!clases.length?<p className="vacio">Todavía no hay clases registradas.</p>:<><label>Clase<select value={seleccion} onChange={e=>setSeleccion(e.target.value)}>{clases.map(c=><option key={c.id} value={c.id}>{c.fecha}</option>)}</select></label><div className="tabla-contenedor"><table><thead><tr><th>Alumno</th><th>Estado</th><th>Última actualización</th></tr></thead><tbody>{alumnos.map(a=><tr key={a.id}><td>{a.nombre||a.email}</td><td>{puedeCrear?<select aria-label={`Estado de ${a.nombre||a.email}`} value={a.presente?'presente':'ausente'} onChange={e=>setAlumnos(xs=>xs.map(x=>x.id===a.id?{...x,presente:e.target.value==='presente'}:x))}><option value="presente">Presente</option><option value="ausente">Ausente</option></select>:a.presente?'Presente':'Ausente'}</td><td>{a.actualizadoEn?new Date(a.actualizadoEn).toLocaleString('es-CL'):'Sin guardar'}</td></tr>)}</tbody></table></div>{puedeCrear&&<button disabled={ocupado||!alumnos.length} onClick={guardar}>Guardar asistencia</button>}</>}
  </section>;
}
