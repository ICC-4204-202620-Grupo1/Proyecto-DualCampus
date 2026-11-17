import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AutenticacionGuard } from '../../common/guards/autenticacion.guard.js';
import { AutenticacionController } from './autenticacion.controller.js';
import { AutenticacionService } from './autenticacion.service.js';
import { CuentaPersonalController } from './cuenta-personal.controller.js';
import { CuentaPersonalService } from './cuenta-personal.service.js';
import { CuentasPersonalesRepositorio, PostgresCuentasPersonalesRepositorio } from './cuentas-personales.repositorio.js';
import { GoogleOidcAdapter } from './google-oidc.adapter.js';
import { SesionController } from './sesion.controller.js';
import { SesionService } from './sesion.service.js';
import { PostgresUsuariosRepositorio, UsuariosRepositorio } from './usuarios.repositorio.js';

// Login con Google Workspace (OIDC), sesión UsuarioSesion (H01), institución activa (H02)
// y vinculación de una cuenta personal verificada (H43)
@Module({
  imports: [JwtModule.register({})],
  controllers: [AutenticacionController, SesionController, CuentaPersonalController],
  providers: [
    AutenticacionService,
    CuentaPersonalService,
    GoogleOidcAdapter,
    SesionService,
    { provide: UsuariosRepositorio, useClass: PostgresUsuariosRepositorio },
    { provide: CuentasPersonalesRepositorio, useClass: PostgresCuentasPersonalesRepositorio },
    { provide: APP_GUARD, useClass: AutenticacionGuard },
  ],
  exports: [SesionService, UsuariosRepositorio],
})
export class AutenticacionModule {}
