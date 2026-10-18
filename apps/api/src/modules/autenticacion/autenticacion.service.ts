import { Inject, Injectable } from '@nestjs/common';
import { CONFIG, Config } from '../../config/config';
import type { IdentidadGoogle, UsuarioSesion } from './usuario-sesion';
import { UsuariosRepositorio } from './usuarios.repositorio';

@Injectable()
export class AutenticacionService {
  constructor(
    private readonly usuarios: UsuariosRepositorio,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /**
   * Decide si una identidad confirmada por Google puede obtener sesión.
   * Devuelve null (sin sesión) si la cuenta no está habilitada en DualCampus.
   */
  async autorizar(identidad: IdentidadGoogle): Promise<UsuarioSesion | null> {
    if (!identidad.email || !identidad.emailVerificado) return null;

    const dominios = this.config.dominiosPermitidos;
    if (dominios.length > 0 && !dominios.includes(identidad.dominio ?? '')) return null;

    const usuario = await this.usuarios.buscarPorEmail(identidad.email);
    if (!usuario || !usuario.activo || usuario.roles.length === 0) return null;

    // La cuenta queda ligada al primer identificador de Google con que ingresó
    if (usuario.googleSub && usuario.googleSub !== identidad.sub) return null;

    await this.usuarios.registrarAcceso(usuario.id, identidad.sub);
    return {
      usuarioId: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre ?? identidad.nombre,
      institucionActivaId: null,
      roles: usuario.roles,
    };
  }
}
