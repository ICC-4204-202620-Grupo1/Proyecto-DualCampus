import { Inicio } from './features/acceso/Inicio';
import { PantallaLogin } from './features/acceso/PantallaLogin';
import { useSesion } from './features/acceso/useSesion';
import { VistaEgresado } from './features/historial-academico/VistaEgresado';
import { SelectorTema } from './features/acceso/SelectorTema';

export default function App() {
  const { estado, salir, actualizar } = useSesion();

  if (estado.tipo === 'cargando') return <><div className="tema-acceso"><SelectorTema /></div><main className="login texto-suave">Cargando…</main></>;
  if (estado.tipo === 'autenticado') {
    return <Inicio usuario={estado.usuario} onSalir={salir} onCambio={actualizar} />;
  }
  if (estado.tipo === 'egresado') return <><div className="tema-acceso"><SelectorTema /></div><VistaEgresado egresado={estado.egresado} onSalir={salir} /></>;
  return <><div className="tema-acceso"><SelectorTema /></div><PantallaLogin errorServidor={estado.tipo === 'error'} /></>;
}
