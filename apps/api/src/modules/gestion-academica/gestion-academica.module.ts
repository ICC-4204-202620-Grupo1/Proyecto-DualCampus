import { Module } from '@nestjs/common';
import { AutorizacionModule } from '../autorizacion/autorizacion.module';
import { PeriodosController } from './periodos/periodos.controller';
import { PeriodosRepositorio, PostgresPeriodosRepositorio } from './periodos/periodos.repositorio';
import { PeriodosService } from './periodos/periodos.service';
import { AcademicoController } from './academico.controller';
import { AcademicoService } from './academico.service';

@Module({
  imports: [AutorizacionModule],
  controllers: [PeriodosController, AcademicoController],
  providers: [PeriodosService, AcademicoService, { provide: PeriodosRepositorio, useClass: PostgresPeriodosRepositorio }],
})
export class GestionAcademicaModule {}
