import { Module } from '@nestjs/common';
import { InstitucionesController } from './instituciones.controller.js';
import { UsuariosGlobalesController } from './usuarios.controller.js';
@Module({ controllers: [InstitucionesController, UsuariosGlobalesController] })
export class SuperadministracionModule {}
