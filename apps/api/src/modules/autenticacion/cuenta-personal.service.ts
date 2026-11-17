import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { CONFIG, Config } from '../../config/config.js';
import { CuentaPersonal, CuentasPersonalesRepositorio } from './cuentas-personales.repositorio.js';
import type { IdentidadGoogle } from './usuario-sesion.js';
import { UsuariosRepositorio } from './usuarios.repositorio.js';

/** Resultado que la API devuelve a la interfaz en ?vinculacion= tras volver de Google. */
export type ResultadoVinculacionPersonal =
  | 'vinculada'
  | 'sesion_requerida'
  | 'no_alumno'
  | 'no_verificada'
  | 'cuenta_institucional'
  | 'cuenta_ocupada'
  | 'fallo';

/**
 * H43 · Vincular una cuenta personal verificada.
 * La persona se toma siempre de la sesión vigente; nunca se acepta un usuarioId del cliente.
 */
@Injectable()
export class CuentaPersonalService {
  constructor(
    private readonly usuarios: UsuariosRepositorio,
    private readonly cuentas: CuentasPersonalesRepositorio,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  /** La vinculación prepara el acceso tras el egreso: solo la solicita quien es alumno. */
  async esAlumnoHabilitado(usuarioId: string): Promise<boolean> {
    const usuario = await this.usuarios.buscarPorId(usuarioId);
    return !!usuario?.activo && usuario.roles.some((r) => r.rol === 'ALUMNO');
  }

  async exigirAlumno(usuarioId: string): Promise<void> {
    if (!(await this.esAlumnoHabilitado(usuarioId))) {
      throw new ForbiddenException('Solo un alumno puede vincular una cuenta personal');
    }
  }

  /** CA3 · Cuenta asociada, consultable desde el perfil. */
  async consultar(usuarioId: string): Promise<{ cuentaPersonal: CuentaPersonal | null }> {
    await this.exigirAlumno(usuarioId);
    return { cuentaPersonal: await this.cuentas.obtener(usuarioId) };
  }

  /**
   * CA1 y CA2 · Asocia la identidad que Google acaba de confirmar. Quien llama ya verificó
   * que la sesión institucional sigue vigente y es la misma que inició el flujo.
   */
  async vincular(usuarioId: string, identidad: IdentidadGoogle): Promise<ResultadoVinculacionPersonal> {
    if (!(await this.esAlumnoHabilitado(usuarioId))) return 'no_alumno';
    // Sin correo verificado no hay prueba de que la persona controla esa cuenta.
    if (!identidad.sub || !identidad.email || !identidad.emailVerificado) return 'no_verificada';
    // Una cuenta del dominio institucional se pierde al egresar: no sirve como cuenta personal.
    if (identidad.dominio && this.config.dominiosPermitidos.includes(identidad.dominio)) return 'cuenta_institucional';

    const resultado = await this.cuentas.vincular(usuarioId, { sub: identidad.sub, email: identidad.email.toLowerCase() });
    if (resultado === 'OCUPADA') return 'cuenta_ocupada';
    if (resultado === 'INSTITUCIONAL') return 'cuenta_institucional';
    return 'vinculada';
  }
}
