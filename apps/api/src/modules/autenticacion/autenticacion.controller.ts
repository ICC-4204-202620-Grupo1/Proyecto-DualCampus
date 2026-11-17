import { Controller, Get, HttpCode, Inject, Logger, Post, Query, Req, Res } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { Publico } from '../../common/decorators/publico.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { CONFIG, Config } from '../../config/config.js';
import { AutenticacionService } from './autenticacion.service.js';
import { GoogleOidcAdapter } from './google-oidc.adapter.js';
import { COOKIE_OIDC, COOKIE_SESION, SesionService } from './sesion.service.js';
import type { UsuarioSesion } from './usuario-sesion.js';

@Controller('auth')
export class AutenticacionController {
  private readonly log = new Logger(AutenticacionController.name);

  constructor(
    private readonly google: GoogleOidcAdapter,
    private readonly autenticacion: AutenticacionService,
    private readonly sesion: SesionService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** Inicia el flujo: redirige a Google con state y nonce de un solo uso. */
  @Publico()
  @Get('google')
  iniciar(@Res() res: Response) {
    const state = randomBytes(24).toString('base64url');
    const nonce = randomBytes(24).toString('base64url');
    res.cookie(COOKIE_OIDC, this.sesion.emitirOidc({ state, nonce }), this.sesion.opcionesCookieOidc());
    res.redirect(this.google.urlAutorizacion(state, nonce));
  }

  /** Acceso rápido para desarrollo local sin depender de credenciales de Google */
  @Publico()
  @Get('dev-login')
  async devLogin(
    @Query('email') email: string | undefined,
    @Res() res: Response,
  ) {
    if (this.config.produccion) return res.status(404).send('No disponible en producción');
    const correo = (email || 'benjamin@dualcampus.test').toLowerCase();
    const usuario = await this.autenticacion.autorizar({
      sub: 'dev-' + correo,
      email: correo,
      emailVerificado: true,
      nombre: correo.split('@')[0],
      dominio: null,
    });
    if (!usuario) {
      return res.status(403).send(`Usuario ${correo} no habilitado en la base de datos.`);
    }
    res.cookie(COOKIE_SESION, this.sesion.emitir(usuario), this.sesion.opcionesCookieSesion());
    res.redirect(`${this.config.appUrl}/`);
  }

  /** Google vuelve aquí. Solo una cuenta habilitada recibe la cookie de sesión. */
  @Publico()
  @Get('google/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const oidc = this.sesion.verificarOidc(req.cookies?.[COOKIE_OIDC]);
    res.clearCookie(COOKIE_OIDC, this.sesion.opcionesBorrado());

    if (!oidc || !code || !state || state !== oidc.state) {
      return this.rechazar(res, 'fallo_login');
    }

    let usuario: UsuarioSesion | null;
    try {
      const identidad = await this.google.canjearCodigo(code, oidc.nonce);
      usuario = await this.autenticacion.autorizar(identidad);
      if (!usuario) this.log.warn(`Ingreso rechazado: ${identidad.email}`);
    } catch (error) {
      this.log.error(`Fallo en el inicio de sesión: ${(error as Error).message}`);
      return this.rechazar(res, 'fallo_login');
    }
    if (!usuario) return this.rechazar(res, 'no_autorizado');

    res.cookie(COOKIE_SESION, this.sesion.emitir(usuario), this.sesion.opcionesCookieSesion());
    res.redirect(`${this.config.appUrl}/`);
  }

  /** Identidad de la sesión actual. Sin sesión válida, el guard responde 401. */
  @Get('me')
  me(@UsuarioActual() usuario: UsuarioSesion) {
    return usuario;
  }

  @Publico()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_SESION, this.sesion.opcionesBorrado());
  }

  private rechazar(res: Response, motivo: 'no_autorizado' | 'fallo_login') {
    res.clearCookie(COOKIE_SESION, this.sesion.opcionesBorrado());
    res.redirect(`${this.config.appUrl}/?error=${motivo}`);
  }
}
