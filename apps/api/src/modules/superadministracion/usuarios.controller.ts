import { BadRequestException, Body, ConflictException, Controller, Delete, ForbiddenException, Get, Inject, Param, Post } from '@nestjs/common';
import { Pool, type PoolClient } from 'pg';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator.js';
import { PG_POOL } from '../../database/pg-pool.token.js';
import type { UsuarioSesion, Rol } from '../autenticacion/usuario-sesion.js';
import { filaPublica, leerCsv, validarCarga, type InstitucionCarga, type UsuarioExistente } from './carga-usuarios.js';

type Consultable = Pool | PoolClient;

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

  /** Lee el CSV y lo valida contra las universidades activas y los usuarios ya registrados. */
  private async revisarCarga(db: Consultable, datos: Record<string, unknown>) {
    const csv = typeof datos?.csv === 'string' ? datos.csv : '';
    if (!csv.trim()) throw new BadRequestException('Pega o sube un archivo CSV');
    const porDefecto = typeof datos?.institucionId === 'string' && datos.institucionId ? datos.institucionId : undefined;
    if (porDefecto && !UUID.test(porDefecto)) throw new BadRequestException('Selecciona una universidad válida');

    const { rows: instituciones } = await db.query<InstitucionCarga>('SELECT id,nombre FROM institucion WHERE activa ORDER BY nombre');
    const institucionPorDefecto = porDefecto ? instituciones.find((i) => i.id === porDefecto) : undefined;
    if (porDefecto && !institucionPorDefecto) throw new BadRequestException('La universidad no existe o está inactiva');

    const correos = [...new Set(leerCsv(csv).flat().map((v) => v.toLowerCase()).filter((v) => v.includes('@')))];
    const { rows: usuarios } = await db.query<UsuarioExistente & { email: string }>(`
      SELECT u.id,u.email,u.activo,
        COALESCE(json_agg(json_build_object('institucionId',r.institucion_id,'rol',r.rol))
          FILTER (WHERE r.usuario_id IS NOT NULL),'[]') AS roles
      FROM usuario u LEFT JOIN rol_en_institucion r ON r.usuario_id=u.id
      WHERE u.email = ANY($1::text[]) GROUP BY u.id`, [correos]);
    const existentes = new Map(usuarios.map((u) => [u.email, u]));

    const { filas, error } = validarCarga(csv, instituciones, existentes, institucionPorDefecto);
    if (error) throw new BadRequestException(error);
    return filas;
  }

  private resumen(filas: { resultado: string }[]) {
    const contar = (r: string) => filas.filter((f) => f.resultado === r).length;
    return { total: filas.length, crear: contar('CREAR'), asignarRol: contar('ASIGNAR_ROL'), sinCambios: contar('SIN_CAMBIOS'), rechazadas: contar('RECHAZADA') };
  }

  /** Vista previa de la carga masiva: no escribe nada. */
  @Post('carga/validar')
  async validarCargaMasiva(@UsuarioActual() actor: UsuarioSesion, @Body() datos: Record<string, unknown>) {
    this.exigirGlobal(actor);
    const filas = await this.revisarCarga(this.db, datos);
    return { filas: filas.map(filaPublica), resumen: this.resumen(filas) };
  }

  /** Aplica la carga masiva completa en una transacción; si alguna fila es inválida no se guarda nada. */
  @Post('carga/confirmar')
  async confirmarCargaMasiva(@UsuarioActual() actor: UsuarioSesion, @Body() datos: Record<string, unknown>) {
    this.exigirGlobal(actor);
    const cliente = await this.db.connect();
    try {
      await cliente.query('BEGIN');
      const filas = await this.revisarCarga(cliente, datos);
      if (filas.some((f) => f.resultado === 'RECHAZADA')) {
        throw new BadRequestException('Corrige las filas rechazadas antes de confirmar la carga');
      }
      for (const f of filas) {
        if (f.resultado === 'SIN_CAMBIOS') continue;
        await cliente.query('INSERT INTO usuario(email,nombre) VALUES($1,$2) ON CONFLICT(email) DO NOTHING', [f.email, f.nombre]);
        await cliente.query(`INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol)
          SELECT id,$2,$3::rol FROM usuario WHERE email=$1 ON CONFLICT DO NOTHING`, [f.email, f.institucionId, f.rol]);
      }
      await cliente.query('COMMIT');
      return this.resumen(filas);
    } catch (e) { await cliente.query('ROLLBACK'); throw e; }
    finally { cliente.release(); }
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
