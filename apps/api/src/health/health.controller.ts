import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Pool } from 'pg';
import { Publico } from '../common/decorators/publico.decorator.js';
import { PG_POOL } from '../database/pg-pool.token.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}
  @Publico()
  @Get()
  health() { return { status:'ok', service:'dualcampus-api' }; }
  @Publico()
  @Get('ready')
  async ready() {
    try {
      const r = await this.pool.query("SELECT archivo FROM schema_migraciones WHERE archivo='003_configuracion_academica.sql'");
      if(!r.rowCount) throw new Error('Faltan migraciones');
      const rol = await this.pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
      if(rol.rows[0]?.rolsuper || rol.rows[0]?.rolbypassrls) throw new Error('Rol inseguro');
      return {status:'ok',database:'ready'};
    }catch{throw new ServiceUnavailableException('Base de datos o migraciones no disponibles');}
  }
}
