import { Controller, Get, Inject, Logger, Query, Req, Res } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { Publico } from '../../common/decorators/publico.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { CONFIG, Config } from '../../config/config.js';
import { CuentaPersonalService, ResultadoVinculacionPersonal } from './cuenta-personal.service.js';
import { GoogleOidcAdapter } from './google-oidc.adapter.js';
import { COOKIE_OIDC, COOKIE_SESION, SesionService } from './sesion.service.js';
import type { UsuarioSesion } from './usuario-sesion.js';

/**
 * H43 · Vincular una cuenta personal verificada.
 * El flujo vuelve por /api/auth/google/callback (la misma redirección registrada en Google),
 * que reconoce el propósito 'vincular' en la cookie OIDC firmada.
 */
@Controller('cuenta-personal')
export class CuentaPersonalController {
  private readonly log = new Logger(CuentaPersonalController.name);

  constructor(
    private readonly cuentaPersonal: CuentaPersonalService,
    private readonly google: GoogleOidcAdapter,
    private readonly sesion: SesionService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** CA3 · Cuenta personal asociada, para mostrarla en el perfil. */
  @Get()
  consultar(@UsuarioActual() usuario: UsuarioSesion) {
    return this.cuentaPersonal.consultar(usuario.usuarioId);
  }

  /**
   * CA1 · Inicia la verificación con Google. Es una navegación del navegador, por eso
   * responde con redirecciones en vez de errores JSON; la sesión se valida aquí mismo.
   */
  @Publico()
  @Get('vincular')
  async iniciar(@Req() req: Request, @Res() res: Response) {
    const sesion = this.sesion.verificar(req.cookies?.[COOKIE_SESION]);
    if (!sesion) return volverAlPerfil(res, this.config, 'sesion_requerida');
    if (!(await this.cuentaPersonal.esAlumnoHabilitado(sesion.usuarioId))) {
      return volverAlPerfil(res, this.config, 'no_alumno');
    }
    const state = randomBytes(24).toString('base64url');
    const nonce = randomBytes(24).toString('base64url');
    res.cookie(
      COOKIE_OIDC,
      this.sesion.emitirOidc({ state, nonce, proposito: 'vincular', usuarioId: sesion.usuarioId }),
      this.sesion.opcionesCookieOidc(),
    );
    res.redirect(this.google.urlAutorizacion(state, nonce, { cuentaPersonal: true }));
  }

  /** Vinculación local sin Google, igual que dev-login. No existe en producción. */
  @Publico()
  @Get('dev-vincular')
  async devVincular(@Query('email') email: string | undefined, @Req() req: Request, @Res() res: Response) {
    if (this.config.produccion) return res.status(404).send('No disponible en producción');
    const sesion = this.sesion.verificar(req.cookies?.[COOKIE_SESION]);
    if (!sesion) return volverAlPerfil(res, this.config, 'sesion_requerida');
    const correo = (email || 'personal.demo@example.invalid').trim().toLowerCase();
    const resultado = await this.cuentaPersonal.vincular(sesion.usuarioId, {
      sub: 'dev-personal-' + correo,
      email: correo,
      emailVerificado: true,
      nombre: correo.split('@')[0],
      dominio: null,
    });
    this.log.log(`Vinculación local de cuenta personal: ${resultado}`);
    return volverAlPerfil(res, this.config, resultado);
  }
}

/** Vuelve a la aplicación sin tocar la sesión institucional, que sigue vigente. */
export function volverAlPerfil(res: Response, config: Config, resultado: ResultadoVinculacionPersonal) {
  res.redirect(`${config.appUrl}/?vinculacion=${resultado}`);
}
