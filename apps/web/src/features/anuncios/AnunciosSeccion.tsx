import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../../lib/api';

type Anuncio = { id: string; titulo: string; mensaje: string; autor: string; publicadoEn: string };

export function AnunciosSeccion({ seccionId, puedePublicar }: { seccionId: string; puedePublicar: boolean }) {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([]);
  const [titulo, setTitulo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const ruta = `/anuncios/secciones/${seccionId}`;

  useEffect(() => {
    let vigente = true;
    api<Anuncio[]>(ruta).then(datos => { if (vigente) setAnuncios(datos); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudieron cargar los anuncios'); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [ruta]);

  async function publicar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true); setError(''); setAviso('');
    try {
      const nuevo = await api<Anuncio>(ruta, 'POST', { titulo, mensaje });
      setAnuncios(actuales => [nuevo, ...actuales]);
      setTitulo(''); setMensaje(''); setAviso('Anuncio publicado en la sección.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo publicar el anuncio');
    } finally { setGuardando(false); }
  }

  return <section id="modulo-anuncios" aria-label="Anuncios de la sección">
    {puedePublicar && <form onSubmit={publicar}>
      <h3>Publicar anuncio</h3>
      <label>Título<input required maxLength={200} value={titulo} onChange={e => setTitulo(e.target.value)} /></label>
      <label>Mensaje<textarea required maxLength={5000} rows={5} value={mensaje} onChange={e => setMensaje(e.target.value)} /></label>
      <button disabled={guardando}>{guardando ? 'Publicando…' : 'Publicar anuncio'}</button>
    </form>}
    {error && <p className="alerta" role="alert">{error}</p>}
    {aviso && <p className="exito" role="status">{aviso}</p>}
    <h3>Anuncios publicados</h3>
    {cargando ? <p role="status">Cargando anuncios…</p> : !anuncios.length ?
      <p className="vacio">Aún no hay anuncios en esta sección.</p> :
      <div className="lista-anuncios">{anuncios.map(anuncio => <article className="panel" key={anuncio.id}>
        <h4>{anuncio.titulo}</h4>
        <p className="texto-suave">{anuncio.autor} · {new Date(anuncio.publicadoEn).toLocaleString('es-CL')}</p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{anuncio.mensaje}</p>
      </article>)}</div>}
  </section>;
}
