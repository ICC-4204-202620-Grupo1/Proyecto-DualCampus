import { useCallback, useEffect, useState } from 'react';
import { obtenerContexto, type ContextoInstitucion, type UsuarioSesion } from '../../lib/api';
import { Periodos } from '../configuracion-academica/Periodos';
import { MenuLateral, type DestinoNavegacion } from './MenuLateral';
import { SelectorInstitucion } from './SelectorInstitucion';
import { Instituciones } from '../superadministracion/Instituciones';
import { Usuarios } from '../superadministracion/Usuarios';
import { leerResultadoVinculacion, MiPerfil } from '../perfil/MiPerfil';
import { SelectorTema } from './SelectorTema';
import { EstadoAvisos } from '../calificaciones/EstadoAvisos';

export function Inicio({usuario,onSalir,onCambio}:{usuario:UsuarioSesion;onSalir:()=>void;onCambio:(u:UsuarioSesion)=>void}) {
  const [contexto,setContexto]=useState<ContextoInstitucion|null>(null);
  const [error,setError]=useState('');
  const [cambiando,setCambiando]=useState(false);
  const [version,setVersion]=useState(0);
  const esAlumno=usuario.roles.some(r=>r.rol==='ALUMNO');
  // H43: al volver de verificar la cuenta personal en Google se abre el perfil con el resultado.
  const [resultadoVinculacion]=useState(leerResultadoVinculacion);
  const destinoInicial=():DestinoNavegacion=>usuario.esSuperadministrador && !usuario.institucionActivaId ? 'instituciones' : usuario.roles.some(r=>r.rol==='PROFESOR'||r.rol==='AYUDANTE'||r.rol==='ALUMNO') && !usuario.roles.some(r=>r.rol==='ADMINISTRADOR') ? 'inicio' : 'periodos-academicos';
  const [destino,setDestino]=useState<DestinoNavegacion>(()=>resultadoVinculacion && esAlumno ? 'mi-perfil' : destinoInicial());
  useEffect(()=>{if(resultadoVinculacion) window.history.replaceState(null,'',window.location.pathname);},[resultadoVinculacion]);
  const [menuMovil,setMenuMovil]=useState(false);
  const cerrarMenuMovil = useCallback(() => setMenuMovil(false), []);
  useEffect(()=>{
    let vigente=true;setContexto(null);setError('');setDestino(d=>d==='mi-perfil' && esAlumno ? d : destinoInicial());setMenuMovil(false);
    if(usuario.institucionActivaId) obtenerContexto().then(c=>{if(vigente)setContexto(c);}).catch(()=>{if(vigente)setError('No se pudo verificar tu acceso. Reintenta o vuelve a iniciar sesión.');});
    return ()=>{vigente=false;};
  },[usuario.institucionActivaId,version]);
  async function salir(){try{await onSalir();}catch{setError('No se pudo cerrar la sesión. Reintenta.');}}
  const visible=!cambiando && contexto?.institucionActivaId===usuario.institucionActivaId;
  const mostrarMenu = (visible && !!contexto) || (usuario.esSuperadministrador && !usuario.institucionActivaId);

  function navegar(siguiente: DestinoNavegacion) {
    setDestino(siguiente);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  const titulos: Partial<Record<DestinoNavegacion, string>> = {inicio:'Inicio', 'periodos-academicos':'Períodos académicos', 'calendario-periodo':'Calendario académico', 'oferta-academica':'Mis secciones', 'espacio-seccion':'Sección de trabajo', 'detalle-seccion':'Equipo y nómina', 'modulo-notas':'Evaluaciones y notas', 'modulo-materiales':'Materiales', 'modulo-entregas':'Actividades y entregas', 'modulo-asistencia':'Asistencia', 'distribucion-notas':'Distribución de notas', 'mi-perfil':'Mi perfil', 'indicadores-institucionales':'Indicadores institucionales', 'modulo-anuncios':'Anuncios de sección', 'estado-avisos':'Estado de avisos', instituciones:'Universidades', 'usuarios-globales':'Usuarios y roles'};
  return <>
    <header className="barra"><div className="marca">
      {mostrarMenu && <button className="menu-abrir-movil" type="button" onClick={()=>setMenuMovil(true)} aria-label="Abrir menú lateral" aria-expanded={menuMovil}>☰</button>}
      <span className="marca-logo">D</span>DualCampus</div>
      <div className="barra-usuario"><SelectorTema /><span>{usuario.nombre}</span><button className="boton-secundario" onClick={salir}>Cerrar sesión</button></div>
    </header>
    <div className={'estructura-app' + (mostrarMenu ? ' con-menu-lateral' : '')}>
      {mostrarMenu && <MenuLateral key={contexto?.institucionActivaId ?? "global"} roles={contexto?.roles ?? []} institucion={contexto?.institucion ?? "Administración global"} destino={destino} onNavegar={navegar} abiertoMovil={menuMovil} onCerrarMovil={cerrarMenuMovil} esSuperadministrador={!!usuario.esSuperadministrador}/>}
      <main className="contenido" id="contenido-principal">
        <div className="encabezado"><div><p className="etiqueta">DualCampus · Gestión académica</p><h1>{titulos[destino] ?? "Espacio académico"}</h1><p className="texto-suave">{destino === "inicio" ? "Tus cursos y próximas acciones, en un solo lugar." : "Trabaja con la institución y el período que seleccionaste."}</p></div>
          {(usuario.roles.length > 0) && <SelectorInstitucion usuario={usuario} onCambio={onCambio} onPendiente={setCambiando}/>}</div>
        {!usuario.institucionActivaId && !usuario.esSuperadministrador && <section className="panel vacio">Selecciona una institución para comenzar.</section>}
        {usuario.esSuperadministrador && destino === 'instituciones' && <Instituciones />}
        {usuario.esSuperadministrador && destino === 'usuarios-globales' && <Usuarios />}
        {esAlumno && destino === 'mi-perfil' && <MiPerfil usuario={usuario} resultado={resultadoVinculacion} />}
        {visible && contexto && destino === 'estado-avisos' && contexto.roles.includes('ADMINISTRADOR') && <EstadoAvisos />}
        {error && <p className="alerta" role="alert">{error} <button onClick={()=>setVersion(v=>v+1)}>Reintentar</button></p>}
        {usuario.institucionActivaId && (!visible || !contexto) && !error && <p role="status">Cargando institución…</p>}
        {visible && contexto && destino !== 'instituciones' && destino !== 'usuarios-globales' && destino !== 'mi-perfil' && destino !== 'estado-avisos' && <><div className="contexto"><strong>{contexto.institucion}</strong><span>{contexto.roles.map(r=>r.toLowerCase()).join(' · ')}</span></div>
          <Periodos key={contexto.institucionActivaId} roles={contexto.roles} navegacionDestino={destino} usuarioId={usuario.usuarioId} institucionId={contexto.institucionActivaId} onNavegar={navegar}/></>}
      </main>
    </div>
    <footer>DualCampus · Grupo 1</footer>
  </>;
}
