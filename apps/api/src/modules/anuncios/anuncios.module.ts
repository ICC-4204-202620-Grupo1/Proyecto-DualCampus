import { Module } from '@nestjs/common';
import { AutorizacionModule } from '../autorizacion/autorizacion.module.js';
import { AnunciosController } from './anuncios.controller.js';
import { AnunciosService } from './anuncios.service.js';

@Module({
  imports: [AutorizacionModule],
  controllers: [AnunciosController],
  providers: [AnunciosService],
})
export class AnunciosModule {}
