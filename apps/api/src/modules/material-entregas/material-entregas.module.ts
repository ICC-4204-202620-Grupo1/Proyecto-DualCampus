import { Module } from '@nestjs/common';
import { AutorizacionModule } from '../autorizacion/autorizacion.module.js';
import { MaterialesController } from './materiales.controller.js';
import { MaterialesService } from './materiales.service.js';
import { ActividadesController } from './actividades.controller.js';
import { ActividadesService } from './actividades.service.js';

@Module({
  imports: [AutorizacionModule],
  controllers: [MaterialesController, ActividadesController],
  providers: [MaterialesService, ActividadesService],
})
export class MaterialEntregasModule {}
