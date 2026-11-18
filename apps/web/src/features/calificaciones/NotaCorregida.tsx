/** Nota publicada que fue corregida (H22): valor anterior y fecha de la última corrección. */
export interface CorreccionNota {
  valorAnterior: number | null;
  ausenteAnterior: boolean;
  corregidoEn: string;
}

const formato = (valor: number | null, ausente: boolean) =>
  ausente ? 'Ausente' : valor === null ? 'Sin nota' : valor.toFixed(1);

/**
 * Muestra la nota vigente. Si fue corregida, muestra la nota anterior tachada,
 * la nueva y la fecha de la corrección.
 */
export function NotaConCorreccion({ valor, esAusente, correccion, sinNota = 'Sin nota registrada' }: {
  valor: number | null;
  esAusente: boolean;
  correccion?: CorreccionNota | null;
  sinNota?: string;
}) {
  const actual = esAusente ? 'Ausente' : valor === null ? sinNota : valor.toFixed(1);
  if (!correccion) return <>{actual}</>;
  const anterior = formato(correccion.valorAnterior, correccion.ausenteAnterior);
  return <span className="nota-corregida">
    <span className="nota-cambio" aria-label={`Nota corregida: antes ${anterior}, ahora ${actual}`}>
      <del className="nota-anterior">{anterior}</del>
      <span aria-hidden="true"> → </span>
      <strong>{actual}</strong>
    </span>
    <small>Corregida el {new Date(correccion.corregidoEn).toLocaleDateString('es-CL')}</small>
  </span>;
}
