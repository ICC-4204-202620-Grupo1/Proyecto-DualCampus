import { Module } from '@nestjs/common';
import { AutorizacionModule } from '../autorizacion/autorizacion.module.js';
import { EvaluacionesController } from './evaluaciones.controller.js';
import { EvaluacionesService } from './evaluaciones.service.js';
import { NotasService } from './notas.service.js';

@Module({
  imports: [AutorizacionModule],
  controllers: [EvaluacionesController],
  providers: [EvaluacionesService, NotasService],
  exports: [EvaluacionesService, NotasService],
})
export class CalificacionesModule {}
