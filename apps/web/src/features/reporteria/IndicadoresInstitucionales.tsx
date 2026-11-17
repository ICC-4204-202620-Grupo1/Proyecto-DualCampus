import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Motivo = 'grupo_pequeno' | 'unanime' | 'complementaria' | 'sin_datos';
type Valor = { valor: number | null; motivo: Motivo | null };
type Indicadores = {
  alumnos: number | null;
  motivo: Motivo | null;
  promedioNotas: Valor;
  aprobacion: Valor;
  asistencia: Valor;
  distribucion: { motivo: Motivo | null; rangos: { rango: string; cantidad: number | null; motivo: Motivo | null }[] };
};
type Respuesta = {
  periodo: { id: string; nombre: string; fechaInicio: string; fechaFin: string };
  minimoAlumnos: number;
  institucion: Indicadores;
  cursos: (Indicadores & { codigo: string; nombre: string })[];
};

const MOTIVOS: Record<Motivo, string> = {
  grupo_pequeno: 'Oculto: menos de cinco alumnos',
  unanime: 'Oculto: revelaría el resultado de cada alumno',
  complementaria: 'Oculto: permitiría deducir otro valor oculto',
  sin_datos: 'Sin datos',
};

function Cifra({ v, sufijo = '' }: { v: Valor; sufijo?: string }) {
  if (v.valor !== null) return <>{v.valor.toLocaleString('es-CL')}{sufijo}</>;
  const texto = MOTIVOS[v.motivo ?? 'sin_datos'];
  return <span className="texto-suave" title={texto}>{v.motivo === 'sin_datos' ? '—' : 'Oculto'}</span>;
}

/**
 * H48 · Indicadores agregados de la institución para el director.
 * La API ya entrega los datos anonimizados; esta vista solo los muestra (CA3).
 */
export function IndicadoresInstitucionales({ periodoId }: { periodoId: string }) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setDatos(null);
    setError('');
    api<Respuesta>('/reporteria/indicadores-institucionales?periodoId=' + encodeURIComponent(periodoId))
      .then(d => { if (vigente) setDatos(d); })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudieron cargar los indicadores.'); });
    return () => { vigente = false; };
  }, [periodoId, version]);

  if (error) return <section className="panel"><p role="alert" className="alerta">{error} <button type="button" onClick={() => setVersion(v => v + 1)}>Reintentar</button></p></section>;
  if (!datos) return <section className="panel"><p role="status">Cargando indicadores…</p></section>;

  const inst = datos.institucion;
  return <section id="indicadores-institucionales" className="panel" aria-label="Indicadores institucionales">
    <p className="etiqueta">Reportería institucional</p>
    <h2>Indicadores del período {datos.periodo.nombre}</h2>
    <p className="texto-suave">
      Cifras agregadas, sin nombres ni identificadores. Se ocultan los grupos con menos de {datos.minimoAlumnos} alumnos
      y los valores que revelarían el resultado de alguien. Los totales consideran solo datos publicables.
    </p>

    <div className="tabla-contenedor"><table>
      <caption className="texto-suave">Institución</caption>
      <thead><tr><th>Alumnos</th><th>Promedio de notas</th><th>Notas aprobadas</th><th>Asistencia</th></tr></thead>
      <tbody><tr>
        <td>{inst.alumnos ?? <span className="texto-suave" title={MOTIVOS.grupo_pequeno}>Oculto</span>}</td>
        <td><Cifra v={inst.promedioNotas} /></td>
        <td><Cifra v={inst.aprobacion} sufijo="%" /></td>
        <td><Cifra v={inst.asistencia} sufijo="%" /></td>
      </tr></tbody>
    </table></div>

    <h3>Distribución de notas publicadas</h3>
    {inst.distribucion.motivo ? <p className="vacio">{MOTIVOS[inst.distribucion.motivo]}.</p> :
      <div className="tabla-contenedor"><table>
        <thead><tr>{inst.distribucion.rangos.map(c => <th key={c.rango}>{c.rango}</th>)}</tr></thead>
        <tbody><tr>{inst.distribucion.rangos.map(c => <td key={c.rango}>
          {c.cantidad ?? <span className="texto-suave" title={MOTIVOS[c.motivo ?? 'sin_datos']}>Oculto</span>}
        </td>)}</tr></tbody>
      </table></div>}

    <h3>Por curso</h3>
    {datos.cursos.length === 0 ? <p className="vacio">Sin cursos en este período.</p> :
      <div className="tabla-contenedor"><table>
        <thead><tr><th>Curso</th><th>Alumnos</th><th>Promedio</th><th>Notas aprobadas</th><th>Asistencia</th></tr></thead>
        <tbody>{datos.cursos.map(c => <tr key={c.codigo + c.nombre}>
          <td>{c.codigo} · {c.nombre}</td>
          {c.motivo ? <td colSpan={4} className="texto-suave">{MOTIVOS[c.motivo]}</td> : <>
            <td>{c.alumnos}</td>
            <td><Cifra v={c.promedioNotas} /></td>
            <td><Cifra v={c.aprobacion} sufijo="%" /></td>
            <td><Cifra v={c.asistencia} sufijo="%" /></td>
          </>}
        </tr>)}</tbody>
      </table></div>}
    <p className="texto-suave">Pasa el cursor sobre «Oculto» para ver el motivo.</p>
  </section>;
}
