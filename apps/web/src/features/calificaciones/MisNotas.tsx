import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Resultado = {
  id: string; nombre: string; fecha: string; ponderacion: number;
  publicadoEn: string; valor: number | null; esAusente: boolean;
  escalaMinima: number; escalaMaxima: number; escalaAprobacion: number;
};

export function MisNotas({ seccionId }: { seccionId: string }) {
  const [notas, setNotas] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCargando(true); setNotas([]); setError('');
    api<Resultado[]>(`/calificaciones/secciones/${seccionId}/mis-notas`)
      .then(data => { if (vigente) setNotas(data); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudieron cargar tus notas.'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [seccionId, version]);
  return <section className="panel" aria-label="Mis notas publicadas">
    <h3>Mis notas publicadas</h3>
    <p className="texto-suave">Aquí aparecen únicamente tus resultados oficiales de esta sección.</p>
    <button type="button" className="boton-secundario" disabled={cargando} onClick={() => setVersion(v => v + 1)}>Actualizar notas</button>
    {cargando ? <p role="status">Cargando tus notas…</p> : error ? <p role="alert" className="alerta">{error}</p> : !notas.length ?
      <p className="vacio">Todavía no tienes notas publicadas en esta sección.</p> :
      <div className="tabla-contenedor"><table><thead><tr>
        <th>Evaluación</th><th>Fecha</th><th>Ponderación</th><th>Mi nota</th><th>Resultado</th><th>Publicación</th>
      </tr></thead><tbody>{notas.map(n => <tr key={n.id}>
        <td>{n.nombre}</td><td>{n.fecha.slice(0, 10)}</td><td>{n.ponderacion}%</td>
        <td>{n.esAusente ? 'Ausente' : n.valor === null ? 'Sin nota registrada' : n.valor.toFixed(1)}</td>
        <td>{n.esAusente ? 'Ausencia registrada' : n.valor === null ? '—' : n.valor >= n.escalaAprobacion ? 'Aprobado' : 'Reprobado'}</td>
        <td>{new Date(n.publicadoEn).toLocaleString()}</td>
      </tr>)}</tbody></table></div>}
  </section>;
}
