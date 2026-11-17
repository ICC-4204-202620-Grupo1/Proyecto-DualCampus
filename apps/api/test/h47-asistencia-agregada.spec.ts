
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { AsistenciaAgregadaService } from '../src/modules/reporteria/asistencia-agregada.service.js';

describe('H47 - asistencia agregada por sección', () => {
  const seccion = {
    id: '11111111-1111-4111-8111-111111111111',
    codigo: '01',
    cursoCodigo: 'ICC-4204',
    curso: 'Introducción al software',
    periodoId: '44444444-4444-4444-8444-444444444444',
    periodo: '2026-2',
    alumnosActivos: 6,
  };

  const actor = '22222222-2222-4222-8222-222222222222';
  const institucion = '33333333-3333-4333-8333-333333333333';

  const db = { query: vi.fn() };
  const autorizacion = { exigirRol: vi.fn() };

  const contexto = {
    ejecutar: vi.fn(
      async (_: string, fn: (db: unknown) => Promise<unknown>) => fn(db),
    ),
  };

  const servicio = new AsistenciaAgregadaService(
    contexto as never,
    autorizacion as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    db.query.mockReset();
    autorizacion.exigirRol.mockReset();
    autorizacion.exigirRol.mockResolvedValue(undefined);
  });

  it('agrega presentes y marcas explícitas por clase', async () => {
    db.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [seccion],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ rol: 'PROFESOR' }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            fecha: '2026-08-10',
            presentes: 4,
            marcasConsideradas: 5,
          },
          {
            id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
            fecha: '2026-08-17',
            presentes: 0,
            marcasConsideradas: 0,
          },
          {
            id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
            fecha: '2026-08-24',
            presentes: 5,
            marcasConsideradas: 6,
          },
        ],
      });

    const resultado = await servicio.consultar(
      actor,
      institucion,
      seccion.id,
    );

    expect(resultado.disponible).toBe(true);
    expect(resultado.presentes).toBe(9);
    expect(resultado.marcasConsideradas).toBe(11);
    expect(resultado.clasesConsideradas).toBe(2);
    expect(resultado.totalClases).toBe(3);
    expect(resultado.proporcion).toBe(81.82);

    expect(resultado.clases[1].marcasConsideradas).toBe(0);
    expect(resultado.clases[1].proporcion).toBe(null);

    const sql = db.query.mock.calls[2][0];

    expect(sql).toContain('LEFT JOIN asistencia_clase');
    expect(sql).toContain('a.presente IS TRUE');
    expect(sql).not.toContain('asistencia_correccion');
  });

  it('no inventa porcentaje cuando no existen marcas', async () => {
    db.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [seccion],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{}],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            fecha: '2026-08-10',
            presentes: 0,
            marcasConsideradas: 0,
          },
        ],
      });

    const resultado = await servicio.consultar(
      actor,
      institucion,
      seccion.id,
    );

    expect(resultado.presentes).toBe(0);
    expect(resultado.marcasConsideradas).toBe(0);
    expect(resultado.clasesConsideradas).toBe(0);
    expect(resultado.proporcion).toBe(null);
  });

  it('no muestra agregados para grupos menores a cinco alumnos', async () => {
    db.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ ...seccion, alumnosActivos: 4 }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{}],
      });

    const resultado = await servicio.consultar(
      actor,
      institucion,
      seccion.id,
    );

    expect(resultado.disponible).toBe(false);
    expect(resultado.clases).toEqual([]);
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('rechaza a un profesor no asignado a la sección', async () => {
    db.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [seccion],
      })
      .mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

    await expect(
      servicio.consultar(actor, institucion, seccion.id),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('rechaza secciones inexistentes o de otra institución', async () => {
    db.query.mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });

    await expect(
      servicio.consultar(actor, institucion, seccion.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exige el rol profesor institucional', async () => {
    autorizacion.exigirRol.mockRejectedValueOnce(
      new ForbiddenException(),
    );

    await expect(
      servicio.consultar(actor, institucion, seccion.id),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(db.query).not.toHaveBeenCalled();
  });

  it('rechaza identificadores de sección inválidos', async () => {
    await expect(
      servicio.consultar(actor, institucion, 'seccion-invalida'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(db.query).not.toHaveBeenCalled();
    expect(autorizacion.exigirRol).not.toHaveBeenCalled();
  });
});
