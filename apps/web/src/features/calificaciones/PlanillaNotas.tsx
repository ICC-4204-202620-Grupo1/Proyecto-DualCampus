import { useEffect, useState, type FormEvent } from 'react';
import { api, type Rol } from '../../lib/api';

interface FilaAlumno {
  alumnoId: string;
  nombre: string;
  email: string;
  notaId: string | null;
  valor: number | null;
  esAusente: boolean;
  actualizadoEn: string | null;
}

interface RespuestaNotas {
  evaluacion: {
    id: string;
    nombre: string;
    estado: string;
    observacion: string | null;
    devueltoEn: string | null;
    reenviadoEn: string | null;
    puedeDevolver: boolean;
    puedePublicar: boolean;
    publicadoEn: string | null;
    escalaMinima: number;
    escalaMaxima: number;
  };
  filas: FilaAlumno[];
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'No se pudo completar la operación');

export function PlanillaNotas({
  evaluacionId,
  evaluacionNombre,
  roles,
  onCerrar,
  onEnviada,
}: {
  evaluacionId: string;
  evaluacionNombre: string;
  roles: Rol[];
  onCerrar: () => void;
  onEnviada: () => void;
}) {
  const [filas, setFilas] = useState<FilaAlumno[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  // H16: estado de ausencias por alumno
  const [ausentes, setAusentes] = useState<Record<string, boolean>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [estado, setEstado] = useState('');
  const [pendiente, setPendiente] = useState(false);
  const [observacion, setObservacion] = useState('');
  const [comentario, setComentario] = useState('');
  const [devueltoEn, setDevueltoEn] = useState<string | null>(null);
  const [reenviadoEn, setReenviadoEn] = useState<string | null>(null);
  const [puedePublicar, setPuedePublicar] = useState(false);
  const [publicadoEn, setPublicadoEn] = useState<string | null>(null);
  const [puedeDevolver, setPuedeDevolver] = useState(false);

  const esAlumno = roles.every((r) => r === 'ALUMNO');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    api<RespuestaNotas>(`/calificaciones/evaluaciones/${evaluacionId}/notas`)
      .then((data) => {
        if (!vigente) return;
        setFilas(data.filas);
        setEstado(data.evaluacion.estado);
        setObservacion(data.evaluacion.observacion ?? '');
        setDevueltoEn(data.evaluacion.devueltoEn);
        setReenviadoEn(data.evaluacion.reenviadoEn);
        setPuedeDevolver(data.evaluacion.puedeDevolver);
        setPuedePublicar(data.evaluacion.puedePublicar);
        setPublicadoEn(data.evaluacion.publicadoEn);
        setPendiente(false);
        const inicialValores: Record<string, string> = {};
        const inicialAusentes: Record<string, boolean> = {};
        for (const f of data.filas) {
          inicialValores[f.alumnoId] = f.valor !== null ? String(f.valor) : '';
          // H16: recuperar estado de ausencia al reabrir (CA1 H16)
          inicialAusentes[f.alumnoId] = f.esAusente ?? false;
        }
        setValores(inicialValores);
        setAusentes(inicialAusentes);
      })
      .catch((e) => {
        if (vigente) setError(mensaje(e));
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [evaluacionId]);

  function cambiarNota(alumnoId: string, texto: string) {
    setPendiente(true);
    setValores((prev) => ({ ...prev, [alumnoId]: texto }));
    setError('');
    setAviso('');
  }

  // H16: toggle ausente. Cuando se marca ausente, se borra la nota (valor null ≠ cero)
  function toggleAusente(alumnoId: string) {
    setPendiente(true);
    setAusentes((prev) => {
      const nuevo = !prev[alumnoId];
      if (nuevo) {
        // Limpiar nota si se marca ausente (ausencia ≠ cero)
        setValores((v) => ({ ...v, [alumnoId]: '' }));
      }
      return { ...prev, [alumnoId]: nuevo };
    });
    setError('');
    setAviso('');
  }

  // CA2 H15: Validación de escala — sólo para los que NO están ausentes
  const tieneErroresEscala = Object.entries(valores).some(([alumnoId, val]) => {
    if (ausentes[alumnoId]) return false; // ausente: no se valida escala
    if (!val || val.trim() === '') return false;
    const num = Number(val);
    return isNaN(num) || num < 1.0 || num > 7.0;
  });

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (tieneErroresEscala) {
      setError('Hay notas fuera de escala (deben estar entre 1.0 y 7.0). Corrígelas antes de guardar.');
      return;
    }

    setGuardando(true);
    setError('');
    setAviso('');

    try {
      // Construir payload incluyendo ausentes y notas con valor
      const payload = filas
        .filter((f) => {
          const val = valores[f.alumnoId] ?? '';
          const estaAusente = ausentes[f.alumnoId] ?? false;
          return estaAusente || val.trim() !== '' || f.notaId !== null;
        })
        .map((f) => {
          const estaAusente = ausentes[f.alumnoId] ?? false;
          return {
            alumnoId: f.alumnoId,
            // H16 CA1: si ausente, valor null (distinto de cero)
            valor: estaAusente || !valores[f.alumnoId]?.trim() ? null : Number(valores[f.alumnoId]),
            esAusente: estaAusente,
          };
        });

      if (payload.length === 0) {
        setError('Ingresa al menos una nota o marca a un alumno como ausente para guardar.');
        setGuardando(false);
        return;
      }

      await api(`/calificaciones/evaluaciones/${evaluacionId}/notas`, 'PUT', { notas: payload });

      const guardadas = await api<RespuestaNotas>(`/calificaciones/evaluaciones/${evaluacionId}/notas`);
      setFilas(guardadas.filas);
      setPendiente(false);
      const totalAusentes = payload.filter((p) => p.esAusente).length;
      const totalNotas = payload.length - totalAusentes;
      const partes = [];
      if (totalNotas > 0) partes.push(`${totalNotas} nota${totalNotas !== 1 ? 's' : ''}`);
      if (totalAusentes > 0) partes.push(`${totalAusentes} ausencia${totalAusentes !== 1 ? 's' : ''}`);
      setAviso(`Cambios guardados: ${partes.join(' y ')}.`);
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setGuardando(false);
    }
  }

  const editable = ['BORRADOR', 'DEVUELTA'].includes(estado) && !esAlumno;
  const completa = filas.length > 0 && filas.every((f) => ausentes[f.alumnoId] || valores[f.alumnoId]?.trim());

  async function enviarARevision() {
    setGuardando(true);
    setError('');
    try {
      const reenvio = estado === 'DEVUELTA';
      const ruta = reenvio ? 'reenviar-revision' : 'enviar-revision';
      const data = await api<{ reenviadoEn: string | null }>(`/calificaciones/evaluaciones/${evaluacionId}/${ruta}`, 'POST', {});
      setReenviadoEn(data.reenviadoEn);
      setEstado('EN_REVISION');
      setAviso(`Evaluación ${reenvio ? 'reenviada' : 'enviada'} a revisión. Las notas y ausencias quedaron bloqueadas.`);
      onEnviada();
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setGuardando(false);
    }
  }

  async function devolver() {
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      const data = await api<{ observacion: string; devueltoEn: string }>(
        `/calificaciones/evaluaciones/${evaluacionId}/devolver`, 'POST', { observacion: comentario },
      );
      setEstado('DEVUELTA');
      setObservacion(data.observacion);
      setDevueltoEn(data.devueltoEn);
      setComentario('');
      setAviso('Evaluación devuelta. El equipo asignado puede corregir las notas y ausencias.');
      onEnviada();
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setGuardando(false);
    }
  }

  async function publicar() {
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      const data = await api<{ publicadoEn: string }>(`/calificaciones/evaluaciones/${evaluacionId}/publicar`, 'POST', {});
      setEstado('PUBLICADA');
      setPublicadoEn(data.publicadoEn);
      setAviso('Notas publicadas oficialmente. Cada alumno puede consultar únicamente su resultado.');
      onEnviada();
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      style={{
        marginTop: '1.5rem',
        padding: '1.25rem',
        background: '#ffffff',
        border: '1px solid var(--borde)',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <span className="etiqueta" style={{ fontSize: '0.8rem', color: 'var(--suave)' }}>
            H15–H16 · Calificaciones y Ausencias en Borrador
          </span>
          <h3 style={{ margin: '0.2rem 0' }}>Planilla: {evaluacionNombre}</h3>
          <p className="texto-suave" style={{ margin: 0, fontSize: '0.85rem' }}>
            Escala estándar: <strong>1.0 a 7.0</strong>. Puedes marcar alumnos como ausentes (distinto de nota 0).
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="boton-secundario"
          style={{ color: 'var(--texto)', borderColor: 'var(--borde)' }}
        >
          Cerrar planilla
        </button>
      </div>

      {error && <p role="alert" className="alerta" style={{ marginBottom: '1rem' }}>{error}</p>}
      {estado && <p>Estado: <strong>{estado === 'EN_REVISION' ? 'En revisión' : estado}</strong>{!editable && !esAlumno && ' · Solo lectura'}</p>}
      {publicadoEn && <p>Publicada el {new Date(publicadoEn).toLocaleString()}</p>}
      {!cargando && estado === 'EN_REVISION' && puedePublicar && <section className="panel" aria-label="Publicación de notas">
        <p>Al publicar, los resultados serán oficiales y cada alumno podrá consultar su propia nota.</p>
        <button type="button" className="boton" disabled={guardando} onClick={publicar}>
          {guardando ? 'Publicando…' : 'Publicar notas aprobadas'}
        </button>
      </section>}
      {reenviadoEn && <p>Último reenvío: {new Date(reenviadoEn).toLocaleString()}</p>}
      {observacion && <section className="panel" aria-label="Observación del profesor">
        <h4>Observación del profesor</h4>
        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{observacion}</p>
        {devueltoEn && <small>Devuelta el {new Date(devueltoEn).toLocaleString()}</small>}
      </section>}
      {!cargando && estado === 'EN_REVISION' && puedeDevolver && <form onSubmit={(e) => { e.preventDefault(); void devolver(); }}>
        <label htmlFor="observacion-devolucion">Comentario de devolución (obligatorio)</label>
        <textarea id="observacion-devolucion" required maxLength={2000} value={comentario}
          disabled={guardando} onChange={(e) => setComentario(e.target.value)} />
        <button className="boton" type="submit" disabled={guardando || !comentario.trim()}>
          {guardando ? 'Devolviendo…' : 'Devolver evaluación'}
        </button>
      </form>}
      {aviso && <p role="status" className="exito" style={{ marginBottom: '1rem' }}>{aviso}</p>}

      {cargando ? (
        <p className="texto-suave">Cargando nómina de alumnos…</p>
      ) : esAlumno ? (
        <p className="alerta">El alumno no ve valores en el borrador (disponible una vez publicada).</p>
      ) : filas.length === 0 ? (
        <p className="vacio">No hay alumnos inscritos en esta sección para calificar.</p>
      ) : (
        <form onSubmit={guardar}>
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Correo</th>
                  <th style={{ width: '130px' }}>Nota (1.0–7.0)</th>
                  {/* H16: columna de ausencias */}
                  <th style={{ width: '90px', textAlign: 'center' }}>Ausente</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const valActual = valores[f.alumnoId] ?? '';
                  const estaAusente = ausentes[f.alumnoId] ?? false;
                  const num = Number(valActual);
                  const esInvalido = !estaAusente && valActual.trim() !== '' && (isNaN(num) || num < 1.0 || num > 7.0);

                  return (
                    <tr key={f.alumnoId} style={{ opacity: estaAusente ? 0.75 : 1 }}>
                      <td><strong>{f.nombre}</strong></td>
                      <td style={{ color: 'var(--suave)', fontSize: '0.85rem' }}>{f.email}</td>
                      <td>
                        <input
                          type="number"
                          step="0.1"
                          min="1.0"
                          max="7.0"
                          placeholder="—"
                          value={valActual}
                          // H16: deshabilitar input si está ausente
                          disabled={estaAusente || !editable || guardando}
                          onChange={(e) => cambiarNota(f.alumnoId, e.target.value)}
                          style={{
                            width: '90px',
                            padding: '0.4rem 0.5rem',
                            borderRadius: '6px',
                            border: esInvalido ? '1px solid #ef4444' : '1px solid var(--borde)',
                            backgroundColor: estaAusente ? '#f9fafb' : esInvalido ? '#fef2f2' : '#ffffff',
                            fontWeight: 600,
                            textAlign: 'center',
                            cursor: estaAusente ? 'not-allowed' : 'text',
                            color: estaAusente ? 'var(--suave)' : 'inherit',
                          }}
                        />
                        {esInvalido && (
                          <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                            Fuera de escala
                          </div>
                        )}
                      </td>
                      {/* H16: checkbox de ausente */}
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          id={`ausente-${f.alumnoId}`}
                          checked={estaAusente}
                          disabled={!editable || guardando}
                          onChange={() => toggleAusente(f.alumnoId)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#f59e0b' }}
                        />
                      </td>
                      <td>
                        {/* H16 CA2: el profesor ve la marca de ausencia al revisar el borrador */}
                        {estaAusente ? (
                          <span style={{
                            display: 'inline-block',
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fcd34d',
                            borderRadius: '999px',
                            padding: '0.15rem 0.65rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                          }}>
                            Ausente
                          </span>
                        ) : valActual.trim() !== '' && !esInvalido ? (
                          <span style={{ color: num >= 4.0 ? '#15803d' : '#b91c1c', fontSize: '0.85rem', fontWeight: 600 }}>
                            {num >= 4.0 ? '✓ Aprobado' : '✗ Reprobado'}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--suave)', fontSize: '0.85rem' }}>Sin calificar</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '1.25rem' }}>
            <button
              type="submit"
              disabled={!editable || guardando || tieneErroresEscala}
              className="boton"
              style={{ padding: '0.6rem 1.5rem', cursor: 'pointer' }}
            >
              {guardando ? 'Guardando borrador…' : 'Guardar notas y ausencias'}
            </button>
            {editable && <button type="button" className="boton" onClick={enviarARevision}
              disabled={guardando || pendiente || !completa || tieneErroresEscala}>
              {estado === 'DEVUELTA' ? 'Reenviar a revisión' : 'Enviar a revisión'}
            </button>}
            <span style={{ fontSize: '0.85rem', color: 'var(--suave)' }}>
              {pendiente ? 'Guarda los cambios antes de enviar. ' : ''}Las ausencias se guardan como estado distinto de nota 0.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
