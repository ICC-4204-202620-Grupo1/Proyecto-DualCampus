import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InstitucionActiva } from '../../common/decorators/institucion-activa.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion.js';
import { AnunciosService } from './anuncios.service.js';

@Controller('anuncios/secciones')
export class AnunciosController {
  constructor(private readonly anuncios: AnunciosService) {}

  @Get(':seccionId')
  listar(@UsuarioActual() usuario: UsuarioSesion, @InstitucionActiva() institucion: string,
    @Param('seccionId') seccionId: string) {
    return this.anuncios.listar(usuario.usuarioId, institucion, seccionId);
  }

  @Post(':seccionId')
  publicar(@UsuarioActual() usuario: UsuarioSesion, @InstitucionActiva() institucion: string,
    @Param('seccionId') seccionId: string, @Body() datos: Record<string, unknown>) {
    return this.anuncios.publicar(usuario.usuarioId, institucion, seccionId, datos ?? {});
  }
}
