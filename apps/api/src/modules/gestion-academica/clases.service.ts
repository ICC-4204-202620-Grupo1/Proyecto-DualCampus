import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { ContextoInstitucion } from '../../database/contexto-institucion.js';
import { AutorizacionService } from '../autorizacion/autorizacion.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class ClasesService {
  constructor(private readonly contexto: ContextoInstitucion, private readonly autorizacion: AutorizacionService) {}

  private async ejecutar<T>(institucion: string, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    try { return await this.contexto.ejecutar(institucion, fn); }
    catch (e) { if ((e as { code?: string }).code === '23505') throw new ConflictException('Ya existe una clase registrada para esa fecha'); throw e; }
  }

  private validarSeccion(valor: unknown): string {
    if (typeof valor !== 'string' || !UUID.test(valor)) throw new BadRequestException('Sección inválida');
    return valor;
  }

  private validarFecha(valor: unknown): string {
    if (typeof valor !== 'string' || !FECHA.test(valor)) throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD');
    const fecha = new Date(`${valor}T00:00:00Z`);
    if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) throw new BadRequestException('La fecha no es válida');
    return valor;
  }

  private async exigirAcceso(db: PoolClient, actor: string, institucion: string, seccion: string) {
    const existe = await db.query('SELECT 1 FROM seccion WHERE id=$1', [seccion]);
    if (!existe.rowCount) throw new NotFoundException('Sección no encontrada');
    const permiso = await db.query(`SELECT 1 FROM rol_en_institucion r
      WHERE r.usuario_id=$1 AND r.institucion_id=$2 AND r.rol='ADMINISTRADOR'
      UNION SELECT 1 FROM equipo_docente e WHERE e.usuario_id=$1 AND e.institucion_id=$2
        AND e.seccion_id=$3 AND e.rol='PROFESOR'`, [actor, institucion, seccion]);
    if (!permiso.rowCount) throw new ForbiddenException('Solo el profesor asignado puede registrar clases');
  }

  async listar(actor: string, institucion: string, seccionId: string) {
    const seccion = this.validarSeccion(seccionId);
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR', 'AYUDANTE', 'ALUMNO');
    return this.ejecutar(institucion, async db => {
      const acceso = await db.query(`SELECT 1 FROM seccion s WHERE s.id=$1 AND (
        EXISTS (SELECT 1 FROM rol_en_institucion r WHERE r.usuario_id=$2 AND r.institucion_id=$3 AND r.rol='ADMINISTRADOR')
        OR EXISTS (SELECT 1 FROM equipo_docente e WHERE e.seccion_id=s.id AND e.usuario_id=$2)
        OR EXISTS (SELECT 1 FROM matricula m WHERE m.seccion_id=s.id AND m.usuario_id=$2))`, [seccion, actor, institucion]);
      if (!acceso.rowCount) throw new ForbiddenException('No tienes acceso a esta sección');
      return (await db.query(`SELECT id,fecha,creado_por AS "creadoPor",creado_en AS "creadoEn"
        FROM clase WHERE seccion_id=$1 ORDER BY fecha DESC`, [seccion])).rows;
    });
  }

  async crear(actor: string, institucion: string, seccionId: string, dto: Record<string, unknown>) {
    const seccion = this.validarSeccion(seccionId);
    const fecha = this.validarFecha(dto.fecha);
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR');
    return this.ejecutar(institucion, async db => {
      await this.exigirAcceso(db, actor, institucion, seccion);
      const { rows } = await db.query(`INSERT INTO clase(institucion_id,seccion_id,fecha,creado_por)
        VALUES ($1,$2,$3,$4) RETURNING id,fecha,creado_por AS "creadoPor",creado_en AS "creadoEn"`, [institucion, seccion, fecha, actor]);
      await db.query(`INSERT INTO evento_academico(institucion_id,recurso_id,actor_id,accion,datos)
        VALUES ($1,$2,$3,'CREAR_CLASE',$4)`, [institucion, rows[0].id, actor, JSON.stringify({ seccionId: seccion, fecha })]);
      return rows[0];
    });
  }
}
