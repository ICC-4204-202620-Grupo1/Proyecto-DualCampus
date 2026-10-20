import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';

type Actividad = { id: string; titulo: string; instrucciones: string; creadoEn: string; autor: string };
type Listado = { puedeCrear: boolean; actividades: Actividad[] };

export function ActividadesEntrega({ seccionId }: { seccionId: string }) {
  const [datos, setDatos] = useState<Listado | null>(null);
  const [titulo, setTitulo] = useState('');
  const [instrucciones, setInstrucciones] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true); setError('');
    api<Listado>(`/actividades/secciones/${seccionId}`)
      .then(res => { if (vigente) setDatos(res); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudieron cargar las actividades'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [seccionId, version]);

  async function crear(e: FormEvent) {
    e.preventDefault(); setError(''); setAviso(''); setGuardando(true);
    try {
      await api(`/actividades/secciones/${seccionId}`, 'POST', { titulo, instrucciones });
      setTitulo(''); setInstrucciones('');
      setAviso('Actividad creada correctamente.');
      setVersion(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear la actividad'); }
    finally { setGuardando(false); }
  }

  return <section className="panel" aria-label="Actividades de entrega">
    <h3>Actividades de entrega</h3>
    {error && <p className="alerta" role="alert">{error}</p>}
    {aviso && <p className="exito" role="status">{aviso}</p>}
    {datos?.puedeCrear && <form onSubmit={crear}>
      <label>Título de la actividad<input required maxLength={200} value={titulo} disabled={guardando}
        onChange={e => setTitulo(e.target.value)}/></label>
      <label>Instrucciones<textarea required maxLength={10000} rows={5} value={instrucciones}
        disabled={guardando} onChange={e => setInstrucciones(e.target.value)}/></label>
      <button disabled={guardando || !titulo.trim() || !instrucciones.trim()}>
        {guardando ? 'Creando…' : 'Crear actividad'}
      </button>
    </form>}
    {cargando ? <p role="status">Cargando actividades…</p> : !datos ?
      <button type="button" onClick={() => setVersion(v => v + 1)}>Reintentar</button> :
      !datos.actividades.length ? <p className="vacio">No hay actividades de entrega en esta sección.</p> :
      <ul>{datos.actividades.map(a => <li key={a.id} style={{ marginBlock: '1rem' }}>
        <strong>{a.titulo}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{a.instrucciones}</p>
        <small>{a.autor} · {new Date(a.creadoEn).toLocaleString('es-CL')}</small>
      </li>)}</ul>}
  </section>;
}
