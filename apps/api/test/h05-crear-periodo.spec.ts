/** H05 · Crear un período académico — evidencia de CA1, CA2 y CA3. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { crearApp, ID_ICS, ID_UG, PeriodosEnMemoria, sesionDe, sesionEn, UsuariosEnMemoria } from './apoyo';

const VALIDO = { nombre: '2026-2', fechaInicio: '2026-08-03', fechaFin: '2026-12-18' };

describe('H05 · Crear un período académico', () => {
  let app: INestApplication;
  const usuarios = new UsuariosEnMemoria();
  const periodos = new PeriodosEnMemoria(usuarios);
  const api = () => request(app.getHttpServer());
  let adminUg: string;

  beforeAll(async () => {
    app = await crearApp(usuarios, periodos);
  });
  beforeEach(async () => {
    usuarios.reiniciar();
    periodos.reiniciar();
    adminUg = await sesionEn(app, 'rodolfo', ID_UG);
  });
  afterAll(() => app.close());

  const crear = (cookie: string, body: object) => api().post('/api/periodos').set('Cookie', cookie).send(body);

  describe('CA1 · Un período válido se guarda en su institución y puede volver a consultarse', () => {
    it('el administrador crea el período en la institución activa', async () => {
      const res = await crear(adminUg, VALIDO).expect(201);
      expect(res.body).toMatchObject({ ...VALIDO, institucionId: ID_UG });
      expect(res.body.id).toBeTruthy();
    });

    it('se puede volver a consultar en la lista y por su id, también en una sesión nueva', async () => {
      const { body: creado } = await crear(adminUg, VALIDO).expect(201);
      const otraSesion = await sesionEn(app, 'rodolfo', ID_UG);
      const lista = await api().get('/api/periodos').set('Cookie', otraSesion).expect(200);
      expect(lista.body).toEqual([creado]);
      const uno = await api().get(`/api/periodos/${creado.id}`).set('Cookie', otraSesion).expect(200);
      expect(uno.body).toEqual(creado);
    });

    it('cualquier rol de la institución puede consultarlo', async () => {
      const { body: creado } = await crear(adminUg, VALIDO).expect(201);
      const ayudante = await sesionDe(app, 'diego'); // única institución: UG
      const lista = await api().get('/api/periodos').set('Cookie', ayudante).expect(200);
      expect(lista.body.map((p: { id: string }) => p.id)).toEqual([creado.id]);
    });

    it('queda en su institución: desde otra institución no se ve ni se obtiene', async () => {
      const { body: creado } = await crear(adminUg, VALIDO).expect(201);
      const enIcs = await sesionEn(app, 'benjamin', ID_ICS);
      expect((await api().get('/api/periodos').set('Cookie', enIcs).expect(200)).body).toEqual([]);
      await api().get(`/api/periodos/${creado.id}`).set('Cookie', enIcs).expect(404);
    });

    it('solo un administrador puede crearlo', async () => {
      const profesor = await sesionEn(app, 'benjamin', ID_UG);
      await crear(profesor, VALIDO).expect(403);
      await crear(await sesionDe(app, 'diego'), VALIDO).expect(403);
      expect(periodos.periodos).toHaveLength(0);
    });

    it('sin institución activa se pide elegir una y sin sesión se rechaza', async () => {
      await crear(await sesionDe(app, 'rodolfo'), VALIDO).expect(409);
      await api().post('/api/periodos').send(VALIDO).expect(401);
    });
  });

  describe('CA2 · Se rechazan fechas incoherentes y duplicados dentro de la institución', () => {
    it.each([
      ['término anterior al inicio', { fechaInicio: '2026-12-18', fechaFin: '2026-08-03' }],
      ['inicio igual al término', { fechaInicio: '2026-08-03', fechaFin: '2026-08-03' }],
      ['año cero no válido en PostgreSQL', { fechaInicio: '0000-01-01' }],
      ['fecha inexistente', { fechaInicio: '2026-02-30' }],
      ['formato de fecha inválido', { fechaFin: '18/12/2026' }],
      ['fecha faltante', { fechaInicio: undefined }],
      ['nombre vacío', { nombre: '   ' }],
      ['nombre demasiado largo', { nombre: 'x'.repeat(101) }],
    ])('%s → 400 y no se guarda', async (_, cambio) => {
      const res = await crear(adminUg, { ...VALIDO, ...cambio }).expect(400);
      expect(res.body.message.length).toBeGreaterThan(0);
      expect(periodos.periodos).toHaveLength(0);
    });

    it('un nombre repetido en la misma institución → 409 (sin distinguir mayúsculas ni espacios)', async () => {
      await crear(adminUg, VALIDO).expect(201);
      await crear(adminUg, VALIDO).expect(409);
      await crear(adminUg, { ...VALIDO, nombre: '  2026-2 ' }).expect(409);
      await crear(adminUg, { nombre: 'Semestre X', fechaInicio: '2027-03-01', fechaFin: '2027-07-15' }).expect(201);
      await crear(adminUg, { nombre: 'semestre x', fechaInicio: '2027-03-01', fechaFin: '2027-07-15' }).expect(409);
      expect(periodos.periodos).toHaveLength(2);
    });

    it('el mismo nombre en otra institución sí se permite', async () => {
      await crear(adminUg, VALIDO).expect(201);
      const adminIcs = await sesionEn(app, 'rodolfo', ID_ICS);
      const res = await crear(adminIcs, VALIDO).expect(201);
      expect(res.body.institucionId).toBe(ID_ICS);
    });
  });

  describe('CA3 · Se registra quién lo creó', () => {
    it('el período guarda y muestra a su creador y la fecha de creación', async () => {
      const { body } = await crear(adminUg, VALIDO).expect(201);
      expect(body.creadoPor).toEqual({ id: 'u-rodolfo', nombre: 'Rodolfo Ávila', email: 'rodolfo@ug.cl' });
      expect(new Date(body.creadoEn).getTime()).toBeLessThanOrEqual(Date.now());
      const consultado = await api().get(`/api/periodos/${body.id}`).set('Cookie', adminUg).expect(200);
      expect(consultado.body.creadoPor.id).toBe('u-rodolfo');
    });

    it('el creador sale de la sesión: no se puede suplantar desde el cuerpo de la petición', async () => {
      const { body } = await crear(adminUg, { ...VALIDO, creadoPor: 'u-benjamin', institucionId: ID_ICS }).expect(201);
      expect(body.creadoPor.id).toBe('u-rodolfo');
      expect(body.institucionId).toBe(ID_UG);
    });
  });
});
