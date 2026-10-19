import { ConflictException, createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Entrega el id de la institución activa de la sesión. Si el usuario aún no eligió
 * una, responde 409 para que la interfaz le pida seleccionarla.
 */
export const InstitucionActiva = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const id = ctx.switchToHttp().getRequest().usuario?.institucionActivaId;
  if (!id) throw new ConflictException('Selecciona una institución activa');
  return id;
});
