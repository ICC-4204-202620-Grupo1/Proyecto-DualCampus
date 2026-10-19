/** H02 · Seleccionar institución activa — evidencia de CA1, CA2 y CA3. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { cookieSesion, crearApp, ID_AJENA, ID_ICS, ID_UG, sesionDe, UsuariosEnMemoria } from './apoyo.js';

describe('H02 · Seleccionar institución activa', () => {
  let app: INestApplication;
  const repo = new UsuariosEnMemoria();
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await crearApp(repo);
  });
  beforeEach(() => repo.reiniciar());
  afterAll(() => app.close());

  function seleccionar(cookie: string, institucionId: string) {
    return api().put('/api/sesion/institucion').set('Cookie', cookie).send({ institucionId });
  }

  describe('CA1 · El selector muestra solamente instituciones autorizadas', () => {
    it('un profesor de ambas instituciones ve las dos, sin otras', async () => {
      const cookie = await sesionDe(app, 'benjamin');
      const res = await api().get('/api/sesion/instituciones').set('Cookie', cookie).expect(200);
      expect(res.body.instituciones.map((i: { id: string }) => i.id).sort()).toEqual([ID_UG, ID_ICS].sort());
      expect(res.body.institucionActivaId).toBeNull();
    });

    it('un ayudante de una institución ve solo esa', async () => {
      const cookie = await sesionDe(app, 'diego');
      const res = await api().get('/api/sesion/instituciones').set('Cookie', cookie).expect(200);
      expect(res.body.instituciones).toEqual([{ id: ID_UG, nombre: 'Universidad grande', roles: ['AYUDANTE'] }]);
    });

    it('la lista se lee de la base: un rol revocado deja de aparecer', async () => {
      const cookie = await sesionDe(app, 'benjamin');
      repo.usuarios[0].roles = repo.usuarios[0].roles.filter((r) => r.institucionId === ID_UG);
      const res = await api().get('/api/sesion/instituciones').set('Cookie', cookie).expect(200);
      expect(res.body.instituciones.map((i: { id: string }) => i.id)).toEqual([ID_UG]);
    });

    it('seleccionar una institución sin rol se rechaza con 403 y no cambia la sesión', async () => {
      const cookie = await sesionDe(app, 'diego');
      const res = await seleccionar(cookie, ID_ICS);
      expect(res.status).toBe(403);
      expect(cookieSesion(res)).toBeUndefined();
      await seleccionar(cookie, ID_AJENA).expect(403);
      await seleccionar(cookie, 'no-es-un-id').expect(400);
    });

    it('sin sesión no se puede listar ni seleccionar', async () => {
      await api().get('/api/sesion/instituciones').expect(401);
      await api().put('/api/sesion/institucion').send({ institucionId: ID_UG }).expect(401);
    });
  });

  describe('CA2 · La institución seleccionada queda visible y persiste durante la sesión', () => {
    it('seleccionar reemite la sesión con la institución activa', async () => {
      const cookie = await sesionDe(app, 'benjamin');
      const res = await seleccionar(cookie, ID_ICS).expect(200);
      expect(res.body.institucionActivaId).toBe(ID_ICS);
      const nueva = cookieSesion(res)!;
      expect(nueva).toMatch(/HttpOnly/i);

      // Persiste en peticiones posteriores (recargas)
      for (let i = 0; i < 3; i++) {
        const me = await api().get('/api/auth/me').set('Cookie', nueva.split(';')[0]).expect(200);
        expect(me.body.institucionActivaId).toBe(ID_ICS);
      }
    });

    it('con una sola institución autorizada queda activa al iniciar sesión', async () => {
      const cookie = await sesionDe(app, 'diego');
      const me = await api().get('/api/auth/me').set('Cookie', cookie).expect(200);
      expect(me.body.institucionActivaId).toBe(ID_UG);
    });
  });

  describe('CA3 · El cambio actualiza el contexto de las consultas posteriores', () => {
    it('sin institución activa, las consultas de contexto piden elegir una (409)', async () => {
      const cookie = await sesionDe(app, 'benjamin');
      await api().get('/api/sesion/contexto').set('Cookie', cookie).expect(409);
    });

    it('las consultas corren con la institución elegida y cambian al cambiarla', async () => {
      const inicial = await sesionDe(app, 'benjamin');

      const enUg = cookieSesion(await seleccionar(inicial, ID_UG))!.split(';')[0];
      const r1 = await api().get('/api/sesion/contexto').set('Cookie', enUg).expect(200);
      expect(r1.body).toMatchObject({ institucionContexto: ID_UG, institucion: 'Universidad grande' });
      expect(repo.ultimoContexto).toBe(ID_UG);

      const enIcs = cookieSesion(await seleccionar(enUg, ID_ICS))!.split(';')[0];
      const r2 = await api().get('/api/sesion/contexto').set('Cookie', enIcs).expect(200);
      expect(r2.body).toMatchObject({ institucionContexto: ID_ICS, institucion: 'Instituto de Ciencias de la Salud' });
      expect(repo.ultimoContexto).toBe(ID_ICS);
    });

    it('si se revoca el rol en la institución activa, la consulta se rechaza', async () => {
      const cookie = cookieSesion(await seleccionar(await sesionDe(app, 'benjamin'), ID_ICS))!.split(';')[0];
      repo.usuarios[0].roles = repo.usuarios[0].roles.filter((r) => r.institucionId === ID_UG);
      await api().get('/api/sesion/contexto').set('Cookie', cookie).expect(403);
    });
  });
});
