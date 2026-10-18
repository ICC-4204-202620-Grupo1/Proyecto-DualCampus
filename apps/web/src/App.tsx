import { Inicio } from './features/acceso/Inicio';
import { PantallaLogin } from './features/acceso/PantallaLogin';
import { useSesion } from './features/acceso/useSesion';

export default function App() {
  const { estado, salir } = useSesion();

  if (estado.tipo === 'cargando') return <main className="login texto-suave">Cargando…</main>;
  if (estado.tipo === 'autenticado') return <Inicio usuario={estado.usuario} onSalir={salir} />;
  return <PantallaLogin errorServidor={estado.tipo === 'error'} />;
}
