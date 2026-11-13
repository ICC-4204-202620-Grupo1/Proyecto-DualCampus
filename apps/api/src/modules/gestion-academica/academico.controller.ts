import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { InstitucionActiva } from '../../common/decorators/institucion-activa.decorator.js';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion.js';
import { AcademicoService } from './academico.service.js';
import { ClasesService } from './clases.service.js';

@Controller('academico')
export class AcademicoController {
  constructor(private readonly servicio: AcademicoService, private readonly clases: ClasesService) {}
  @Get('cursos')
  cursos(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string,@Query('periodoId') p: string) { return this.servicio.cursos(u.usuarioId,i,p); }
  @Post('cursos')
  curso(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string,@Body() d: Record<string,unknown>) { return this.servicio.crearCurso(u.usuarioId,i,d ?? {}); }
  @Get('secciones')
  secciones(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string,@Query('periodoId') p?: string) { return this.servicio.secciones(u.usuarioId,i,p); }
  @Post('secciones')
  seccion(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string,@Body() d: Record<string,unknown>) { return this.servicio.crearSeccion(u.usuarioId,i,d ?? {}); }
  @Get('docentes')
  docentes(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string) { return this.servicio.candidatos(u.usuarioId,i); }
  @Get('secciones/:id')
  detalle(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string,@Param('id') s: string) { return this.servicio.detalle(u.usuarioId,i,s); }
  @Put('secciones/:id/equipo')
  equipo(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string,@Param('id') s: string,@Body() d: Record<string,unknown>) { return this.servicio.asignar(u.usuarioId,i,s,d ?? {}); }
  @Post('secciones/:id/nomina/validar')
  validar(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string,@Param('id') s: string,@Body() d: Record<string,unknown>) { return this.servicio.nomina(u.usuarioId,i,s,d ?? {},false); }
  @Post('secciones/:id/nomina')
  nomina(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string,@Param('id') s: string,@Body() d: Record<string,unknown>) { return this.servicio.nomina(u.usuarioId,i,s,d ?? {},true); }
  @Get('secciones/:id/clases')
  clasesDeSeccion(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string,@Param('id') s: string) { return this.clases.listar(u.usuarioId,i,s); }
  @Post('secciones/:id/clases')
  crearClase(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string,@Param('id') s: string,@Body() d: Record<string,unknown>) { return this.clases.crear(u.usuarioId,i,s,d ?? {}); }
  @Get('secciones/:id/clases/:claseId/asistencia')
  asistencia(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string,@Param('id') s: string,@Param('claseId') c: string) { return this.clases.asistencia(u.usuarioId,i,s,c); }
  @Put('secciones/:id/clases/:claseId/asistencia')
  guardarAsistencia(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string,@Param('id') s: string,@Param('claseId') c: string,@Body() d: Record<string,unknown>) { return this.clases.guardarAsistencia(u.usuarioId,i,s,c,d ?? {}); }
  @Get('secciones/:id/mi-asistencia')
  miAsistencia(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string,@Param('id') s: string) { return this.clases.miAsistencia(u.usuarioId,i,s); }
  @Put('secciones/:id/clases/:claseId/asistencia/:alumnoId')
  corregirAsistencia(@UsuarioActual() u: UsuarioSesion,@InstitucionActiva() i: string,@Param('id') s: string,@Param('claseId') c: string,@Param('alumnoId') a: string,@Body() d: Record<string,unknown>) { return this.clases.corregirAsistencia(u.usuarioId,i,s,c,a,d ?? {}); }
}
