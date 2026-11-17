import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { InstitucionActiva } from '../../common/decorators/institucion-activa.decorator.js';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion.js';
import { HistorialAcademicoService } from './historial-academico.service.js';

/** H39: historial exclusivamente del alumno autenticado en su institución activa. */
@Controller('historial-academico')
export class HistorialAcademicoController {
  constructor(private readonly historial: HistorialAcademicoService) {}

  @Get('propio')
  propio(
    @UsuarioActual() usuario: UsuarioSesion,
    @InstitucionActiva() institucionId: string,
  ) {
    return this.historial.consultar(usuario.usuarioId, institucionId);
  }

  @Post('lotes/confirmar')
  confirmar(
    @UsuarioActual() usuario: UsuarioSesion,
    @InstitucionActiva() institucionId: string,
    @Body() body: { huella?: string; filas?: unknown[]; totalValidas?: number },
  ) {
    return this.historial.confirmarLote(usuario.usuarioId, institucionId, body);
  }

  @Post('lotes/:id/revertir')
  revertir(
    @Param('id') loteId: string,
    @UsuarioActual() usuario: UsuarioSesion,
    @InstitucionActiva() institucionId: string,
    @Body() body: { motivo?: string },
  ) {
    return this.historial.revertirLote(usuario.usuarioId, institucionId, loteId, body?.motivo);
  }
}
