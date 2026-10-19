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
}: {
  evaluacionId: string;
  evaluacionNombre: string;
  roles: Rol[];
  onCerrar: () => void;
}) {
  const [filas, setFilas] = useState<FilaAlumno[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const esAlumno = roles.every((r) => r === 'ALUMNO');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    api<RespuestaNotas>(`/calificaciones/evaluaciones/${evaluacionId}/notas`)
      .then((data) => {
        if (!vigente) return;
        setFilas(data.filas);
        const inicial: Record<string, string> = {};
        for (const f of data.filas) {
          inicial[f.alumnoId] = f.valor !== null ? String(f.valor) : '';
        }
        setValores(inicial);
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
    setValores((prev) => ({ ...prev, [alumnoId]: texto }));
    setError('');
    setAviso('');
  }

  // CA2: Validación de escala 1.0 a 7.0
  const tieneErroresEscala = Object.entries(valores).some(([_, val]) => {
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
      const payload = Object.entries(valores)
        .filter(([_, val]) => val !== undefined && val.trim() !== '')
        .map(([alumnoId, val]) => ({
          alumnoId,
          valor: Number(val),
        }));

      if (payload.length === 0) {
        setError('Ingresa al menos una nota para guardar.');
        setGuardando(false);
        return;
      }

      await api(`/calificaciones/evaluaciones/${evaluacionId}/notas`, 'PUT', { notas: payload });
      setAviso(`Notas guardadas en borrador correctamente (${payload.length} alumnos calificados).`);
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
            H15 · Calificaciones en Borrador
          </span>
          <h3 style={{ margin: '0.2rem 0' }}>Planilla: {evaluacionNombre}</h3>
          <p className="texto-suave" style={{ margin: 0, fontSize: '0.85rem' }}>
            Escala estándar: <strong>1.0 a 7.0</strong> (nota mínima de aprobación: 4.0). Los cambios se guardan en borrador.
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
                  <th style={{ width: '140px' }}>Nota (1.0 - 7.0)</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const valActual = valores[f.alumnoId] ?? '';
                  const num = Number(valActual);
                  const esInvalido = valActual.trim() !== '' && (isNaN(num) || num < 1.0 || num > 7.0);

                  return (
                    <tr key={f.alumnoId}>
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
                          onChange={(e) => cambiarNota(f.alumnoId, e.target.value)}
                          style={{
                            width: '90px',
                            padding: '0.4rem 0.5rem',
                            borderRadius: '6px',
                            border: esInvalido ? '1px solid #ef4444' : '1px solid var(--borde)',
                            backgroundColor: esInvalido ? '#fef2f2' : '#ffffff',
                            fontWeight: 600,
                            textAlign: 'center',
                          }}
                        />
                        {esInvalido && (
                          <div style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                            Fuera de escala
                          </div>
                        )}
                      </td>
                      <td>
                        {valActual.trim() !== '' && !esInvalido ? (
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
              disabled={guardando || tieneErroresEscala}
              className="boton"
              style={{ padding: '0.6rem 1.5rem', cursor: 'pointer' }}
            >
              {guardando ? 'Guardando borrador…' : 'Guardar notas en borrador'}
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--suave)' }}>
              Guarda tus notas parciales en cualquier momento para evitar pérdida de digitación.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
