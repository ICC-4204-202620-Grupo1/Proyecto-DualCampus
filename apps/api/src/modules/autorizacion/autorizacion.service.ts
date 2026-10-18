import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Rol } from '../autenticacion/usuario-sesion';
import { UsuariosRepositorio } from '../autenticacion/usuarios.repositorio';

/**
 * Verificación mínima de rol en la institución activa, leída de la base en cada
 * operación. H03 la reemplaza por @RequierePermiso y el EvaluadorPoliticas.
 */
@Injectable()
export class AutorizacionService {
  constructor(private readonly usuarios: UsuariosRepositorio) {}

  async exigirRol(usuarioId: string, institucionId: string, ...permitidos: Rol[]): Promise<void> {
    const contexto = await this.usuarios.rolesEnInstitucionActiva(usuarioId, institucionId);
    if (!contexto || !contexto.roles.some((r) => permitidos.includes(r))) {
      throw new ForbiddenException(`Requiere rol ${permitidos.join(' o ')} en la institución activa`);
    }
  }
}
