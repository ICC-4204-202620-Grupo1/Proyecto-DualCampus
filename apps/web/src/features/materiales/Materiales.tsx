import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, descargarMaterial } from '../../lib/api';
type Material = { id: string; titulo: string; nombreArchivo: string; tamano: number; publicadoEn: string; autor?: string };
type Listado = { puedePublicar: boolean; materiales: Material[] };
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
