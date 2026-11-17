import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContextoInstitucion } from '../../database/contexto-institucion.js';
import { AutorizacionService } from '../autorizacion/autorizacion.service.js';
import { AvisosCorreccionService } from './avisos-correccion.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class EstadoAvisosService {
  constructor(
    private readonly contexto: ContextoInstitucion,
    private readonly autorizacion: AutorizacionService,
    private readonly avisos: AvisosCorreccionService,
  ) {}

  async listar(actor: string, institucion: string) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR');
    return this.contexto.ejecutar(institucion, async db => {
      const avisos = await db.query<{ id: string } & Record<string, unknown>>(`
        SELECT a.id, a.tipo, a.estado, a.destinatario_email AS "destinatarioEmail",
          u.nombre AS "destinatarioNombre", e.accion AS "evento", e.creado_en AS "eventoEn",
          a.creado_en AS "creadoEn", a.intentos, a.ultimo_intento_en AS "ultimoIntentoEn",
          a.enviado_en AS "enviadoEn", a.ultimo_error AS "ultimoError"
        FROM aviso_correo a
        JOIN evento_academico e ON e.id=a.evento_id AND e.institucion_id=a.institucion_id
        JOIN usuario u ON u.id=a.destinatario_id
        WHERE a.institucion_id=$1 ORDER BY a.creado_en DESC, a.id DESC LIMIT 100`, [institucion]);
      const ids = avisos.rows.map(a => a.id);
      if (!ids.length) return [];
      const intentos = await db.query(`SELECT aviso_id AS "avisoId", numero, resultado, fecha, error
        FROM intento_aviso_correo WHERE aviso_id = ANY($1::uuid[]) ORDER BY fecha DESC, numero DESC`, [ids]);
      return avisos.rows.map(aviso => ({ ...aviso, intentosDetalle: intentos.rows.filter(i => i.avisoId === aviso.id) }));
    });
  }

  async reintentar(actor: string, institucion: string, avisoId: string) {
    if (!UUID.test(avisoId)) throw new BadRequestException('Aviso inválido');
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR');
    const habilitado = await this.contexto.ejecutar(institucion, async db => db.query(
      `UPDATE aviso_correo SET estado='PENDIENTE' WHERE id=$1 AND institucion_id=$2
        AND estado='FALLIDO' RETURNING id`, [avisoId, institucion]));
    if (!habilitado.rowCount) throw new NotFoundException('Aviso fallido no encontrado');
    await this.avisos.despachar(institucion, avisoId);
    return this.contexto.ejecutar(institucion, async db => {
      const r = await db.query(`SELECT id, estado, intentos, ultimo_error AS "ultimoError" FROM aviso_correo WHERE id=$1`, [avisoId]);
      return r.rows[0];
    });
  }
}
