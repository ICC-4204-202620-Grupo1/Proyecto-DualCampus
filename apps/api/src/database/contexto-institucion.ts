import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from './pg-pool.token';

/**
 * Ejecuta consultas dentro de una transacción con app.institucion_id fijado a la
 * institución activa (Entrega 3, 3.4.1). Las políticas de Row-Level Security (H04)
 * leerán esta variable; ninguna consulta de datos académicos debe correr fuera de aquí.
 */
@Injectable()
export class ContextoInstitucion {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async ejecutar<T>(institucionId: string, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await db.query(`SELECT set_config('app.institucion_id', $1, true)`, [institucionId]);
      const resultado = await fn(db);
      await db.query('COMMIT');
      return resultado;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    } finally {
      db.release();
    }
  }
}
