import { useEffect, useState } from 'react';
import { obtenerInstituciones,seleccionarInstitucion,type InstitucionAutorizada,type UsuarioSesion } from '../../lib/api';
export function SelectorInstitucion({usuario,onCambio,onPendiente}:{usuario:UsuarioSesion;onCambio:(u:UsuarioSesion)=>void;onPendiente:(p:boolean)=>void}) {
  const [instituciones,setInstituciones]=useState<InstitucionAutorizada[]>([]);
  const [error,setError]=useState('');
  const [ocupado,setOcupado]=useState(false);
  useEffect(()=>{let vigente=true;obtenerInstituciones().then(i=>{if(vigente)setInstituciones(i);}).catch(()=>{if(vigente)setError('No se pudieron cargar las instituciones');});return()=>{vigente=false;};},[]);
  async function cambiar(id:string) {
    setError('');setOcupado(true);onPendiente(true);
    try{onCambio(await seleccionarInstitucion(id));}
    catch{setError('No se pudo cambiar de institución');}
    finally{setOcupado(false);onPendiente(false);}
  }
  return <label>Institución activa<select aria-label="Institución activa" disabled={ocupado} value={usuario.institucionActivaId || ''} onChange={e=>cambiar(e.target.value)}>
    {!usuario.institucionActivaId && <option value="">Selecciona una institución…</option>}
    {instituciones.map(i=><option value={i.id} key={i.id}>{i.nombre}</option>)}
  </select>{error && <span role="alert">{error}</span>}</label>;
}
