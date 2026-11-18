/**
 * Nota publicada que fue corregida (H22): valor anterior y fecha de la última corrección.
 * Se lee del evento CORREGIR_NOTA_PUBLICADA, que guarda el valor previo de cada corrección.
 */
export interface CorreccionNota {
  valorAnterior: number | null;
  ausenteAnterior: boolean;
  corregidoEn: string;
}

/**
 * LEFT JOIN LATERAL con la última corrección de la nota de un alumno en una evaluación.
 * Recibe las expresiones SQL de la evaluación y del alumno; agrega las columnas
 * "correccionValorAnterior", "correccionAusenteAnterior" y "correccionEn" (NULL si nunca se corrigió).
 */
export function joinUltimaCorreccion(evaluacion: string, alumno: string): string {
  return `LEFT JOIN LATERAL (
      SELECT (c.datos->>'valorPrevio')::float8 AS "correccionValorAnterior",
             COALESCE((c.datos->>'ausentePrevio')::boolean, false) AS "correccionAusenteAnterior",
             c.creado_en AS "correccionEn"
        FROM evento_academico c
       WHERE c.recurso_id = ${evaluacion}
         AND c.accion = 'CORREGIR_NOTA_PUBLICADA'
         AND c.datos->>'alumnoId' = (${alumno})::text
       ORDER BY c.creado_en DESC, c.id DESC
       LIMIT 1
    ) correccion ON true`;
}

export const COLUMNAS_CORRECCION =
  'correccion."correccionValorAnterior", correccion."correccionAusenteAnterior", correccion."correccionEn"';

/** Convierte las columnas de joinUltimaCorreccion en el objeto que recibe la interfaz. */
export function leerCorreccion(fila: {
  correccionValorAnterior?: number | string | null;
  correccionAusenteAnterior?: boolean | null;
  correccionEn?: string | Date | null;
}): CorreccionNota | null {
  if (!fila.correccionEn) return null;
  return {
    valorAnterior: fila.correccionValorAnterior === null || fila.correccionValorAnterior === undefined ? null : Number(fila.correccionValorAnterior),
    ausenteAnterior: fila.correccionAusenteAnterior === true,
    corregidoEn: new Date(fila.correccionEn).toISOString(),
  };
}
