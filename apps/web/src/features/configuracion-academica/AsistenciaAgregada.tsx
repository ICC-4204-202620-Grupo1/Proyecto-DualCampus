
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Clase = {
  id: string;
  fecha: string;
  presentes: number;
  marcasConsideradas: number;
  proporcion: number | null;
};

type Respuesta = {
  disponible: boolean;
  motivo?: string;
  seccion: {
    id: string;
    codigo: string;
    cursoCodigo: string;
    curso: string;
    periodoId: string;
    periodo: string;
  };
  presentes: number | null;
  marcasConsideradas: number | null;
  clasesConsideradas: number | null;
  totalClases: number | null;
  proporcion: number | null;
  clases: Clase[];
};

export function AsistenciaAgregada({
  seccionId,
}: {
  seccionId: string;
}) {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;

    setCargando(true);
    setError('');
    setDatos(null);

    api<Respuesta>(
      `/reporteria/secciones/${seccionId}/asistencia-agregada`,
    )
      .then(r => {
        if (vigente) setDatos(r);
      })
      .catch(e => {
        if (vigente) {
          setError(
            e instanceof Error
              ? e.message
              : 'No se pudo consultar la asistencia agregada',
          );
        }
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, [seccionId, version]);

  if (cargando) {
    return <p role="status">Cargando asistencia agregada…</p>;
  }

  if (error) {
    return (
      <p className="alerta" role="alert">
        {error}{' '}
        <button type="button" onClick={() => setVersion(v => v + 1)}>
          Reintentar
        </button>
      </p>
    );
  }

  if (!datos) {
    return <p className="vacio">No se encontraron datos.</p>;
  }

  return (
    <section
      className="detalle-seccion"
      aria-label="Asistencia agregada por sección"
    >
      <p className="etiqueta">04 · Asistencia</p>
      <h3>Asistencia agregada por sección</h3>

      <p className="texto-suave">
        Período: <strong>{datos.seccion.periodo}</strong>
        {' · '}
        {datos.seccion.cursoCodigo}
        {' · '}
        {datos.seccion.curso}
        {' · Sección '}
        {datos.seccion.codigo}
      </p>

      {!datos.disponible ? (
        <p className="vacio" role="status">
          {datos.motivo}
        </p>
      ) : !datos.totalClases ? (
        <p className="vacio">
          Sin datos: todavía no hay clases registradas.
        </p>
      ) : (
        <>
          <div className="resumen-asistencia">
            <p>
              <strong>{datos.presentes}</strong>
              {' marcas de presente'}
            </p>

            <p>
              <strong>{datos.clasesConsideradas}</strong>
              {' clases consideradas de '}
              <strong>{datos.totalClases}</strong>
              {' registradas'}
            </p>

            <p>
              <strong>{datos.marcasConsideradas}</strong>
              {' marcas consideradas (denominador)'}
            </p>

            <p>
              Proporción agregada:{' '}
              <strong>
                {datos.proporcion === null
                  ? 'Sin datos'
                  : `${datos.proporcion}%`}
              </strong>
            </p>
          </div>

          <p className="texto-suave">
            Se cuentan únicamente las marcas explícitas de presente
            y ausente. Las clases sin marcas no se consideran ausencias.
          </p>

          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Presentes</th>
                  <th scope="col">Marcas consideradas</th>
                  <th scope="col">Proporción</th>
                </tr>
              </thead>

              <tbody>
                {datos.clases.map(clase => (
                  <tr key={clase.id}>
                    <td>{clase.fecha}</td>
                    <td>{clase.presentes}</td>
                    <td>
                      {clase.marcasConsideradas === 0
                        ? 'Sin marcas'
                        : clase.marcasConsideradas}
                    </td>
                    <td>
                      {clase.proporcion === null
                        ? 'Sin datos'
                        : `${clase.proporcion}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
