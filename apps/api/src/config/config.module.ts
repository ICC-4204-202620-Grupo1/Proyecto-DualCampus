import { Global, Module } from '@nestjs/common';
import { CONFIG, cargarConfig } from './config.js';

@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: () => cargarConfig() }],
  exports: [CONFIG],
})
export class ConfigModule {}
