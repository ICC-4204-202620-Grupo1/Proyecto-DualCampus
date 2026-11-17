import { Module } from '@nestjs/common';
import { AutenticacionModule } from '../autenticacion/autenticacion.module.js';
import { AutorizacionModule } from '../autorizacion/autorizacion.module.js';
import { EgresadoController } from './egresado.controller.js';
import { HistorialAcademicoController } from './historial-academico.controller.js';
import { HistorialAcademicoService } from './historial-academico.service.js';

@Module({
  imports: [AutenticacionModule, AutorizacionModule],
  controllers: [HistorialAcademicoController, EgresadoController],
  providers: [HistorialAcademicoService],
})
export class HistorialAcademicoModule {}
