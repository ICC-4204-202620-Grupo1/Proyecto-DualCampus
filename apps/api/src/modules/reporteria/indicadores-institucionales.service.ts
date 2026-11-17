import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContextoInstitucion } from '../../database/contexto-institucion.js';
import { AutorizacionService } from '../autorizacion/autorizacion.service.js';
import {
  DatosGrupo,
  IndicadoresPublicos,
  indicadoresDeGrupo,
  indicadoresTotales,
  MINIMO_ALUMNOS,
} from './anonimizacion.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface IndicadoresCurso extends IndicadoresPublicos {
  codigo: string;
  nombre: string;
}

export interface IndicadoresInstitucionales {
  periodo: { id: string; nombre: string; fechaInicio: string; fechaFin: string };
  minimoAlumnos: number;
  institucion: IndicadoresPublicos;
  cursos: IndicadoresCurso[];
}

/**
 * H48 · Consultar indicadores institucionales (director).
 * Agrega por curso y por institución las fuentes de H46 (notas publicadas) y H47 (asistencia).
 * CA3: la anonimización ocurre aquí, en el servidor; la respuesta nunca contiene alumnos,
 * secciones ni datos crudos, sea cual sea la petición.
 */
@Injectable()
export class IndicadoresInstitucionalesService {
  constructor(
    private readonly contexto: ContextoInstitucion,
    private readonly autorizacion: AutorizacionService,
  ) {}

  async consultar(actor: string, institucion: string, periodoId: unknown): Promise<IndicadoresInstitucionales> {
    if (typeof periodoId !== 'string' || !UUID.test(periodoId)) throw new BadRequestException('Período inválido');
    await this.autorizacion.exigirRol(actor, institucion, 'DIRECTOR');

    return this.contexto.ejecutar(institucion, async (db) => {
      const periodo = await db.query(
        `SELECT id, nombre, fecha_inicio AS "fechaInicio", fecha_fin AS "fechaFin"
           FROM periodo WHERE id = $1 AND institucion_id = $2`,
        [periodoId, institucion],
      );
      if (!periodo.rowCount) throw new NotFoundException('Período no encontrado');

      const cursos = await db.query<{ id: string; codigo: string; nombre: string }>(
        `SELECT id, codigo, nombre FROM curso
          WHERE periodo_id = $1 AND institucion_id = $2
          ORDER BY codigo, nombre, id`,
        [periodoId, institucion],
      );
      const datos = new Map<string, DatosGrupo>(
        cursos.rows.map((c) => [c.id, { alumnos: new Set<string>(), notas: [], marcas: [] }]),
      );

      // Alumnos del curso en cualquiera de sus secciones, incluidos los retirados, cuyas notas
      // publicadas se conservan (igual que H46).
      const matriculas = await db.query<{ cursoId: string; alumno: string }>(
        `SELECT s.curso_id AS "cursoId", m.usuario_id AS alumno
           FROM matricula m
           JOIN seccion s ON s.id = m.seccion_id AND s.institucion_id = m.institucion_id
          WHERE s.periodo_id = $1 AND s.institucion_id = $2`,
        [periodoId, institucion],
      );
      for (const m of matriculas.rows) datos.get(m.cursoId)?.alumnos.add(m.alumno);

      // H46: solo evaluaciones publicadas y notas numéricas de alumnos matriculados.
      const notas = await db.query<{ cursoId: string; alumno: string; valor: number; aprueba: boolean }>(
        `SELECT s.curso_id AS "cursoId", n.usuario_id AS alumno, n.valor::float8 AS valor,
                (n.valor >= e.escala_aprobacion) AS aprueba
           FROM evaluacion e
           JOIN nota n ON n.evaluacion_id = e.id AND n.institucion_id = e.institucion_id
           JOIN seccion s ON s.id = e.seccion_id AND s.institucion_id = e.institucion_id
           JOIN matricula m ON m.seccion_id = s.id AND m.institucion_id = s.institucion_id AND m.usuario_id = n.usuario_id
          WHERE s.periodo_id = $1 AND e.institucion_id = $2 AND e.estado = 'PUBLICADA'
            AND n.valor IS NOT NULL AND n.es_ausente = false`,
        [periodoId, institucion],
      );
      for (const n of notas.rows) {
        const valor = Number(n.valor);
        if (Number.isFinite(valor) && valor >= 1 && valor <= 7) {
          datos.get(n.cursoId)?.notas.push({ alumno: n.alumno, valor, aprueba: n.aprueba });
        }
      }

      // H47: marca vigente de cada alumno en cada clase.
      const marcas = await db.query<{ cursoId: string; alumno: string; presente: boolean }>(
        `SELECT s.curso_id AS "cursoId", a.alumno_id AS alumno, a.presente
           FROM asistencia_clase a
           JOIN clase c ON c.id = a.clase_id AND c.institucion_id = a.institucion_id
           JOIN seccion s ON s.id = c.seccion_id AND s.institucion_id = c.institucion_id
          WHERE s.periodo_id = $1 AND a.institucion_id = $2`,
        [periodoId, institucion],
      );
      for (const m of marcas.rows) datos.get(m.cursoId)?.marcas.push({ alumno: m.alumno, presente: m.presente });

      const grupos = cursos.rows.map((c) => {
        const d = datos.get(c.id)!;
        return { curso: c, datos: d, publicos: indicadoresDeGrupo(d) };
      });

      // CA1: solo código y nombre del curso junto a cifras agregadas; ningún id ni alumno.
      return {
        periodo: periodo.rows[0],
        minimoAlumnos: MINIMO_ALUMNOS,
        institucion: indicadoresTotales(grupos),
        cursos: grupos.map((g) => ({ codigo: g.curso.codigo, nombre: g.curso.nombre, ...g.publicos })),
      };
    });
  }
}
