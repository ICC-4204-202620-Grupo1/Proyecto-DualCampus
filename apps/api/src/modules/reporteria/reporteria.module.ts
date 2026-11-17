import { Module } from '@nestjs/common';
import { AutorizacionModule } from '../autorizacion/autorizacion.module.js';
import { ReporteriaController } from './reporteria.controller.js';
import { AsistenciaAgregadaService } from './asistencia-agregada.service.js';
import { IndicadoresInstitucionalesService } from './indicadores-institucionales.service.js';
import { ReportesProgramadosService } from './reportes-programados.service.js';

@Module({
  imports: [AutorizacionModule],
  controllers: [ReporteriaController],
  providers: [AsistenciaAgregadaService, IndicadoresInstitucionalesService, ReportesProgramadosService],
})
export class ReporteriaModule {}
