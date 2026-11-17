import { Module } from '@nestjs/common';
import { AutorizacionModule } from '../autorizacion/autorizacion.module.js';
import { PeriodosController } from './periodos/periodos.controller.js';
import { PeriodosRepositorio, PostgresPeriodosRepositorio } from './periodos/periodos.repositorio.js';
import { PeriodosService } from './periodos/periodos.service.js';
import { AcademicoController } from './academico.controller.js';
import { AcademicoService } from './academico.service.js';

@Module({
  imports: [AutorizacionModule],
  controllers: [PeriodosController, AcademicoController],
  providers: [PeriodosService, AcademicoService, { provide: PeriodosRepositorio, useClass: PostgresPeriodosRepositorio }],
})
export class GestionAcademicaModule {}
