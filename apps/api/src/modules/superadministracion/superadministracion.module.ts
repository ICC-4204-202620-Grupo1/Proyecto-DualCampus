import { Module } from '@nestjs/common';
import { InstitucionesController } from './instituciones.controller.js';
@Module({ controllers: [InstitucionesController] })
export class SuperadministracionModule {}
