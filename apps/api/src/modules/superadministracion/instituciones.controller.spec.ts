import { describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InstitucionesController } from './instituciones.controller.js';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion.js';

const superadmin = { usuarioId: 'u1', esSuperadministrador: true } as UsuarioSesion;
const administrador = { usuarioId: 'u2', esSuperadministrador: false } as UsuarioSesion;

describe('H57: crear universidades', () => {
  it('deniega listado y escritura a un administrador local', async () => {
    const query = vi.fn();
    const ctl = new InstitucionesController({ query } as never);
    await expect(ctl.listar(administrador)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(ctl.crear(administrador, { nombre: 'Universidad Nueva' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });
  it('rechaza nombre vacio o corto', async () => {
    const ctl = new InstitucionesController({ query: vi.fn() } as never);
    await expect(ctl.crear(superadmin, { nombre: '  ' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('crea universidad valida', async () => {
    const universidad = { id: 'nueva', nombre: 'Universidad Nueva', activa: true, creadoEn: new Date() };
    const query = vi.fn().mockResolvedValue({ rows: [universidad] });
    const ctl = new InstitucionesController({ query } as never);
    await expect(ctl.crear(superadmin, { nombre: ' Universidad Nueva  ' })).resolves.toEqual(universidad);
    expect(query.mock.calls[0][1]).toEqual(['Universidad Nueva']);
  });
  it('rechaza duplicados sin escribir una segunda universidad', async () => {
    const ctl = new InstitucionesController({ query: vi.fn().mockResolvedValue({ rows: [] }) } as never);
    await expect(ctl.crear(superadmin, { nombre: 'Universidad Nueva' })).rejects.toBeInstanceOf(ConflictException);
  });
});
