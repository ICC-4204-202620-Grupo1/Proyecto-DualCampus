import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Resumen = { presentes:number; consideradas:number; proporcion:number|null; totalClases:number; clases:{id:string;fecha:string;estado:string;actualizadoEn:string|null}[] };
export function MiAsistencia({seccionId}:{seccionId:string}) {
  const [datos,setDatos]=useState<Resumen|null>(null); const [error,setError]=useState('');
  useEffect(()=>{let vigente=true;api<Resumen>(`/academico/secciones/${seccionId}/mi-asistencia`).then(r=>{if(vigente)setDatos(r);}).catch(e=>{if(vigente)setError(e instanceof Error?e.message:'No se pudo cargar tu asistencia');});return()=>{vigente=false;};},[seccionId]);
  return <section className="detalle-seccion"><p className="etiqueta">04 · Asistencia</p><h3>Mi asistencia</h3>{error&&<p className="alerta" role="alert">{error}</p>}{datos&&!datos.totalClases?<p className="vacio">Sin datos: todavía no hay clases registradas.</p>:datos&&<><p className="texto-suave">{datos.presentes} presentes de {datos.consideradas} clases consideradas ({datos.proporcion===null?'Sin datos':`${datos.proporcion}%`}).</p><div className="tabla-contenedor"><table><thead><tr><th>Fecha</th><th>Estado</th></tr></thead><tbody>{datos.clases.map(c=><tr key={c.id}><td>{c.fecha}</td><td>{c.estado}</td></tr>)}</tbody></table></div></>}</section>;
}
