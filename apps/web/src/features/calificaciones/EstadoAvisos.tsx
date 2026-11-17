import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Intento = { numero: number; resultado: string; fecha: string; error: string | null };
type Aviso = { id: string; tipo: string; estado: string; evento: string; eventoEn: string;
  destinatarioNombre: string | null; destinatarioEmail: string; creadoEn: string;
  intentos: number; ultimoError: string | null; intentosDetalle: Intento[] };

export function EstadoAvisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [reintentando, setReintentando] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true); setError('');
    api<Aviso[]>('/calificaciones/avisos')
      .then(datos => { if (vigente) setAvisos(datos); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudieron cargar los avisos.'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [version]);

  async function reintentar(id: string) {
    setReintentando(id); setError('');
    try {
      await api(`/calificaciones/avisos/${encodeURIComponent(id)}/reintentar`, 'POST', {});
      setVersion(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo reintentar el aviso.'); }
    finally { setReintentando(null); }
  }

  return <section className="panel" aria-label="Estado de avisos">
    <p className="etiqueta">Comunicación académica</p>
    <h2>Estado de avisos enviados</h2>
    <p className="texto-suave">Avisos de publicación y corrección de notas de la institución activa. El correo no incluye la calificación.</p>
    <button type="button" className="boton-secundario" onClick={() => setVersion(v => v + 1)}>Actualizar</button>
    {error && <p className="alerta" role="alert">{error}</p>}
    {cargando ? <p role="status">Cargando avisos…</p> : avisos.length === 0 ? <p className="vacio">Aún no hay avisos registrados.</p> :
      <div className="tabla-contenedor"><table>
        <thead><tr><th>Evento</th><th>Destinatario</th><th>Estado</th><th>Intentos</th><th>Acción</th></tr></thead>
        <tbody>{avisos.map(a => <tr key={a.id}>
          <td>{a.tipo === 'PUBLICACION_NOTA' ? 'Publicación de notas' : 'Corrección de nota'}<br />
            <span className="texto-suave">{new Date(a.eventoEn).toLocaleString('es-CL')}</span></td>
          <td>{a.destinatarioNombre || a.destinatarioEmail}<br /><span className="texto-suave">{a.destinatarioEmail}</span></td>
          <td>{a.estado}{a.ultimoError && <p className="texto-suave">{a.ultimoError}</p>}</td>
          <td>{a.intentosDetalle.length === 0 ? 'Sin intentos' : <details><summary>{a.intentos} intento(s)</summary>
            <ol>{a.intentosDetalle.map(i => <li key={i.numero}>
              {new Date(i.fecha).toLocaleString('es-CL')} · {i.resultado}{i.error ? ` · ${i.error}` : ''}
            </li>)}</ol></details>}</td>
          <td>{a.estado === 'FALLIDO' && <button type="button" disabled={reintentando === a.id}
            onClick={() => void reintentar(a.id)}>{reintentando === a.id ? 'Reintentando…' : 'Reintentar'}</button>}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
