import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
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
  @Put(':id/actividades/:actividadId/configuracion')
  configurar(@UsuarioActual() u: UsuarioSesion, @InstitucionActiva() i: string,
    @Param('id') id: string, @Param('actividadId') actividadId: string,
    @Body() datos: Record<string, unknown>) {
    return this.servicio.configurar(u.usuarioId, i, id, actividadId, datos ?? {});
  }
}
