import { Module } from '@nestjs/common';
import { AutorizacionModule } from '../autorizacion/autorizacion.module';
import { EvaluacionesController } from './evaluaciones.controller';
import { EvaluacionesService } from './evaluaciones.service';
import { NotasService } from './notas.service';

@Module({
  imports: [AutorizacionModule],
  controllers: [EvaluacionesController],
  providers: [EvaluacionesService, NotasService],
  exports: [EvaluacionesService, NotasService],
})
export class CalificacionesModule {}
