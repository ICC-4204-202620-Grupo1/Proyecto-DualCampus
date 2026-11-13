import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { ContextoInstitucion } from '../../database/contexto-institucion.js';
import { AutorizacionService } from '../autorizacion/autorizacion.service.js';

const MAXIMO = 1048576;
@Injectable()
export class MaterialesService {
  constructor(private readonly contexto: ContextoInstitucion, private readonly autorizacion: AutorizacionService) {}

  private id(valor: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)) throw new BadRequestException('Identificador inválido');
    return valor;
  }

  private async acceso(db: PoolClient, actor: string, institucion: string, seccion: string) {
    const existe = await db.query('SELECT 1 FROM seccion WHERE id=$1', [seccion]);
    if (!existe.rowCount) throw new NotFoundException('Sección no encontrada');
    const res = await db.query(
      `SELECT r.rol, EXISTS(SELECT 1 FROM equipo_docente e WHERE e.seccion_id=$3 AND e.usuario_id=$1 AND e.rol='PROFESOR') AS profesor,
         EXISTS(SELECT 1 FROM equipo_docente e WHERE e.seccion_id=$3 AND e.usuario_id=$1) AS docente,
         EXISTS(SELECT 1 FROM matricula m WHERE m.seccion_id=$3 AND m.usuario_id=$1) AS alumno
       FROM rol_en_institucion r WHERE r.usuario_id=$1 AND r.institucion_id=$2`, [actor,institucion,seccion],
    );
    if (!res.rows.some(r => r.rol === 'ADMINISTRADOR' || r.docente || r.alumno)) throw new ForbiddenException('No tienes acceso a esta sección');
    return res.rows.some(r => r.rol === 'PROFESOR' && r.profesor);
  }

  async listar(actor: string, institucion: string, seccionId: string) {
    await this.autorizacion.exigirRol(actor,institucion,'ADMINISTRADOR','PROFESOR','AYUDANTE','ALUMNO');
    const sid = this.id(seccionId);
    return this.contexto.ejecutar(institucion, async db => {
      const puedePublicar = await this.acceso(db,actor,institucion,sid);
      const { rows } = await db.query(
        `SELECT m.id,m.titulo,m.nombre_archivo AS "nombreArchivo",m.tipo,octet_length(m.contenido) AS tamano,
           m.publicado_en AS "publicadoEn",COALESCE(NULLIF(u.nombre,''),u.email) AS autor
         FROM material_curso m JOIN usuario u ON u.id=m.publicado_por
         WHERE m.seccion_id=$1 AND m.estado='PUBLICADO' ORDER BY m.publicado_en DESC,m.id`, [sid],
      );
      const borradores = puedePublicar ? (await db.query(
        `SELECT m.id,m.titulo,m.nombre_archivo AS "nombreArchivo",m.tipo,octet_length(m.contenido) AS tamano,
                m.actualizado_en AS "actualizadoEn",m.origen_material_id AS "origenMaterialId",
                o.titulo AS "origenTitulo",p.nombre AS "origenPeriodo",c.codigo AS "origenCurso",s.codigo AS "origenSeccion"
           FROM material_curso m
           JOIN material_curso o ON o.id=m.origen_material_id
           JOIN seccion s ON s.id=o.seccion_id JOIN periodo p ON p.id=s.periodo_id JOIN curso c ON c.id=s.curso_id
          WHERE m.seccion_id=$1 AND m.estado='BORRADOR' ORDER BY m.actualizado_en DESC,m.id`, [sid])).rows : [];
      return { puedePublicar, materiales: rows, borradores };
    });
  }

  async descargar(actor: string, institucion: string, seccionId: string, materialId: string) {
    await this.autorizacion.exigirRol(actor, institucion, 'PROFESOR', 'AYUDANTE', 'ALUMNO');
    const sid = this.id(seccionId);
    const mid = this.id(materialId);
    return this.contexto.ejecutar(institucion, async db => {
      const acceso = await db.query(
        `SELECT EXISTS(SELECT 1 FROM equipo_docente e WHERE e.seccion_id=$2 AND e.usuario_id=$1) AS docente,
                EXISTS(SELECT 1 FROM matricula m WHERE m.seccion_id=$2 AND m.usuario_id=$1) AS alumno`,
        [actor, sid],
      );
      if (!acceso.rows[0]?.docente && !acceso.rows[0]?.alumno) {
        throw new ForbiddenException('No tienes permiso para descargar materiales de esta sección');
      }
      const { rows } = await db.query(
        `SELECT nombre_archivo AS "nombreArchivo",tipo,contenido FROM material_curso
         WHERE id=$1 AND seccion_id=$2 AND estado='PUBLICADO'`, [mid, sid],
      );
      if (!rows.length) throw new NotFoundException('Material no encontrado');
      return { nombreArchivo: rows[0].nombreArchivo as string, tipo: rows[0].tipo as string, contenido: rows[0].contenido as Buffer };
    });
  }

  async publicar(actor: string, institucion: string, seccionId: string, dto: Record<string, unknown>) {
    await this.autorizacion.exigirRol(actor,institucion,'PROFESOR');
    const sid = this.id(seccionId);
    return this.contexto.ejecutar(institucion, async db => {
      if (!await this.acceso(db,actor,institucion,sid)) throw new ForbiddenException('Solo el profesor asignado puede publicar materiales');
      const titulo = typeof dto.titulo === 'string' ? dto.titulo.trim() : '';
      if (!titulo || titulo.length > 200) throw new BadRequestException('Título obligatorio, máximo 200 caracteres');
      const nombre = typeof dto.nombreArchivo === 'string' ? dto.nombreArchivo.trim() : '';
      if (!nombre || nombre.length > 180 || /[\\/\x00-\x1f\x7f]/.test(nombre)) throw new BadRequestException('Nombre de archivo inválido');
      const extension = nombre.toLowerCase().split('.').pop();
      const tipo = extension === 'pdf' ? 'application/pdf' : extension === 'txt' ? 'text/plain' : null;
      if (!tipo || dto.tipo !== tipo) throw new BadRequestException('Solo se permiten archivos PDF o TXT con su tipo correspondiente');
      const base64 = dto.contenidoBase64;
      if (typeof base64 !== 'string' || !base64.length) throw new BadRequestException('El archivo está vacío');
      if (base64.length > Math.ceil(MAXIMO / 3) * 4) throw new BadRequestException('El archivo supera el máximo de 1 MB');
      if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new BadRequestException('Contenido del archivo inválido');
      const contenido = Buffer.from(base64,'base64');
      if (!contenido.length || contenido.length > MAXIMO) throw new BadRequestException('El archivo debe tener entre 1 byte y 1 MB');
      if (contenido.toString('base64') !== base64) throw new BadRequestException('Contenido del archivo inválido');
      if (tipo === 'application/pdf') {
        if (!contenido.subarray(0,5).equals(Buffer.from('%PDF-')) || !contenido.subarray(-1024).includes(Buffer.from('%%EOF'))) {
          throw new BadRequestException('El contenido no corresponde a un documento PDF');
        }
      } else {
        try {
          const texto = new TextDecoder('utf-8',{fatal:true}).decode(contenido);
          if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(texto)) throw new Error();
        } catch { throw new BadRequestException('El TXT debe contener texto UTF-8 válido'); }
      }
      const { rows } = await db.query(
        `INSERT INTO material_curso(institucion_id,seccion_id,titulo,nombre_archivo,tipo,contenido,publicado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,titulo,nombre_archivo AS "nombreArchivo",tipo,
           octet_length(contenido) AS tamano,publicado_en AS "publicadoEn"`,
        [institucion,sid,titulo,nombre,tipo,contenido,actor],
      );
      await db.query(
        "INSERT INTO evento_academico(institucion_id,actor_id,recurso_id,accion,datos) VALUES ($1,$2,$3,'PUBLICAR_MATERIAL',$4)",
        [institucion,actor,sid,JSON.stringify({materialId:rows[0].id,titulo,nombreArchivo:nombre,tamano:contenido.length})],
      );
      return rows[0];
    });
  }

  async opcionesReutilizacion(actor: string, institucion: string, seccionId: string) {
    await this.autorizacion.exigirRol(actor,institucion,'PROFESOR');
    const destino = this.id(seccionId);
    return this.contexto.ejecutar(institucion, async db => {
      if (!await this.acceso(db,actor,institucion,destino)) throw new ForbiddenException('Solo el profesor asignado puede reutilizar materiales');
      const { rows } = await db.query(
        `SELECT m.id,m.titulo,m.nombre_archivo AS "nombreArchivo",m.tipo,octet_length(m.contenido) AS tamano,
                s.id AS "seccionId",s.codigo AS seccion,p.nombre AS periodo,c.codigo AS "cursoCodigo",c.nombre AS curso
           FROM material_curso m
           JOIN seccion s ON s.id=m.seccion_id JOIN seccion d ON d.id=$2 AND d.periodo_id<>s.periodo_id
           JOIN periodo p ON p.id=s.periodo_id JOIN curso c ON c.id=s.curso_id
           JOIN equipo_docente e ON e.seccion_id=s.id AND e.usuario_id=$1 AND e.rol='PROFESOR'
          WHERE s.id<>$2 AND m.estado='PUBLICADO'
          ORDER BY p.fecha_inicio DESC,c.codigo,s.codigo,m.titulo`, [actor,destino]);
      return rows;
    });
  }

  async reutilizar(actor: string, institucion: string, seccionId: string, dto: Record<string, unknown>) {
    await this.autorizacion.exigirRol(actor,institucion,'PROFESOR');
    const destino = this.id(seccionId);
    const origen = this.id(typeof dto.materialOrigenId === 'string' ? dto.materialOrigenId : '');
    return this.contexto.ejecutar(institucion, async db => {
      if (!await this.acceso(db,actor,institucion,destino)) throw new ForbiddenException('Solo el profesor asignado puede preparar la copia');
      const fuente = await db.query(
        `SELECT m.id,m.seccion_id,s.periodo_id,m.titulo,m.nombre_archivo,m.tipo,m.contenido
           FROM material_curso m
           JOIN seccion s ON s.id=m.seccion_id
           JOIN equipo_docente e ON e.seccion_id=m.seccion_id AND e.usuario_id=$2 AND e.rol='PROFESOR'
          WHERE m.id=$1 AND m.estado='PUBLICADO' FOR SHARE OF m`, [origen,actor]);
      if (!fuente.rowCount) throw new NotFoundException('Material de origen no encontrado entre tus secciones autorizadas');
      if (fuente.rows[0].seccion_id === destino) throw new BadRequestException('La sección de origen y destino deben ser distintas');
      const original = fuente.rows[0];
      const periodoDestino = await db.query('SELECT periodo_id FROM seccion WHERE id=$1',[destino]);
      if (original.periodo_id === periodoDestino.rows[0].periodo_id) {
        throw new BadRequestException('El material de origen debe pertenecer a otro período');
      }
      const { rows } = await db.query(
        `INSERT INTO material_curso(institucion_id,seccion_id,titulo,nombre_archivo,tipo,contenido,publicado_por,publicado_en,estado,origen_material_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,'BORRADOR',$8)
         RETURNING id,titulo,nombre_archivo AS "nombreArchivo",tipo,octet_length(contenido) AS tamano,
                   actualizado_en AS "actualizadoEn",origen_material_id AS "origenMaterialId"`,
        [institucion,destino,original.titulo,original.nombre_archivo,original.tipo,original.contenido,actor,origen]);
      await db.query(
        "INSERT INTO evento_academico(institucion_id,actor_id,recurso_id,accion,datos) VALUES ($1,$2,$3,'PREPARAR_COPIA_MATERIAL',$4)",
        [institucion,actor,destino,JSON.stringify({borradorId:rows[0].id,materialOrigenId:origen})]);
      return rows[0];
    });
  }

  async editarBorrador(actor: string, institucion: string, seccionId: string, materialId: string, dto: Record<string, unknown>) {
    await this.autorizacion.exigirRol(actor,institucion,'PROFESOR');
    const destino = this.id(seccionId), material = this.id(materialId);
    const titulo = typeof dto.titulo === 'string' ? dto.titulo.trim() : '';
    if (!titulo || titulo.length > 200) throw new BadRequestException('Título obligatorio, máximo 200 caracteres');
    return this.contexto.ejecutar(institucion, async db => {
      if (!await this.acceso(db,actor,institucion,destino)) throw new ForbiddenException('Solo el profesor asignado puede editar la copia');
      const actual = await db.query("SELECT titulo FROM material_curso WHERE id=$1 AND seccion_id=$2 AND estado='BORRADOR' FOR UPDATE",[material,destino]);
      if (!actual.rowCount) throw new NotFoundException('Borrador no encontrado');
      const { rows } = await db.query(
        `UPDATE material_curso SET titulo=$3,actualizado_en=clock_timestamp() WHERE id=$1 AND seccion_id=$2
         RETURNING id,titulo,actualizado_en AS "actualizadoEn"`,[material,destino,titulo]);
      await db.query(
        "INSERT INTO evento_academico(institucion_id,actor_id,recurso_id,accion,datos) VALUES ($1,$2,$3,'EDITAR_COPIA_MATERIAL',$4)",
        [institucion,actor,destino,JSON.stringify({borradorId:material,tituloPrevio:actual.rows[0].titulo,tituloNuevo:titulo})]);
      return rows[0];
    });
  }

  async publicarBorrador(actor: string, institucion: string, seccionId: string, materialId: string) {
    await this.autorizacion.exigirRol(actor,institucion,'PROFESOR');
    const destino = this.id(seccionId), material = this.id(materialId);
    return this.contexto.ejecutar(institucion, async db => {
      if (!await this.acceso(db,actor,institucion,destino)) throw new ForbiddenException('Solo el profesor asignado puede publicar la copia');
      const borrador = await db.query(
        "SELECT titulo,origen_material_id FROM material_curso WHERE id=$1 AND seccion_id=$2 AND estado='BORRADOR' FOR UPDATE",[material,destino]);
      if (!borrador.rowCount) throw new ConflictException('La copia ya no está disponible como borrador');
      const { rows } = await db.query(
        `UPDATE material_curso SET estado='PUBLICADO',publicado_en=clock_timestamp(),actualizado_en=clock_timestamp(),publicado_por=$3
          WHERE id=$1 AND seccion_id=$2 RETURNING id,titulo,nombre_archivo AS "nombreArchivo",tipo,
          octet_length(contenido) AS tamano,publicado_en AS "publicadoEn"`,[material,destino,actor]);
      await db.query(
        "INSERT INTO evento_academico(institucion_id,actor_id,recurso_id,accion,datos) VALUES ($1,$2,$3,'PUBLICAR_COPIA_MATERIAL',$4)",
        [institucion,actor,destino,JSON.stringify({materialId:material,materialOrigenId:borrador.rows[0].origen_material_id,titulo:borrador.rows[0].titulo})]);
      return rows[0];
    });
  }
}
