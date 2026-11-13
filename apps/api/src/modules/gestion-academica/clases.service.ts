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

  async asistencia(actor: string, institucion: string, seccionId: string, claseId: string) {
    const seccion = this.validarSeccion(seccionId);
    if (typeof claseId !== 'string' || !UUID.test(claseId)) throw new BadRequestException('Clase inválida');
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR', 'AYUDANTE', 'ALUMNO');
    return this.ejecutar(institucion, async db => {
      const clase = await db.query('SELECT id FROM clase WHERE id=$1 AND seccion_id=$2', [claseId, seccion]);
      if (!clase.rowCount) throw new NotFoundException('Clase no encontrada');
      const alumnos = await db.query(`SELECT u.id,u.nombre,u.email,COALESCE(a.presente,false) AS presente,
        a.autor_id AS "autorId",a.actualizado_en AS "actualizadoEn"
        FROM matricula m JOIN usuario u ON u.id=m.usuario_id
        LEFT JOIN asistencia_clase a ON a.clase_id=$1 AND a.alumno_id=m.usuario_id
        WHERE m.seccion_id=$2 ORDER BY u.nombre,u.email`, [claseId, seccion]);
      return alumnos.rows;
    });
  }

  async guardarAsistencia(actor: string, institucion: string, seccionId: string, claseId: string, dto: Record<string, unknown>) {
    const seccion = this.validarSeccion(seccionId);
    if (typeof claseId !== 'string' || !UUID.test(claseId)) throw new BadRequestException('Clase inválida');
    if (!Array.isArray(dto.marcas) || !dto.marcas.length) throw new BadRequestException('Debes enviar una marca por alumno');
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR');
    return this.ejecutar(institucion, async db => {
      await this.exigirAcceso(db, actor, institucion, seccion);
      const clase = await db.query('SELECT id FROM clase WHERE id=$1 AND seccion_id=$2', [claseId, seccion]);
      if (!clase.rowCount) throw new NotFoundException('Clase no encontrada');
      const alumnos = (await db.query('SELECT usuario_id FROM matricula WHERE seccion_id=$1', [seccion])).rows.map(r => r.usuario_id as string);
      const marcas = dto.marcas as Array<Record<string, unknown>>;
      if (marcas.length !== alumnos.length || new Set(marcas.map(m => m.alumnoId)).size !== alumnos.length || marcas.some(m => !alumnos.includes(m.alumnoId as string) || typeof m.presente !== 'boolean')) {
        throw new BadRequestException('La asistencia debe incluir exactamente a cada alumno activo');
      }
      for (const marca of marcas) await db.query(`INSERT INTO asistencia_clase(institucion_id,clase_id,alumno_id,presente,autor_id)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT (clase_id,alumno_id) DO UPDATE SET presente=EXCLUDED.presente,autor_id=EXCLUDED.autor_id,actualizado_en=now()`,
        [institucion, claseId, marca.alumnoId, marca.presente, actor]);
      await db.query(`INSERT INTO evento_academico(institucion_id,recurso_id,actor_id,accion,datos) VALUES ($1,$2,$3,'GUARDAR_ASISTENCIA',$4)`,
        [institucion, claseId, actor, JSON.stringify({ seccionId: seccion, alumnos: alumnos.length })]);
      return { mensaje: 'Asistencia guardada', total: alumnos.length };
    });
  }

  async miAsistencia(actor: string, institucion: string, seccionId: string) {
    const seccion = this.validarSeccion(seccionId);
    await this.autorizacion.exigirRol(actor, institucion, 'ALUMNO');
    return this.ejecutar(institucion, async db => {
      const matriculado = await db.query('SELECT 1 FROM matricula WHERE seccion_id=$1 AND usuario_id=$2', [seccion, actor]);
      if (!matriculado.rowCount) throw new ForbiddenException('No estás matriculado en esta sección');
      const filas = (await db.query(`SELECT c.id,c.fecha,a.presente,a.actualizado_en AS "actualizadoEn"
        FROM clase c LEFT JOIN asistencia_clase a ON a.clase_id=c.id AND a.alumno_id=$2
        WHERE c.seccion_id=$1 ORDER BY c.fecha DESC`, [seccion, actor])).rows;
      const consideradas = filas.filter(f => f.presente !== null).length;
      const presentes = filas.filter(f => f.presente === true).length;
      return { presentes, consideradas, proporcion: consideradas ? Math.round((presentes / consideradas) * 10000) / 100 : null, totalClases: filas.length, clases: filas.map(f => ({ id:f.id, fecha:f.fecha, estado:f.presente === true ? 'Presente' : f.presente === false ? 'Ausente' : 'Sin marca', actualizadoEn:f.actualizadoEn })) };
    });
  }

  async corregirAsistencia(actor: string, institucion: string, seccionId: string, claseId: string, alumnoId: string, dto: Record<string, unknown>) {
    const seccion = this.validarSeccion(seccionId);
    if (!UUID.test(claseId) || !UUID.test(alumnoId)) throw new BadRequestException('Identificador inválido');
    if (typeof dto.presente !== 'boolean') throw new BadRequestException('El nuevo estado es obligatorio');
    if (typeof dto.motivo !== 'string' || !dto.motivo.trim() || dto.motivo.trim().length > 500) throw new BadRequestException('Debes indicar un motivo de hasta 500 caracteres');
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR');
    return this.ejecutar(institucion, async db => {
      await this.exigirAcceso(db, actor, institucion, seccion);
      const actual = await db.query(`SELECT a.presente FROM asistencia_clase a JOIN clase c ON c.id=a.clase_id
        JOIN matricula m ON m.seccion_id=c.seccion_id AND m.usuario_id=a.alumno_id
        WHERE a.clase_id=$1 AND c.seccion_id=$2 AND a.alumno_id=$3 FOR UPDATE`, [claseId, seccion, alumnoId]);
      if (!actual.rowCount) throw new NotFoundException('No existe una marca para ese alumno y clase');
      if (actual.rows[0].presente === dto.presente) throw new ConflictException('La marca ya tiene ese estado');
      const motivo = (dto.motivo as string).trim();
      await db.query(`INSERT INTO asistencia_correccion(institucion_id,clase_id,alumno_id,estado_anterior,estado_nuevo,motivo,autor_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [institucion, claseId, alumnoId, actual.rows[0].presente, dto.presente, motivo, actor]);
      await db.query(`UPDATE asistencia_clase SET presente=$1,autor_id=$2,actualizado_en=now() WHERE clase_id=$3 AND alumno_id=$4`, [dto.presente, actor, claseId, alumnoId]);
      return { mensaje:'Marca corregida' };
    });
  }
}
