import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/pg-pool.token.js';

/** H43 · Cuenta personal de Google vinculada a una persona de DualCampus. */
export interface CuentaPersonal {
  email: string;
  verificadoEn: string;
}

/** Identidad personal ya confirmada por Google (firma, nonce y correo verificado). */
export interface IdentidadPersonal {
  sub: string;
  email: string;
}

/**
 * VINCULADA: quedó asociada a la persona.
 * OCUPADA: la cuenta ya identifica a otra persona (vinculada o como cuenta institucional).
 * INSTITUCIONAL: es la propia cuenta institucional de la persona, no una personal.
 */
export type ResultadoVinculacion = 'VINCULADA' | 'OCUPADA' | 'INSTITUCIONAL';

/** H44 · Persona a la que pertenece una cuenta personal vinculada. */
export interface TitularCuentaPersonal {
  usuarioId: string;
  email: string;
}

export abstract class CuentasPersonalesRepositorio {
  abstract obtener(usuarioId: string): Promise<CuentaPersonal | null>;
  /** H44 · El google_sub es el identificador estable de la cuenta; el correo puede cambiar. */
  abstract buscarPorSub(sub: string): Promise<TitularCuentaPersonal | null>;
  abstract vincular(usuarioId: string, identidad: IdentidadPersonal): Promise<ResultadoVinculacion>;
}

const VIOLACION_UNICIDAD = '23505';

@Injectable()
export class PostgresCuentasPersonalesRepositorio extends CuentasPersonalesRepositorio {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  async obtener(usuarioId: string): Promise<CuentaPersonal | null> {
    const { rows } = await this.pool.query(
      `SELECT email, verificado_en AS "verificadoEn" FROM cuenta_personal WHERE usuario_id = $1::uuid`,
      [usuarioId],
    );
    return rows[0] ? { email: rows[0].email, verificadoEn: new Date(rows[0].verificadoEn).toISOString() } : null;
  }

  async buscarPorSub(sub: string): Promise<TitularCuentaPersonal | null> {
    const { rows } = await this.pool.query<TitularCuentaPersonal>(
      `SELECT usuario_id AS "usuarioId", email FROM cuenta_personal WHERE google_sub = $1`,
      [sub],
    );
    return rows[0] ?? null;
  }

  async vincular(usuarioId: string, identidad: IdentidadPersonal): Promise<ResultadoVinculacion> {
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      // Una cuenta con la que alguien ya ingresa como institucional no puede identificar a otra persona.
      const { rows: institucionales } = await db.query<{ id: string }>(
        `SELECT id FROM usuario WHERE email = $1 OR google_sub = $2`,
        [identidad.email, identidad.sub],
      );
      if (institucionales.length > 0) {
        await db.query('ROLLBACK');
        return institucionales.every((u) => u.id === usuarioId) ? 'INSTITUCIONAL' : 'OCUPADA';
      }
      const { rows: vinculadas } = await db.query<{ usuario_id: string }>(
        `SELECT usuario_id FROM cuenta_personal WHERE google_sub = $1 OR email = $2 FOR UPDATE`,
        [identidad.sub, identidad.email],
      );
      if (vinculadas.some((v) => v.usuario_id !== usuarioId)) {
        await db.query('ROLLBACK');
        return 'OCUPADA';
      }
      // Volver a vincular reemplaza la cuenta anterior de la misma persona.
      await db.query(
        `INSERT INTO cuenta_personal (usuario_id, google_sub, email) VALUES ($1::uuid, $2, $3)
         ON CONFLICT (usuario_id) DO UPDATE
           SET google_sub = EXCLUDED.google_sub, email = EXCLUDED.email, verificado_en = now()`,
        [usuarioId, identidad.sub, identidad.email],
      );
      await db.query('COMMIT');
      return 'VINCULADA';
    } catch (error) {
      await db.query('ROLLBACK');
      // Dos vinculaciones simultáneas de la misma cuenta: la restricción decide y la segunda queda rechazada.
      if ((error as { code?: string }).code === VIOLACION_UNICIDAD) return 'OCUPADA';
      throw error;
    } finally {
      db.release();
    }
  }
}
