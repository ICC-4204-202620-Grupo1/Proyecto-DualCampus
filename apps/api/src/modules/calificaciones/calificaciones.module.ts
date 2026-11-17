import { Module } from '@nestjs/common';
import { AutorizacionModule } from '../autorizacion/autorizacion.module.js';
import { EvaluacionesController } from './evaluaciones.controller.js';
import { EvaluacionesService } from './evaluaciones.service.js';
import { NotasService } from './notas.service.js';
import { DistribucionNotasService } from './distribucion-notas.service.js';
import { AvisosCorreccionService } from './avisos-correccion.service.js';
import { EstadoAvisosService } from './estado-avisos.service.js';
import { EstadoAvisosController } from './estado-avisos.controller.js';

@Module({
  imports: [AutorizacionModule],
  controllers: [EvaluacionesController, EstadoAvisosController],
  providers: [EvaluacionesService, NotasService, DistribucionNotasService, AvisosCorreccionService, EstadoAvisosService],
  exports: [EvaluacionesService, NotasService],
})
export class CalificacionesModule {}
