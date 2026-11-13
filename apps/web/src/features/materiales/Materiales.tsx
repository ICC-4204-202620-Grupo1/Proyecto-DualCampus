import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, descargarMaterial } from '../../lib/api';
type Material = { id: string; titulo: string; nombreArchivo: string; tamano: number; publicadoEn: string; autor?: string };
type Borrador = { id:string; titulo:string; nombreArchivo:string; tamano:number; actualizadoEn:string; origenMaterialId:string;
  origenTitulo:string; origenPeriodo:string; origenCurso:string; origenSeccion:string };
type Opcion = { id:string; titulo:string; nombreArchivo:string; tamano:number; seccionId:string; seccion:string;
  periodo:string; cursoCodigo:string; curso:string };
type Listado = { puedePublicar: boolean; materiales: Material[]; borradores: Borrador[] };
const MAXIMO = 1048576;
function leer(archivo: File): Promise<string> {
  return new Promise((resolve,reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(',')[1]);
    lector.onerror = () => reject(new Error('No se pudo leer el archivo. Selecciónalo nuevamente.'));
    lector.readAsDataURL(archivo);
  });
}
export function Materiales({ seccionId }: { seccionId: string }) {
  const [datos,setDatos] = useState<Listado | null>(null);
  const [titulo,setTitulo] = useState('');
  const [archivo,setArchivo] = useState<File | null>(null);
  const [error,setError] = useState('');
  const [aviso,setAviso] = useState('');
  const [cargando,setCargando] = useState(true);
  const [guardando,setGuardando] = useState(false);
  const [descargando,setDescargando] = useState<string | null>(null);
  const [opciones,setOpciones] = useState<Opcion[]>([]);
  const [origen,setOrigen] = useState('');
  const [copiando,setCopiando] = useState(false);
  const [version,setVersion] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let vigente = true;
    setCargando(true); setError('');
    api<Listado>(`/materiales/secciones/${seccionId}`)
      .then(res => { if (vigente) setDatos(res); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudieron cargar los materiales'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [seccionId,version]);
  useEffect(() => {
    if (!datos?.puedePublicar) { setOpciones([]); return; }
    let vigente = true;
    api<Opcion[]>(`/materiales/secciones/${seccionId}/reutilizacion/opciones`)
      .then(res => { if (vigente) setOpciones(res); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudieron cargar los materiales anteriores'); });
    return () => { vigente = false; };
  }, [seccionId,datos?.puedePublicar,version]);
  async function publicar(e: FormEvent) {
    e.preventDefault(); setError(''); setAviso('');
    if (!archivo) { setError('Selecciona un documento PDF o TXT.'); return; }
    if (!archivo.size || archivo.size > MAXIMO) { setError('El archivo debe tener entre 1 byte y 1 MB.'); return; }
    const ext = archivo.name.toLowerCase().split('.').pop();
    const tipo = ext === 'pdf' ? 'application/pdf' : ext === 'txt' ? 'text/plain' : null;
    if (!tipo) { setError('Solo se permiten documentos PDF o TXT.'); return; }
    setGuardando(true);
    try {
      const contenidoBase64 = await leer(archivo);
      await api(`/materiales/secciones/${seccionId}`,'POST',{titulo,nombreArchivo:archivo.name,tipo,contenidoBase64});
      setAviso('Material publicado y almacenado correctamente.');
      setTitulo(''); setArchivo(null); if (entrada.current) entrada.current.value = '';
      setVersion(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo publicar el material'); }
    finally { setGuardando(false); }
  }
  async function descargar(material: Material) {
    setError(''); setAviso(''); setDescargando(material.id);
    try {
      await descargarMaterial(seccionId, material.id, material.nombreArchivo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo descargar el material');
    } finally { setDescargando(null); }
  }
  async function copiar() {
    if (!origen) return;
    setCopiando(true); setError(''); setAviso('');
    try {
      await api(`/materiales/secciones/${seccionId}/reutilizaciones`,'POST',{materialOrigenId:origen});
      setOrigen(''); setAviso('Copia preparada como borrador. Revísala antes de publicarla.'); setVersion(v => v + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo preparar la copia'); }
    finally { setCopiando(false); }
  }
  const elegido = opciones.find(o => o.id === origen);
  return <section className="panel" aria-label="Materiales de la sección">
    <h3>Materiales del curso</h3>
    {error && <p className="alerta" role="alert">{error}</p>}
    {aviso && <p className="exito" role="status">{aviso}</p>}
    {datos?.puedePublicar && <form onSubmit={publicar}>
      <p>Publica un documento PDF o TXT de hasta 1 MB.</p>
      <label>Título del material<input required maxLength={200} value={titulo} disabled={guardando} onChange={e => setTitulo(e.target.value)} /></label>
      <label>Documento<input ref={entrada} type="file" accept=".pdf,.txt,application/pdf,text/plain" required disabled={guardando}
        onChange={e => { setArchivo(e.target.files?.[0] ?? null); setError(''); setAviso(''); }} /></label>
      <button type="submit" className="boton" disabled={guardando || !titulo.trim() || !archivo}>{guardando ? 'Publicando…' : 'Publicar material'}</button>
    </form>}
    {datos?.puedePublicar && <div className="preview" style={{marginBlock:'1rem'}}>
      <h4>Reutilizar material de otra sección</h4>
      <p className="texto-suave">Selecciona un material de una sección donde eres profesor. La copia quedará como borrador hasta que la revises y la publiques.</p>
      {!opciones.length ? <p className="vacio">No hay materiales publicados en otras secciones autorizadas.</p> : <>
        <label>Material anterior<select value={origen} disabled={copiando} onChange={e => setOrigen(e.target.value)}>
          <option value="">Selecciona un material</option>
          {opciones.map(o => <option key={o.id} value={o.id}>{o.periodo} · {o.cursoCodigo} · Sección {o.seccion} · {o.titulo}</option>)}
        </select></label>
        {elegido && <div><strong>Vista previa</strong><p>{elegido.titulo}</p><p>{elegido.nombreArchivo} · {Math.ceil(elegido.tamano/1024)} KB</p>
          <small>Origen: {elegido.periodo} · {elegido.cursoCodigo} {elegido.curso} · Sección {elegido.seccion}</small></div>}
        <button type="button" className="boton-secundario" disabled={!origen || copiando} onClick={() => void copiar()}>
          {copiando ? 'Preparando copia…' : 'Copiar como borrador'}
        </button>
      </>}
    </div>}
    {!!datos?.borradores?.length && <div style={{marginBlock:'1rem'}}><h4>Copias pendientes de revisión</h4>
      {datos.borradores.map(b => <BorradorMaterial key={b.id} seccionId={seccionId} borrador={b}
        ocupado={guardando || copiando} alCambiar={() => setVersion(v => v + 1)} informar={setAviso} fallar={setError} />)}
    </div>}
    {cargando ? <p role="status">Cargando materiales…</p> : !datos ?
      <button type="button" onClick={() => setVersion(v => v + 1)}>Reintentar</button> : !datos.materiales.length ?
      <p className="vacio">Todavía no hay materiales publicados en esta sección.</p> :
      <ul>{datos.materiales.map(m => <li key={m.id} style={{marginBlock:'1rem'}}>
        <strong>{m.titulo}</strong><p>{m.nombreArchivo} · {Math.ceil(m.tamano / 1024)} KB</p>
        <small>{m.autor} · {new Date(m.publicadoEn).toLocaleString()}</small>
        <p><button type="button" className="boton" disabled={descargando !== null} onClick={() => void descargar(m)}>{descargando === m.id ? 'Descargando…' : 'Descargar material'}</button></p>
      </li>)}</ul>}
  </section>;
}

function BorradorMaterial({seccionId,borrador,ocupado,alCambiar,informar,fallar}:{seccionId:string;borrador:Borrador;ocupado:boolean;
  alCambiar:()=>void;informar:(m:string)=>void;fallar:(m:string)=>void}) {
  const [titulo,setTitulo] = useState(borrador.titulo);
  const [procesando,setProcesando] = useState(false);
  const modificado = titulo.trim() !== borrador.titulo;
  async function ejecutar(accion:'guardar'|'publicar') {
    setProcesando(true); fallar(''); informar('');
    try {
      if (accion === 'guardar') {
        await api(`/materiales/secciones/${seccionId}/borradores/${borrador.id}`,'PUT',{titulo});
        informar('Cambios del borrador guardados. El material aún no está publicado.');
      } else {
        await api(`/materiales/secciones/${seccionId}/borradores/${borrador.id}/publicar`,'POST');
        informar('Copia revisada y publicada en la sección destino.');
      }
      alCambiar();
    } catch (e) { fallar(e instanceof Error ? e.message : 'No se pudo actualizar la copia'); }
    finally { setProcesando(false); }
  }
  return <div className="preview" style={{marginBlock:'0.75rem'}}>
    <p className="etiqueta">Borrador · todavía no visible para estudiantes</p>
    <label>Título de la copia<input required maxLength={200} value={titulo} disabled={ocupado || procesando} onChange={e => setTitulo(e.target.value)} /></label>
    <p>{borrador.nombreArchivo} · {Math.ceil(borrador.tamano/1024)} KB</p>
    <small>Original: {borrador.origenTitulo} · {borrador.origenPeriodo} · {borrador.origenCurso} · Sección {borrador.origenSeccion}</small>
    <p><button type="button" className="boton-secundario" disabled={ocupado || procesando || !titulo.trim() || !modificado}
      onClick={() => void ejecutar('guardar')}>Guardar cambios</button>{' '}
      <button type="button" className="boton" disabled={ocupado || procesando || modificado}
        onClick={() => void ejecutar('publicar')}>{procesando ? 'Procesando…' : 'Publicar copia revisada'}</button></p>
    {modificado && <p className="texto-suave">Guarda el título antes de publicar.</p>}
  </div>;
}
