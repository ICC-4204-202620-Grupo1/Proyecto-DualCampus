import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import type { RolEnInstitucion } from './usuario-sesion';

export interface UsuarioRegistrado {
  id: string;
  email: string;
  nombre: string | null;
  activo: boolean;
  googleSub: string | null;
  roles: RolEnInstitucion[];
}

export abstract class UsuariosRepositorio {
  abstract buscarPorEmail(email: string): Promise<UsuarioRegistrado | null>;
  abstract registrarAcceso(usuarioId: string, googleSub: string): Promise<void>;
}

@Injectable()
export class PostgresUsuariosRepositorio extends UsuariosRepositorio {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {
    super();
  }

  async buscarPorEmail(email: string): Promise<UsuarioRegistrado | null> {
    const { rows } = await this.pool.query(
      `SELECT u.id, u.email, u.nombre, u.activo, u.google_sub,
              COALESCE(
                json_agg(json_build_object('institucionId', i.id, 'institucion', i.nombre, 'rol', r.rol))
                  FILTER (WHERE i.id IS NOT NULL),
                '[]'
              ) AS roles
         FROM usuario u
         LEFT JOIN rol_en_institucion r ON r.usuario_id = u.id
         LEFT JOIN institucion i ON i.id = r.institucion_id AND i.activa
        WHERE u.email = lower($1)
        GROUP BY u.id`,
      [email],
    );
    if (rows.length === 0) return null;
    const f = rows[0];
    return {
      id: f.id,
      email: f.email,
      nombre: f.nombre,
      activo: f.activo,
      googleSub: f.google_sub,
      roles: f.roles,
    };
  }

  async registrarAcceso(usuarioId: string, googleSub: string): Promise<void> {
    await this.pool.query(
      `UPDATE usuario SET google_sub = COALESCE(google_sub, $2), ultimo_acceso = now() WHERE id = $1`,
      [usuarioId, googleSub],
    );
  }
}
