import { Module } from '@nestjs/common';
import { AutorizacionModule } from '../autorizacion/autorizacion.module';
import { EvaluacionesController } from './evaluaciones.controller';
import { EvaluacionesService } from './evaluaciones.service';

@Module({
  imports: [AutorizacionModule],
  controllers: [EvaluacionesController],
  providers: [EvaluacionesService],
  exports: [EvaluacionesService],
})
export class CalificacionesModule {}
