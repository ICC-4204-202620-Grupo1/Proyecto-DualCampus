/** H01 · Ingresar con cuenta institucional — evidencia de CA1, CA2 y CA3. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { cookieSesion, cookiesDe, crearApp, ICS, iniciarSesion, SECRETO, UG, UsuariosEnMemoria } from './apoyo.js';

describe('H01 · Ingresar con cuenta institucional', () => {
  let app: INestApplication;
  const jwt = new JwtService();
  const repo = new UsuariosEnMemoria();

  beforeAll(async () => {
    app = await crearApp(repo);
  });
  beforeEach(() => repo.reiniciar());
  afterAll(() => app.close());

  describe('CA1 · Una cuenta institucional habilitada inicia sesión y conserva su identidad al recargar', () => {
    it('recibe una cookie de sesión httpOnly y vuelve a la aplicación', async () => {
      const res = await iniciarSesion(app, 'benjamin');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:5173/');
      const cookie = cookieSesion(res)!;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Max-Age=43200/);
    });

    it('conserva la misma identidad en peticiones posteriores (recarga)', async () => {
      const cookie = cookieSesion(await iniciarSesion(app, 'benjamin'))!.split(';')[0];
      for (let recarga = 0; recarga < 3; recarga++) {
        const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(200);
        expect(me.body).toMatchObject({
          usuarioId: 'u-benjamin',
          email: 'benjamin@ug.cl',
          nombre: 'Benjamin Alonso',
          roles: [UG, ICS],
        });
      }
    });
  });

  describe('CA2 · Una cuenta no autorizada no obtiene una sesión', () => {
    it.each([
      ['no registrada en DualCampus', 'desconocido'],
      ['desactivada', 'inactivo'],
      ['sin rol en ninguna institución', 'sinrol'],
      ['con correo no verificado por Google', 'noverificado'],
      ['de un dominio no permitido', 'otrodominio'],
    ])('cuenta %s → sin cookie de sesión y aviso no_autorizado', async (_, codigo) => {
      const res = await iniciarSesion(app, codigo);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:5173/?error=no_autorizado');
      expect(cookieSesion(res)).toBeUndefined();
    });

    it('otra cuenta de Google con el mismo correo no suplanta a quien ya ingresó', async () => {
      await iniciarSesion(app, 'benjamin'); // liga la cuenta a g-benjamin
      const res = await iniciarSesion(app, 'suplantado');
      expect(res.headers.location).toContain('error=no_autorizado');
      expect(cookieSesion(res)).toBeUndefined();
    });

    it('un callback sin el state correcto se rechaza (protección CSRF)', async () => {
      const inicio = await request(app.getHttpServer()).get('/api/auth/google');
      const cookieOidc = cookiesDe(inicio).find((c) => c.startsWith('dc_oidc='))!;
      const res = await request(app.getHttpServer())
        .get('/api/auth/google/callback?code=benjamin&state=falso')
        .set('Cookie', cookieOidc);
      expect(res.headers.location).toContain('error=fallo_login');
      expect(cookieSesion(res)).toBeUndefined();
    });

    it('un callback sin haber iniciado el flujo se rechaza', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/google/callback?code=benjamin&state=x');
      expect(res.headers.location).toContain('error=fallo_login');
      expect(cookieSesion(res)).toBeUndefined();
    });
  });

  describe('CA3 · Una sesión vencida impide acceder a recursos protegidos', () => {
    const datos = { usuarioId: 'u-benjamin', email: 'benjamin@ug.cl', nombre: 'B', institucionActivaId: null, roles: [UG] };

    it('una sesión vencida responde 401', async () => {
      const vencida = jwt.sign(
        { ...datos, iat: Math.floor(Date.now() / 1000) - 13 * 3600 },
        { secret: SECRETO, audience: 'dualcampus:sesion', expiresIn: 12 * 3600 },
      );
      const res = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', `dc_sesion=${vencida}`).expect(401);
      expect(res.body).not.toHaveProperty('email');
    });

    it('sin sesión responde 401', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('una sesión alterada o firmada con otra clave responde 401', async () => {
      const ajena = jwt.sign(datos, { secret: 'otra-clave-cualquiera-de-32-caracteres!!', audience: 'dualcampus:sesion' });
      await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', `dc_sesion=${ajena}`).expect(401);
      const buena = cookieSesion(await iniciarSesion(app, 'benjamin'))!.split(';')[0];
      await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', buena + 'x').expect(401);
    });

    it('cerrar sesión borra la cookie', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/logout').expect(204);
      expect(cookiesDe(res).some((c) => /^dc_sesion=;/.test(c))).toBe(true);
    });

    it('los endpoints públicos siguen disponibles sin sesión', async () => {
      await request(app.getHttpServer()).get('/api/health').expect(200);
    });
  });
});
