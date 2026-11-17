import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvaluacionesService } from '../src/modules/calificaciones/evaluaciones.service.js';
import { AvisosCorreccionService } from '../src/modules/calificaciones/avisos-correccion.service.js';

const eid = '11111111-1111-4111-8111-111111111111';
const seccion = '22222222-2222-4222-8222-222222222222';

function preparar(destinatarios = [{ usuario_id: 'alumno-1', email: 'alumno@institucion.test' }]) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('FROM evaluacion WHERE id=$1 FOR UPDATE')) return { rowCount: 1, rows: [{ seccion_id: seccion, estado: 'EN_REVISION' }] };
    if (sql.includes('FROM equipo_docente')) return { rowCount: 1, rows: [{ '?column?': 1 }] };
    if (sql.includes('FROM matricula m LEFT JOIN nota')) return { rowCount: 0, rows: [] };
    if (sql.includes("UPDATE evaluacion SET estado='PUBLICADA'")) return { rowCount: 1, rows: [{ id: eid, estado: 'PUBLICADA', publicadoEn: new Date() }] };
    if (sql.includes('SELECT m.usuario_id, u.email')) return { rowCount: destinatarios.length, rows: destinatarios };
    if (sql.includes("'AVISAR_PUBLICACION_NOTA'")) return { rowCount: 1, rows: [{ id: 'evento-1' }] };
    if (sql.includes("'PUBLICACION_NOTA'")) return { rowCount: 1, rows: [{ id: 'aviso-1' }] };
    return { rowCount: 1, rows: [] };
  });
  const contexto = { ejecutar: vi.fn(async (_institucion, fn) => fn({ query })) };
  const autorizacion = { exigirRol: vi.fn().mockResolvedValue(undefined) };
  const avisos = { despachar: vi.fn().mockResolvedValue(undefined) };
  const servicio = new EvaluacionesService(contexto as never, autorizacion as never, avisos as never);
  return { servicio, query, avisos };
}

describe('H54: aviso de publicación de notas', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('crea un aviso individual solo para cada alumno activo con nota, después intenta enviarlo', async () => {
    const { servicio, query, avisos } = preparar();
    await expect(servicio.publicar('profesor', 'institucion', eid)).resolves.toMatchObject({ estado: 'PUBLICADA' });
    const consulta = query.mock.calls.find(([sql]) => sql.includes('SELECT m.usuario_id, u.email'))?.[0] ?? '';
    expect(consulta).toContain("m.estado='ACTIVA'");
    expect(consulta).toContain('JOIN nota n ON n.evaluacion_id=$1 AND n.usuario_id=m.usuario_id');
    const insercion = query.mock.calls.find(([sql]) => sql.includes("'PUBLICACION_NOTA'"));
    expect(insercion?.[1]).toEqual(['institucion', 'evento-1', 'alumno-1', 'alumno@institucion.test']);
    expect(avisos.despachar).toHaveBeenCalledWith('institucion', 'aviso-1');
  });

  it('publica sin crear avisos cuando no hay alumnos afectados', async () => {
    const { servicio, query, avisos } = preparar([]);
    await expect(servicio.publicar('profesor', 'institucion', eid)).resolves.toMatchObject({ estado: 'PUBLICADA' });
    expect(query.mock.calls.some(([sql]) => sql.includes("'PUBLICACION_NOTA'"))).toBe(false);
    expect(avisos.despachar).not.toHaveBeenCalled();
  });

  it('envía un enlace a la aplicación sin revelar la calificación', async () => {
    vi.stubEnv('AVISOS_BREVO_API_KEY', 'clave-de-prueba');
    vi.stubEnv('AVISOS_CORREO_REMITENTE', 'avisos@example.org');
    vi.stubEnv('APP_URL', 'https://dualcampus.example.org');
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal('fetch', fetch);
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ destinatario_email: 'alumno@example.org', estado: 'PENDIENTE', tipo: 'PUBLICACION_NOTA' }] })
      .mockResolvedValueOnce({ rowCount: 1 });
    const contexto = { ejecutar: vi.fn(async (_institucion, fn) => fn({ query })) };
    const avisos = new AvisosCorreccionService(contexto as never);
    await avisos.despachar('institucion', 'aviso-1');
    const correo = JSON.parse(fetch.mock.calls[0][1].body);
    expect(correo.to).toEqual([{ email: 'alumno@example.org' }]);
    expect(correo.subject).toContain('publicaron tus notas');
    expect(correo.textContent).toContain('https://dualcampus.example.org');
    expect(correo.textContent).toContain('inicia sesión');
    expect(correo.textContent).not.toMatch(/[1-7][,.][0-9]|calificación:\s*\d/i);
    expect(query.mock.calls[1][1][1]).toBe('ENVIADO');
  });
});
