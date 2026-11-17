import { Controller, Get, Param, Post } from '@nestjs/common';
import { InstitucionActiva } from '../../common/decorators/institucion-activa.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion.js';
import { EstadoAvisosService } from './estado-avisos.service.js';

@Controller('calificaciones/avisos')
export class EstadoAvisosController {
  constructor(private readonly servicio: EstadoAvisosService) {}

  @Get()
  listar(@UsuarioActual() usuario: UsuarioSesion, @InstitucionActiva() institucion: string) {
    return this.servicio.listar(usuario.usuarioId, institucion);
  }

  @Post(':id/reintentar')
  reintentar(@UsuarioActual() usuario: UsuarioSesion, @InstitucionActiva() institucion: string, @Param('id') id: string) {
    return this.servicio.reintentar(usuario.usuarioId, institucion, id);
  }
}
