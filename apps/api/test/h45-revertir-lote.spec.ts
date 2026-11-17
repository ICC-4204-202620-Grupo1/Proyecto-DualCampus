import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HistorialAcademicoService } from '../src/modules/historial-academico/historial-academico.service.js';

describe('H45 · revertir lote histórico', () => {
  const auth = { exigirRol: vi.fn().mockResolvedValue(undefined) } as any;
  const contexto = { ejecutar: vi.fn() } as any;
  const service = new HistorialAcademicoService(contexto, auth);

  it('exige motivo y un UUID de lote', async () => {
    await expect(service.revertirLote('admin', 'inst', 'invalido', '')).rejects.toBeInstanceOf(BadRequestException);
    expect(contexto.ejecutar).not.toHaveBeenCalled();
  });

  it('exige rol administrador antes de modificar', async () => {
    await service.revertirLote('admin', 'inst', '00000000-0000-0000-0000-000000000001', 'corrección');
    expect(auth.exigirRol).toHaveBeenCalledWith('admin', 'inst', 'ADMINISTRADOR');
  });

  it('informa lote inexistente o ya revertido', async () => {
    contexto.ejecutar.mockImplementation(async (_inst: string, fn: (db: any) => Promise<unknown>) => fn({ query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }) }));
    await expect(service.revertirLote('admin', 'inst', '00000000-0000-0000-0000-000000000001', 'corrección')).rejects.toBeInstanceOf(NotFoundException);
  });
});
