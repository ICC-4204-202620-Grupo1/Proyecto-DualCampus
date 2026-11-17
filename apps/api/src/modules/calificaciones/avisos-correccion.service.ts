import { Injectable, Logger } from '@nestjs/common';
import { ContextoInstitucion } from '../../database/contexto-institucion.js';

/** H55. Avisos transaccionales via Brevo API HTTPS.
 * El envio ocurre despues de confirmar la correccion; los fallos nunca revierten notas.
 */
@Injectable()
export class AvisosCorreccionService {
  private readonly logger = new Logger(AvisosCorreccionService.name);
  constructor(private readonly contexto: ContextoInstitucion) {}

  async despachar(institucion: string, avisoId: string): Promise<void> {
    try {
      const aviso = await this.contexto.ejecutar(institucion, async db => {
        const r = await db.query<{ destinatario_email: string; estado: string }>(
          `SELECT destinatario_email, estado FROM aviso_correo WHERE id=$1 FOR UPDATE`, [avisoId]);
        return r.rows[0];
      });
      if (!aviso || aviso.estado !== 'PENDIENTE') return;

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
              subject: 'DualCampus: se corrigio una calificacion',
              textContent: `Se ha confirmado una correccion de calificacion en DualCampus.\nIngresa a ${process.env.APP_URL || 'http://localhost:5173'} e inicia sesion para revisar tu informacion academica.\nPor seguridad, este mensaje no incluye calificaciones.`,
            }),
            signal: AbortSignal.timeout(5000),
          });
          enviado = respuesta.ok;
          if (!respuesta.ok) error = `Brevo: HTTP ${respuesta.status}`;
        } catch (e) {
          error = e instanceof Error ? e.message : 'Error de transporte';
        }
      }
      await this.contexto.ejecutar(institucion, async db => {
        await db.query(`UPDATE aviso_correo
          SET estado=$2, intentos=intentos+1, ultimo_intento_en=now(),
              enviado_en=CASE WHEN $2='ENVIADO' THEN now() ELSE enviado_en END,
              ultimo_error=$3 WHERE id=$1 AND estado='PENDIENTE'`,
          [avisoId, enviado ? 'ENVIADO' : 'FALLIDO', enviado ? null : error.slice(0, 250)]);
      });
      if (!enviado) this.logger.warn(`H55: aviso ${avisoId} no enviado: ${error}`);
    } catch (e) {
      this.logger.error('H55: no fue posible procesar el aviso', e instanceof Error ? e.stack : String(e));
    }
  }
}
