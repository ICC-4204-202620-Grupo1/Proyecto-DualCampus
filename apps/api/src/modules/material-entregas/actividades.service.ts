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
        a.apertura_en AS "aperturaEn", a.cierre_en AS "cierreEn",
        a.formatos_permitidos AS "formatosPermitidos", a.tamano_maximo_mb AS "tamanoMaximoMb",
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
  async configurar(actor: string, institucion: string, seccion: string, actividad: string, dto: Record<string, unknown>) {
    await this.autorizacion.exigirRol(actor, institucion, 'PROFESOR');
    const sid = this.seccionId(seccion);
    const aid = this.seccionId(actividad);
    const fechas = [dto.aperturaEn, dto.cierreEn];
    if (!fechas.every(v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))) {
      throw new BadRequestException('Fechas de apertura y cierre deben ser fechas ISO válidas con zona horaria');
    }
    const apertura = new Date(dto.aperturaEn as string);
    const cierre = new Date(dto.cierreEn as string);
    if (!Number.isFinite(apertura.getTime()) || !Number.isFinite(cierre.getTime()) || apertura >= cierre) {
      throw new BadRequestException('La fecha de cierre debe ser posterior a la apertura');
    }
    const permitidos = ['pdf', 'docx', 'txt', 'png'];
    const formatos = dto.formatosPermitidos;
    if (!Array.isArray(formatos) || formatos.length === 0 || formatos.length > permitidos.length ||
      !formatos.every(f => typeof f === 'string' && permitidos.includes(f)) || new Set(formatos).size !== formatos.length) {
      throw new BadRequestException('Selecciona formatos válidos sin duplicados (pdf, docx, txt, png)');
    }
    const mb = dto.tamanoMaximoMb;
    if (typeof mb !== 'number' || !Number.isInteger(mb) || mb < 1 || mb > 50) {
      throw new BadRequestException('El tamaño máximo debe ser un entero entre 1 y 50 MB');
    }
    return this.contexto.ejecutar(institucion, async db => {
      const acceso = await this.permisos(db, actor, institucion, sid);
      if (!acceso.profesor) throw new ForbiddenException('Solo el profesor asignado puede configurar entregas');
      const { rows } = await db.query(`UPDATE actividad_entrega SET
        apertura_en=$4, cierre_en=$5, formatos_permitidos=$6, tamano_maximo_mb=$7
        WHERE institucion_id=$1 AND seccion_id=$2 AND id=$3
        RETURNING id, apertura_en AS "aperturaEn", cierre_en AS "cierreEn",
          formatos_permitidos AS "formatosPermitidos", tamano_maximo_mb AS "tamanoMaximoMb"`,
        [institucion, sid, aid, apertura.toISOString(), cierre.toISOString(), formatos, mb]);
      if (!rows.length) throw new NotFoundException('Actividad no encontrada en esta sección');
      await db.query(`INSERT INTO evento_academico(institucion_id,actor_id,recurso_id,accion,datos)
        VALUES ($1,$2,$3,'CONFIGURAR_ACTIVIDAD_ENTREGA',$4)`,
        [institucion, actor, sid, JSON.stringify({actividadId:aid,aperturaEn:apertura.toISOString(),
          cierreEn:cierre.toISOString(),formatosPermitidos:formatos,tamanoMaximoMb:mb})]);
      return rows[0];
    });
  }

}
