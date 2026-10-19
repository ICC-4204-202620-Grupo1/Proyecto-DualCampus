import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { ContextoInstitucion } from '../../database/contexto-institucion';
import { PG_POOL } from '../../database/pg-pool.token';
import type { Rol, RolEnInstitucion } from './usuario-sesion';

export interface UsuarioRegistrado {
  id: string;
  email: string;
  nombre: string | null;
  activo: boolean;
  googleSub: string | null;
  roles: RolEnInstitucion[];
}

/** Resultado de una consulta hecha dentro del contexto de la institución activa. */
export interface ContextoConsultado {
  /** Valor de app.institucion_id con que corrió la consulta. */
  institucionContexto: string;
  institucion: string;
  roles: Rol[];
}

export abstract class UsuariosRepositorio {
  abstract buscarPorEmail(email: string): Promise<UsuarioRegistrado | null>;
  abstract buscarPorId(id: string): Promise<UsuarioRegistrado | null>;
  abstract registrarAcceso(usuarioId: string, googleSub: string): Promise<void>;
  abstract rolesEnInstitucionActiva(
    usuarioId: string,
    institucionId: string,
  ): Promise<ContextoConsultado | null>;
}

const SELECT_USUARIO = `
  SELECT u.id, u.email, u.nombre, u.activo, u.google_sub,
         COALESCE(
           json_agg(json_build_object('institucionId', i.id, 'institucion', i.nombre, 'rol', r.rol)
                    ORDER BY i.nombre, r.rol)
             FILTER (WHERE i.id IS NOT NULL),
           '[]'
         ) AS roles
    FROM usuario u
    LEFT JOIN rol_en_institucion r ON r.usuario_id = u.id
    LEFT JOIN institucion i ON i.id = r.institucion_id AND i.activa`;

@Injectable()
export class PostgresUsuariosRepositorio extends UsuariosRepositorio {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly contexto: ContextoInstitucion,
  ) {
    super();
  }

  async buscarPorEmail(email: string) {
    return this.buscar(`${SELECT_USUARIO} WHERE u.email = lower($1) GROUP BY u.id`, email);
  }

  async buscarPorId(id: string) {
    return this.buscar(`${SELECT_USUARIO} WHERE u.id = $1::uuid GROUP BY u.id`, id);
  }

  private async buscar(sql: string, valor: string): Promise<UsuarioRegistrado | null> {
    const { rows } = await this.pool.query(sql, [valor]);
    if (rows.length === 0) return null;
    const f = rows[0];
    return { id: f.id, email: f.email, nombre: f.nombre, activo: f.activo, googleSub: f.google_sub, roles: f.roles };
  }

  async registrarAcceso(usuarioId: string, googleSub: string): Promise<void> {
    await this.pool.query(
      `UPDATE usuario SET google_sub = COALESCE(google_sub, $2), ultimo_acceso = now() WHERE id = $1`,
      [usuarioId, googleSub],
    );
  }

  async rolesEnInstitucionActiva(usuarioId: string, institucionId: string) {
    return this.contexto.ejecutar(institucionId, async (db) => {
      // El filtro por institución sale del contexto de la transacción, no de un parámetro
      const { rows } = await db.query(
        `SELECT current_setting('app.institucion_id') AS contexto, i.nombre,
                json_agg(r.rol ORDER BY r.rol) AS roles
           FROM rol_en_institucion r
           JOIN institucion i ON i.id = r.institucion_id AND i.activa
           JOIN usuario u ON u.id = r.usuario_id AND u.activo
          WHERE r.usuario_id = $1
            AND r.institucion_id = current_setting('app.institucion_id')::uuid
          GROUP BY i.nombre`,
        [usuarioId],
      );
      if (rows.length === 0) return null;
      return { institucionContexto: rows[0].contexto, institucion: rows[0].nombre, roles: rows[0].roles };
    });
  }
}
