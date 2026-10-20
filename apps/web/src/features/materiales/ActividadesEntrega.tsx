import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';

type Actividad = { id: string; titulo: string; instrucciones: string; creadoEn: string; autor: string;
  aperturaEn: string | null; cierreEn: string | null; formatosPermitidos: string[] | null; tamanoMaximoMb: number | null };
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
  const [editando, setEditando] = useState<string | null>(null);
  const [apertura, setApertura] = useState('');
  const [cierre, setCierre] = useState('');
  const [formatos, setFormatos] = useState<string[]>(['pdf']);
  const [tamano, setTamano] = useState(10);

  function editar(a: Actividad) {
    setEditando(a.id); setError(''); setAviso('');
    const local = (valor: string | null) => {
      if (!valor) return '';
      const d = new Date(valor); const ajustada = new Date(d.getTime() - d.getTimezoneOffset()*60000);
      return ajustada.toISOString().slice(0,16);
    };
    setApertura(local(a.aperturaEn)); setCierre(local(a.cierreEn));
    setFormatos(a.formatosPermitidos ?? ['pdf']); setTamano(a.tamanoMaximoMb ?? 10);
  }
  async function guardarConfiguracion(e: FormEvent) {
    e.preventDefault(); setError(''); setAviso('');
    if (!apertura || !cierre || new Date(apertura) >= new Date(cierre)) {
      setError('La fecha de cierre debe ser posterior a la apertura'); return;
    }
    setGuardando(true);
    try {
      await api(`/actividades/secciones/${seccionId}/actividades/${editando}/configuracion`, 'PUT', {
        aperturaEn: new Date(apertura).toISOString(), cierreEn: new Date(cierre).toISOString(),
        formatosPermitidos: formatos, tamanoMaximoMb: tamano,
      });
      setAviso('Configuración de entrega guardada.'); setEditando(null);
      setVersion(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la configuración'); }
    finally { setGuardando(false); }
  }

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
        {a.aperturaEn && a.cierreEn && a.formatosPermitidos && a.tamanoMaximoMb ?
          <p>Abre: {new Date(a.aperturaEn).toLocaleString('es-CL')} · Cierra: {new Date(a.cierreEn).toLocaleString('es-CL')}
            <br/>Formatos: {a.formatosPermitidos.join(', ').toUpperCase()} · Máximo: {a.tamanoMaximoMb} MB</p> :
          <p>Condiciones de entrega todavía no configuradas.</p>}
        {datos.puedeCrear && <button type="button" onClick={() => editar(a)}>Configurar entrega</button>}
        {datos.puedeCrear && editando === a.id && <form onSubmit={guardarConfiguracion}>
          <label>Apertura <input type="datetime-local" required value={apertura}
            onChange={e => setApertura(e.target.value)} /></label>
          <label>Cierre <input type="datetime-local" required min={apertura} value={cierre}
            onChange={e => setCierre(e.target.value)} /></label>
          <fieldset><legend>Formatos permitidos</legend>
            {['pdf','docx','txt','png'].map(f => <label key={f} style={{marginRight:'1rem'}}>
              <input type="checkbox" checked={formatos.includes(f)} onChange={e =>
                setFormatos(v => e.target.checked ? [...v,f] : v.filter(x => x !== f))} /> {f.toUpperCase()}
            </label>)}
          </fieldset>
          <label>Tamaño máximo (MB) <input type="number" min={1} max={50} required value={tamano}
            onChange={e => setTamano(Number(e.target.value))} /></label>
          <button disabled={guardando || formatos.length === 0}>Guardar condiciones</button>
          <button type="button" onClick={() => setEditando(null)}>Cancelar</button>
        </form>}
      </li>)}</ul>}
  </section>;
}
