import { CanActivate, ConflictException, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ES_PUBLICO } from '../decorators/publico.decorator.js';
import { COOKIE_SESION, SesionService } from '../../modules/autenticacion/sesion.service.js';
import { UsuariosRepositorio } from '../../modules/autenticacion/usuarios.repositorio.js';
import { CONFIG, Config } from '../../config/config.js';

@Injectable()
export class AutenticacionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sesion: SesionService,
    private readonly usuarios: UsuariosRepositorio,
    @Inject(CONFIG) private readonly config: Config,
  ) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { usuario?: unknown }>();
    const escritura = !['GET','HEAD','OPTIONS'].includes(req.method);
    if (escritura && req.headers.origin && req.headers.origin !== this.config.appUrl) {
      throw new ForbiddenException('Origen de la solicitud no permitido');
    }
    const publico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO,[ctx.getHandler(),ctx.getClass()]);
    if (publico) return true;
    const sesion = this.sesion.verificar(req.cookies?.[COOKIE_SESION]);
    if (!sesion) throw new UnauthorizedException('Sesión inválida o expirada');
    const esperada=req.headers['x-institucion-id'];
    if(esperada && esperada!==sesion.institucionActivaId) throw new ConflictException('La institución cambió en otra pestaña. Recarga antes de continuar.');
    // No confiar en roles embebidos en una cookie emitida antes de una revocación.
    const actual = await this.usuarios.buscarPorId(sesion.usuarioId);
    if (!actual?.activo || !actual.roles.length) throw new UnauthorizedException('La cuenta ya no está habilitada');
    if (sesion.institucionActivaId && !actual.roles.some(r=>r.institucionId===sesion.institucionActivaId)) {
      throw new ForbiddenException('El acceso a la institución ya no está habilitado');
    }
    if (escritura && !req.is('application/json')) throw new ForbiddenException('La operación requiere contenido JSON');
    req.usuario = { ...sesion, nombre:actual.nombre || sesion.nombre, email:actual.email, roles:actual.roles };
    return true;
  }
}
