import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AutenticacionGuard } from '../../common/guards/autenticacion.guard';
import { AutenticacionController } from './autenticacion.controller';
import { AutenticacionService } from './autenticacion.service';
import { GoogleOidcAdapter } from './google-oidc.adapter';
import { SesionController } from './sesion.controller';
import { SesionService } from './sesion.service';
import { PostgresUsuariosRepositorio, UsuariosRepositorio } from './usuarios.repositorio';

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
  exports: [SesionService],
})
export class AutenticacionModule {}
