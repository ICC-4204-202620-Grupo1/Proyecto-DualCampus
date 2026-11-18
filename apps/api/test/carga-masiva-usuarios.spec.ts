import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { leerCsv, validarCarga, type UsuarioExistente } from '../src/modules/superadministracion/carga-usuarios.js';
import { UsuariosGlobalesController } from '../src/modules/superadministracion/usuarios.controller.js';
import type { UsuarioSesion } from '../src/modules/autenticacion/usuario-sesion.js';

const uandes = { id: '11111111-1111-4111-8111-111111111111', nombre: 'Universidad de los Andes' };
const salud = { id: '22222222-2222-4222-8222-222222222222', nombre: 'Instituto de Ciencias de la Salud' };
const instituciones = [uandes, salud];
const sinUsuarios = new Map<string, UsuarioExistente>();

describe('Carga masiva de usuarios: lectura del CSV', () => {
  it('acepta coma, punto y coma, comillas y BOM', () => {
    expect(leerCsv('﻿email,nombre\r\na@x.cl,"Pérez, Ana"\r\n')).toEqual([['email', 'nombre'], ['a@x.cl', 'Pérez, Ana']]);
    expect(leerCsv('email;nombre\na@x.cl;Ana\n\n')).toEqual([['email', 'nombre'], ['a@x.cl', 'Ana']]);
  });
});

describe('Carga masiva de usuarios: validación', () => {
  it('exige las columnas email, nombre y rol', () => {
    expect(validarCarga('correo,nombre\na@x.cl,Ana', instituciones, sinUsuarios).error).toMatch(/email, rol/);
  });

  it('usa la universidad de la fila o la universidad por defecto, sin importar tildes ni mayúsculas', () => {
    const csv = 'email,nombre,rol,universidad\nana@x.cl,Ana,alumno,INSTITUTO DE CIENCIAS DE LA SALUD\nbeto@x.cl,Beto,PROFESOR,';
    const { filas } = validarCarga(csv, instituciones, sinUsuarios, uandes);
    expect(filas.map((f) => [f.universidad, f.rol, f.resultado])).toEqual([
      [salud.nombre, 'ALUMNO', 'CREAR'],
      [uandes.nombre, 'PROFESOR', 'CREAR'],
    ]);
  });

  it('rechaza filas inválidas con su motivo y número de fila', () => {
    const csv = 'email,nombre,rol,universidad\nmalo,Ana,ALUMNO,\nb@x.cl,B,ALUMNO,\nc@x.cl,Cata,REY,\nd@x.cl,Dani,ALUMNO,Otra U\ne@x.cl,Eli,ALUMNO,';
    const { filas } = validarCarga(csv, instituciones, sinUsuarios);
    expect(filas.map((f) => [f.fila, f.motivo])).toEqual([
      [2, 'Correo inválido'],
      [3, 'El nombre debe tener entre 2 y 150 caracteres'],
      [4, expect.stringMatching(/^Rol inválido/)],
      [5, 'La universidad no existe o está inactiva'],
      [6, 'Falta la universidad'],
    ]);
  });

  it('distingue usuarios nuevos, roles nuevos, sin cambios, repetidos e inactivos', () => {
    const existentes = new Map<string, UsuarioExistente>([
      ['ya@x.cl', { id: 'u1', activo: true, roles: [{ institucionId: uandes.id, rol: 'ALUMNO' }] }],
      ['baja@x.cl', { id: 'u2', activo: false, roles: [] }],
    ]);
    const csv = 'email,nombre,rol\nya@x.cl,Ya,ALUMNO\nya@x.cl,Ya,AYUDANTE\nnuevo@x.cl,Nuevo,ALUMNO\nnuevo@x.cl,Nuevo,PROFESOR\nnuevo@x.cl,Nuevo,PROFESOR\nbaja@x.cl,Baja,ALUMNO';
    const { filas } = validarCarga(csv, instituciones, existentes, uandes);
    expect(filas.map((f) => f.resultado)).toEqual(['SIN_CAMBIOS', 'ASIGNAR_ROL', 'CREAR', 'ASIGNAR_ROL', 'RECHAZADA', 'RECHAZADA']);
    expect(filas[4].motivo).toBe('Fila repetida en el archivo');
    expect(filas[5].motivo).toBe('El usuario existe pero está inactivo');
  });
});

describe('Carga masiva de usuarios: endpoints', () => {
  const superadmin = { esSuperadministrador: true } as UsuarioSesion;
  const admin = { esSuperadministrador: false } as UsuarioSesion;

  it('solo el superadministrador puede validar o confirmar', async () => {
    const query = vi.fn(); const connect = vi.fn();
    const controller = new UsuariosGlobalesController({ query, connect } as never);
    await expect(controller.validarCargaMasiva(admin, { csv: 'email,nombre,rol' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.confirmarCargaMasiva(admin, { csv: 'email,nombre,rol' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).not.toHaveBeenCalled(); expect(connect).not.toHaveBeenCalled();
  });

  it('la vista previa no escribe y no devuelve identificadores internos', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: instituciones }).mockResolvedValueOnce({ rows: [] });
    const controller = new UsuariosGlobalesController({ query } as never);
    const r = await controller.validarCargaMasiva(superadmin, { csv: 'email,nombre,rol\nana@x.cl,Ana,ALUMNO', institucionId: uandes.id });
    expect(r.resumen).toMatchObject({ total: 1, crear: 1, rechazadas: 0 });
    expect(r.filas[0]).not.toHaveProperty('institucionId');
    expect(query.mock.calls.every((c) => /^\s*SELECT/i.test(c[0]))).toBe(true);
  });

  it('confirmar con filas rechazadas revierte sin insertar', async () => {
    const query = vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: instituciones }).mockResolvedValueOnce({ rows: [] }).mockResolvedValue({});
    const controller = new UsuariosGlobalesController({ connect: vi.fn().mockResolvedValue({ query, release: vi.fn() }) } as never);
    await expect(controller.confirmarCargaMasiva(superadmin, { csv: 'email,nombre,rol\nmalo,Ana,ALUMNO', institucionId: uandes.id }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(query.mock.calls.some((c) => c[0] === 'ROLLBACK')).toBe(true);
    expect(query.mock.calls.some((c) => /INSERT/.test(c[0]))).toBe(false);
  });

  it('confirmar inserta usuarios y roles en una transacción', async () => {
    const query = vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: instituciones }).mockResolvedValueOnce({ rows: [] }).mockResolvedValue({});
    const release = vi.fn();
    const controller = new UsuariosGlobalesController({ connect: vi.fn().mockResolvedValue({ query, release }) } as never);
    const r = await controller.confirmarCargaMasiva(superadmin, { csv: 'email,nombre,rol\nana@x.cl,Ana,ALUMNO\nana@x.cl,Ana,AYUDANTE', institucionId: uandes.id });
    expect(r).toMatchObject({ total: 2, crear: 1, asignarRol: 1 });
    expect(query.mock.calls.filter((c) => /INSERT INTO rol_en_institucion/.test(c[0]))).toHaveLength(2);
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    expect(release).toHaveBeenCalled();
  });
});
