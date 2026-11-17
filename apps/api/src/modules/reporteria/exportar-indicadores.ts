import type { IndicadoresInstitucionales } from './indicadores-institucionales.service.js';
import type { IndicadoresPublicos, MotivoSupresion, ValorPublico } from './anonimizacion.js';

const MOTIVOS: Record<MotivoSupresion, string> = {
  grupo_pequeno: 'Oculto: menos de cinco alumnos',
  unanime: 'Oculto: revelaría el resultado de cada alumno',
  complementaria: 'Oculto: permitiría deducir otro valor oculto',
  sin_datos: 'Sin datos',
};

function visible(valor: number | null, motivo: MotivoSupresion | null): string | number {
  return valor === null ? MOTIVOS[motivo ?? 'sin_datos'] : valor;
}

function cifra(valor: ValorPublico): string | number {
  return visible(valor.valor, valor.motivo);
}

function filaIndicadores(ambito: string, curso: string, datos: IndicadoresPublicos) {
  return [ambito, curso, visible(datos.alumnos, datos.motivo), cifra(datos.promedioNotas),
    cifra(datos.aprobacion), cifra(datos.asistencia)];
}

// Los nombres de cursos y facultades son editables: evitar fórmulas al abrir el CSV en Excel.
function celda(valor: string | number): string {
  let texto = String(valor);
  if (/^[\s]*[=+@-]/.test(texto)) texto = "'" + texto;
  return '"' + texto.replaceAll('"', '""') + '"';
}

/** Serializa solo la respuesta pública de H49; jamás recibe notas ni alumnos individuales. */
export function exportarIndicadoresCsv(datos: IndicadoresInstitucionales, generadoEn = new Date()): string {
  const filas: (string | number)[][] = [
    ['Fecha de exportación', generadoEn.toISOString()],
    ['Período', datos.periodo.nombre],
    ['Facultad', datos.filtros.facultad ?? 'Todas las facultades'],
    ['Mínimo de alumnos por grupo', datos.minimoAlumnos],
    ['Denominador: alumnos', visible(datos.denominadores.alumnos, datos.institucion.motivo)],
    ['Denominador: notas', visible(datos.denominadores.notas, datos.institucion.promedioNotas.motivo)],
    ['Denominador: marcas de asistencia', visible(datos.denominadores.asistencia, datos.institucion.asistencia.motivo)],
    [],
    ['Ámbito', 'Curso', 'Alumnos', 'Promedio de notas', 'Notas aprobadas (%)', 'Asistencia (%)'],
    filaIndicadores('Institución', '', datos.institucion),
    ...datos.cursos.map(c => filaIndicadores('Curso', `${c.codigo} · ${c.nombre}`, c)),
    [],
    ['Distribución de notas publicadas de la institución'],
  ];
  if (datos.institucion.distribucion.motivo) {
    filas.push([MOTIVOS[datos.institucion.distribucion.motivo]]);
  } else {
    filas.push(['Rango', 'Cantidad']);
    for (const rango of datos.institucion.distribucion.rangos) {
      filas.push([rango.rango, visible(rango.cantidad, rango.motivo)]);
    }
  }
  return '\uFEFF' + filas.map(f => f.map(celda).join(',')).join('\r\n') + '\r\n';
}
