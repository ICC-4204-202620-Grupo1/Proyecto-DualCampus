import { BadRequestException, Body, Controller, ForbiddenException, Get, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { InstitucionActiva } from '../../common/decorators/institucion-activa.decorator';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator';
import { AutenticacionService } from './autenticacion.service';
import { COOKIE_SESION, SesionService } from './sesion.service';
import type { UsuarioSesion } from './usuario-sesion';
import { UsuariosRepositorio } from './usuarios.repositorio';

/** H02 · Seleccionar la institución activa de la sesión. */
@Controller('sesion')
export class SesionController {
  constructor(
    private readonly autenticacion: AutenticacionService,
    private readonly sesion: SesionService,
    private readonly usuarios: UsuariosRepositorio,
  ) {}

  /** Solo las instituciones en que el usuario tiene un rol (CA1). */
  @Get('instituciones')
  async instituciones(@UsuarioActual() usuario: UsuarioSesion) {
    return {
      institucionActivaId: usuario.institucionActivaId,
      instituciones: await this.autenticacion.institucionesAutorizadas(usuario.usuarioId),
    };
  }

  /** Fija la institución activa y reemite la cookie de sesión (CA2). */
  @Put('institucion')
  async seleccionar(
    @UsuarioActual() usuario: UsuarioSesion,
    @Body() body: { institucionId?: unknown },
    @Res({ passthrough: true }) res: Response,
  ): Promise<UsuarioSesion> {
    const id = body?.institucionId;
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
      throw new BadRequestException('institucionId debe ser un identificador válido');
    }
    const nueva = await this.autenticacion.cambiarInstitucion(usuario.usuarioId, id);
    if (!nueva) throw new ForbiddenException('No tienes un rol en esa institución');
    res.cookie(COOKIE_SESION, this.sesion.emitir(nueva), this.sesion.opcionesCookieSesion());
    return nueva;
  }

  /**
   * Consulta hecha dentro del contexto de la institución activa (CA3): muestra el
   * valor de app.institucion_id con que corrió y los roles del usuario en ella.
   */
  @Get('contexto')
  async contexto(@UsuarioActual() usuario: UsuarioSesion, @InstitucionActiva() institucionId: string) {
    const resultado = await this.usuarios.rolesEnInstitucionActiva(usuario.usuarioId, institucionId);
    if (!resultado) throw new ForbiddenException('Ya no tienes un rol en la institución activa');
    return { institucionActivaId: institucionId, ...resultado };
  }
}
