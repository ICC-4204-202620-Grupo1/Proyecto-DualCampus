import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Respuesta = {
  seccion: { id: string; codigo: string; cursoCodigo: string; curso: string; periodoId: string; periodo: string };
  cantidadNotas: number;
  distribucion: { rango: string; cantidad: number }[];
};

/** H46: distribución por nota registrada, no por promedio por estudiante. */
export function DistribucionNotas({ seccionId }: { seccionId: string }) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let vigente = true;
    setCargando(true); setError(''); setDatos(null);
    api<Respuesta>(`/calificaciones/secciones/${seccionId}/distribucion-notas`)
      .then(r => { if (vigente) setDatos(r); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo consultar la distribución'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [seccionId, version]);

  if (cargando) return <p role="status">Cargando distribución de notas…</p>;
  if (error) return <p className="alerta" role="alert">{error} <button type="button" onClick={() => setVersion(v => v + 1)}>Reintentar</button></p>;
  if (!datos || datos.cantidadNotas === 0) return <p className="vacio">Sin datos: esta sección no tiene notas publicadas con valor numérico.</p>;
  const mayor = Math.max(1, ...datos.distribucion.map(f => f.cantidad));
  return <div aria-label="Distribución de notas publicadas">
    <p className="texto-suave">Período: <strong>{datos.seccion.periodo}</strong> · Sección: {datos.seccion.cursoCodigo} · {datos.seccion.curso} · {datos.seccion.codigo}</p>
    <p><strong>{datos.cantidadNotas}</strong> notas publicadas con valor numérico.</p>
    <p className="texto-suave">Cada nota publicada se cuenta una vez. Se excluyen ausencias, notas vacías y evaluaciones no publicadas.</p>
    <div className="tabla-contenedor"><table><thead><tr><th scope="col">Rango de nota</th><th scope="col">Cantidad</th><th scope="col">Distribución</th></tr></thead><tbody>
      {datos.distribucion.map(f => <tr key={f.rango}><th scope="row">{f.rango}</th><td>{f.cantidad}</td><td style={{ minWidth: '120px' }}>
        <div role="img" aria-label={`${f.cantidad} notas en rango ${f.rango}`} style={{ background: 'var(--borde, #ddd)', height: '16px', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${(f.cantidad / mayor) * 100}%`, height: '100%', background: 'var(--primario, #2563eb)' }} />
        </div>
      </td></tr>)}
    </tbody></table></div>
  </div>;
}
