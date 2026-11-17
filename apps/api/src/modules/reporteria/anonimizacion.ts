/**
 * H48 · Reglas de anonimización de la reportería institucional (D2).
 * Funciones puras: reciben observaciones con el alumno solo para contar personas distintas
 * y devuelven indicadores públicos que nunca incluyen identificadores individuales (CA1).
 */

/** CA2 · Ningún indicador se publica con menos alumnos distintos que este mínimo. */
export const MINIMO_ALUMNOS = 5;

/**
 * grupo_pequeno: aportan datos menos de MINIMO_ALUMNOS alumnos.
 * unanime: el valor revelaría el resultado de cada alumno (todos aprueban, todos en el mismo rango...).
 * complementaria: se oculta para que una celda suprimida no se deduzca restando del total.
 * sin_datos: no hay observaciones.
 */
export type MotivoSupresion = 'grupo_pequeno' | 'unanime' | 'complementaria' | 'sin_datos';

export interface NotaObservada { alumno: string; valor: number; aprueba: boolean }
export interface MarcaObservada { alumno: string; presente: boolean }

/** Datos crudos de un grupo. Solo existen dentro del servidor; jamás se devuelven. */
export interface DatosGrupo {
  alumnos: Set<string>;
  notas: NotaObservada[];
  marcas: MarcaObservada[];
}

export interface ValorPublico { valor: number | null; motivo: MotivoSupresion | null }
export interface CeldaPublica { rango: string; cantidad: number | null; motivo: MotivoSupresion | null }
export interface DistribucionPublica { motivo: MotivoSupresion | null; rangos: CeldaPublica[] }

export interface IndicadoresPublicos {
  /** null cuando el grupo tiene menos de MINIMO_ALUMNOS alumnos. */
  alumnos: number | null;
  motivo: MotivoSupresion | null;
  promedioNotas: ValorPublico;
  /** Porcentaje de notas publicadas sobre la escala de aprobación de su evaluación. */
  aprobacion: ValorPublico;
  /** Porcentaje de marcas de asistencia presentes. */
  asistencia: ValorPublico;
  distribucion: DistribucionPublica;
}

export const RANGOS = ['1,0–1,9', '2,0–2,9', '3,0–3,9', '4,0–4,9', '5,0–5,9', '6,0–7,0'];

const redondear = (n: number) => Math.round(n * 10) / 10;
const suprimido = (motivo: MotivoSupresion): ValorPublico => ({ valor: null, motivo });
const distintos = (xs: { alumno: string }[]) => new Set(xs.map((x) => x.alumno)).size;

/** Índice de rango igual que H46: 1,0–1,9 … 5,0–5,9 y 6,0–7,0. */
export function indiceRango(nota: number): number {
  return Math.min(6, Math.floor(nota)) - 1;
}

function distribucionSuprimida(motivo: MotivoSupresion): DistribucionPublica {
  return { motivo, rangos: RANGOS.map((rango) => ({ rango, cantidad: null, motivo })) };
}

/** Valor que depende de que todos los alumnos no compartan el mismo resultado. */
function porcentaje<T>(obs: T[], alumnos: number, exito: (o: T) => boolean): ValorPublico {
  if (obs.length === 0) return suprimido('sin_datos');
  if (alumnos < MINIMO_ALUMNOS) return suprimido('grupo_pequeno');
  const exitos = obs.filter(exito).length;
  // 0 % o 100 % revelan el resultado de cada alumno del grupo.
  if (exitos === 0 || exitos === obs.length) return suprimido('unanime');
  return { valor: redondear((exitos / obs.length) * 100), motivo: null };
}

function promedio(notas: NotaObservada[]): ValorPublico {
  if (notas.length === 0) return suprimido('sin_datos');
  if (distintos(notas) < MINIMO_ALUMNOS) return suprimido('grupo_pequeno');
  // Si todas las notas son iguales, el promedio es la nota de cada alumno.
  if (notas.every((n) => n.valor === notas[0].valor)) return suprimido('unanime');
  return { valor: redondear(notas.reduce((s, n) => s + n.valor, 0) / notas.length), motivo: null };
}

function distribucion(notas: NotaObservada[]): DistribucionPublica {
  if (notas.length === 0) return distribucionSuprimida('sin_datos');
  if (distintos(notas) < MINIMO_ALUMNOS) return distribucionSuprimida('grupo_pequeno');
  const celdas = RANGOS.map(() => ({ cantidad: 0, alumnos: new Set<string>() }));
  for (const n of notas) {
    const c = celdas[indiceRango(n.valor)];
    c.cantidad += 1;
    c.alumnos.add(n.alumno);
  }
  // Todas las notas en un mismo rango revelan el rango de cada alumno.
  if (celdas.filter((c) => c.cantidad > 0).length === 1) return distribucionSuprimida('unanime');

  const motivos: (MotivoSupresion | null)[] = celdas.map((c) =>
    c.cantidad > 0 && c.alumnos.size < MINIMO_ALUMNOS ? 'grupo_pequeno' : null,
  );
  // Supresión complementaria: con una sola celda oculta, total menos visibles la revelaría.
  if (motivos.filter(Boolean).length === 1) {
    const candidata = celdas
      .map((c, i) => ({ i, cantidad: c.cantidad }))
      .filter(({ i, cantidad }) => !motivos[i] && cantidad > 0)
      .sort((a, b) => a.cantidad - b.cantidad)[0];
    if (candidata) motivos[candidata.i] = 'complementaria';
  }
  return {
    motivo: null,
    rangos: RANGOS.map((rango, i) => ({ rango, cantidad: motivos[i] ? null : celdas[i].cantidad, motivo: motivos[i] })),
  };
}

