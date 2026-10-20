import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Nota = {
  id: string;
  nombre: string;
  fecha: string;
  ponderacion: number;
  valor: number | null;
  esAusente: boolean;
  escalaAprobacion: number;
  publicadoEn: string;
};
type Asignatura = {
  seccionId: string;
  seccionCodigo: string;
  cursoId: string;
  cursoCodigo: string;
  cursoNombre: string;
  notas: Nota[];
};
type Periodo = {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  asignaturas: Asignatura[];
};

/** H39: vista histórica de toda la institución activa, no solo del período seleccionado. */
export function HistorialAcademico() {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    setPeriodos([]);
    api<Periodo[]>('/historial-academico/propio')
      .then(datos => { if (vigente) setPeriodos(datos); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [version]);

  return <section className="panel" aria-label="Mi historial académico">
    <div className="encabezado-seccion">
      <div><p className="etiqueta">03 · Historial académico</p><h2>Mi historial académico</h2></div>
      <button type="button" className="boton-secundario" disabled={cargando} onClick={() => setVersion(v => v + 1)}>
        Actualizar historial
      </button>
    </div>
    <p className="texto-suave">Tus calificaciones oficiales, agrupadas por período y asignatura de la institución activa.</p>
    {cargando ? <p role="status">Cargando historial…</p> : error ?
      <p role="alert" className="alerta">{error}</p> : periodos.length === 0 ?
      <p className="vacio">Sin datos: todavía no hay períodos académicos en esta institución.</p> :
      periodos.map(periodo => {
        const tieneNotas = periodo.asignaturas.some(asignatura => asignatura.notas.length > 0);
        return <div key={periodo.id} className="detalle-seccion">
          <h3>{periodo.nombre}</h3>
          <p className="texto-suave">{periodo.fechaInicio.slice(0, 10)} al {periodo.fechaFin.slice(0, 10)}</p>
          {!tieneNotas ? <p className="vacio">Sin datos: no hay calificaciones publicadas en este período.</p> :
            periodo.asignaturas.map(asignatura => <div key={asignatura.seccionId}>
              <h4>{asignatura.cursoCodigo} · {asignatura.cursoNombre} (sección {asignatura.seccionCodigo})</h4>
              {asignatura.notas.length === 0 ? <p className="vacio">Sin datos: no hay notas publicadas en esta asignatura.</p> :
                <div className="tabla-contenedor"><table>
                  <thead><tr><th>Evaluación</th><th>Fecha</th><th>Ponderación</th><th>Mi nota</th><th>Resultado</th><th>Publicación</th></tr></thead>
                  <tbody>{asignatura.notas.map(nota => <tr key={nota.id}>
                    <td>{nota.nombre}</td>
                    <td>{nota.fecha.slice(0, 10)}</td>
                    <td>{nota.ponderacion}%</td>
                    <td>{nota.esAusente ? 'Ausente' : nota.valor === null ? 'Sin nota registrada' : nota.valor.toFixed(1)}</td>
                    <td>{nota.esAusente ? 'Ausencia registrada' : nota.valor === null ? '—' : nota.valor >= nota.escalaAprobacion ? 'Aprobado' : 'Reprobado'}</td>
                    <td>{nota.publicadoEn ? new Date(nota.publicadoEn).toLocaleString('es-CL') : '—'}</td>
                  </tr>)}</tbody>
                </table></div>}
            </div>)}
        </div>;
      })}
  </section>;
}
