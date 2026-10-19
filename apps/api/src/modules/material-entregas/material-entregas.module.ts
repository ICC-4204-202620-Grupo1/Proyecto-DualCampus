import { Module } from '@nestjs/common';
import { AutorizacionModule } from '../autorizacion/autorizacion.module';
import { MaterialesController } from './materiales.controller';
import { MaterialesService } from './materiales.service';
@Module({ imports: [AutorizacionModule], controllers: [MaterialesController], providers: [MaterialesService] })
export class MaterialEntregasModule {}
