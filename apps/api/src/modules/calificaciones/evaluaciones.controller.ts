import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InstitucionActiva } from '../../common/decorators/institucion-activa.decorator';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion';
import { EvaluacionesService } from './evaluaciones.service';

@Controller('calificaciones')
export class EvaluacionesController {
  constructor(private readonly servicio: EvaluacionesService) {}

  @Get('secciones/:id/evaluaciones')
  listar(
    @UsuarioActual() u: UsuarioSesion,
    @InstitucionActiva() i: string,
    @Param('id') seccionId: string,
  ) {
    return this.servicio.listar(u.usuarioId, i, seccionId);
  }

  @Post('secciones/:id/evaluaciones')
  crear(
    @UsuarioActual() u: UsuarioSesion,
    @InstitucionActiva() i: string,
    @Param('id') seccionId: string,
    @Body() datos: Record<string, unknown>,
  ) {
    return this.servicio.crear(u.usuarioId, i, seccionId, datos ?? {});
  }
}
