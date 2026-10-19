import { Inject, Injectable } from '@nestjs/common';
import { OAuth2Client, type GenerateAuthUrlOpts } from 'google-auth-library';
import { CONFIG, Config } from '../../config/config.js';
import type { IdentidadGoogle } from './usuario-sesion.js';

/**
 * Adaptador de Google Workspace (OpenID Connect, flujo authorization code).
 * Aísla al proveedor para poder reemplazarlo en pruebas sin tocar la lógica.
 */
@Injectable()
export class GoogleOidcAdapter {
  private cliente?: OAuth2Client;

  constructor(@Inject(CONFIG) private readonly config: Config) {}

  private obtenerCliente(): OAuth2Client {
    if (!this.config.googleClientId || !this.config.googleClientSecret) {
      throw new Error('Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en la configuración de la API.');
    }
    this.cliente ??= new OAuth2Client({
      clientId: this.config.googleClientId,
      clientSecret: this.config.googleClientSecret,
      redirectUri: `${this.config.appUrl}/api/auth/google/callback`,
    });
    return this.cliente;
  }

  urlAutorizacion(state: string, nonce: string): string {
    const dominios = this.config.dominiosPermitidos;
    const opciones: GenerateAuthUrlOpts & { nonce: string } = {
      scope: ['openid', 'email', 'profile'],
      state,
      nonce,
      prompt: 'select_account',
      // Con un solo dominio, Google muestra directamente las cuentas de esa institución
      ...(dominios.length === 1 ? { hd: dominios[0] } : {}),
    };
    return this.obtenerCliente().generateAuthUrl(opciones);
  }

  /** Canjea el código y valida firma, emisor, audiencia, vencimiento y nonce del id_token. */
  async canjearCodigo(code: string, nonce: string): Promise<IdentidadGoogle> {
    const cliente = this.obtenerCliente();
    const { tokens } = await cliente.getToken(code);
    if (!tokens.id_token) throw new Error('Google no entregó id_token');
    const ticket = await cliente.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.config.googleClientId,
    });
    const datos = ticket.getPayload();
    if (!datos || datos.nonce !== nonce) throw new Error('id_token inválido');
    return {
      sub: datos.sub,
      email: (datos.email ?? '').toLowerCase(),
      emailVerificado: datos.email_verified === true,
      nombre: datos.name ?? datos.email ?? '',
      dominio: datos.hd?.toLowerCase() ?? null,
    };
  }
}
