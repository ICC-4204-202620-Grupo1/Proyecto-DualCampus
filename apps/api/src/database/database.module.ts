import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { CONFIG, Config } from '../config/config';
import { ContextoInstitucion } from './contexto-institucion';
import { PG_POOL } from './pg-pool.token';

export { PG_POOL };

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [CONFIG],
      // El pool se conecta recién en la primera consulta
      useFactory: (config: Config) => new Pool({ connectionString: config.databaseUrl, max: 5 }),
    },
    ContextoInstitucion,
  ],
  exports: [PG_POOL, ContextoInstitucion],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
