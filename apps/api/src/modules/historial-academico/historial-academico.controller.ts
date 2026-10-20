import { Controller, Get } from '@nestjs/common';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { InstitucionActiva } from '../../common/decorators/institucion-activa.decorator.js';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion.js';
import { HistorialAcademicoService } from './historial-academico.service.js';

/** H39: historial exclusivamente del alumno autenticado en su institución activa. */
@Controller('historial-academico')
export class HistorialAcademicoController {
  constructor(private readonly historial: HistorialAcademicoService) {}

  @Get('propio')
  propio(
    @UsuarioActual() usuario: UsuarioSesion,
    @InstitucionActiva() institucionId: string,
  ) {
    return this.historial.consultar(usuario.usuarioId, institucionId);
  }
}
