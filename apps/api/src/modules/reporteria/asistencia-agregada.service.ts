
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContextoInstitucion } from '../../database/contexto-institucion.js';
import { AutorizacionService } from '../autorizacion/autorizacion.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Regla propuesta para D2: proteger grupos pequeños.
const MINIMO_ALUMNOS_AGREGACION = 5;

type FilaClase = {
  id: string;
  fecha: string;
  presentes: number | string;
  marcasConsideradas: number | string;
};

function porcentaje(presentes: number, consideradas: number): number | null {
  return consideradas > 0
    ? Math.round((presentes / consideradas) * 10000) / 100
    : null;
}

@Injectable()
export class AsistenciaAgregadaService {
  constructor(
    private readonly contexto: ContextoInstitucion,
    private readonly autorizacion: AutorizacionService,
  ) {}

  async consultar(actor: string, institucion: string, seccionId: string) {
    if (!UUID.test(seccionId)) {
      throw new BadRequestException('Sección inválida');
    }

    // Solo profesores con rol vigente en la institución.
    await this.autorizacion.exigirRol(actor, institucion, 'PROFESOR');

    return this.contexto.ejecutar(institucion, async db => {

      // Obtener información de la sección y cantidad de alumnos activos.
      const resultadoSeccion = await db.query(
        `SELECT
           s.id,
           s.codigo,
           c.codigo AS "cursoCodigo",
           c.nombre AS curso,
           p.id AS "periodoId",
           p.nombre AS periodo,
           (
             SELECT COUNT(*)::int
             FROM matricula m
             WHERE m.seccion_id = s.id
               AND m.estado = 'ACTIVA'
           ) AS "alumnosActivos"
         FROM seccion s
         JOIN curso c ON c.id = s.curso_id
         JOIN periodo p ON p.id = s.periodo_id
         WHERE s.id = $1
           AND s.institucion_id = $2`,
        [seccionId, institucion],
      );

      if (!resultadoSeccion.rowCount) {
        throw new NotFoundException('Sección no encontrada');
      }

      const datos = resultadoSeccion.rows[0];

      const seccion = {
        id: datos.id,
        codigo: datos.codigo,
        cursoCodigo: datos.cursoCodigo,
        curso: datos.curso,
        periodoId: datos.periodoId,
        periodo: datos.periodo,
      };

      // El profesor debe estar asignado específicamente a esta sección.
      const asignacion = await db.query(
        `SELECT 1
         FROM equipo_docente
         WHERE institucion_id = $1
           AND seccion_id = $2
           AND usuario_id = $3
           AND rol = 'PROFESOR'`,
        [institucion, seccionId, actor],
      );

      if (!asignacion.rowCount) {
        throw new ForbiddenException(
          'No estás asignado como profesor a esta sección',
        );
      }

      // No publicar agregados de grupos pequeños.
      if (Number(datos.alumnosActivos) < MINIMO_ALUMNOS_AGREGACION) {
        return {
          disponible: false,
          motivo:
            'No se puede mostrar la asistencia agregada de esta sección.',
          seccion,
          presentes: null,
          marcasConsideradas: null,
          clasesConsideradas: null,
          totalClases: null,
          proporcion: null,
          clases: [],
        };
      }

      // Se consulta la marca VIGENTE de cada alumno.
      // Las correcciones de H37 ya actualizan asistencia_clase.presente.
      // COUNT(alumno_id) excluye las filas sin marca.
      const resultadoClases = await db.query(
        `SELECT
           c.id,
           c.fecha,
           COUNT(a.alumno_id)::int AS "marcasConsideradas",
           COUNT(a.alumno_id)
             FILTER (WHERE a.presente IS TRUE)::int AS presentes
         FROM clase c
         LEFT JOIN asistencia_clase a
           ON a.clase_id = c.id
           AND a.institucion_id = c.institucion_id
         WHERE c.institucion_id = $1
           AND c.seccion_id = $2
         GROUP BY c.id, c.fecha
         ORDER BY c.fecha DESC, c.id`,
        [institucion, seccionId],
      );

      const clases = (resultadoClases.rows as FilaClase[]).map(f => {
        const presentes = Number(f.presentes);
        const marcasConsideradas = Number(f.marcasConsideradas);

        return {
          id: f.id,
          fecha: f.fecha,
          presentes,
          marcasConsideradas,
          proporcion: porcentaje(presentes, marcasConsideradas),
        };
      });

      // Resumen de toda la sección.
      const presentes = clases.reduce((s, c) => s + c.presentes, 0);

      const marcasConsideradas = clases.reduce(
        (s, c) => s + c.marcasConsideradas,
        0,
      );

      // Una clase se considera cuando tiene al menos una marca.
      const clasesConsideradas = clases.filter(
        c => c.marcasConsideradas > 0,
      ).length;

      const totalClases = clases.length;

      return {
        disponible: true,
        seccion,
        presentes,
        marcasConsideradas,
        clasesConsideradas,
        totalClases,
        proporcion: porcentaje(presentes, marcasConsideradas),
        clases,
      };
    });
  }
}
