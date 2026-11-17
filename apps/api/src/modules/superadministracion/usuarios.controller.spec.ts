import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { UsuariosGlobalesController } from './usuarios.controller.js';
import type { UsuarioSesion } from '../autenticacion/usuario-sesion.js';

const admin = { esSuperadministrador: false } as UsuarioSesion;
const superadmin = { esSuperadministrador: true } as UsuarioSesion;
const institu = '11111111-1111-4111-8111-111111111111';
const datos = { nombre: 'Ana Ejemplo', email: 'ana@institucion.test', institucionId: institu, rol: 'ALUMNO' };

describe('H58: administración global de usuarios',()=>{
  it('deniega operaciones a administradores institucionales', async()=>{
    const query=vi.fn();const controller=new UsuariosGlobalesController({query} as never);
    await expect(controller.listar(admin)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.crear(admin,datos)).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled();
  });
  it('rechaza una universidad inválida antes de escribir', async()=>{
    const connect=vi.fn();const controller=new UsuariosGlobalesController({connect} as never);
    await expect(controller.crear(superadmin,{...datos,institucionId:'invalida'})).rejects.toBeInstanceOf(BadRequestException);
    expect(connect).not.toHaveBeenCalled();
  });
  it('crea usuario y rol en una transacción',async()=>{
    const query=vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({rowCount:1}).mockResolvedValueOnce({rowCount:1,rows:[{id:'nuevo',email:datos.email,nombre:datos.nombre,activo:true}]}).mockResolvedValueOnce({}).mockResolvedValueOnce({});
    const release=vi.fn();const controller=new UsuariosGlobalesController({connect:vi.fn().mockResolvedValue({query,release})} as never);
    const result=await controller.crear(superadmin,datos);
    expect(result).toMatchObject({email:datos.email,roles:[{institucionId:institu,rol:'ALUMNO'}]});
    expect(query.mock.calls.some(c=>c[0]==='COMMIT')).toBe(true);
    expect(release).toHaveBeenCalled();
  });
  it('rechaza correo duplicado y revierte la transacción',async()=>{
    const query=vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({rowCount:1}).mockResolvedValueOnce({rowCount:0,rows:[]}).mockResolvedValueOnce({});
    const controller=new UsuariosGlobalesController({connect:vi.fn().mockResolvedValue({query,release:vi.fn()})} as never);
    await expect(controller.crear(superadmin,datos)).rejects.toBeInstanceOf(ConflictException);
    expect(query.mock.calls.some(c=>c[0]==='ROLLBACK')).toBe(true);
  });
});
