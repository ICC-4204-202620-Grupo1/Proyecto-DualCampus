import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { ContextoInstitucion } from '../../database/contexto-institucion.js';
import { AutorizacionService } from '../autorizacion/autorizacion.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AnunciosService {
  constructor(private readonly contexto: ContextoInstitucion, private readonly autorizacion: AutorizacionService) {}

  private validarSeccion(seccionId: string) {
    if (!UUID.test(seccionId)) throw new BadRequestException('Sección inválida');
    return seccionId;
  }

  private async exigirProfesor(db: PoolClient, actor: string, seccionId: string) {
    const existe = await db.query('SELECT 1 FROM seccion WHERE id=$1', [seccionId]);
    if (!existe.rowCount) throw new NotFoundException('Sección no encontrada');
    const asignacion = await db.query(
      "SELECT 1 FROM equipo_docente WHERE seccion_id=$1 AND usuario_id=$2 AND rol='PROFESOR'",
      [seccionId, actor],
    );
    if (!asignacion.rowCount) throw new ForbiddenException('Solo el profesor asignado puede publicar anuncios');
  }

  async listar(actor: string, institucion: string, seccionId: string) {
    await this.autorizacion.exigirRol(actor, institucion, 'PROFESOR', 'ALUMNO');
    const sid = this.validarSeccion(seccionId);
    return this.contexto.ejecutar(institucion, async db => {
      const existe = await db.query('SELECT 1 FROM seccion WHERE id=$1', [sid]);
      if (!existe.rowCount) throw new NotFoundException('Sección no encontrada');
      const acceso = await db.query(
        `SELECT 1 FROM equipo_docente WHERE seccion_id=$1 AND usuario_id=$2 AND rol='PROFESOR'
         UNION ALL
         SELECT 1 FROM matricula WHERE seccion_id=$1 AND usuario_id=$2 AND estado='ACTIVA'
         LIMIT 1`, [sid, actor],
      );
      if (!acceso.rowCount) throw new ForbiddenException('No tienes acceso a los anuncios de esta sección');
      const { rows } = await db.query(
        `SELECT a.id,a.titulo,a.mensaje,a.publicado_en AS "publicadoEn",
                COALESCE(NULLIF(u.nombre,''),u.email) AS autor
         FROM anuncio_seccion a JOIN usuario u ON u.id=a.publicado_por
         WHERE a.seccion_id=$1 ORDER BY a.publicado_en DESC,a.id DESC`, [sid],
      );
      return rows;
    });
  }

  async publicar(actor: string, institucion: string, seccionId: string, datos: Record<string, unknown>) {
    await this.autorizacion.exigirRol(actor, institucion, 'PROFESOR');
    const sid = this.validarSeccion(seccionId);
    const titulo = typeof datos.titulo === 'string' ? datos.titulo.trim() : '';
    const mensaje = typeof datos.mensaje === 'string' ? datos.mensaje.trim() : '';
    if (!titulo || titulo.length > 200) throw new BadRequestException('Título obligatorio, máximo 200 caracteres');
    if (!mensaje || mensaje.length > 5000) throw new BadRequestException('Mensaje obligatorio, máximo 5000 caracteres');
    return this.contexto.ejecutar(institucion, async db => {
      await this.exigirProfesor(db, actor, sid);
      const { rows } = await db.query(
        `WITH nuevo AS (
           INSERT INTO anuncio_seccion(institucion_id,seccion_id,titulo,mensaje,publicado_por)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING id,titulo,mensaje,publicado_por,publicado_en
         ) SELECT n.id,n.titulo,n.mensaje,n.publicado_en AS "publicadoEn",
                  COALESCE(NULLIF(u.nombre,''),u.email) AS autor
           FROM nuevo n JOIN usuario u ON u.id=n.publicado_por`,
        [institucion, sid, titulo, mensaje, actor],
      );
      return rows[0];
    });
  }
}
