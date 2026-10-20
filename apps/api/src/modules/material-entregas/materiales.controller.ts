import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { InstitucionActiva } from '../../common/decorators/institucion-activa.decorator.js';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion.js';
import { MaterialesService } from './materiales.service.js';
@Controller('materiales/secciones')
export class MaterialesController {
  constructor(private readonly servicio: MaterialesService) {}
  @Get(':id')
  listar(@UsuarioActual() u: UsuarioSesion, @InstitucionActiva() i: string, @Param('id') id: string) {
    return this.servicio.listar(u.usuarioId,i,id);
  }
  @Post(':id')
  publicar(@UsuarioActual() u: UsuarioSesion, @InstitucionActiva() i: string, @Param('id') id: string, @Body() datos: Record<string,unknown>) {
    return this.servicio.publicar(u.usuarioId,i,id,datos ?? {});
  }
}
