import { Module } from '@nestjs/common';
import { AutorizacionModule } from '../autorizacion/autorizacion.module.js';
import { MaterialesController } from './materiales.controller.js';
import { MaterialesService } from './materiales.service.js';
@Module({ imports: [AutorizacionModule], controllers: [MaterialesController], providers: [MaterialesService] })
export class MaterialEntregasModule {}
