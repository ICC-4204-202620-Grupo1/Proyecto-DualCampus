import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/pg-pool.token.js';
import { DOMINIO_PRUEBA } from './autenticacion.service.js';
import type { Rol } from './usuario-sesion.js';

/** Del alumno al superadministrador, en el orden en que se ofrecen en el formulario. */
export const ROLES_PRUEBA = ['ALUMNO', 'AYUDANTE', 'PROFESOR', 'DIRECTOR', 'ADMINISTRADOR', 'SUPERADMINISTRADOR'] as const;
export type RolPrueba = (typeof ROLES_PRUEBA)[number];

export interface CuentaPruebaCreada {
  email: string;
  nombre: string;
  rol: RolPrueba;
  institucion: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USUARIO = /^[a-z0-9][a-z0-9._-]{0,63}$/;

/**
 * Normaliza lo que se escribe en el formulario: «ana», «Ana@testing.com» → «ana@testing.com».
 * Devuelve null si no es una cuenta de prueba válida.
 */
export function correoPrueba(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  let usuario = valor.trim().toLowerCase();
  if (usuario.endsWith(DOMINIO_PRUEBA)) usuario = usuario.slice(0, -DOMINIO_PRUEBA.length);
  return USUARIO.test(usuario) ? usuario + DOMINIO_PRUEBA : null;
}

/** Alta de cuentas de prueba sin administrador ni contraseña, para la etapa de pruebas. */
@Injectable()
export class CuentasPruebaService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async instituciones(): Promise<{ id: string; nombre: string }[]> {
    const { rows } = await this.db.query('SELECT id, nombre FROM institucion WHERE activa ORDER BY nombre');
    return rows;
  }

  async crear(datos: Record<string, unknown>): Promise<CuentaPruebaCreada> {
    const email = correoPrueba(datos?.usuario);
    if (!email) {
      throw new BadRequestException('El usuario solo puede tener letras minúsculas, números, puntos, guiones o guiones bajos (máximo 64)');
    }
    const rol = datos?.rol as RolPrueba;
    if (!ROLES_PRUEBA.includes(rol)) throw new BadRequestException('Selecciona un rol válido');
    const escrito = typeof datos?.nombre === 'string' ? datos.nombre.trim().replace(/\s+/g, ' ') : '';
    const nombre = escrito || email.slice(0, -DOMINIO_PRUEBA.length);
    if (nombre.length < 2 || nombre.length > 150) throw new BadRequestException('El nombre debe tener entre 2 y 150 caracteres');
    const institucionId = datos?.institucionId;
    if (rol !== 'SUPERADMINISTRADOR' && (typeof institucionId !== 'string' || !UUID.test(institucionId))) {
      throw new BadRequestException('Selecciona una institución para ese rol');
    }

    const cliente = await this.db.connect();
    try {
      await cliente.query('BEGIN');
      let institucion: string | null = null;
      if (rol !== 'SUPERADMINISTRADOR') {
        const { rows } = await cliente.query<{ nombre: string }>('SELECT nombre FROM institucion WHERE id = $1 AND activa', [institucionId]);
        if (!rows.length) throw new BadRequestException('La institución no existe o está inactiva');
        institucion = rows[0].nombre;
      }
      const nuevo = await cliente.query<{ id: string }>(
        'INSERT INTO usuario (email, nombre) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id',
        [email, nombre],
      );
      if (!nuevo.rowCount) throw new ConflictException(`Ya existe una cuenta ${email}. Ingresa con ella o elige otro usuario.`);
      const id = nuevo.rows[0].id;
      if (rol === 'SUPERADMINISTRADOR') {
        await cliente.query('INSERT INTO superadministrador (usuario_id) VALUES ($1)', [id]);
      } else {
        await cliente.query('INSERT INTO rol_en_institucion (usuario_id, institucion_id, rol) VALUES ($1, $2, $3::rol)', [id, institucionId, rol as Rol]);
      }
      await cliente.query('COMMIT');
      return { email, nombre, rol, institucion };
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }
}
