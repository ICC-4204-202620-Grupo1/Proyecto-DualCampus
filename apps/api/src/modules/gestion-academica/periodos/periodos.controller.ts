import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InstitucionActiva } from '../../../common/decorators/institucion-activa.decorator.js';
import { UsuarioActual } from '../../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioSesion } from '../../autenticacion/usuario-sesion.js';
import { CrearPeriodoDto, PeriodosService } from './periodos.service.js';

/** H05 · Períodos académicos de la institución activa. */
@Controller('periodos')
export class PeriodosController {
  constructor(private readonly periodos: PeriodosService) {}

  @Post()
  crear(
    @UsuarioActual() usuario: UsuarioSesion,
    @InstitucionActiva() institucionId: string,
    @Body() dto: CrearPeriodoDto,
  ) {
    return this.periodos.crear(usuario.usuarioId, institucionId, dto ?? {});
  }

  @Get()
  listar(@UsuarioActual() usuario: UsuarioSesion, @InstitucionActiva() institucionId: string) {
    return this.periodos.listar(usuario.usuarioId, institucionId);
  }

  @Get(':id')
  obtener(
    @UsuarioActual() usuario: UsuarioSesion,
    @InstitucionActiva() institucionId: string,
    @Param('id') id: string,
  ) {
    return this.periodos.obtener(usuario.usuarioId, institucionId, id);
  }
}
