import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { ContextoInstitucion } from '../../database/contexto-institucion';
import { AutorizacionService } from '../autorizacion/autorizacion.service';

type Datos = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function id(valor: unknown): string {
  if (typeof valor !== 'string' || !UUID.test(valor)) throw new BadRequestException('Identificador inválido');
  return valor;
}

export interface NotaAlumnoDto {
  alumnoId: string;
  valor?: number | string | null;
  esAusente?: boolean;
}

@Injectable()
export class NotasService {
  constructor(
    private readonly contexto: ContextoInstitucion,
    private readonly autorizacion: AutorizacionService,
  ) {}

  private async ejecutar<T>(institucion: string, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    return this.contexto.ejecutar(institucion, fn);
  }

  private async registrar(db: PoolClient, institucion: string, actor: string, recurso: string, accion: string, datos: unknown) {
    await db.query(
      'INSERT INTO evento_academico(institucion_id,actor_id,recurso_id,accion,datos) VALUES ($1,$2,$3,$4,$5)',
      [institucion, actor, recurso, accion, JSON.stringify(datos)],
    );
  }

  /**
   * Obtiene la nómina de alumnos con sus notas para una evaluación.
   * CA3: Si está en BORRADOR, el alumno no puede ver las notas (403 Forbidden).
   */
  async listarNotas(actor: string, institucion: string, evaluacionId: string) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR', 'AYUDANTE', 'ALUMNO');
    const eid = id(evaluacionId);

