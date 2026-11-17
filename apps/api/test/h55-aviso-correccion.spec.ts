import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvisosCorreccionService } from '../src/modules/calificaciones/avisos-correccion.service.js';

const inst = '11111111-1111-4111-8111-111111111111';
const aviso = '22222222-2222-4222-8222-222222222222';

describe('H55 - aviso de corrección de nota', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function preparar(estado = 'PENDIENTE') {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ destinatario_email: 'alumno@example.org', estado }] })
      .mockResolvedValueOnce({ rowCount: 1 });
    const contexto = { ejecutar: vi.fn(async (_inst: string, fn: (db: any) => Promise<unknown>) => fn({ query })) };
    const servicio = new AvisosCorreccionService(contexto as any);
    return { servicio, query, contexto };
  }

  it('no envía avisos ya procesados', async () => {
    const { servicio, query } = preparar('ENVIADO');
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await servicio.despachar(inst, aviso);
    expect(fetch).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('sin configuración deja el aviso FALLIDO sin afectar la corrección', async () => {
    vi.stubEnv('AVISOS_BREVO_API_KEY', '');
    vi.stubEnv('AVISOS_CORREO_REMITENTE', '');
    const { servicio, query } = preparar();
    await expect(servicio.despachar(inst, aviso)).resolves.toBeUndefined();
    expect(query.mock.calls[1][1][1]).toBe('FALLIDO');
  });

  it('envía únicamente al alumno y nunca incluye valores de nota', async () => {
    vi.stubEnv('AVISOS_BREVO_API_KEY', 'clave-de-prueba');
    vi.stubEnv('AVISOS_CORREO_REMITENTE', 'avisos@example.org');
    vi.stubEnv('APP_URL', 'https://dualcampus.example.org');
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetch);
    const { servicio, query } = preparar();
    await servicio.despachar(inst, aviso);
    const solicitud = fetch.mock.calls[0][1];
    const cuerpo = JSON.parse(solicitud.body);
    expect(cuerpo.to).toEqual([{ email: 'alumno@example.org' }]);
    expect(cuerpo.sender).toEqual({ email: 'avisos@example.org', name: 'DualCampus' });
    expect(fetch.mock.calls[0][0]).toBe('https://api.brevo.com/v3/smtp/email');
    expect(solicitud.headers['api-key']).toBe('clave-de-prueba');
    expect(cuerpo.textContent).toContain('https://dualcampus.example.org');
    expect(cuerpo.textContent).not.toMatch(/valorNuevo|valorPrevio|nota\s*:\s*[1-7][,.][0-9]/i);
    expect(query.mock.calls[1][1][1]).toBe('ENVIADO');
  });

  it('si el proveedor falla, no lanza error y registra FALLIDO', async () => {
    vi.stubEnv('AVISOS_BREVO_API_KEY', 'clave-de-prueba');
    vi.stubEnv('AVISOS_CORREO_REMITENTE', 'avisos@example.org');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin conexión')));
    const { servicio, query } = preparar();
    await expect(servicio.despachar(inst, aviso)).resolves.toBeUndefined();
    expect(query.mock.calls[1][1][1]).toBe('FALLIDO');
  });
});
