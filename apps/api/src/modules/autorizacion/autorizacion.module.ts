import { Module } from '@nestjs/common';
import { AutenticacionModule } from '../autenticacion/autenticacion.module';
import { AutorizacionService } from './autorizacion.service';

// EvaluadorPoliticas, MatrizRolAccion y políticas (H03). Por ahora: verificación de rol.
@Module({
  imports: [AutenticacionModule],
  providers: [AutorizacionService],
  exports: [AutorizacionService],
})
export class AutorizacionModule {}
