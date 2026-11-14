import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Inject, Post } from '@nestjs/common';
import { Pool } from 'pg';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { PG_POOL } from '../../database/pg-pool.token.js';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion.js';

/** H57. Control de privilegios globales: nunca se confia en un identificador de institucion enviado por el cliente. */
@Controller('superadmin/instituciones')
export class InstitucionesController {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  private exigirSuperadministrador(usuario: UsuarioSesion): void {
    if (!usuario.esSuperadministrador) throw new ForbiddenException('Solo un superadministrador puede gestionar instituciones');
  }

  @Get()
  async listar(@UsuarioActual() usuario: UsuarioSesion) {
    this.exigirSuperadministrador(usuario);
    const { rows } = await this.db.query('SELECT id, nombre, activa, creado_en AS "creadoEn" FROM institucion ORDER BY nombre');
    return rows;
  }

  @Post()
  async crear(@UsuarioActual() usuario: UsuarioSesion, @Body() body: { nombre?: unknown }) {
    this.exigirSuperadministrador(usuario);
    if (typeof body?.nombre !== 'string') throw new BadRequestException('Ingresa el nombre de la universidad');
    const nombre = body.nombre.trim().replace(/\s+/g, ' ');
    if (nombre.length < 3 || nombre.length > 120) throw new BadRequestException('El nombre debe tener entre 3 y 120 caracteres');
    const { rows } = await this.db.query(
      `INSERT INTO institucion (nombre) VALUES ($1)
       ON CONFLICT DO NOTHING
       RETURNING id, nombre, activa, creado_en AS "creadoEn"`, [nombre]);
    if (!rows.length) throw new ConflictException('Ya existe una universidad con ese nombre');
    return rows[0];
  }
}
