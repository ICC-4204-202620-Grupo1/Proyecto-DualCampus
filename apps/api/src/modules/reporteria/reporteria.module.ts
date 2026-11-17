import { Module } from '@nestjs/common';
import { AutorizacionModule } from '../autorizacion/autorizacion.module.js';
import { ReporteriaController } from './reporteria.controller.js';
import { AsistenciaAgregadaService } from './asistencia-agregada.service.js';
import { IndicadoresInstitucionalesService } from './indicadores-institucionales.service.js';

@Module({
  imports: [AutorizacionModule],
  controllers: [ReporteriaController],
  providers: [AsistenciaAgregadaService, IndicadoresInstitucionalesService],
})
export class ReporteriaModule {}
