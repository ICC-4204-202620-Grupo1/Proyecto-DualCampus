import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { InstitucionActiva } from '../../common/decorators/institucion-activa.decorator.js';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion.js';
import { ActividadesService } from './actividades.service.js';

@Controller('actividades/secciones')
export class ActividadesController {
  constructor(private readonly servicio: ActividadesService) {}

  @Get(':id')
  listar(@UsuarioActual() u: UsuarioSesion, @InstitucionActiva() i: string, @Param('id') id: string) {
    return this.servicio.listar(u.usuarioId, i, id);
  }

  @Post(':id')
  crear(@UsuarioActual() u: UsuarioSesion, @InstitucionActiva() i: string,
    @Param('id') id: string, @Body() datos: Record<string, unknown>) {
    return this.servicio.crear(u.usuarioId, i, id, datos ?? {});
  }
}
