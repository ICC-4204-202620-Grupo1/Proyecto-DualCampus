import { useEffect, useState } from 'react';
import { obtenerContexto, type ContextoInstitucion, type UsuarioSesion } from '../../lib/api';
import { Periodos } from '../configuracion-academica/Periodos';
import { SelectorInstitucion } from './SelectorInstitucion';

export function Inicio({usuario,onSalir,onCambio}:{usuario:UsuarioSesion;onSalir:()=>void;onCambio:(u:UsuarioSesion)=>void}) {
  const [contexto,setContexto]=useState<ContextoInstitucion|null>(null);
  const [error,setError]=useState('');
  const [cambiando,setCambiando]=useState(false);
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    let vigente=true;setContexto(null);setError('');
    if(usuario.institucionActivaId) obtenerContexto().then(c=>{if(vigente)setContexto(c);}).catch(()=>{if(vigente)setError('No se pudo verificar tu acceso. Reintenta o vuelve a iniciar sesión.');});
    return ()=>{vigente=false;};
  },[usuario.institucionActivaId,version]);
  async function salir(){try{await onSalir();}catch{setError('No se pudo cerrar la sesión. Reintenta.');}}
  const visible=!cambiando && contexto?.institucionActivaId===usuario.institucionActivaId;
  return <>
    <header className="barra"><div className="marca"><span className="marca-logo">D</span>DualCampus</div>
      <div className="barra-usuario"><span>{usuario.nombre}</span><button className="boton-secundario" onClick={salir}>Cerrar sesión</button></div></header>
    <main className="contenido">
      <div className="encabezado"><div><p className="etiqueta">Gestión académica</p><h1>Un semestre bien organizado</h1><p className="texto-suave">Tu institución, tus cursos y tu equipo en un solo lugar.</p></div>
        <SelectorInstitucion usuario={usuario} onCambio={onCambio} onPendiente={setCambiando}/></div>
      {!usuario.institucionActivaId && <section className="panel vacio">Selecciona una institución para comenzar.</section>}
      {error && <p className="alerta" role="alert">{error} <button onClick={()=>setVersion(v=>v+1)}>Reintentar</button></p>}
      {usuario.institucionActivaId && (!visible || !contexto) && !error && <p role="status">Cargando institución…</p>}
      {visible && contexto && <><div className="contexto"><strong>{contexto.institucion}</strong><span>{contexto.roles.map(r=>r.toLowerCase()).join(' · ')}</span></div>
        <Periodos key={contexto.institucionActivaId} roles={contexto.roles}/></>}
    </main><footer>DualCampus · Primera iteración funcional · Grupo 1</footer>
  </>;
}
