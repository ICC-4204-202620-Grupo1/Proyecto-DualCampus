import { Module } from '@nestjs/common';
import { AutorizacionModule } from '../autorizacion/autorizacion.module';
import { PeriodosController } from './periodos/periodos.controller';
import { PeriodosRepositorio, PostgresPeriodosRepositorio } from './periodos/periodos.repositorio';
import { PeriodosService } from './periodos/periodos.service';

// Períodos (H05), cursos, secciones, asignación docente y nóminas
@Module({
  imports: [AutorizacionModule],
  controllers: [PeriodosController],
  providers: [PeriodosService, { provide: PeriodosRepositorio, useClass: PostgresPeriodosRepositorio }],
})
export class GestionAcademicaModule {}
