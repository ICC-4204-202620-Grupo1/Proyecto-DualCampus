import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DistribucionNotasService } from '../src/modules/calificaciones/distribucion-notas.service.js';

describe('H46 - distribución de notas por sección', () => {
  const seccion = { id: '11111111-1111-4111-8111-111111111111', codigo: '01', cursoCodigo: 'ICC-4204', curso: 'Introducción al software', periodoId: 'p', periodo: 'Segundo semestre' };
  const actor = '22222222-2222-4222-8222-222222222222';
  const institucion = '33333333-3333-4333-8333-333333333333';
  const db = { query: vi.fn() };
  const autorizacion = { exigirRol: vi.fn() };
  const contexto = { ejecutar: vi.fn(async (_: string, fn: (db: unknown) => Promise<unknown>) => fn(db)) };
  const servicio = new DistribucionNotasService(contexto as never, autorizacion as never);
  beforeEach(() => { vi.clearAllMocks(); autorizacion.exigirRol.mockResolvedValue(undefined); });

  it('cuenta exclusivamente las notas retornadas desde evaluaciones publicadas', async () => {
    db.query.mockResolvedValueOnce({rowCount:1,rows:[seccion]})
      .mockResolvedValueOnce({rowCount:1,rows:[{rol:'PROFESOR'}]})
      .mockResolvedValueOnce({rows:[{valor:1},{valor:3.9},{valor:4},{valor:6.9},{valor:7}]});
    const r = await servicio.consultar(actor,institucion,seccion.id);
    expect(r.cantidadNotas).toBe(5);
    expect(r.distribucion.map(f=>f.cantidad)).toEqual([1,0,1,1,0,2]);
    expect(db.query.mock.calls[2][0]).toContain("e.estado='PUBLICADA'");
    expect(db.query.mock.calls[2][0]).toContain('n.es_ausente=false');
  });
  it('rechaza un docente no asignado', async () => {
    db.query.mockResolvedValueOnce({rowCount:1,rows:[seccion]}).mockResolvedValueOnce({rowCount:0,rows:[]});
    await expect(servicio.consultar(actor,institucion,seccion.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.query).toHaveBeenCalledTimes(2);
  });
  it('no revela secciones inexistentes o de otra institución', async () => {
    db.query.mockResolvedValueOnce({rowCount:0,rows:[]});
    await expect(servicio.consultar(actor,institucion,seccion.id)).rejects.toBeInstanceOf(NotFoundException);
  });
  it('exige el rol profesor institucional', async () => {
    autorizacion.exigirRol.mockRejectedValueOnce(new ForbiddenException());
    await expect(servicio.consultar(actor,institucion,seccion.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.query).not.toHaveBeenCalled();
  });
});
