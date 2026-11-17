import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { EstadoAvisosService } from '../src/modules/calificaciones/estado-avisos.service.js';
import { AvisosCorreccionService } from '../src/modules/calificaciones/avisos-correccion.service.js';

const inst = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';

describe('H56: estado y reintento de avisos', () => {
  it('solo reclama avisos fallidos; un aviso enviado nunca se reenvía', async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const contexto = { ejecutar: vi.fn(async (_: string, fn: (db: { query: typeof query }) => Promise<unknown>) => fn({ query })) };
    const autorizacion = { exigirRol: vi.fn() };
    const despachar = vi.fn();
    const servicio = new EstadoAvisosService(contexto as never, autorizacion as never, { despachar } as never);
    await expect(servicio.reintentar('admin', inst, id)).rejects.toBeInstanceOf(NotFoundException);
    expect(autorizacion.exigirRol).toHaveBeenCalledWith('admin', inst, 'ADMINISTRADOR');
    expect(query.mock.calls[0][0]).toContain("estado='FALLIDO'");
    expect(despachar).not.toHaveBeenCalled();
  });

  it('lista el evento, destinatario y cada intento sin leer datos de notas', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id, evento: 'CORREGIR_NOTA_PUBLICADA', estado: 'FALLIDO' }] })
      .mockResolvedValueOnce({ rows: [{ avisoId: id, numero: 1, resultado: 'FALLIDO', error: 'Sin conexión' }] });
    const contexto = { ejecutar: vi.fn(async (_: string, fn: (db: { query: typeof query }) => Promise<unknown>) => fn({ query })) };
    const servicio = new EstadoAvisosService(contexto as never, { exigirRol: vi.fn() } as never, {} as never);
    const avisos = await servicio.listar('admin', inst);
    expect(avisos[0].intentosDetalle).toHaveLength(1);
    expect(query.mock.calls[0][0]).not.toMatch(/e\.datos|n\.valor|nota\.valor/);
    expect(query.mock.calls[1][0]).toContain('intento_aviso_correo');
  });

  it('el despachador reclama atómicamente y registra el resultado del intento', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ destinatario_email: 'alumno@example.org', estado: 'ENVIANDO', tipo: 'CORRECCION_NOTA' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ intentos: 2 }] })
      .mockResolvedValueOnce({ rowCount: 1 });
    const contexto = { ejecutar: vi.fn(async (_: string, fn: (db: { query: typeof query }) => Promise<unknown>) => fn({ query })) };
    const servicio = new AvisosCorreccionService(contexto as never);
    const clave = process.env.AVISOS_BREVO_API_KEY;
    const remitente = process.env.AVISOS_CORREO_REMITENTE;
    delete process.env.AVISOS_BREVO_API_KEY;
    delete process.env.AVISOS_CORREO_REMITENTE;
    try { await servicio.despachar(inst, id); }
    finally { if (clave !== undefined) process.env.AVISOS_BREVO_API_KEY = clave; if (remitente !== undefined) process.env.AVISOS_CORREO_REMITENTE = remitente; }
    expect(query.mock.calls[0][0]).toContain("WHERE id=$1 AND estado='PENDIENTE'");
    expect(query.mock.calls[1][1][1]).toBe('FALLIDO');
    expect(query.mock.calls[2][0]).toContain('INSERT INTO intento_aviso_correo');
    expect(query.mock.calls[2][1]).toEqual([inst, id, 2, 'FALLIDO', 'Servicio de correo Brevo no configurado']);
  });
});
