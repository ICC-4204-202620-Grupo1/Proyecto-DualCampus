import { Injectable, Logger } from '@nestjs/common';
import { ContextoInstitucion } from '../../database/contexto-institucion.js';

/** H54/H55. Avisos transaccionales vía Brevo API HTTPS.
 * El envío ocurre después de confirmar la publicación o corrección; los fallos nunca revierten notas.
 */
@Injectable()
export class AvisosCorreccionService {
  private readonly logger = new Logger(AvisosCorreccionService.name);
  constructor(private readonly contexto: ContextoInstitucion) {}

  async despachar(institucion: string, avisoId: string): Promise<void> {
    try {
      const aviso = await this.contexto.ejecutar(institucion, async db => {
        const r = await db.query<{ destinatario_email: string; estado: string; tipo: string }>(
          `UPDATE aviso_correo SET estado='ENVIANDO' WHERE id=$1 AND estado='PENDIENTE'
           RETURNING destinatario_email, estado, tipo`, [avisoId]);
        return r.rows[0];
      });
      if (!aviso) {
        return;
      }
      if (aviso.estado !== 'ENVIANDO') return;

      const apiKey = process.env.AVISOS_BREVO_API_KEY?.trim();
      const remitenteEmail = process.env.AVISOS_CORREO_REMITENTE?.trim();
      const remitenteNombre = process.env.AVISOS_CORREO_NOMBRE?.trim() || 'DualCampus';
      let enviado = false;
      let error = '';
      if (!apiKey || !remitenteEmail) {
        error = 'Servicio de correo Brevo no configurado';
      } else {
        try {
          const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': apiKey,
              'accept': 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              sender: { email: remitenteEmail, name: remitenteNombre },
              to: [{ email: aviso.destinatario_email }],
              subject: aviso.tipo === 'PUBLICACION_NOTA'
                ? 'DualCampus: se publicaron tus notas'
                : 'DualCampus: se corrigio una calificacion',
              textContent: aviso.tipo === 'PUBLICACION_NOTA'
                ? `Se publicaron notas de una evaluación en DualCampus.\nIngresa a ${process.env.APP_URL || 'http://localhost:5173'} e inicia sesión para consultar tus calificaciones.\nPor seguridad, este mensaje no incluye notas.`
                : `Se ha confirmado una correccion de calificacion en DualCampus.\nIngresa a ${process.env.APP_URL || 'http://localhost:5173'} e inicia sesion para revisar tu informacion academica.\nPor seguridad, este mensaje no incluye calificaciones.`,
            }),
            signal: AbortSignal.timeout(5000),
          });
          enviado = respuesta.ok;
          if (!respuesta.ok) {
            // La API responde con un JSON que contiene el motivo del rechazo.
            // Registrar solo codigo/mensaje, nunca credenciales ni cabeceras.
            let detalle = '';
            try {
              const cuerpo: unknown = await respuesta.json();
              if (cuerpo && typeof cuerpo === 'object') {
                const dato = cuerpo as { code?: unknown; message?: unknown };
                const codigo = typeof dato.code === 'string' ? dato.code : '';
                const mensaje = typeof dato.message === 'string' ? dato.message : '';
                detalle = [codigo, mensaje].filter(Boolean).join(': ');
              }
            } catch { /* La respuesta puede no contener JSON. */ }
            error = `Brevo: HTTP ${respuesta.status}${detalle ? ' - ' + detalle : ''}`;
          }
        } catch (e) {
          error = e instanceof Error ? e.message : 'Error de transporte';
        }
      }
      const actualizados = await this.contexto.ejecutar(institucion, async db => {
        const actualizado = await db.query<{ intentos: number }>(`UPDATE aviso_correo
          SET estado=$2, intentos=intentos+1, ultimo_intento_en=now(),
              enviado_en=CASE WHEN $2='ENVIADO' THEN now() ELSE enviado_en END,
              ultimo_error=$3 WHERE id=$1 AND estado='ENVIANDO' RETURNING intentos`,
          [avisoId, enviado ? 'ENVIADO' : 'FALLIDO', enviado ? null : error.slice(0, 250)]);
        if (actualizado.rows?.[0]) await db.query(`INSERT INTO intento_aviso_correo
          (institucion_id,aviso_id,numero,resultado,error) VALUES($1,$2,$3,$4,$5)`,
          [institucion, avisoId, actualizado.rows[0].intentos, enviado ? 'ENVIADO' : 'FALLIDO', enviado ? null : error.slice(0, 250)]);
        return actualizado;
      });
      if (!actualizados.rowCount) this.logger.warn(`H55: aviso ${avisoId} sin actualizacion de estado`);
      if (!enviado) this.logger.warn(`H55: aviso ${avisoId} no enviado: ${error}`);
    } catch (e) {
      this.logger.error('H55: no fue posible procesar el aviso', e instanceof Error ? e.stack : String(e));
    }
  }
}
