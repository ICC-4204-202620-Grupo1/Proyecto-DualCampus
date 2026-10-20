import { Module } from '@nestjs/common';
import { AutorizacionModule } from '../autorizacion/autorizacion.module.js';
import { HistorialAcademicoController } from './historial-academico.controller.js';
import { HistorialAcademicoService } from './historial-academico.service.js';

@Module({
  imports: [AutorizacionModule],
  controllers: [HistorialAcademicoController],
  providers: [HistorialAcademicoService],
})
export class HistorialAcademicoModule {}
