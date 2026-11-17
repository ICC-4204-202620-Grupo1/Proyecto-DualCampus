
import { Controller, Get, Param, Query } from '@nestjs/common';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { InstitucionActiva } from '../../common/decorators/institucion-activa.decorator.js';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion.js';
import { AsistenciaAgregadaService } from './asistencia-agregada.service.js';
import { IndicadoresInstitucionalesService } from './indicadores-institucionales.service.js';

@Controller(['reporteria', 'academico'])
export class ReporteriaController {
  constructor(
    private readonly asistencia: AsistenciaAgregadaService,
    private readonly indicadores: IndicadoresInstitucionalesService,
  ) {}

  /** H48 · Indicadores agregados de la institución activa en un período, solo para el director. */
  @Get('indicadores-institucionales')
  indicadoresInstitucionales(
    @UsuarioActual() usuario: UsuarioSesion,
    @InstitucionActiva() institucion: string,
    @Query('periodoId') periodoId: unknown,
    @Query('facultad') facultad?: unknown,
  ) {
    return this.indicadores.consultar(usuario.usuarioId, institucion, periodoId, facultad);
  }

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
