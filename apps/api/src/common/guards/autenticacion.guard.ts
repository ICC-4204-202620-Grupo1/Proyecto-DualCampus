import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ES_PUBLICO } from '../decorators/publico.decorator';
import { COOKIE_SESION, SesionService } from '../../modules/autenticacion/sesion.service';

/**
 * Primer filtro de toda petición (Entrega 3, 4.2): sin sesión válida o con sesión
 * vencida responde 401. Se registra como guard global; @Publico() lo omite.
 */
@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sesion: SesionService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const esPublico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (esPublico) return true;

    const req = ctx.switchToHttp().getRequest<Request & { usuario?: unknown }>();
    const usuario = this.sesion.verificar(req.cookies?.[COOKIE_SESION]);
    if (!usuario) throw new UnauthorizedException('Sesión inválida o expirada');
    req.usuario = usuario;
    return true;
  }
}
