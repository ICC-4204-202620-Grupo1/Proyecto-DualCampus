import { FormEvent, useEffect, useState } from 'react';
import { crearPeriodo, ErrorApi, listarPeriodos, type Periodo } from '../../lib/api';

/** H05 · Lista los períodos de la institución activa; el administrador puede crear uno. */
export function Periodos({ institucionId, esAdministrador }: { institucionId: string; esAdministrador: boolean }) {
  const [periodos, setPeriodos] = useState<Periodo[]>([]);
  const [form, setForm] = useState({ nombre: '', fechaInicio: '', fechaFin: '' });
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    listarPeriodos().then(setPeriodos).catch(() => setPeriodos([]));
  }, [institucionId]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErrores([]);
    setGuardando(true);
    try {
      const nuevo = await crearPeriodo(form);
      setPeriodos((actuales) => [nuevo, ...actuales]);
      setForm({ nombre: '', fechaInicio: '', fechaFin: '' });
    } catch (err) {
      setErrores(err instanceof ErrorApi ? err.mensajes : ['No se pudo guardar el período']);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section>
      <h3>Períodos académicos</h3>

      {esAdministrador && (
        <form onSubmit={enviar}>
          <label>
            Nombre <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          </label>{' '}
          <label>
            Inicio{' '}
            <input type="date" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
          </label>{' '}
          <label>
            Término{' '}
            <input type="date" value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
          </label>{' '}
          <button type="submit" disabled={guardando}>
            Crear período
          </button>
          {errores.length > 0 && (
            <ul role="alert" style={{ color: 'crimson' }}>
              {errores.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </form>
      )}

      {periodos.length === 0 ? (
        <p>Sin períodos registrados.</p>
      ) : (
        <table border={1} cellPadding={4} style={{ borderCollapse: 'collapse', marginTop: '0.5rem' }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Inicio</th>
              <th>Término</th>
              <th>Creado por</th>
              <th>Creado el</th>
            </tr>
          </thead>
          <tbody>
            {periodos.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>{p.fechaInicio}</td>
                <td>{p.fechaFin}</td>
                <td>{p.creadoPor.nombre ?? p.creadoPor.email}</td>
                <td>{new Date(p.creadoEn).toLocaleString('es-CL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
