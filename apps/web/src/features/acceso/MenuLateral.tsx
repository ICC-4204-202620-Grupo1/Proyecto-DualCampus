import './MenuLateral.css';
import { useEffect, useState } from 'react';
import type { Rol } from '../../lib/api';

export type DestinoNavegacion =
  | 'usuarios-globales'
  | 'instituciones'
  | 'periodos-academicos'
  | 'oferta-academica'
  | 'detalle-seccion'
  | 'modulo-notas'
  | 'modulo-materiales'
  | 'modulo-entregas'
  | 'modulo-asistencia'
  | 'historial-academico';

type Enlace = { id: DestinoNavegacion; etiqueta: string; sigla: string };

/** Los enlaces del menú no autorizan acciones: las reglas siguen verificándose en la API. */
function enlacesPara(roles: Rol[], esSuperadministrador: boolean): Enlace[] {
  const enlaces: Enlace[] = roles.length ? [{ id: 'periodos-academicos', etiqueta: 'Períodos académicos', sigla: 'PA' }] : [];
  if (esSuperadministrador) enlaces.unshift({ id: 'instituciones', etiqueta: 'Universidades', sigla: 'UN' }, { id: 'usuarios-globales', etiqueta: 'Usuarios y roles', sigla: 'UR' });
  const esAdmin = roles.includes('ADMINISTRADOR');
  const esDocente = roles.some(r => r === 'PROFESOR' || r === 'AYUDANTE');
  const esAlumno = roles.includes('ALUMNO') && !esAdmin && !esDocente;
  if (esAdmin || esDocente || esAlumno) {
    enlaces.push({ id: 'oferta-academica', etiqueta: esAdmin ? 'Cursos y secciones' : 'Mis secciones', sigla: 'CS' });
    if (esAdmin) enlaces.push({ id: 'detalle-seccion', etiqueta: 'Equipo y nómina', sigla: 'EN' });
    enlaces.push(
      { id: 'modulo-notas', etiqueta: esAlumno ? 'Mis calificaciones' : 'Evaluaciones y notas', sigla: 'NO' },
      { id: 'modulo-materiales', etiqueta: 'Materiales de clase', sigla: 'MA' },
      { id: 'modulo-entregas', etiqueta: 'Actividades y entregas', sigla: 'AE' },
      { id: 'modulo-asistencia', etiqueta: esAlumno ? 'Mi asistencia' : 'Asistencia', sigla: 'AS' },
    );
    if (esAlumno) enlaces.push({ id: 'historial-academico', etiqueta: 'Historial académico', sigla: 'HI' });
  }
  return enlaces;
}

export function MenuLateral({ roles, institucion, destino, onNavegar, abiertoMovil, onCerrarMovil, esSuperadministrador = false }: {
  roles: Rol[];
  esSuperadministrador?: boolean;
  institucion: string;
  destino: DestinoNavegacion;
  onNavegar: (destino: DestinoNavegacion) => void;
  abiertoMovil: boolean;
  onCerrarMovil: () => void;
}) {
  const [contraido, setContraido] = useState(false);
  useEffect(() => { setContraido(false); onCerrarMovil(); }, [institucion]); // Cambiar de institución reinicia la navegación visual.
  useEffect(() => {
    if (!abiertoMovil) return;
    const manejarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrarMovil();
    };
    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [abiertoMovil, onCerrarMovil]);
  const enlaces = enlacesPara(roles, esSuperadministrador);
  return <>
    {abiertoMovil && <button className="menu-fondo-movil" type="button" aria-label="Cerrar menú" onClick={onCerrarMovil} />}
    <aside className={'menu-lateral' + (contraido ? ' menu-contraido' : '') + (abiertoMovil ? ' menu-abierto' : '')} aria-label="Navegación de DualCampus">
      <div className="menu-cabecera">
        {!contraido && <><span className="menu-sobretitulo">Institución activa</span><strong title={institucion}>{institucion}</strong></>}
        <button type="button" className="menu-contraer" onClick={() => setContraido(c => !c)} aria-label={contraido ? 'Expandir menú lateral' : 'Contraer menú lateral'} title={contraido ? 'Expandir menú' : 'Contraer menú'}>
          <span aria-hidden="true">{contraido ? '»' : '«'}</span>
        </button>
        <button type="button" className="menu-cerrar-movil" onClick={onCerrarMovil} aria-label="Cerrar menú lateral">Cerrar</button>
      </div>
      <nav aria-label="Secciones disponibles">
        {enlaces.map(enlace => <button key={enlace.id} type="button"
          className={'menu-enlace' + (destino === enlace.id ? ' menu-enlace-activo' : '')}
          aria-current={destino === enlace.id ? 'location' : undefined}
          title={contraido ? enlace.etiqueta : undefined}
          onClick={() => { onNavegar(enlace.id); onCerrarMovil(); }}>
          <span className="menu-sigla" aria-hidden="true">{enlace.sigla}</span><span className="menu-texto">{enlace.etiqueta}</span>
        </button>)}
      </nav>
      {!contraido && <p className="menu-ayuda">Para cambiar de curso, selecciona su sección en la vista principal.</p>}
    </aside>
  </>;
}
