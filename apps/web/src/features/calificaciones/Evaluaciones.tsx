import { useEffect, useState, type FormEvent } from 'react';
import { api, type Rol } from '../../lib/api';

export interface Evaluacion {
  id: string;
  seccionId: string;
  nombre: string;
  fecha: string;
  ponderacion: string | number;
  escalaMinima: string | number;
  escalaMaxima: string | number;
  escalaAprobacion: string | number;
  estado: string;
  creadoEn: string;
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : 'No se pudo completar la operación');

export function Evaluaciones({ seccionId, roles }: { seccionId: string; roles: Rol[] }) {
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [version, setVersion] = useState(0);

  const [form, setForm] = useState({
    nombre: '',
    fecha: '',
    ponderacion: '20',
  });

  const esAdmin = roles.includes('ADMINISTRADOR');
  const esProfesor = roles.includes('PROFESOR');
  const esAyudante = roles.every((r) => r === 'AYUDANTE');
  const puedeCrear = esAdmin || esProfesor;

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError('');
    api<Evaluacion[]>(`/calificaciones/secciones/${seccionId}/evaluaciones`)
      .then((data) => {
        if (vigente) setEvaluaciones(data);
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
  }, [seccionId, version]);

  async function crearEvaluacion(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      const nueva = await api<Evaluacion>(`/calificaciones/secciones/${seccionId}/evaluaciones`, 'POST', {
        nombre: form.nombre,
        fecha: form.fecha,
        ponderacion: Number(form.ponderacion),
      });
      setEvaluaciones((prev) => [...prev, nueva]);
      setForm({ nombre: '', fecha: '', ponderacion: '20' });
      setAviso(`Evaluación "${nueva.nombre}" creada con éxito.`);
      setVersion((v) => v + 1);
    } catch (err) {
      setError(mensaje(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="evaluaciones-panel" style={{ marginTop: '2rem', borderTop: '1px solid var(--borde)', paddingTop: '1.5rem' }}>
      <div className="encabezado-seccion" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="etiqueta" style={{ fontSize: '0.8rem', color: 'var(--suave)', margin: 0 }}>H14 · Épica 3: Calificaciones</p>
          <h3 style={{ margin: '0.25rem 0 0.5rem 0' }}>Evaluaciones del curso</h3>
        </div>
        <span className="insignia">{evaluaciones.length} registradas</span>
      </div>

      {error && <p role="alert" className="alerta" style={{ marginBottom: '1rem' }}>{error}</p>}
      {aviso && <p role="status" className="exito" style={{ marginBottom: '1rem' }}>{aviso}</p>}

      {puedeCrear && (
        <form
          onSubmit={crearEvaluacion}
          className="formulario-fila"
          style={{
            marginBottom: '1.5rem',
            background: '#f8fafc',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid var(--borde)',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem' }}>
            Nombre de la evaluación
            <input
              required
              maxLength={100}
              placeholder="Ej: Control 1, Solemne 1"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--borde)' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem' }}>
            Fecha
            <input
              required
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--borde)' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem' }}>
            Ponderación (%)
            <input
              type="number"
              min="0"
              max="100"
              required
              value={form.ponderacion}
              onChange={(e) => setForm({ ...form, ponderacion: e.target.value })}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--borde)', width: '90px' }}
            />
          </label>
          <button
            disabled={guardando}
            className="boton"
            style={{ alignSelf: 'flex-end', padding: '0.55rem 1.2rem', cursor: 'pointer' }}
          >
            {guardando ? 'Creando…' : 'Crear evaluación'}
          </button>
        </form>
      )}

      {esAyudante && (
        <p className="texto-suave" style={{ fontSize: '0.85rem', fontStyle: 'italic', marginBottom: '1rem' }}>
          ℹ️ Como ayudante puedes consultar las evaluaciones registradas (la creación está restringida a profesores).
        </p>
      )}

      {cargando ? (
        <p className="texto-suave">Cargando evaluaciones…</p>
      ) : evaluaciones.length === 0 ? (
        <p
          className="vacio"
          style={{
            textAlign: 'center',
            color: 'var(--suave)',
            padding: '1.5rem',
            background: '#fdfdfd',
            border: '1px dashed var(--borde)',
            borderRadius: '8px',
          }}
        >
          Todavía no hay evaluaciones registradas en esta sección.
        </p>
      ) : (
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Evaluación</th>
                <th>Fecha</th>
                <th>Ponderación</th>
                <th>Escala</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {evaluaciones.map((ev) => (
                <tr key={ev.id}>
                  <td><strong>{ev.nombre}</strong></td>
                  <td>{ev.fecha}</td>
                  <td>{Number(ev.ponderacion)}%</td>
                  <td>
                    {ev.escalaMinima} – {ev.escalaMaxima} (Aprobación: {ev.escalaAprobacion})
                  </td>
                  <td>
                    <span
                      className="insignia"
                      style={{ background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}
                    >
                      {ev.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
