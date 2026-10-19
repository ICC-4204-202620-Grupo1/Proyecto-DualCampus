import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { ContextoInstitucion } from '../../database/contexto-institucion';
import { AutorizacionService } from '../autorizacion/autorizacion.service';

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
         WHERE m.seccion_id=$1 ORDER BY m.publicado_en DESC,m.id`, [sid],
      );
      return { puedePublicar, materiales: rows };
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
}
