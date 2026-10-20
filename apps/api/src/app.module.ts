import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { AutenticacionModule } from './modules/autenticacion/autenticacion.module.js';
import { AutorizacionModule } from './modules/autorizacion/autorizacion.module.js';
import { GestionAcademicaModule } from './modules/gestion-academica/gestion-academica.module.js';
import { CalificacionesModule } from './modules/calificaciones/calificaciones.module.js';
import { MaterialEntregasModule } from './modules/material-entregas/material-entregas.module.js';
import { ReporteriaModule } from './modules/reporteria/reporteria.module.js';
import { AuditoriaModule } from './modules/auditoria/auditoria.module.js';

// Un módulo por componente del diagrama C4 nivel 3 (Entrega 3)
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
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
