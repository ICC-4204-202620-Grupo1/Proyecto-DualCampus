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
        COALESCE(NULLIF(u.nombre,''),u.email) AS autor,
        CASE WHEN e.id IS NULL THEN NULL ELSE json_build_object(
          'id',e.id,'nombreArchivo',e.nombre_archivo,
          'tamanoBytes',e.tamano_bytes,'recibidoEn',e.recibido_en) END AS comprobante
        FROM actividad_entrega a JOIN usuario u ON u.id=a.creado_por
        LEFT JOIN entrega_archivo e ON e.institucion_id=a.institucion_id
          AND e.actividad_id=a.id AND e.alumno_id=$3
        WHERE a.institucion_id=$1 AND a.seccion_id=$2 ORDER BY a.creado_en DESC,a.id`, [institucion, sid, actor]);

      return { puedeCrear: acceso.profesor, puedeEntregar: acceso.alumno, puedeVerInformes: acceso.equipo, actividades: rows };
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

  async entregar(actor: string, institucion: string, seccion: string, actividad: string,
    archivo?: { originalname: string; mimetype: string; buffer: Buffer; size: number }) {
    await this.autorizacion.exigirRol(actor, institucion, 'ALUMNO');
    const sid = this.seccionId(seccion), aid = this.seccionId(actividad);
    if (!archivo?.buffer?.length || !archivo.originalname || !archivo.size) {
      throw new BadRequestException('Selecciona un archivo no vacío');
    }
    const nombre = archivo.originalname;
    if (nombre.length > 180 || /[\\/\x00-\x1f\x7f]/.test(nombre) || !/^[^\.]+(?:\.[^\.]+)*\.[a-zA-Z0-9]+$/.test(nombre)) {
      throw new BadRequestException('Nombre de archivo inválido');
    }
    const extension = nombre.split('.').pop()!.toLowerCase();
    const tipos: Record<string,string[]> = {
      pdf: ['application/pdf'], docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      txt: ['text/plain'], png: ['image/png']
    };
    if (!tipos[extension]?.includes(archivo.mimetype)) throw new BadRequestException('Tipo de archivo no permitido');
    const b = archivo.buffer;
    if (extension === 'pdf' && (!b.subarray(0,5).equals(Buffer.from('%PDF-')) || !b.subarray(-1024).includes(Buffer.from('%%EOF'))))
      throw new BadRequestException('PDF inválido');
    if (extension === 'png' && !b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
      throw new BadRequestException('PNG inválido');
    if (extension === 'docx' && !b.subarray(0,4).equals(Buffer.from([80,75,3,4])))
      throw new BadRequestException('DOCX inválido');
    if (extension === 'txt') {
      try { new TextDecoder('utf-8', {fatal:true}).decode(b); }
      catch { throw new BadRequestException('El TXT debe ser UTF-8'); }
    }
    return this.contexto.ejecutar(institucion, async db => {
      const acceso = await this.permisos(db, actor, institucion, sid);
      if (!acceso.alumno) throw new ForbiddenException('Debes estar matriculado en la sección');
      // Serializar por alumno y actividad para que dos envíos simultáneos no eludan condiciones.
            const {rows} = await db.query(`SELECT titulo, apertura_en, cierre_en, formatos_permitidos, tamano_maximo_mb
        FROM actividad_entrega WHERE institucion_id=$1 AND seccion_id=$2 AND id=$3 FOR UPDATE`,
        [institucion,sid,aid]);
      if (!rows.length) throw new NotFoundException('Actividad no encontrada');
      const cfg = rows[0];
      if (!cfg.apertura_en || !cfg.cierre_en || !cfg.formatos_permitidos || !cfg.tamano_maximo_mb)
        throw new BadRequestException('El profesor aún no configura las condiciones');
      const momento = Date.now();
      if (momento < new Date(cfg.apertura_en).getTime()) throw new BadRequestException('La entrega todavía no abre');
      if (momento > new Date(cfg.cierre_en).getTime()) throw new BadRequestException('El plazo de entrega terminó');
      if (!(cfg.formatos_permitidos as string[]).includes(extension)) throw new BadRequestException('Formato no admitido para esta actividad');
      if (archivo.size > Number(cfg.tamano_maximo_mb) * 1024 * 1024)
        throw new BadRequestException('Archivo supera el tamaño máximo permitido');
      const guardado = await db.query(`INSERT INTO entrega_archivo
        (institucion_id,actividad_id,alumno_id,nombre_archivo,extension,tipo,contenido,tamano_bytes)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT(actividad_id,alumno_id) DO UPDATE SET
          nombre_archivo=EXCLUDED.nombre_archivo, extension=EXCLUDED.extension,
          tipo=EXCLUDED.tipo,contenido=EXCLUDED.contenido,tamano_bytes=EXCLUDED.tamano_bytes,recibido_en=now()
        RETURNING id,nombre_archivo AS "nombreArchivo",tamano_bytes AS "tamanoBytes",recibido_en AS "recibidoEn"`,
        [institucion,aid,actor,nombre,extension,archivo.mimetype,b,archivo.size]);
      return { ...guardado.rows[0], actividad: cfg.titulo };
    });
  }

  async listarEntregas(actor: string, institucion: string, seccion: string, actividadId?: string) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR', 'AYUDANTE');
    const sid = this.seccionId(seccion);
    const aid = actividadId ? this.seccionId(actividadId) : undefined;
    return this.contexto.ejecutar(institucion, async db => {
      const acceso = await this.permisos(db, actor, institucion, sid);
      if (!acceso.equipo) {
        throw new ForbiddenException('Solo el profesor o ayudante asignados pueden consultar los informes recibidos');
      }
      if (aid) {
        const existe = await db.query(
          'SELECT 1 FROM actividad_entrega WHERE institucion_id=$1 AND seccion_id=$2 AND id=$3',
          [institucion, sid, aid],
        );
        if (!existe.rowCount) throw new NotFoundException('Actividad no encontrada');
      }
      const params: unknown[] = [institucion, sid];
      let query = `SELECT e.id, e.actividad_id AS "actividadId", a.titulo AS "actividadTitulo",
        e.alumno_id AS "alumnoId", COALESCE(NULLIF(u.nombre,''), u.email) AS autor, u.email,
        e.nombre_archivo AS "nombreArchivo", e.extension, e.tamano_bytes AS "tamanoBytes",
        e.recibido_en AS "recibidoEn"
        FROM entrega_archivo e
        JOIN actividad_entrega a ON a.id = e.actividad_id AND a.institucion_id = e.institucion_id
        JOIN usuario u ON u.id = e.alumno_id
        WHERE e.institucion_id = $1 AND a.seccion_id = $2`;
      if (aid) {
        params.push(aid);
        query += ` AND e.actividad_id = $3`;
      }
      query += ` ORDER BY e.recibido_en DESC, e.id`;
      const { rows } = await db.query(query, params);
      return rows;
    });
  }
}
