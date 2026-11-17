import { Inicio } from './features/acceso/Inicio';
import { PantallaLogin } from './features/acceso/PantallaLogin';
import { useSesion } from './features/acceso/useSesion';
import { VistaEgresado } from './features/historial-academico/VistaEgresado';

export default function App() {
  const { estado, salir, actualizar } = useSesion();

  if (estado.tipo === 'cargando') return <main className="login texto-suave">Cargando…</main>;
  if (estado.tipo === 'autenticado') {
    return <Inicio usuario={estado.usuario} onSalir={salir} onCambio={actualizar} />;
  }
  if (estado.tipo === 'egresado') return <VistaEgresado egresado={estado.egresado} onSalir={salir} />;
  return <PantallaLogin errorServidor={estado.tipo === 'error'} />;
}
