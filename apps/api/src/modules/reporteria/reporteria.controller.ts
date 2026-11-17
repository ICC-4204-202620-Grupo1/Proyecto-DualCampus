
import { Body, Controller, Get, Headers, Param, Post, Query, StreamableFile } from '@nestjs/common';
import { Publico } from '../../common/decorators/publico.decorator.js';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { InstitucionActiva } from '../../common/decorators/institucion-activa.decorator.js';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion.js';
import { AsistenciaAgregadaService } from './asistencia-agregada.service.js';
import { IndicadoresInstitucionalesService } from './indicadores-institucionales.service.js';
import { exportarIndicadoresCsv } from './exportar-indicadores.js';
import { ReportesProgramadosService } from './reportes-programados.service.js';

@Controller(['reporteria', 'academico'])
export class ReporteriaController {
  constructor(
    private readonly asistencia: AsistenciaAgregadaService,
    private readonly indicadores: IndicadoresInstitucionalesService,
    private readonly programados: ReportesProgramadosService,
  ) {}

  /** H48 · Indicadores agregados de la institución activa en un período, solo para el director. */
  @Get('indicadores-institucionales')
  indicadoresInstitucionales(
    @UsuarioActual() usuario: UsuarioSesion,
    @InstitucionActiva() institucion: string,
    @Query('periodoId') periodoId: unknown,
    @Query('facultad') facultad?: unknown,
  ) {
    return this.indicadores.consultar(usuario.usuarioId, institucion, periodoId, facultad);
  }

  @Get('reportes-programados')
  listarProgramados(@UsuarioActual() usuario: UsuarioSesion, @InstitucionActiva() institucion: string) {
    return this.programados.listar(usuario.usuarioId, institucion);
  }

  @Post('reportes-programados')
  crearProgramado(@UsuarioActual() usuario: UsuarioSesion, @InstitucionActiva() institucion: string,
    @Body() datos: Record<string, unknown>) {
    return this.programados.crear(usuario.usuarioId, institucion, datos ?? {});
  }

  @Post('reportes-programados/:id/cancelar')
  cancelarProgramado(@UsuarioActual() usuario: UsuarioSesion, @InstitucionActiva() institucion: string,
    @Param('id') id: string) {
    return this.programados.cancelar(usuario.usuarioId, institucion, id);
  }

  /** Vercel Cron invoca este GET con Authorization: Bearer CRON_SECRET. */
  @Publico()
  @Get('reportes-programados/ejecutar')
  ejecutarProgramados(@Headers('authorization') autorizacion?: string) {
    return this.programados.ejecutarPendientes(autorizacion);
  }

  /** H50 · Recalcula los mismos indicadores autorizados y entrega el CSV público. */
  @Get('indicadores-institucionales/exportar')
  async exportarIndicadores(
    @UsuarioActual() usuario: UsuarioSesion,
    @InstitucionActiva() institucion: string,
    @Query('periodoId') periodoId: unknown,
    @Query('facultad') facultad?: unknown,
  ) {
    const datos = await this.indicadores.consultar(usuario.usuarioId, institucion, periodoId, facultad);
    const fecha = new Date();
    const csv = exportarIndicadoresCsv(datos, fecha);
    const nombre = `reporte-agregado-${fecha.toISOString().slice(0, 10)}.csv`;
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${nombre}"`,
    });
  }

  @Get('secciones/:id/asistencia-agregada')
  asistenciaAgregada(
    @UsuarioActual() usuario: UsuarioSesion,
    @InstitucionActiva() institucion: string,
    @Param('id') seccionId: string,
  ) {
    return this.asistencia.consultar(
      usuario.usuarioId,
      institucion,
      seccionId,
    );
  }
}