    return this.ejecutar(institucion, async (db) => {
      const evRes = await db.query(
        `SELECT e.id, e.seccion_id AS "seccionId", e.nombre, e.estado,
                e.escala_minima AS "escalaMinima", e.escala_maxima AS "escalaMaxima"
         FROM evaluacion e
         WHERE e.id = $1`,
        [eid],
      );
      if (!evRes.rowCount) throw new NotFoundException('Evaluación no encontrada');
      const evaluacion = evRes.rows[0];

      // Verificar rol y pertenencia a la sección
      const rolRes = await db.query(
        `SELECT r.rol FROM rol_en_institucion r
         WHERE r.usuario_id = $1 AND r.institucion_id = $2`,
        [actor, institucion],
      );
      const rolesUsuario = rolRes.rows.map((r: { rol: string }) => r.rol);
      const esAdmin = rolesUsuario.includes('ADMINISTRADOR');

      const equipoRes = await db.query(
        `SELECT rol FROM equipo_docente WHERE seccion_id = $1 AND usuario_id = $2`,
        [evaluacion.seccionId, actor],
      );
      const esDocente = (equipoRes.rowCount ?? 0) > 0;

      const matriculaRes = await db.query(
        `SELECT 1 FROM matricula WHERE seccion_id = $1 AND usuario_id = $2`,
        [evaluacion.seccionId, actor],
      );
      const esAlumno = (matriculaRes.rowCount ?? 0) > 0;

      if (!esAdmin && !esDocente && !esAlumno) {
        throw new ForbiddenException('No tienes acceso a esta sección');
      }

      // CA3: El alumno no ve valores en el borrador
      if (!esAdmin && !esDocente && esAlumno) {
        if (evaluacion.estado === 'BORRADOR') {
          throw new ForbiddenException('El alumno no ve valores en el borrador');
        }
      }

      // Obtener todos los alumnos matriculados junto con su nota si existe
      const { rows } = await db.query(
        `SELECT u.id AS "alumnoId", u.nombre, u.email,
                n.id AS "notaId", n.valor, n.es_ausente AS "esAusente",
                n.actualizado_en AS "actualizadoEn"
         FROM matricula m
         JOIN usuario u ON u.id = m.usuario_id
         LEFT JOIN nota n ON n.evaluacion_id = $1 AND n.usuario_id = u.id
         WHERE m.seccion_id = $2
         ORDER BY u.nombre ASC, u.email ASC`,
        [eid, evaluacion.seccionId],
      );

      return {
        evaluacion: {
          id: evaluacion.id,
          nombre: evaluacion.nombre,
          estado: evaluacion.estado,
          escalaMinima: Number(evaluacion.escalaMinima),
          escalaMaxima: Number(evaluacion.escalaMaxima),
        },
        filas: rows.map((r: { alumnoId: string; nombre: string; email: string; notaId: string | null; valor: string | null; esAusente: boolean | null; actualizadoEn: string | null }) => ({
          alumnoId: r.alumnoId,
          nombre: r.nombre || r.email,
          email: r.email,
          notaId: r.notaId,
          valor: r.valor !== null ? Number(r.valor) : null,
          esAusente: r.esAusente ?? false,
          actualizadoEn: r.actualizadoEn,
        })),
      };
    });
  }

  /**
   * H15 · Ingresar notas en borrador.
   * CA1: Una nota válida se guarda y se recupera al reabrir.
   * CA2: Un valor fuera de escala no reemplaza la última nota válida.
   * Permitido para: Administrador, Profesor de la sección y Ayudante de la sección (Diego Riquelme).
   */
  async guardarNotas(actor: string, institucion: string, evaluacionId: string, dto: { notas?: unknown }) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR', 'AYUDANTE');
    const eid = id(evaluacionId);

    if (!Array.isArray(dto?.notas) || dto.notas.length === 0) {
      throw new BadRequestException('Debes enviar al menos una nota');
    }

    return this.ejecutar(institucion, async (db) => {
      const evRes = await db.query(
        `SELECT e.id, e.seccion_id AS "seccionId", e.estado,
                e.escala_minima AS "escalaMinima", e.escala_maxima AS "escalaMaxima"
         FROM evaluacion e
         WHERE e.id = $1`,
        [eid],
      );
      if (!evRes.rowCount) throw new NotFoundException('Evaluación no encontrada');
      const evaluacion = evRes.rows[0];

      // Verificar permisos de docente asignado o administrador
      const rolAdmin = await db.query(
        `SELECT 1 FROM rol_en_institucion WHERE usuario_id = $1 AND institucion_id = $2 AND rol = 'ADMINISTRADOR'`,
        [actor, institucion],
      );
      const esAdmin = (rolAdmin.rowCount ?? 0) > 0;

      if (!esAdmin) {
        const docenteRes = await db.query(
          `SELECT rol FROM equipo_docente WHERE seccion_id = $1 AND usuario_id = $2`,
          [evaluacion.seccionId, actor],
        );
        if (!docenteRes.rowCount) {
          throw new ForbiddenException('No tienes permiso para calificar en esta sección');
        }
      }

      const escalaMin = Number(evaluacion.escalaMinima);
      const escalaMax = Number(evaluacion.escalaMaxima);

      // Pre-validar todas las filas antes de cualquier escritura (CA2)
      const validadas: { alumnoId: string; valor: number | null; esAusente: boolean }[] = [];

      for (const item of dto.notas as NotaAlumnoDto[]) {
        const alumnoId = id(item.alumnoId);

        // Verificar que el alumno esté matriculado en la sección
        const matriculaRes = await db.query(
          `SELECT 1 FROM matricula WHERE seccion_id = $1 AND usuario_id = $2`,
          [evaluacion.seccionId, alumnoId],
        );
        if (!matriculaRes.rowCount) {
          throw new BadRequestException(`El alumno ${alumnoId} no está matriculado en esta sección`);
        }

        let valorNum: number | null = null;
        if (item.valor !== undefined && item.valor !== null && item.valor !== '') {
          valorNum = Number(item.valor);
          // CA2: Un valor fuera de escala no reemplaza la última nota válida
          if (isNaN(valorNum) || valorNum < escalaMin || valorNum > escalaMax) {
            throw new BadRequestException(
              `Valor ${item.valor} fuera de escala: la nota debe estar entre ${escalaMin.toFixed(1)} y ${escalaMax.toFixed(1)}`,
            );
          }
          // Redondear a 1 decimal
          valorNum = Math.round(valorNum * 10) / 10;
        }

        validadas.push({
          alumnoId,
          valor: valorNum,
          esAusente: item.esAusente === true,
        });
      }

      // Upsert de notas válidas
      for (const v of validadas) {
        await db.query(
          `INSERT INTO nota (institucion_id, evaluacion_id, usuario_id, valor, es_ausente, modificado_por, actualizado_en)
           VALUES ($1, $2, $3, $4, $5, $6, now())
           ON CONFLICT (evaluacion_id, usuario_id)
           DO UPDATE SET valor = EXCLUDED.valor,
                         es_ausente = EXCLUDED.es_ausente,
                         modificado_por = EXCLUDED.modificado_por,
                         actualizado_en = now()`,
          [institucion, eid, v.alumnoId, v.valor, v.esAusente, actor],
        );
      }

      await this.registrar(db, institucion, actor, eid, 'GUARDAR_NOTAS_BORRADOR', {
        totalGuardadas: validadas.length,
      });

      return {
        mensaje: 'Notas guardadas correctamente',
        total: validadas.length,
      };
    });
  }
}
