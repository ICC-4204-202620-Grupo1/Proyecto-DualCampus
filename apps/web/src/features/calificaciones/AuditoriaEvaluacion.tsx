import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Evento = { id: string; accion: string; autor: string; fecha: string; datos: Record<string, unknown> };
const acciones: Record<string, string> = {
  CREAR_EVALUACION: 'Evaluación creada', GUARDAR_NOTAS_BORRADOR: 'Notas y ausencias guardadas',
  ENVIAR_A_REVISION: 'Enviada a revisión', DEVOLVER_EVALUACION: 'Devuelta con observaciones',
  REENVIAR_A_REVISION: 'Reenviada a revisión', PUBLICAR_EVALUACION: 'Notas publicadas',
  CORREGIR_NOTA_PUBLICADA: 'Nota publicada corregida',
};
const campos: Record<string, string> = {
  nombre: 'Evaluación', fecha: 'Fecha de evaluación', ponderacion: 'Ponderación',
  totalGuardadas: 'Filas guardadas', totalAusentes: 'Ausencias', observacion: 'Observación',
  valorPrevio: 'Valor previo', valorAnterior: 'Valor anterior', valorNuevo: 'Valor nuevo',
  motivo: 'Motivo', referencia: 'Referencia de solicitud', referenciaSolicitud: 'Referencia de solicitud',
};

export function AuditoriaEvaluacion({ evaluacionId }: { evaluacionId: string }) {
  const [abierta, setAbierta] = useState(false);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!abierta) return;
    let vigente = true;
    setCargando(true); setError(''); setEventos([]);
    api<Evento[]>(`/calificaciones/evaluaciones/${evaluacionId}/auditoria`)
      .then(data => { if (vigente) setEventos(data); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [abierta, evaluacionId, version]);
  return <section className="panel" aria-label="Auditoría de la evaluación">
    <h4>Historial de la evaluación</h4>
    <p className="texto-suave">Consulta quién actuó y cuándo. Los antecedentes se conservan y son de solo lectura.</p>
    <button type="button" className="boton-secundario" aria-expanded={abierta} onClick={() => setAbierta(v => !v)}>
      {abierta ? 'Ocultar historial' : 'Ver auditoría'}
    </button>
    {abierta && <>
      <button type="button" className="boton-secundario" disabled={cargando} onClick={() => setVersion(v => v + 1)}>Actualizar historial</button>
      {cargando ? <p role="status">Cargando historial…</p> : error ? <p role="alert" className="alerta">{error}</p> :
        !eventos.length ? <p>No hay eventos registrados para esta evaluación.</p> :
        <ol>{eventos.map(e => <li key={e.id} style={{ marginBlock: '1rem' }}>
          <strong>{acciones[e.accion] ?? e.accion.replaceAll('_', ' ').toLowerCase()}</strong>
          <p>{e.autor} · {new Date(e.fecha).toLocaleString()}</p>
          <dl>{Object.entries(e.datos).filter(([k]) => k in campos).map(([k, valor]) =>
            <div key={k}><dt>{campos[k]}</dt><dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{valor === null ? 'Sin valor' : String(valor)}</dd></div>
          )}</dl>
        </li>)}</ol>}
    </>}
  </section>;
}
