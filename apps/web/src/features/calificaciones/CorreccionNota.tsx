import { useState, type FormEvent } from 'react';
import { api } from '../../lib/api';
type Nota = { alumnoId: string; nombre: string; valor: number | null; esAusente: boolean; actualizadoEn: string | null };
export function CorreccionNota({ evaluacionId, nota, onCerrar, onCorregida }: {
  evaluacionId: string; nota: Nota; onCerrar: () => void; onCorregida: () => void;
}) {
  const [valor,setValor] = useState('');
  const [motivo,setMotivo] = useState('');
  const [referencia,setReferencia] = useState('');
  const [guardando,setGuardando] = useState(false);
  const [error,setError] = useState('');
  const [completada,setCompletada] = useState(false);
  async function guardar(e: FormEvent) {
    e.preventDefault(); setGuardando(true); setError('');
    try {
      await api(`/calificaciones/evaluaciones/${evaluacionId}/notas/${nota.alumnoId}/correcciones`,'POST',{
        valor:Number(valor),motivo,referencia,valorPrevio:nota.valor,ausentePrevio:nota.esAusente,actualizadoEn:nota.actualizadoEn,
      });
      setCompletada(true); onCorregida();
    } catch(e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la corrección'); }
    finally { setGuardando(false); }
  }
  return <section className="panel" aria-label="Corrección formal de nota">
    <h4>Corregir nota publicada: {nota.nombre}</h4>
    <p>Valor previo: <strong>{nota.esAusente ? 'Ausente' : nota.valor?.toFixed(1) ?? 'Sin nota'}</strong>.</p>
    <p>La corrección queda publicada para el alumno y registrada en el historial con su motivo y solicitud.</p>
    {error && <p role="alert" className="alerta">{error}</p>}
    {completada ? <p role="status" className="exito">Corrección guardada. La planilla y el resultado del alumno ya muestran el valor vigente.</p> :
      <form onSubmit={guardar}>
        <label>Nueva nota<input type="number" min="1" max="7" step="0.1" required value={valor} disabled={guardando} onChange={e=>setValor(e.target.value)} /></label>
        <label>Motivo de la corrección<textarea required maxLength={2000} value={motivo} disabled={guardando} onChange={e=>setMotivo(e.target.value)} /></label>
        <label>Referencia de la solicitud<input required maxLength={200} value={referencia} disabled={guardando} onChange={e=>setReferencia(e.target.value)} /></label>
        <button type="submit" className="boton" disabled={guardando || !valor || !motivo.trim() || !referencia.trim()}>{guardando ? 'Guardando…' : 'Confirmar corrección publicada'}</button>
      </form>}
    <button type="button" className="boton-secundario" disabled={guardando} onClick={onCerrar}>Cerrar corrección</button>
  </section>;
}
