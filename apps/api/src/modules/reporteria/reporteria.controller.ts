
import { Controller, Get, Param } from '@nestjs/common';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { InstitucionActiva } from '../../common/decorators/institucion-activa.decorator.js';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion.js';
import { AsistenciaAgregadaService } from './asistencia-agregada.service.js';

@Controller(['reporteria', 'academico'])
export class ReporteriaController {
  constructor(
    private readonly asistencia: AsistenciaAgregadaService,
  ) {}

  @Get('secciones/:id/asistencia-agregada')
  asistenciaAgregada(
    @UsuarioActual() usuario: UsuarioSesion,
    @InstitucionActiva() institucion: string,
    @Param('id') seccionId: string,
  ) {
    return this.asistencia.consultar(
      usuario.usuarioId,
      institucion,
      seccionId,
    );
  }
}
