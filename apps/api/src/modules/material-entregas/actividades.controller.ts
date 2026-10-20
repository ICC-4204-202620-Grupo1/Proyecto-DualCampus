import { Body, Controller, Get, Param, Post, Put, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
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

  @Get(':id/actividades/:actividadId/entregas/:entregaId/descargar')
  async descargarEntrega(
    @UsuarioActual() u: UsuarioSesion,
    @InstitucionActiva() i: string,
    @Param('id') seccionId: string,
    @Param('actividadId') actividadId: string,
    @Param('entregaId') entregaId: string,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const archivo = await this.servicio.descargarEntrega(u.usuarioId, i, seccionId, actividadId, entregaId);
    const nombre = encodeURIComponent(archivo.nombreArchivo);
    respuesta.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${nombre}`);
    respuesta.setHeader('Cache-Control', 'private, no-store');
    respuesta.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(archivo.contenido, { type: archivo.tipo, length: archivo.contenido.length });
  }

  @Get(':id/entregas/:entregaId/descargar')
  async descargarEntregaSeccion(
    @UsuarioActual() u: UsuarioSesion,
    @InstitucionActiva() i: string,
    @Param('id') seccionId: string,
    @Param('entregaId') entregaId: string,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    const archivo = await this.servicio.descargarEntrega(u.usuarioId, i, seccionId, '', entregaId);
    const nombre = encodeURIComponent(archivo.nombreArchivo);
    respuesta.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${nombre}`);
    respuesta.setHeader('Cache-Control', 'private, no-store');
    respuesta.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(archivo.contenido, { type: archivo.tipo, length: archivo.contenido.length });
  }
}