/** CA1 y CA2 · Indicadores públicos de un grupo (curso) del período. */
export function indicadoresDeGrupo(datos: DatosGrupo): IndicadoresPublicos {
  if (datos.alumnos.size < MINIMO_ALUMNOS) {
    return {
      alumnos: null,
      motivo: 'grupo_pequeno',
      promedioNotas: suprimido('grupo_pequeno'),
      aprobacion: suprimido('grupo_pequeno'),
      asistencia: suprimido('grupo_pequeno'),
      distribucion: distribucionSuprimida('grupo_pequeno'),
    };
  }
  return {
    alumnos: datos.alumnos.size,
    motivo: null,
    promedioNotas: promedio(datos.notas),
    aprobacion: porcentaje(datos.notas, distintos(datos.notas), (n) => n.aprueba),
    asistencia: porcentaje(datos.marcas, distintos(datos.marcas), (m) => m.presente),
    distribucion: distribucion(datos.notas),
  };
}

/**
 * CA2 · Totales de la institución. Cada indicador se calcula solo con los datos de los grupos
 * en que ese indicador ya se publicó: lo suprimido nunca entra en una cifra visible, por lo
 * que no puede deducirse restando el total menos los grupos publicados.
 */
export function indicadoresTotales(grupos: { datos: DatosGrupo; publicos: IndicadoresPublicos }[]): IndicadoresPublicos {
  const unir = (incluir: (p: IndicadoresPublicos) => boolean): DatosGrupo => {
    const union: DatosGrupo = { alumnos: new Set(), notas: [], marcas: [] };
    for (const g of grupos.filter((g) => incluir(g.publicos))) {
      g.datos.alumnos.forEach((a) => union.alumnos.add(a));
      union.notas.push(...g.datos.notas);
      union.marcas.push(...g.datos.marcas);
    }
    return union;
  };
  // El total de alumnos tampoco puede incluir grupos ocultos: restar los cursos
  // visibles revelaría cuántas personas hay en un curso pequeño.
  const todos = unir((p) => p.motivo === null);
  if (todos.alumnos.size < MINIMO_ALUMNOS) return indicadoresDeGrupo(todos);
  const conPromedio = unir((p) => p.promedioNotas.valor !== null).notas;
  const conAprobacion = unir((p) => p.aprobacion.valor !== null).notas;
  const conAsistencia = unir((p) => p.asistencia.valor !== null).marcas;
  // En la distribución no basta con el grupo: una celda oculta dentro de un grupo publicado
  // tampoco puede entrar al total, o se deduciría restando las celdas visibles de los demás.
  const conDistribucion = grupos
    .filter((g) => g.publicos.distribucion.motivo === null)
    .flatMap((g) => g.datos.notas.filter((n) => g.publicos.distribucion.rangos[indiceRango(n.valor)].cantidad !== null));
  // Sin datos publicables no siempre es «sin datos»: puede haberlos, todos ocultos.
  const motivoSinPublicar = (hayDatos: boolean, motivos: (MotivoSupresion | null)[]): MotivoSupresion => {
    if (!hayDatos) return 'sin_datos';
    const ocultos = motivos.filter((m): m is MotivoSupresion => m !== null && m !== 'sin_datos');
    return ocultos.length && ocultos.every((m) => m === ocultos[0]) ? ocultos[0] : 'grupo_pequeno';
  };
  const motivoNotas = (motivo: (p: IndicadoresPublicos) => MotivoSupresion | null) =>
    motivoSinPublicar(todos.notas.length > 0, grupos.map((g) => motivo(g.publicos)));
  const celdasOcultas = grupos.flatMap((g) => g.publicos.distribucion.motivo
    ? [g.publicos.distribucion.motivo]
    : g.publicos.distribucion.rangos.map((c) => c.motivo));
  return {
    alumnos: todos.alumnos.size,
    motivo: null,
    promedioNotas: conPromedio.length ? promedio(conPromedio) : suprimido(motivoNotas((p) => p.promedioNotas.motivo)),
    aprobacion: conAprobacion.length
      ? porcentaje(conAprobacion, distintos(conAprobacion), (n) => n.aprueba)
      : suprimido(motivoNotas((p) => p.aprobacion.motivo)),
    asistencia: conAsistencia.length
      ? porcentaje(conAsistencia, distintos(conAsistencia), (m) => m.presente)
      : suprimido(motivoSinPublicar(todos.marcas.length > 0, grupos.map((g) => g.publicos.asistencia.motivo))),
    distribucion: conDistribucion.length
      ? distribucion(conDistribucion)
      : distribucionSuprimida(motivoSinPublicar(todos.notas.length > 0, celdasOcultas)),
  };
}
