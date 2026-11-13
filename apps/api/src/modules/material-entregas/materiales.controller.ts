import { Body, Controller, Get, Param, Post, Put, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
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

  @Get(':id/reutilizacion/opciones')
  opciones(@UsuarioActual() u: UsuarioSesion, @InstitucionActiva() i: string, @Param('id') id: string) {
    return this.servicio.opcionesReutilizacion(u.usuarioId, i, id);
  }

  @Post(':id/reutilizaciones')
  reutilizar(@UsuarioActual() u: UsuarioSesion, @InstitucionActiva() i: string, @Param('id') id: string,
    @Body() datos: Record<string,unknown>) {
    return this.servicio.reutilizar(u.usuarioId, i, id, datos ?? {});
  }

  @Put(':id/borradores/:materialId')
  editarBorrador(@UsuarioActual() u: UsuarioSesion, @InstitucionActiva() i: string, @Param('id') id: string,
    @Param('materialId') materialId: string, @Body() datos: Record<string,unknown>) {
    return this.servicio.editarBorrador(u.usuarioId, i, id, materialId, datos ?? {});
  }

  @Post(':id/borradores/:materialId/publicar')
  publicarBorrador(@UsuarioActual() u: UsuarioSesion, @InstitucionActiva() i: string, @Param('id') id: string,
    @Param('materialId') materialId: string) {
    return this.servicio.publicarBorrador(u.usuarioId, i, id, materialId);
  }
  @Get(':id/materiales/:materialId/descargar')
  async descargar(@UsuarioActual() u: UsuarioSesion, @InstitucionActiva() i: string,
    @Param('id') id: string, @Param('materialId') materialId: string,
    @Res({ passthrough: true }) respuesta: Response) {
    const archivo = await this.servicio.descargar(u.usuarioId, i, id, materialId);
    // El nombre se escapa en el header; no se devuelve ninguna URL de almacenamiento público.
    const nombre = encodeURIComponent(archivo.nombreArchivo);
    respuesta.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${nombre}`);
    respuesta.setHeader('Cache-Control', 'private, no-store');
    respuesta.setHeader('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(archivo.contenido, { type: archivo.tipo, length: archivo.contenido.length });
  }

  @Post(':id')
  publicar(@UsuarioActual() u: UsuarioSesion, @InstitucionActiva() i: string, @Param('id') id: string, @Body() datos: Record<string,unknown>) {
    return this.servicio.publicar(u.usuarioId,i,id,datos ?? {});
  }
}
