import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UsuarioSesion } from '../../modules/autenticacion/usuario-sesion.js';

/** Inyecta el UsuarioSesion que dejó el AutenticacionGuard. */
export const UsuarioActual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioSesion => ctx.switchToHttp().getRequest().usuario,
);
