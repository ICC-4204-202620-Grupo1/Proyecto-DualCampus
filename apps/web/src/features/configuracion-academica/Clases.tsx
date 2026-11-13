import { useEffect, useState, type FormEvent } from 'react';
import { api, type Rol } from '../../lib/api';

type Clase = { id:string; fecha:string; creadoEn:string };
const hoy = () => new Date().toISOString().slice(0, 10);

export function Clases({seccionId, roles}:{seccionId:string;roles:Rol[]}) {
  const puedeCrear = roles.includes('ADMINISTRADOR') || roles.includes('PROFESOR');
  const [clases,setClases] = useState<Clase[]>([]);
  const [fecha,setFecha] = useState(hoy());
  const [error,setError] = useState('');
  const [aviso,setAviso] = useState('');
  const [ocupado,setOcupado] = useState(false);
  const [version,setVersion] = useState(0);
  useEffect(()=>{ let vigente=true; api<Clase[]>(`/academico/secciones/${seccionId}/clases`).then(r=>{if(vigente)setClases(r);}).catch(e=>{if(vigente)setError(e instanceof Error?e.message:'No se pudieron cargar las clases');}); return ()=>{vigente=false;}; },[seccionId,version]);
  async function crear(e:FormEvent){e.preventDefault();setOcupado(true);setError('');setAviso('');try{await api(`/academico/secciones/${seccionId}/clases`,'POST',{fecha});setAviso('Clase registrada.');setVersion(v=>v+1);}catch(e){setError(e instanceof Error?e.message:'No se pudo registrar la clase');}finally{setOcupado(false);}}
  return <section className="detalle-seccion"><p className="etiqueta">04 · Asistencia</p><h3>Registro de clases</h3>
    {error&&<p className="alerta" role="alert">{error}</p>}{aviso&&<p className="exito" role="status">{aviso}</p>}
    {puedeCrear&&<form onSubmit={crear} className="formulario-linea"><label>Fecha de la clase<input required type="date" value={fecha} onChange={e=>setFecha(e.target.value)}/></label><button disabled={ocupado}>Registrar clase</button></form>}
    {!clases.length?<p className="vacio">Todavía no hay clases registradas.</p>:<div className="tabla-contenedor"><table><thead><tr><th>Fecha</th><th>Registrada</th></tr></thead><tbody>{clases.map(c=><tr key={c.id}><td>{c.fecha}</td><td>{new Date(c.creadoEn).toLocaleString('es-CL')}</td></tr>)}</tbody></table></div>}
  </section>;
}
