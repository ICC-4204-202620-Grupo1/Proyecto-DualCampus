import { Inject, Injectable } from '@nestjs/common';
import { CONFIG, Config } from '../../config/config.js';
import type { IdentidadGoogle, UsuarioSesion } from './usuario-sesion.js';
import { UsuarioRegistrado, UsuariosRepositorio } from './usuarios.repositorio.js';

export interface InstitucionAutorizada {
  id: string;
  nombre: string;
  roles: string[];
}

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

    // Con una sola institución no hay nada que elegir: queda activa de inmediato (H02)
    const instituciones = institucionesDe(usuario);
    const activa = instituciones.length === 1 ? instituciones[0].id : null;
    return construirSesion(usuario, activa, identidad.nombre);
  }

  /** Instituciones activas en que el usuario tiene al menos un rol, leídas de la base. */
  async institucionesAutorizadas(usuarioId: string): Promise<InstitucionAutorizada[]> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario || !usuario.activo) return [];
    return institucionesDe(usuario);
  }

  /**
   * Nueva sesión con la institución elegida. Devuelve null si el usuario no tiene
   * rol en ella (o dejó de estar habilitado).
   */
  async cambiarInstitucion(usuarioId: string, institucionId: string): Promise<UsuarioSesion | null> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    if (!usuario || !usuario.activo) return null;
    if (!institucionesDe(usuario).some((i) => i.id === institucionId)) return null;
    return construirSesion(usuario, institucionId);
  }
}

function institucionesDe(usuario: UsuarioRegistrado): InstitucionAutorizada[] {
  const porId = new Map<string, InstitucionAutorizada>();
  for (const r of usuario.roles) {
    const inst = porId.get(r.institucionId) ?? { id: r.institucionId, nombre: r.institucion, roles: [] };
    inst.roles.push(r.rol);
    porId.set(r.institucionId, inst);
  }
  return [...porId.values()];
}

function construirSesion(u: UsuarioRegistrado, institucionActivaId: string | null, nombreGoogle = ''): UsuarioSesion {
  return {
    usuarioId: u.id,
    email: u.email,
    nombre: u.nombre || nombreGoogle || u.email,
    institucionActivaId,
    roles: u.roles,
  };
}
