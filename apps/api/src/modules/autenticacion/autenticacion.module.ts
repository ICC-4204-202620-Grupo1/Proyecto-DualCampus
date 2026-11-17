import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AutenticacionGuard } from '../../common/guards/autenticacion.guard.js';
import { AutenticacionController } from './autenticacion.controller.js';
import { AutenticacionService } from './autenticacion.service.js';
import { GoogleOidcAdapter } from './google-oidc.adapter.js';
import { SesionController } from './sesion.controller.js';
import { SesionService } from './sesion.service.js';
import { PostgresUsuariosRepositorio, UsuariosRepositorio } from './usuarios.repositorio.js';

// Login con Google Workspace (OIDC), sesión UsuarioSesion (H01) e institución activa (H02)
@Module({
  imports: [JwtModule.register({})],
  controllers: [AutenticacionController, SesionController],
  providers: [
    AutenticacionService,
    GoogleOidcAdapter,
    SesionService,
    { provide: UsuariosRepositorio, useClass: PostgresUsuariosRepositorio },
    { provide: APP_GUARD, useClass: AutenticacionGuard },
  ],
  exports: [SesionService, UsuariosRepositorio],
})
export class AutenticacionModule {}
