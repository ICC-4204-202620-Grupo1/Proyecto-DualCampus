import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, Inject, Param, Post } from '@nestjs/common';
import { Pool } from 'pg';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { PG_POOL } from '../../database/pg-pool.token.js';
import type { UsuarioSesion, Rol } from '../autenticacion/usuario-sesion.js';

const ROLES: Rol[] = ['ADMINISTRADOR', 'PROFESOR', 'AYUDANTE', 'ALUMNO', 'DIRECTOR'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** H58: operaciones globales; la autorización se valida siempre en servidor. */
@Controller('superadmin/usuarios')
export class UsuariosGlobalesController {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  private exigirGlobal(actor: UsuarioSesion) {
    if (!actor.esSuperadministrador) throw new ForbiddenException('Solo un superadministrador puede gestionar usuarios');
  }
  private asignacion(datos: Record<string,unknown>): { institucionId: string; rol: Rol } {
    if (typeof datos.institucionId !== 'string' || !UUID.test(datos.institucionId)) {
      throw new BadRequestException('Selecciona una universidad válida');
    }
    if (!ROLES.includes(datos.rol as Rol)) throw new BadRequestException('Selecciona un rol válido');
    return { institucionId: datos.institucionId, rol: datos.rol as Rol };
  }

  @Get()
  async listar(@UsuarioActual() actor: UsuarioSesion) {
    this.exigirGlobal(actor);
    const { rows } = await this.db.query(`
      SELECT u.id,u.email,u.nombre,u.activo,
        COALESCE(json_agg(json_build_object('institucionId',i.id,'institucion',i.nombre,'rol',r.rol)
          ORDER BY i.nombre,r.rol) FILTER (WHERE i.id IS NOT NULL),'[]') AS roles
      FROM usuario u
      LEFT JOIN rol_en_institucion r ON r.usuario_id=u.id
      LEFT JOIN institucion i ON i.id=r.institucion_id
      GROUP BY u.id ORDER BY u.email`);
    return rows;
  }

  @Post()
  async crear(@UsuarioActual() actor: UsuarioSesion, @Body() datos: Record<string,unknown>) {
    this.exigirGlobal(actor);
    const email = typeof datos?.email === 'string' ? datos.email.trim().toLowerCase() : '';
    const nombre = typeof datos?.nombre === 'string' ? datos.nombre.trim().replace(/\s+/g,' ') : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Correo electrónico inválido');
    if (nombre.length < 2 || nombre.length > 150) throw new BadRequestException('El nombre debe tener entre 2 y 150 caracteres');
    const { institucionId, rol } = this.asignacion(datos);
    const cliente = await this.db.connect();
    try {
      await cliente.query('BEGIN');
      const existe = await cliente.query('SELECT 1 FROM institucion WHERE id=$1 AND activa', [institucionId]);
      if (!existe.rowCount) throw new BadRequestException('La universidad no existe o está inactiva');
      const nuevo = await cliente.query(`INSERT INTO usuario(email,nombre) VALUES($1,$2)
        ON CONFLICT(email) DO NOTHING RETURNING id,email,nombre,activo`, [email,nombre]);
      if (!nuevo.rowCount) throw new ConflictException('Ya existe un usuario con ese correo');
      await cliente.query('INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES($1,$2,$3::rol)',
        [nuevo.rows[0].id,institucionId,rol]);
      await cliente.query('COMMIT');
      return { ...nuevo.rows[0], roles: [{ institucionId, rol }] };
    } catch (e) { await cliente.query('ROLLBACK'); throw e; }
    finally { cliente.release(); }
  }

  @Post(':id/roles')
  async asignar(@UsuarioActual() actor: UsuarioSesion, @Param('id') id: string, @Body() datos: Record<string,unknown>) {
    this.exigirGlobal(actor);
    if (!UUID.test(id)) throw new BadRequestException('Usuario inválido');
    const { institucionId, rol } = this.asignacion(datos);
    const cliente = await this.db.connect();
    try {
      await cliente.query('BEGIN');
      const usuario = await cliente.query('SELECT 1 FROM usuario WHERE id=$1 AND activo', [id]);
      if (!usuario.rowCount) throw new BadRequestException('El usuario no existe o está inactivo');
      const inst = await cliente.query('SELECT 1 FROM institucion WHERE id=$1 AND activa', [institucionId]);
      if (!inst.rowCount) throw new BadRequestException('La universidad no existe o está inactiva');
      const inserted = await cliente.query(`INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol)
        VALUES($1,$2,$3::rol) ON CONFLICT DO NOTHING RETURNING usuario_id`,[id,institucionId,rol]);
      if (!inserted.rowCount) throw new ConflictException('El usuario ya tiene ese rol en la universidad');
      await cliente.query('COMMIT');
      return { usuarioId:id,institucionId,rol };
    } catch(e) { await cliente.query('ROLLBACK'); throw e; }
    finally {cliente.release();}
  }

  @Delete(':id/roles')
  async quitar(@UsuarioActual() actor: UsuarioSesion, @Param('id') id: string, @Body() datos: Record<string,unknown>) {
    this.exigirGlobal(actor);
    if (!UUID.test(id)) throw new BadRequestException('Usuario inválido');
    const { institucionId, rol } = this.asignacion(datos);
    const cliente = await this.db.connect();
    try {
      await cliente.query('BEGIN');
      // No permitir revocar roles que tengan referencias en secciones/matrículas.
      const {rowCount} = await cliente.query(`DELETE FROM rol_en_institucion
        WHERE usuario_id=$1 AND institucion_id=$2 AND rol=$3::rol RETURNING usuario_id`,[id,institucionId,rol]);
      if (!rowCount) throw new BadRequestException('La asignación no existe');
      await cliente.query('COMMIT');
      return { eliminado:true };
    } catch(e) {
      await cliente.query('ROLLBACK');
      if ((e as {code?:string}).code === '23503') throw new ConflictException('No puedes quitar un rol utilizado en secciones o matrículas');
      throw e;
    } finally {cliente.release();}
  }
}
