import { useCallback, useEffect, useState } from 'react';
import { obtenerContexto, type ContextoInstitucion, type UsuarioSesion } from '../../lib/api';
import { Periodos } from '../configuracion-academica/Periodos';
import { MenuLateral, type DestinoNavegacion } from './MenuLateral';
import { SelectorInstitucion } from './SelectorInstitucion';

export function Inicio({usuario,onSalir,onCambio}:{usuario:UsuarioSesion;onSalir:()=>void;onCambio:(u:UsuarioSesion)=>void}) {
  const [contexto,setContexto]=useState<ContextoInstitucion|null>(null);
  const [error,setError]=useState('');
  const [cambiando,setCambiando]=useState(false);
  const [version,setVersion]=useState(0);
  const [destino,setDestino]=useState<DestinoNavegacion>('periodos-academicos');
  const [menuMovil,setMenuMovil]=useState(false);
  const cerrarMenuMovil = useCallback(() => setMenuMovil(false), []);
  useEffect(()=>{
    let vigente=true;setContexto(null);setError('');setDestino('periodos-academicos');setMenuMovil(false);
    if(usuario.institucionActivaId) obtenerContexto().then(c=>{if(vigente)setContexto(c);}).catch(()=>{if(vigente)setError('No se pudo verificar tu acceso. Reintenta o vuelve a iniciar sesión.');});
    return ()=>{vigente=false;};
  },[usuario.institucionActivaId,version]);
  async function salir(){try{await onSalir();}catch{setError('No se pudo cerrar la sesión. Reintenta.');}}
  const visible=!cambiando && contexto?.institucionActivaId===usuario.institucionActivaId;

  // Las secciones de un curso pueden montarse después de cargar la API o elegir una sección.
  // El observador espera al destino; no navega hacia módulos de instituciones anteriores.
  useEffect(() => {
    if (!visible || !contexto) return;
    let terminado = false;
    let observer: MutationObserver | null = null;
    const mover = () => {
      const elemento = document.getElementById(destino);
      if (!elemento) return;
      terminado = true;
      observer?.disconnect();
      elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const raf = window.requestAnimationFrame(() => {
      mover();
      if (!terminado) {
        observer = new MutationObserver(mover);
        const contenedor = document.querySelector('.contenido');
        if (contenedor) observer.observe(contenedor, { childList: true, subtree: true });
      }
    });
    return () => { window.cancelAnimationFrame(raf); observer?.disconnect(); };
  }, [destino, contexto, visible]);

  function navegar(siguiente: DestinoNavegacion) {
    if (destino === siguiente) document.getElementById(siguiente)?.scrollIntoView({behavior:'smooth',block:'start'});
    setDestino(siguiente);
  }

  return <>
    <header className="barra"><div className="marca">
      {visible && <button className="menu-abrir-movil" type="button" onClick={()=>setMenuMovil(true)} aria-label="Abrir menú lateral" aria-expanded={menuMovil}>☰</button>}
      <span className="marca-logo">D</span>DualCampus</div>
      <div className="barra-usuario"><span>{usuario.nombre}</span><button className="boton-secundario" onClick={salir}>Cerrar sesión</button></div>
    </header>
    <div className={'estructura-app' + (visible && contexto ? ' con-menu-lateral' : '')}>
      {visible && contexto && <MenuLateral key={contexto.institucionActivaId} roles={contexto.roles} institucion={contexto.institucion} destino={destino} onNavegar={navegar} abiertoMovil={menuMovil} onCerrarMovil={cerrarMenuMovil}/>}
      <main className="contenido" id="contenido-principal">
        <div className="encabezado"><div><p className="etiqueta">Gestión académica</p><h1>Un semestre bien organizado</h1><p className="texto-suave">Tu institución, tus cursos y tu equipo en un solo lugar.</p></div>
          <SelectorInstitucion usuario={usuario} onCambio={onCambio} onPendiente={setCambiando}/></div>
        {!usuario.institucionActivaId && <section className="panel vacio">Selecciona una institución para comenzar.</section>}
        {error && <p className="alerta" role="alert">{error} <button onClick={()=>setVersion(v=>v+1)}>Reintentar</button></p>}
        {usuario.institucionActivaId && (!visible || !contexto) && !error && <p role="status">Cargando institución…</p>}
        {visible && contexto && <><div className="contexto"><strong>{contexto.institucion}</strong><span>{contexto.roles.map(r=>r.toLowerCase()).join(' · ')}</span></div>
          <Periodos key={contexto.institucionActivaId} roles={contexto.roles} navegacionDestino={destino}/></>}
      </main>
    </div>
    <footer>DualCampus · Primera iteración funcional · Grupo 1</footer>
  </>;
}
