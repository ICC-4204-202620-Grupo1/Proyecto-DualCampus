import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { ContextoInstitucion } from '../../database/contexto-institucion';
import { AutorizacionService } from '../autorizacion/autorizacion.service';

type Datos = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function id(valor: unknown): string {
  if (typeof valor !== 'string' || !UUID.test(valor)) throw new BadRequestException('Identificador inválido');
  return valor;
}

function texto(valor: unknown, campo: string, max: number): string {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > max) {
    throw new BadRequestException(campo + ': obligatorio, máximo ' + max + ' caracteres');
  }
  return valor.trim();
}

function fechaValida(valor: unknown): string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new BadRequestException('Fecha: formato inválido (YYYY-MM-DD)');
  }
  const d = new Date(valor + 'T00:00:00Z');
  if (isNaN(d.getTime())) throw new BadRequestException('Fecha inválida');
  return valor;
}

@Injectable()
export class EvaluacionesService {
  constructor(
    private readonly contexto: ContextoInstitucion,
    private readonly autorizacion: AutorizacionService,
  ) {}

  private async ejecutar<T>(institucion: string, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    try {
      return await this.contexto.ejecutar(institucion, fn);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException('Ya existe una evaluación con ese nombre en esta sección');
      }
      throw e;
    }
  }

  private async registrar(db: PoolClient, institucion: string, actor: string, recurso: string, accion: string, datos: unknown) {
    await db.query(
      'INSERT INTO evento_academico(institucion_id,actor_id,recurso_id,accion,datos) VALUES ($1,$2,$3,$4,$5)',
      [institucion, actor, recurso, accion, JSON.stringify(datos)],
    );
  }

  /**
   * Lista evaluaciones de una sección.
   * Visible para Administradores, Docentes de la sección y Alumnos inscritos.
   */
  async listar(actor: string, institucion: string, seccionId: string) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR', 'AYUDANTE', 'ALUMNO');
    const sid = id(seccionId);
    return this.ejecutar(institucion, async (db) => {
      const tieneAcceso = await db.query(
        `SELECT 1 FROM rol_en_institucion r
         WHERE r.usuario_id = $1 AND r.institucion_id = $2
           AND (
             r.rol = 'ADMINISTRADOR'
             OR EXISTS (SELECT 1 FROM equipo_docente e WHERE e.seccion_id = $3 AND e.usuario_id = $1)
             OR EXISTS (SELECT 1 FROM matricula m WHERE m.seccion_id = $3 AND m.usuario_id = $1)
           )`,
        [actor, institucion, sid],
      );
      if (!tieneAcceso.rowCount) throw new ForbiddenException('No tienes acceso a esta sección');

      const { rows } = await db.query(
        `SELECT id, seccion_id AS "seccionId", nombre, fecha, ponderacion,
                escala_minima AS "escalaMinima", escala_maxima AS "escalaMaxima",
                escala_aprobacion AS "escalaAprobacion", estado, creado_en AS "creadoEn"
         FROM evaluacion
         WHERE seccion_id = $1
         ORDER BY fecha ASC, creado_en ASC`,
        [sid],
      );
      return rows;
    });
  }

  /**
   * H14 · Registrar una evaluación presencial.
   * CA1: Nombre y fecha válidos crean una evaluación.
   * CA2: El ayudante no puede crearla (solo profesor asignado o admin).
   * CA3: Usa escala de la institución (1.0 a 7.0, aprobación 4.0).
   */
  async crear(actor: string, institucion: string, seccionId: string, dto: Datos) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR', 'AYUDANTE');
    const sid = id(seccionId);
    const nombre = texto(dto.nombre, 'Nombre de la evaluación', 100);
    const fecha = fechaValida(dto.fecha);

    let ponderacion = 0;
    if (dto.ponderacion !== undefined && dto.ponderacion !== null && dto.ponderacion !== '') {
      ponderacion = Number(dto.ponderacion);
      if (isNaN(ponderacion) || ponderacion < 0 || ponderacion > 100) {
        throw new BadRequestException('Ponderación: debe ser un número entre 0 y 100');
      }
    }

    return this.ejecutar(institucion, async (db) => {
      const seccionRes = await db.query('SELECT id FROM seccion WHERE id = $1', [sid]);
      if (!seccionRes.rowCount) throw new NotFoundException('Sección no encontrada');

      // CA2: El ayudante no puede crearla
      const rolAdmin = await db.query(
        `SELECT 1 FROM rol_en_institucion WHERE usuario_id = $1 AND institucion_id = $2 AND rol = 'ADMINISTRADOR'`,
        [actor, institucion],
      );
      const esAdmin = (rolAdmin.rowCount ?? 0) > 0;

      if (!esAdmin) {
        const docenteRes = await db.query(
          `SELECT rol FROM equipo_docente WHERE seccion_id = $1 AND usuario_id = $2`,
          [sid, actor],
        );
        if (!docenteRes.rowCount) {
          throw new ForbiddenException('No perteneces al equipo docente de esta sección');
        }
        const rolEnSeccion = docenteRes.rows[0].rol;
        if (rolEnSeccion === 'AYUDANTE') {
          throw new ForbiddenException('Los ayudantes no tienen permiso para crear evaluaciones');
        }
      }

      // Escala estándar de la institución (CA3)
      const escalaMin = 1.0;
      const escalaMax = 7.0;
      const escalaApr = 4.0;

      const { rows } = await db.query(
        `INSERT INTO evaluacion (
           institucion_id, seccion_id, nombre, fecha, ponderacion,
           escala_minima, escala_maxima, escala_aprobacion, estado, creado_por
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'BORRADOR', $9)
         RETURNING id, seccion_id AS "seccionId", nombre, fecha, ponderacion,
                   escala_minima AS "escalaMinima", escala_maxima AS "escalaMaxima",
                   escala_aprobacion AS "escalaAprobacion", estado, creado_en AS "creadoEn"`,
        [institucion, sid, nombre, fecha, ponderacion, escalaMin, escalaMax, escalaApr, actor],
      );

      const evaluacion = rows[0];
      await this.registrar(db, institucion, actor, sid, 'CREAR_EVALUACION', {
        evaluacionId: evaluacion.id,
        nombre: evaluacion.nombre,
        fecha: evaluacion.fecha,
        ponderacion: evaluacion.ponderacion,
      });

      return evaluacion;
    });
  }
}
