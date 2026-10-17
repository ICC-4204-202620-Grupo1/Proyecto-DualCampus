import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { AutenticacionModule } from './modules/autenticacion/autenticacion.module';
import { AutorizacionModule } from './modules/autorizacion/autorizacion.module';
import { GestionAcademicaModule } from './modules/gestion-academica/gestion-academica.module';
import { CalificacionesModule } from './modules/calificaciones/calificaciones.module';
import { MaterialEntregasModule } from './modules/material-entregas/material-entregas.module';
import { ReporteriaModule } from './modules/reporteria/reporteria.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';

// Un módulo por componente del diagrama C4 nivel 3 (Entrega 3)
@Module({
  imports: [
    AutenticacionModule,
    AutorizacionModule,
    GestionAcademicaModule,
    CalificacionesModule,
    MaterialEntregasModule,
    ReporteriaModule,
    AuditoriaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
