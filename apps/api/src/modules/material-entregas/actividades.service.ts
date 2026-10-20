import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { ContextoInstitucion } from '../../database/contexto-institucion.js';
import { AutorizacionService } from '../autorizacion/autorizacion.service.js';

@Injectable()
export class ActividadesService {
  constructor(private readonly contexto: ContextoInstitucion, private readonly autorizacion: AutorizacionService) {}

  private seccionId(valor: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)) {
      throw new BadRequestException('Identificador de sección inválido');
    }
    return valor;
  }

  private async permisos(db: PoolClient, actor: string, institucion: string, seccion: string) {
    const existe = await db.query('SELECT 1 FROM seccion WHERE institucion_id=$1 AND id=$2', [institucion, seccion]);
    if (!existe.rowCount) throw new NotFoundException('Sección no encontrada');
    const { rows } = await db.query(`SELECT
      EXISTS(SELECT 1 FROM equipo_docente WHERE institucion_id=$2 AND seccion_id=$3 AND usuario_id=$1 AND rol='PROFESOR') AS profesor,
      EXISTS(SELECT 1 FROM equipo_docente WHERE institucion_id=$2 AND seccion_id=$3 AND usuario_id=$1) AS equipo,
      EXISTS(SELECT 1 FROM matricula WHERE institucion_id=$2 AND seccion_id=$3 AND usuario_id=$1) AS alumno`,
      [actor, institucion, seccion]);
    return rows[0] as { profesor: boolean; equipo: boolean; alumno: boolean };
  }

  async listar(actor: string, institucion: string, seccion: string) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR', 'AYUDANTE', 'ALUMNO');
    const sid = this.seccionId(seccion);
    return this.contexto.ejecutar(institucion, async db => {
      const acceso = await this.permisos(db, actor, institucion, sid);
      if (!acceso.equipo && !acceso.alumno) throw new ForbiddenException('No tienes acceso a esta sección');
      const { rows } = await db.query(`SELECT a.id,a.titulo,a.instrucciones,a.creado_en AS "creadoEn",
        COALESCE(NULLIF(u.nombre,''),u.email) AS autor
        FROM actividad_entrega a JOIN usuario u ON u.id=a.creado_por
        WHERE a.institucion_id=$1 AND a.seccion_id=$2 ORDER BY a.creado_en DESC,a.id`, [institucion, sid]);
      return { puedeCrear: acceso.profesor, actividades: rows };
    });
  }

  async crear(actor: string, institucion: string, seccion: string, dto: Record<string, unknown>) {
    await this.autorizacion.exigirRol(actor, institucion, 'PROFESOR');
    const sid = this.seccionId(seccion);
    const titulo = typeof dto.titulo === 'string' ? dto.titulo.trim() : '';
    const instrucciones = typeof dto.instrucciones === 'string' ? dto.instrucciones.trim() : '';
    if (!titulo || titulo.length > 200) throw new BadRequestException('Título obligatorio (máximo 200 caracteres)');
    if (!instrucciones || instrucciones.length > 10000) throw new BadRequestException('Instrucciones obligatorias (máximo 10000 caracteres)');
    return this.contexto.ejecutar(institucion, async db => {
      const acceso = await this.permisos(db, actor, institucion, sid);
      if (!acceso.profesor) throw new ForbiddenException('Solo el profesor asignado puede crear actividades');
      const { rows } = await db.query(`INSERT INTO actividad_entrega
        (institucion_id,seccion_id,titulo,instrucciones,creado_por)
        VALUES ($1,$2,$3,$4,$5)
        RETURNING id,titulo,instrucciones,creado_en AS "creadoEn"`,
        [institucion,sid,titulo,instrucciones,actor]);
      await db.query(`INSERT INTO evento_academico(institucion_id,actor_id,recurso_id,accion,datos)
        VALUES ($1,$2,$3,'CREAR_ACTIVIDAD_ENTREGA',$4)`,
        [institucion,actor,sid,JSON.stringify({actividadId:rows[0].id,titulo})]);
      return rows[0];
    });
  }
}
