import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Rol } from '../autenticacion/usuario-sesion';
import { UsuariosRepositorio } from '../autenticacion/usuarios.repositorio';

/**
 * H03: exige un rol vigente de la institución activa en cada operación.
 * H04 complementa este control con asignación/matrícula y RLS en gestión académica.
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
