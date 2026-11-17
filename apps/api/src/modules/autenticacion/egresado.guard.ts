import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AccesoEgresadoService, EgresadoActual } from './acceso-egresado.service.js';
import { COOKIE_EGRESADO, SesionService } from './sesion.service.js';

type RequestEgresado = Request & { egresado?: EgresadoActual };

/**
 * H44 · CA2 · Protege las rutas de consulta del egresado. Acepta solo la cookie dc_egresado
 * y solo lecturas; el AutenticacionGuard global no reconoce esa cookie en ninguna otra ruta.
 */
@Injectable()
export class EgresadoGuard implements CanActivate {
  constructor(
    private readonly sesion: SesionService,
    private readonly acceso: AccesoEgresadoService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestEgresado>();
    if (!['GET', 'HEAD'].includes(req.method)) throw new ForbiddenException('El acceso de egresado es solo de consulta');
    const datos = this.sesion.verificarEgresado(req.cookies?.[COOKIE_EGRESADO]);
    if (!datos) throw new UnauthorizedException('Sesión de egresado inválida o expirada');
    const egresado = await this.acceso.vigente(datos);
    if (!egresado) throw new UnauthorizedException('La cuenta personal ya no está vinculada');
    req.egresado = egresado;
    return true;
  }
}

/** Inyecta el egresado que dejó el EgresadoGuard. */
export const Egresado = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): EgresadoActual => ctx.switchToHttp().getRequest<RequestEgresado>().egresado!,
);
