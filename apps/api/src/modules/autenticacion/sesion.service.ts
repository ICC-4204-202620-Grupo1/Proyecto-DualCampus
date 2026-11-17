import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions } from 'express';
import { CONFIG, Config } from '../../config/config.js';
import type { UsuarioSesion } from './usuario-sesion.js';

export const COOKIE_SESION = 'dc_sesion';
export const COOKIE_OIDC = 'dc_oidc';

const AUD_SESION = 'dualcampus:sesion';
const AUD_OIDC = 'dualcampus:oidc';
const OIDC_MINUTOS = 10;

/**
 * Sesión firmada (JWT HS256) en cookie httpOnly. No se guarda estado en el servidor,
 * lo que encaja con funciones serverless. El vencimiento va en el token y en la cookie.
 */
@Injectable()
export class SesionService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  emitir(usuario: UsuarioSesion): string {
    return this.jwt.sign(
      { ...usuario },
      {
        secret: this.config.sessionSecret,
        subject: usuario.usuarioId,
        audience: AUD_SESION,
        expiresIn: this.config.sesionDuracionHoras * 3600,
      },
    );
  }

  verificar(token: string | undefined): UsuarioSesion | null {
    if (!token) return null;
    try {
      const p = this.jwt.verify(token, { secret: this.config.sessionSecret, audience: AUD_SESION });
      return {
        usuarioId: p.usuarioId,
        email: p.email,
        nombre: p.nombre,
        institucionActivaId: p.institucionActivaId ?? null,
        roles: p.roles ?? [],
      };
    } catch {
      return null; // firma inválida, alterado o vencido
    }
  }

  /** Datos temporales del inicio de sesión (state y nonce de OIDC). */
  emitirOidc(datos: { state: string; nonce: string }): string {
    return this.jwt.sign(datos, {
      secret: this.config.sessionSecret,
      audience: AUD_OIDC,
      expiresIn: OIDC_MINUTOS * 60,
    });
  }

  verificarOidc(token: string | undefined): { state: string; nonce: string } | null {
    if (!token) return null;
    try {
      const p = this.jwt.verify(token, { secret: this.config.sessionSecret, audience: AUD_OIDC });
      return { state: p.state, nonce: p.nonce };
    } catch {
      return null;
    }
  }

  private base(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.produccion || this.config.appUrl.startsWith('https://'),
      sameSite: 'lax',
      path: '/',
    };
  }

  opcionesCookieSesion(): CookieOptions {
    return { ...this.base(), maxAge: this.config.sesionDuracionHoras * 3600 * 1000 };
  }

  opcionesCookieOidc(): CookieOptions {
    return { ...this.base(), maxAge: OIDC_MINUTOS * 60 * 1000 };
  }

  /** Opciones para borrar una cookie (deben coincidir en path y flags). */
  opcionesBorrado(): CookieOptions {
    return this.base();
  }
}
