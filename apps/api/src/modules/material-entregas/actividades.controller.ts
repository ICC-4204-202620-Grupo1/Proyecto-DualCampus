import { Body, Controller, Get, Param, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  @Post(':id/actividades/:actividadId/entrega')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 50 * 1024 * 1024, files: 1 } }))
  entregar(@UsuarioActual() u: UsuarioSesion, @InstitucionActiva() i: string,
    @Param('id') id: string, @Param('actividadId') actividadId: string,
    @UploadedFile() archivo: { originalname: string; mimetype: string; buffer: Buffer; size: number } | undefined) {
    return this.servicio.entregar(u.usuarioId, i, id, actividadId, archivo);
  }
  @Put(':id/actividades/:actividadId/configuracion')
  configurar(@UsuarioActual() u: UsuarioSesion, @InstitucionActiva() i: string,
    @Param('id') id: string, @Param('actividadId') actividadId: string,
    @Body() datos: Record<string, unknown>) {
    return this.servicio.configurar(u.usuarioId, i, id, actividadId, datos ?? {});
  }

  @Get(':id/actividades/:actividadId/entregas')
  entregasPorActividad(
    @UsuarioActual() u: UsuarioSesion,
    @InstitucionActiva() i: string,
    @Param('id') seccionId: string,
    @Param('actividadId') actividadId: string,
  ) {
    return this.servicio.listarEntregas(u.usuarioId, i, seccionId, actividadId);
  }

  @Get(':id/entregas')
  entregasPorSeccion(
    @UsuarioActual() u: UsuarioSesion,
    @InstitucionActiva() i: string,
    @Param('id') seccionId: string,
  ) {
    return this.servicio.listarEntregas(u.usuarioId, i, seccionId);
  }
}
