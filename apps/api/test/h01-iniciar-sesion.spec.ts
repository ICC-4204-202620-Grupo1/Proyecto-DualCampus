/**
 * H01 · Ingresar con cuenta institucional — evidencia de CA1, CA2 y CA3.
 * Google se reemplaza por un doble de prueba: el resto del flujo (state, nonce,
 * cookies, sesión firmada, guard y reglas de habilitación) es el código real.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';
import { CONFIG, cargarConfig } from '../src/config/config';
import { GoogleOidcAdapter } from '../src/modules/autenticacion/google-oidc.adapter';
import type { IdentidadGoogle } from '../src/modules/autenticacion/usuario-sesion';
import {
  UsuarioRegistrado,
  UsuariosRepositorio,
} from '../src/modules/autenticacion/usuarios.repositorio';

const SECRETO = 'secreto-de-prueba-con-mas-de-32-caracteres';
const UG = { institucionId: 'i-ug', institucion: 'Universidad grande', rol: 'PROFESOR' as const };

// Cuentas que "Google" confirma según el código recibido en el callback
const identidades: Record<string, IdentidadGoogle> = {
  benjamin: { sub: 'g-benjamin', email: 'benjamin@ug.cl', emailVerificado: true, nombre: 'Benjamin Alonso', dominio: 'ug.cl' },
  desconocido: { sub: 'g-x', email: 'nadie@ug.cl', emailVerificado: true, nombre: 'Nadie', dominio: 'ug.cl' },
  inactivo: { sub: 'g-inactivo', email: 'inactivo@ug.cl', emailVerificado: true, nombre: 'Inactivo', dominio: 'ug.cl' },
  sinrol: { sub: 'g-sinrol', email: 'sinrol@ug.cl', emailVerificado: true, nombre: 'Sin Rol', dominio: 'ug.cl' },
  noverificado: { sub: 'g-benjamin', email: 'benjamin@ug.cl', emailVerificado: false, nombre: 'Benjamin', dominio: 'ug.cl' },
  otrodominio: { sub: 'g-benjamin', email: 'benjamin@ug.cl', emailVerificado: true, nombre: 'Benjamin', dominio: 'gmail.com' },
  suplantado: { sub: 'g-otra-persona', email: 'benjamin@ug.cl', emailVerificado: true, nombre: 'Benjamin', dominio: 'ug.cl' },
};

class GoogleFalso {
  urlAutorizacion(state: string, nonce: string) {
    return `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&nonce=${nonce}`;
  }
  async canjearCodigo(code: string): Promise<IdentidadGoogle> {
    const id = identidades[code];
    if (!id) throw new Error('código inválido');
    return id;
  }
}

class UsuariosEnMemoria extends UsuariosRepositorio {
  usuarios: UsuarioRegistrado[] = [];
  reiniciar() {
    this.usuarios = [
      { id: 'u-benjamin', email: 'benjamin@ug.cl', nombre: 'Benjamin Alonso', activo: true, googleSub: null, roles: [UG] },
      { id: 'u-inactivo', email: 'inactivo@ug.cl', nombre: null, activo: false, googleSub: null, roles: [UG] },
      { id: 'u-sinrol', email: 'sinrol@ug.cl', nombre: null, activo: true, googleSub: null, roles: [] },
    ];
  }
  async buscarPorEmail(email: string) {
    return this.usuarios.find((u) => u.email === email) ?? null;
  }
  async registrarAcceso(id: string, sub: string) {
    const u = this.usuarios.find((x) => x.id === id)!;
    u.googleSub ??= sub;
  }
}

describe('H01 · Ingresar con cuenta institucional', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const repo = new UsuariosEnMemoria();

  beforeAll(async () => {
    const config = cargarConfig({
      SESSION_SECRET: SECRETO,
      APP_URL: 'http://localhost:5173',
      DOMINIOS_PERMITIDOS: 'ug.cl',
      SESION_DURACION_HORAS: '12',
    });
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONFIG).useValue(config)
      .overrideProvider(GoogleOidcAdapter).useClass(GoogleFalso)
      .overrideProvider(UsuariosRepositorio).useValue(repo)
      .compile();
    app = configurarApp(modulo.createNestApplication<NestExpressApplication>());
    await app.init();
    jwt = new JwtService();
  });

  beforeEach(() => repo.reiniciar());
  afterAll(() => app.close());

  /** Recorre el flujo completo: /auth/google → Google → /auth/google/callback. */
  async function iniciarSesion(codigo: string) {
    const inicio = await request(app.getHttpServer()).get('/api/auth/google').expect(302);
    const state = new URL(inicio.headers.location).searchParams.get('state')!;
    const cookieOidc = cookiesDe(inicio).find((c) => c.startsWith('dc_oidc='))!;
    return request(app.getHttpServer())
      .get(`/api/auth/google/callback?code=${codigo}&state=${state}`)
      .set('Cookie', cookieOidc);
  }

  function cookiesDe(res: request.Response): string[] {
    const c = res.headers['set-cookie'] as unknown as string[] | string | undefined;
    return Array.isArray(c) ? c : c ? [c] : [];
  }

  /** Cookie de sesión con valor (las de borrado llegan vacías). */
  function cookieSesion(res: request.Response): string | undefined {
    return cookiesDe(res).find((c) => /^dc_sesion=[^;]+/.test(c));
  }

  describe('CA1 · Una cuenta institucional habilitada inicia sesión y conserva su identidad al recargar', () => {
    it('recibe una cookie de sesión httpOnly y vuelve a la aplicación', async () => {
      const res = await iniciarSesion('benjamin');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:5173/');
      const cookie = cookieSesion(res)!;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Max-Age=43200/);
    });

    it('conserva la misma identidad en peticiones posteriores (recarga)', async () => {
      const cookie = cookieSesion(await iniciarSesion('benjamin'))!.split(';')[0];
      for (let recarga = 0; recarga < 3; recarga++) {
        const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie).expect(200);
        expect(me.body).toMatchObject({
          usuarioId: 'u-benjamin',
          email: 'benjamin@ug.cl',
          nombre: 'Benjamin Alonso',
          roles: [UG],
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
      const res = await iniciarSesion(codigo);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:5173/?error=no_autorizado');
      expect(cookieSesion(res)).toBeUndefined();
    });

    it('otra cuenta de Google con el mismo correo no suplanta a quien ya ingresó', async () => {
      await iniciarSesion('benjamin'); // liga la cuenta a g-benjamin
      const res = await iniciarSesion('suplantado');
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
      const buena = cookieSesion(await iniciarSesion('benjamin'))!.split(';')[0];
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
