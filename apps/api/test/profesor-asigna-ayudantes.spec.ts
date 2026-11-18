import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AcademicoService } from '../src/modules/gestion-academica/academico.service.js';

const institucion = '11111111-1111-4111-8111-111111111111';
const seccion = '22222222-2222-4222-8222-222222222222';
const profesor = '33333333-3333-4333-8333-333333333333';
const ayudante = '44444444-4444-4444-8444-444444444444';
const otroAyudante = '55555555-5555-4555-8555-555555555555';

/** Simula la base: el actor tiene permiso según `permitido` y todos los ayudantes están habilitados. */
function preparar({ permitido = true, rolOk = true } = {}) {
  const query = vi.fn(async (sql: string, _params?: unknown[]) => {
    if (sql.includes('FROM seccion WHERE id=$1 FOR UPDATE')) return { rowCount: 1, rows: [{ id: seccion }] };
    if (sql.includes("r.rol='ADMINISTRADOR' OR (r.rol='PROFESOR'")) return { rowCount: permitido ? 1 : 0, rows: [] };
    if (sql.includes("rol='PROFESOR'`") || sql.includes("WHERE seccion_id=$1 AND rol='PROFESOR'")) return { rowCount: 1, rows: [{ usuario_id: profesor }] };
    if (sql.includes("r.rol='AYUDANTE' AND u.activo")) return { rowCount: rolOk ? 1 : 0, rows: [] };
    if (sql.includes("WHERE seccion_id=$1 AND rol='AYUDANTE'") && sql.startsWith('SELECT')) return { rowCount: 1, rows: [{ usuario_id: otroAyudante }] };
    return { rowCount: 1, rows: [] };
  });
  const contexto = { ejecutar: vi.fn(async (_i: string, fn: (db: unknown) => unknown) => fn({ query })) };
  const autorizacion = { exigirRol: vi.fn().mockResolvedValue(undefined) };
  const servicio = new AcademicoService(contexto as never, autorizacion as never);
  return { servicio, query, autorizacion };
}

describe('El profesor asignado define los ayudantes de su sección', () => {
  it('permite el ingreso a administradores y profesores', async () => {
    const { servicio, autorizacion } = preparar();
    await servicio.asignarAyudantes(profesor, institucion, seccion, { ayudanteIds: [ayudante] });
    expect(autorizacion.exigirRol).toHaveBeenCalledWith(profesor, institucion, 'ADMINISTRADOR', 'PROFESOR');
  });

  it('reemplaza solo los ayudantes y registra el cambio, sin tocar al profesor', async () => {
    const { servicio, query } = preparar();
    const r = await servicio.asignarAyudantes(profesor, institucion, seccion, { ayudanteIds: [ayudante, ayudante] });
    expect(r).toEqual({ mensaje: 'Ayudantes guardados' });
    const sqls = query.mock.calls.map(c => c[0] as string);
    expect(sqls).toContain(`DELETE FROM equipo_docente WHERE seccion_id=$1 AND rol='AYUDANTE'`);
    expect(sqls.some(s => /DELETE FROM equipo_docente WHERE seccion_id=\$1$/.test(s))).toBe(false);
    expect(sqls.filter(s => s.startsWith('INSERT INTO equipo_docente'))).toHaveLength(1);
    const evento = query.mock.calls.find(c => (c[0] as string).startsWith('INSERT INTO evento_academico'));
    expect(evento?.[1]).toContain('ASIGNAR_AYUDANTES');
  });

  it('rechaza a un profesor que no está asignado a la sección', async () => {
    const { servicio, query } = preparar({ permitido: false });
    await expect(servicio.asignarAyudantes(profesor, institucion, seccion, { ayudanteIds: [ayudante] })).rejects.toBeInstanceOf(ForbiddenException);
    expect(query.mock.calls.some(c => (c[0] as string).startsWith('DELETE'))).toBe(false);
  });

  it('rechaza al profesor como su propio ayudante y a quien no tiene rol AYUDANTE', async () => {
    await expect(preparar().servicio.asignarAyudantes(profesor, institucion, seccion, { ayudanteIds: [profesor] }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(preparar({ rolOk: false }).servicio.asignarAyudantes(profesor, institucion, seccion, { ayudanteIds: [ayudante] }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('valida la lista antes de abrir la transacción', async () => {
    const { servicio, query } = preparar();
    await expect(servicio.asignarAyudantes(profesor, institucion, seccion, { ayudanteIds: 'x' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(servicio.asignarAyudantes(profesor, institucion, seccion, { ayudanteIds: ['no-es-uuid'] })).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
});
