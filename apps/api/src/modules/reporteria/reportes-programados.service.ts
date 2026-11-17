import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';
import { ContextoInstitucion } from '../../database/contexto-institucion.js';
import { PG_POOL } from '../../database/pg-pool.token.js';
import { AutorizacionService } from '../autorizacion/autorizacion.service.js';
import { IndicadoresInstitucionalesService } from './indicadores-institucionales.service.js';
import { exportarIndicadoresCsv } from './exportar-indicadores.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Frecuencia = 'DIARIA' | 'SEMANAL' | 'MENSUAL';
type Programacion = { id: string; institucion_id: string; creador_id: string; periodo_id: string; facultad: string | null; frecuencia: Frecuencia; destino_email: string; proxima_ejecucion: Date };

function siguiente(fecha: Date, frecuencia: Frecuencia): Date {
  const proxima = new Date(fecha);
  if (frecuencia === 'DIARIA') proxima.setUTCDate(proxima.getUTCDate() + 1);
  if (frecuencia === 'SEMANAL') proxima.setUTCDate(proxima.getUTCDate() + 7);
  if (frecuencia === 'MENSUAL') proxima.setUTCMonth(proxima.getUTCMonth() + 1);
  return proxima;
}

@Injectable()
export class ReportesProgramadosService {
  constructor(
    private readonly contexto: ContextoInstitucion,
    private readonly autorizacion: AutorizacionService,
    private readonly indicadores: IndicadoresInstitucionalesService,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async listar(actor: string, institucion: string) {
    await this.autorizacion.exigirRol(actor, institucion, 'DIRECTOR');
    return this.contexto.ejecutar(institucion, async db => {
      const r = await db.query(`SELECT p.id, p.periodo_id AS "periodoId", pe.nombre AS "periodo", p.facultad,
        p.frecuencia, p.destino_email AS "destinoEmail", p.estado,
        p.proxima_ejecucion AS "proximaEjecucion", p.creado_en AS "creadoEn",
        e.estado AS "ultimoEstado", e.terminado_en AS "ultimoIntento", e.error AS "ultimoError"
        FROM reporte_programado p JOIN periodo pe ON pe.id=p.periodo_id
        LEFT JOIN LATERAL (SELECT estado, terminado_en, error FROM ejecucion_reporte
          WHERE reporte_id=p.id ORDER BY iniciado_en DESC LIMIT 1) e ON true
        WHERE p.institucion_id=$1 AND p.creador_id=$2 ORDER BY p.creado_en DESC`, [institucion, actor]);
      return r.rows;
    });
  }

  async crear(actor: string, institucion: string, dto: Record<string, unknown>) {
    const { periodoId, facultad, frecuencia } = dto;
    if (typeof periodoId !== 'string' || !UUID.test(periodoId)) throw new BadRequestException('Período inválido');
    if (facultad !== undefined && facultad !== null && (typeof facultad !== 'string' || !facultad.trim() || facultad.length > 150)) throw new BadRequestException('Facultad inválida');
    if (!['DIARIA', 'SEMANAL', 'MENSUAL'].includes(String(frecuencia))) throw new BadRequestException('Frecuencia inválida');
    const datos = await this.indicadores.consultar(actor, institucion, periodoId, facultad ?? undefined);
    return this.contexto.ejecutar(institucion, async db => {
      // El destino se obtiene del usuario autenticado; no se aceptan direcciones arbitrarias.
      const usuario = await db.query<{ email: string }>(`SELECT email FROM usuario WHERE id=$1 AND activo=true`, [actor]);
      if (!usuario.rowCount) throw new ForbiddenException('Usuario no habilitado');
      const r = await db.query(`INSERT INTO reporte_programado
        (institucion_id, creador_id, periodo_id, facultad, frecuencia, destino_email, proxima_ejecucion)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [institucion, actor, periodoId, datos.filtros.facultad, frecuencia, usuario.rows[0].email, siguiente(new Date(), frecuencia as Frecuencia)]);
      return { id: r.rows[0].id };
    });
  }

  async cancelar(actor: string, institucion: string, id: string) {
    if (!UUID.test(id)) throw new BadRequestException('Programación inválida');
    await this.autorizacion.exigirRol(actor, institucion, 'DIRECTOR');
    return this.contexto.ejecutar(institucion, async db => {
      const r = await db.query(`UPDATE reporte_programado SET estado='CANCELADO', cancelado_en=now()
        WHERE id=$1 AND creador_id=$2 AND institucion_id=$3 AND estado='ACTIVO' RETURNING id`, [id, actor, institucion]);
      if (!r.rowCount) throw new NotFoundException('Programación activa no encontrada');
      return { id, estado: 'CANCELADO' };
    });
  }

  async ejecutarPendientes(autorizacion: string | undefined) {
    const secreto = process.env.CRON_SECRET;
    if (!secreto || !autorizacion?.startsWith('Bearer ')) throw new ForbiddenException();
    const recibido = Buffer.from(autorizacion.slice(7));
    const esperado = Buffer.from(secreto);
    if (recibido.length !== esperado.length || !timingSafeEqual(recibido, esperado)) throw new ForbiddenException();
    const instituciones = await this.pool.query<{ id: string }>('SELECT id FROM institucion WHERE activa=true');
    let procesados = 0;
    for (const { id: institucion } of instituciones.rows) {
      await this.contexto.ejecutar(institucion, async db => {
        await db.query(`UPDATE ejecucion_reporte SET estado='FALLIDO', terminado_en=now(),
          error='La ejecución anterior se interrumpió' WHERE estado='EJECUTANDO'
          AND iniciado_en < now() - interval '30 minutes'`);
      });
      // La selección y el reclamo suceden bajo RLS; SKIP LOCKED evita dobles envíos simultáneos.
      for (let n = 0; n < 20; n++) {
        const trabajo = await this.contexto.ejecutar(institucion, async db => {
          const r = await db.query<Programacion>(`SELECT * FROM reporte_programado
            WHERE institucion_id=$1 AND estado='ACTIVO' AND proxima_ejecucion<=now()
            ORDER BY proxima_ejecucion FOR UPDATE SKIP LOCKED LIMIT 1`, [institucion]);
          const p = r.rows[0];
          if (!p) return null;
          await db.query(`UPDATE reporte_programado SET proxima_ejecucion=$2 WHERE id=$1`, [p.id, siguiente(new Date(), p.frecuencia)]);
          const e = await db.query<{ id: string }>(`INSERT INTO ejecucion_reporte(institucion_id,reporte_id,estado)
            VALUES($1,$2,'EJECUTANDO') RETURNING id`, [institucion, p.id]);
          return { p, ejecucionId: e.rows[0].id };
        });
        if (!trabajo) break;
        procesados++;
        let error: string | null = null;
        try {
          const { p } = trabajo;
          const vigente = await this.contexto.ejecutar(institucion, async db => db.query(
            `SELECT id FROM reporte_programado WHERE id=$1 AND estado='ACTIVO'`, [p.id]));
          if (!vigente.rowCount) throw new Error('Programación cancelada antes del envío');
          // Revalidación en cada ejecución: rol vigente, período, facultad y supresiones.
          const datos = await this.indicadores.consultar(p.creador_id, institucion, p.periodo_id, p.facultad ?? undefined);
          const destinatario = await this.contexto.ejecutar(institucion, async db => db.query<{ email: string }>(
            `SELECT u.email FROM usuario u JOIN rol_en_institucion r ON r.usuario_id=u.id
              WHERE u.id=$1 AND u.activo=true AND r.institucion_id=$2 AND r.rol='DIRECTOR'`, [p.creador_id, institucion]));
          if (!destinatario.rowCount || destinatario.rows[0].email !== p.destino_email) throw new Error('Destino institucional ya no autorizado');
          const clave = process.env.AVISOS_BREVO_API_KEY?.trim();
          const remitente = process.env.AVISOS_CORREO_REMITENTE?.trim();
          if (!clave || !remitente) throw new Error('Servicio de correo no configurado');
          const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST', headers: { 'api-key': clave, accept: 'application/json', 'content-type': 'application/json' },
            body: JSON.stringify({ sender: { email: remitente, name: process.env.AVISOS_CORREO_NOMBRE || 'DualCampus' },
              to: [{ email: p.destino_email }], subject: `DualCampus: reporte ${datos.periodo.nombre}`,
              textContent: 'Se adjunta el reporte agregado vigente. Los datos protegidos se encuentran suprimidos.',
              attachment: [{ name: 'reporte-agregado.csv', content: Buffer.from(exportarIndicadoresCsv(datos)).toString('base64') }] }),
            signal: AbortSignal.timeout(10000),
          });
          if (!respuesta.ok) throw new Error(`Servicio de correo: HTTP ${respuesta.status}`);
        } catch (e) { error = e instanceof Error ? e.message : 'Error al enviar reporte'; }
        await this.contexto.ejecutar(institucion, async db => {
          await db.query(`UPDATE ejecucion_reporte SET estado=$2, terminado_en=now(), error=$3 WHERE id=$1`,
            [trabajo.ejecucionId, error ? 'FALLIDO' : 'ENVIADO', error?.slice(0, 250) ?? null]);
        });
      }
    }
    return { procesados };
  }
}
