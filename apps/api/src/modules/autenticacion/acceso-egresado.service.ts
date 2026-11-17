import { Injectable } from '@nestjs/common';
import { CuentasPersonalesRepositorio } from './cuentas-personales.repositorio.js';
import type { SesionEgresado } from './sesion.service.js';
import type { IdentidadGoogle } from './usuario-sesion.js';
import { UsuariosRepositorio } from './usuarios.repositorio.js';

/** Motivo que la API devuelve a la interfaz en ?error= cuando no hay acceso. */
export type RechazoIngresoEgresado = 'sin_vinculacion' | 'no_verificada';

/** Institución en que la persona fue alumna y cuyo historial puede consultar. */
export interface InstitucionEgresado {
  id: string;
  nombre: string;
}

/** H44 · Persona identificada por su cuenta personal, tal como la ve la interfaz de consulta. */
export interface EgresadoActual {
  usuarioId: string;
  nombre: string;
  emailInstitucional: string;
  emailPersonal: string;
  /** La cuenta institucional puede estar inactiva: el acceso no depende de ella (CA1). */
  cuentaInstitucionalActiva: boolean;
  instituciones: InstitucionEgresado[];
}

/**
 * H44 · Acceder al historial tras el egreso.
 * La cuenta personal verificada (H43) identifica a la misma persona aunque su cuenta
 * institucional esté inactiva. El acceso que otorga es de solo consulta de su historial.
 */
@Injectable()
export class AccesoEgresadoService {
  constructor(
    private readonly cuentas: CuentasPersonalesRepositorio,
    private readonly usuarios: UsuariosRepositorio,
  ) {}

  /** CA1 · Resuelve la persona a partir de la identidad que Google acaba de confirmar. */
  async identificar(identidad: IdentidadGoogle): Promise<SesionEgresado | RechazoIngresoEgresado> {
    if (!identidad.sub || !identidad.email || !identidad.emailVerificado) return 'no_verificada';
    // Se busca por google_sub, el identificador estable de la cuenta; nunca por el correo declarado.
    const titular = await this.cuentas.buscarPorSub(identidad.sub);
    if (!titular) return 'sin_vinculacion';
    // No se exige usuario.activo: es justamente lo que se pierde al egresar.
    const usuario = await this.usuarios.buscarPorId(titular.usuarioId);
    if (!usuario) return 'sin_vinculacion';
    return { usuarioId: usuario.id, sub: identidad.sub };
  }

  /**
   * Comprueba en cada consulta que la cuenta personal sigue vinculada a la misma persona:
   * si se reemplazó o liberó (H43), la sesión emitida con ella deja de servir.
   */
  async vigente(sesion: SesionEgresado): Promise<EgresadoActual | null> {
    const titular = await this.cuentas.buscarPorSub(sesion.sub);
    if (!titular || titular.usuarioId !== sesion.usuarioId) return null;
    const usuario = await this.usuarios.buscarPorId(sesion.usuarioId);
    if (!usuario) return null;
    const instituciones = new Map<string, InstitucionEgresado>();
    for (const r of usuario.roles) {
      if (r.rol === 'ALUMNO') instituciones.set(r.institucionId, { id: r.institucionId, nombre: r.institucion });
    }
    return {
      usuarioId: usuario.id,
      nombre: usuario.nombre || usuario.email,
      emailInstitucional: usuario.email,
      emailPersonal: titular.email,
      cuentaInstitucionalActiva: usuario.activo,
      instituciones: [...instituciones.values()],
    };
  }
}
