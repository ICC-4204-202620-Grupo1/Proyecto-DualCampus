import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { InstitucionActiva } from '../../common/decorators/institucion-activa.decorator';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion';
import { EvaluacionesService } from './evaluaciones.service';
import { NotasService } from './notas.service';

@Controller('calificaciones')
export class EvaluacionesController {
  constructor(
    private readonly servicio: EvaluacionesService,
    private readonly notasServicio: NotasService,
  ) {}

  @Get('secciones/:id/evaluaciones')
  listar(
    @UsuarioActual() u: UsuarioSesion,
    @InstitucionActiva() i: string,
    @Param('id') seccionId: string,
  ) {
    return this.servicio.listar(u.usuarioId, i, seccionId);
  }

  @Post('secciones/:id/evaluaciones')
  crear(
    @UsuarioActual() u: UsuarioSesion,
    @InstitucionActiva() i: string,
    @Param('id') seccionId: string,
    @Body() datos: Record<string, unknown>,
  ) {
    return this.servicio.crear(u.usuarioId, i, seccionId, datos ?? {});
  }

  @Post('evaluaciones/:id/enviar-revision')
  enviarARevision(
    @UsuarioActual() u: UsuarioSesion,
    @InstitucionActiva() i: string,
    @Param('id') evaluacionId: string,
  ) {
    return this.servicio.enviarARevision(u.usuarioId, i, evaluacionId);
  }

  @Post('evaluaciones/:id/reenviar-revision')
  reenviarARevision(
    @UsuarioActual() u: UsuarioSesion,
    @InstitucionActiva() i: string,
    @Param('id') evaluacionId: string,
  ) {
    return this.servicio.reenviarARevision(u.usuarioId, i, evaluacionId);
  }

  @Post('evaluaciones/:id/devolver')
  devolver(
    @UsuarioActual() u: UsuarioSesion,
    @InstitucionActiva() i: string,
    @Param('id') evaluacionId: string,
    @Body() datos: Record<string, unknown>,
  ) {
    return this.servicio.devolver(u.usuarioId, i, evaluacionId, datos ?? {});
  }

  @Post('evaluaciones/:id/publicar')
  publicar(
    @UsuarioActual() u: UsuarioSesion,
    @InstitucionActiva() i: string,
    @Param('id') evaluacionId: string,
  ) {
    return this.servicio.publicar(u.usuarioId, i, evaluacionId);
  }

  @Get('evaluaciones/:id/notas')
  listarNotas(
    @UsuarioActual() u: UsuarioSesion,
    @InstitucionActiva() i: string,
    @Param('id') evaluacionId: string,
  ) {
    return this.notasServicio.listarNotas(u.usuarioId, i, evaluacionId);
  }

  @Put('evaluaciones/:id/notas')
  guardarNotas(
    @UsuarioActual() u: UsuarioSesion,
    @InstitucionActiva() i: string,
    @Param('id') evaluacionId: string,
    @Body() datos: { notas?: unknown },
  ) {
    return this.notasServicio.guardarNotas(u.usuarioId, i, evaluacionId, datos ?? {});
  }
}
