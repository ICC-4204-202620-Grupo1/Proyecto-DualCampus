import type { Periodo } from '../../lib/api';

/** Fechas civiles: usar UTC evita que Chile muestre el día anterior por zona horaria. */
function fechaEnChile(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number);
  const valor = new Date(Date.UTC(anio, mes - 1, dia));
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(valor);
}

function diasDeDuracion(inicio: string, fin: string): number {
  const fechaUTC = (valor: string) => {
    const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
    return Date.UTC(anio, mes - 1, dia);
  };
  return Math.round((fechaUTC(fin) - fechaUTC(inicio)) / 86400000) + 1;
}

export function CalendarioPeriodo({ periodos, seleccionado, cargando, error, onSeleccionar, onReintentar }: {
  periodos: Periodo[];
  seleccionado: Periodo | undefined;
  cargando: boolean;
  error: string;
  onSeleccionar: (id: string) => void;
  onReintentar: () => void;
}) {
  return <section className="panel calendario-periodo" aria-label="Calendario académico del período">
    <p className="etiqueta">Calendario académico</p>
    <h2>Calendario del período</h2>
    <p className="texto-suave">Consulta las fechas del período académico de tu institución activa.</p>

    {error && <p className="alerta" role="alert">{error} <button type="button" onClick={onReintentar}>Reintentar</button></p>}
    {cargando && <p role="status">Cargando calendario…</p>}
    {!cargando && !error && periodos.length === 0 && <p className="vacio">Sin datos</p>}
    {!cargando && !error && seleccionado && <>
      <label className="selector-periodo">Período académico
        <select value={seleccionado.id} onChange={e => onSeleccionar(e.target.value)}>
          {periodos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </label>
      <div className="calendario-fechas" aria-label={'Fechas del período ' + seleccionado.nombre}>
        <div className="calendario-fecha">
          <span className="etiqueta">Inicio del período</span>
          <strong>{fechaEnChile(seleccionado.fechaInicio)}</strong>
          <time dateTime={seleccionado.fechaInicio}>{seleccionado.fechaInicio}</time>
        </div>
        <div className="calendario-fecha">
          <span className="etiqueta">Término del período</span>
          <strong>{fechaEnChile(seleccionado.fechaFin)}</strong>
          <time dateTime={seleccionado.fechaFin}>{seleccionado.fechaFin}</time>
        </div>
      </div>
      <p className="texto-suave" role="status">Duración: {diasDeDuracion(seleccionado.fechaInicio, seleccionado.fechaFin)} días corridos, incluyendo inicio y término.</p>
    </>}
  </section>;
}
