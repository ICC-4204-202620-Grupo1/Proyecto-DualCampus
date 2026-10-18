import { Global, Module } from '@nestjs/common';
import { CONFIG, cargarConfig } from './config';

@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: () => cargarConfig() }],
  exports: [CONFIG],
})
export class ConfigModule {}
