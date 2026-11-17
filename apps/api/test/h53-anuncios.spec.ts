import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { AnunciosService } from '../src/modules/anuncios/anuncios.service.js';

const seccion = '11111111-1111-4111-8111-111111111111';

function servicio(matriculado: boolean) {
  const query = vi.fn()
    .mockResolvedValueOnce({ rowCount: 1 })
    .mockResolvedValueOnce({ rowCount: matriculado ? 1 : 0 })
    .mockResolvedValueOnce({ rows: [{ id: 'a1', titulo: 'Aviso', autor: 'Profesora', publicadoEn: new Date() }] });
  const contexto = { ejecutar: vi.fn(async (_institucion, fn) => fn({ query })) };
  const autorizacion = { exigirRol: vi.fn().mockResolvedValue(undefined) };
  return { anuncios: new AnunciosService(contexto as never, autorizacion as never), query, autorizacion };
}

describe('H53: consultar anuncios de la sección', () => {
  it('permite leer los anuncios ordenados a un alumno matriculado', async () => {
    const { anuncios, query, autorizacion } = servicio(true);
    await expect(anuncios.listar('alumno', 'institucion', seccion)).resolves.toMatchObject([{ titulo: 'Aviso', autor: 'Profesora' }]);
    expect(autorizacion.exigirRol).toHaveBeenCalledWith('alumno', 'institucion', 'PROFESOR', 'ALUMNO');
    expect(query.mock.calls[1][0]).toContain("estado='ACTIVA'");
    expect(query.mock.calls[2][0]).toContain('ORDER BY a.publicado_en DESC,a.id DESC');
  });

  it('impide leer anuncios de una sección ajena', async () => {
    const { anuncios, query } = servicio(false);
    await expect(anuncios.listar('alumno', 'institucion', seccion)).rejects.toBeInstanceOf(ForbiddenException);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
