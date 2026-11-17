/** H43 · Vincular una cuenta personal verificada — evidencia de CA1, CA2 y CA3. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { cargarConfig } from '../src/config/config.js';
import { PostgresCuentasPersonalesRepositorio } from '../src/modules/autenticacion/cuentas-personales.repositorio.js';
import { GoogleOidcAdapter } from '../src/modules/autenticacion/google-oidc.adapter.js';
import type { IdentidadGoogle } from '../src/modules/autenticacion/usuario-sesion.js';
import {
  CuentasPersonalesEnMemoria,
  cookieSesion,
  cookiesDe,
  crearApp,
  identidades,
  PeriodosEnMemoria,
  sesionDe,
  UG,
  UsuariosEnMemoria,
} from './apoyo.js';

const personal = (sub: string, email: string, extra: Partial<IdentidadGoogle> = {}): IdentidadGoogle => ({
  sub, email, nombre: email, emailVerificado: true, dominio: null, ...extra,
});

// Cuentas que "Google" confirma en el callback de la vinculación.
Object.assign(identidades, {
  tomas: { sub: 'g-tomas', email: 'tomas@ug.cl', nombre: 'Tomás Alcaíno', emailVerificado: true, dominio: 'ug.cl' },
  catalina: { sub: 'g-catalina', email: 'catalina@ug.cl', nombre: 'Catalina Rojas', emailVerificado: true, dominio: 'ug.cl' },
  'personal-tomas': personal('g-personal-tomas', 'tomas.alcaino@example.invalid'),
  'personal-tomas-nueva': personal('g-personal-tomas-2', 'tomas.nueva@example.invalid'),
  'personal-no-verificada': personal('g-personal-x', 'sin.verificar@example.invalid', { emailVerificado: false }),
  'personal-dominio-institucional': personal('g-otra-ug', 'otra.cuenta@ug.cl', { dominio: 'ug.cl' }),
  // La cuenta institucional de Diego (ya ligada a g-diego), presentada sin dominio Workspace.
  'institucional-de-diego': personal('g-diego', 'diego@ug.cl'),
  // La propia cuenta institucional de Tomás, presentada sin dominio Workspace.
  'institucional-de-tomas': personal('g-tomas', 'tomas@ug.cl'),
});

const ALUMNO_UG = { ...UG, rol: 'ALUMNO' as const };

describe('H43 · Vincular una cuenta personal verificada', () => {
  let app: INestApplication;
  const usuarios = new UsuariosEnMemoria();
  const cuentas = new CuentasPersonalesEnMemoria(usuarios);

  beforeAll(async () => {
    app = await crearApp(usuarios, new PeriodosEnMemoria(usuarios), cuentas);
  });
  beforeEach(async () => {
    usuarios.reiniciar();
    usuarios.usuarios.push(
      { id: 'u-tomas', email: 'tomas@ug.cl', nombre: 'Tomás Alcaíno', activo: true, googleSub: null, roles: [ALUMNO_UG], esSuperadministrador: false },
      { id: 'u-catalina', email: 'catalina@ug.cl', nombre: 'Catalina Rojas', activo: true, googleSub: null, roles: [ALUMNO_UG], esSuperadministrador: false },
    );
    cuentas.reiniciar();
    // Diego ya ingresó una vez: su cuenta institucional queda ligada a g-diego.
    await sesionDe(app, 'diego');
  });
  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());

  /** Inicia la vinculación con la sesión dada y devuelve lo necesario para el callback. */
  async function iniciarVinculacion(sesion: string) {
    const inicio = await http().get('/api/cuenta-personal/vincular').set('Cookie', sesion).expect(302);
    const url = new URL(inicio.headers.location);
    return { inicio, state: url.searchParams.get('state')!, oidc: cookiesDe(inicio).find((c) => c.startsWith('dc_oidc='))?.split(';')[0] };
  }

  /** Recorre vincular → Google → callback. La sesión del callback puede diferir (pruebas de CA1). */
  async function vincular(sesion: string, codigo: string, sesionEnCallback: string | null = sesion) {
    const { state, oidc } = await iniciarVinculacion(sesion);
    return http()
      .get(`/api/auth/google/callback?code=${codigo}&state=${state}`)
      .set('Cookie', [oidc!, ...(sesionEnCallback ? [sesionEnCallback] : [])].join('; '));
  }

  const resultado = (res: request.Response) => new URL(res.headers.location).searchParams.get('vinculacion');
  const perfil = (sesion: string) => http().get('/api/cuenta-personal').set('Cookie', sesion);

  describe('CA1 · La vinculación requiere sesión vigente y verificar la propiedad de la cuenta', () => {
    it('con sesión vigente, Google verifica la cuenta personal y queda vinculada', async () => {
      const sesion = await sesionDe(app, 'tomas');
      const res = await vincular(sesion, 'personal-tomas');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:5173/?vinculacion=vinculada');
      expect((await perfil(sesion).expect(200)).body.cuentaPersonal.email).toBe('tomas.alcaino@example.invalid');
    });

    it('la vinculación no reemplaza ni borra la sesión institucional', async () => {
      const sesion = await sesionDe(app, 'tomas');
      const res = await vincular(sesion, 'personal-tomas');
      expect(cookiesDe(res).some((c) => c.startsWith('dc_sesion='))).toBe(false);
      const me = await http().get('/api/auth/me').set('Cookie', sesion).expect(200);
      expect(me.body).toMatchObject({ usuarioId: 'u-tomas', email: 'tomas@ug.cl' });
    });

    it('sin sesión no se inicia la verificación', async () => {
      const inicio = await http().get('/api/cuenta-personal/vincular').expect(302);
      expect(inicio.headers.location).toBe('http://localhost:5173/?vinculacion=sesion_requerida');
      expect(cookiesDe(inicio).some((c) => c.startsWith('dc_oidc='))).toBe(false);
    });

    it('si la sesión ya no está vigente al volver de Google, no se vincula ni se emite sesión', async () => {
      const sesion = await sesionDe(app, 'tomas');
      const res = await vincular(sesion, 'personal-tomas', null);
      expect(resultado(res)).toBe('sesion_requerida');
      expect(cookieSesion(res)).toBeUndefined();
      expect(cuentas.cuentas.size).toBe(0);
    });

    it('la sesión de otra persona no completa una vinculación ajena', async () => {
      const tomas = await sesionDe(app, 'tomas');
      const catalina = await sesionDe(app, 'catalina');
      const res = await vincular(tomas, 'personal-tomas', catalina);
      expect(resultado(res)).toBe('sesion_requerida');
      expect(cuentas.cuentas.size).toBe(0);
    });

    it('un callback con state alterado se rechaza sin cerrar la sesión', async () => {
      const sesion = await sesionDe(app, 'tomas');
      const { oidc } = await iniciarVinculacion(sesion);
      const res = await http()
        .get('/api/auth/google/callback?code=personal-tomas&state=falso')
        .set('Cookie', `${oidc}; ${sesion}`);
      expect(resultado(res)).toBe('fallo');
      expect(cookiesDe(res).some((c) => /^dc_sesion=;/.test(c))).toBe(false);
      expect(cuentas.cuentas.size).toBe(0);
    });

    it('una cuenta con correo no verificado por Google no prueba su propiedad', async () => {
      const res = await vincular(await sesionDe(app, 'tomas'), 'personal-no-verificada');
      expect(resultado(res)).toBe('no_verificada');
      expect(cuentas.cuentas.size).toBe(0);
    });

    it('una cuenta del dominio institucional no sirve como cuenta personal', async () => {
      const res = await vincular(await sesionDe(app, 'tomas'), 'personal-dominio-institucional');
      expect(resultado(res)).toBe('cuenta_institucional');
      expect(cuentas.cuentas.size).toBe(0);
    });

    it('la propia cuenta institucional no se acepta como personal', async () => {
      const sesion = await sesionDe(app, 'tomas');
      const res = await vincular(sesion, 'institucional-de-tomas');
      expect(resultado(res)).toBe('cuenta_institucional');
      expect(cuentas.cuentas.size).toBe(0);
    });

    it('quien no es alumno no puede iniciar la vinculación ni consultarla', async () => {
      const sesion = await sesionDe(app, 'benjamin'); // profesor
      const inicio = await http().get('/api/cuenta-personal/vincular').set('Cookie', sesion).expect(302);
      expect(inicio.headers.location).toBe('http://localhost:5173/?vinculacion=no_alumno');
      await perfil(sesion).expect(403);
    });

    it('una cookie de vinculación no sirve para iniciar sesión', async () => {
      const sesion = await sesionDe(app, 'tomas');
      const { state, oidc } = await iniciarVinculacion(sesion);
      // Aunque el código corresponda a una cuenta institucional habilitada, no se emite sesión.
      const res = await http().get(`/api/auth/google/callback?code=catalina&state=${state}`).set('Cookie', oidc!);
      expect(cookieSesion(res)).toBeUndefined();
      expect(resultado(res)).toBe('sesion_requerida');
    });

    it('Google muestra la selección de cuentas sin limitarla al dominio institucional', () => {
      const config = cargarConfig({
        SESSION_SECRET: 'secreto-de-prueba-con-mas-de-32-caracteres',
        APP_URL: 'http://localhost:5173',
        DOMINIOS_PERMITIDOS: 'ug.cl',
        GOOGLE_CLIENT_ID: 'cliente-de-prueba',
        GOOGLE_CLIENT_SECRET: 'secreto-de-prueba',
      });
      const google = new GoogleOidcAdapter(config);
      const login = new URL(google.urlAutorizacion('s', 'n'));
      const vinculacion = new URL(google.urlAutorizacion('s', 'n', { cuentaPersonal: true }));
      expect(login.searchParams.get('hd')).toBe('ug.cl');
      expect(vinculacion.searchParams.get('hd')).toBeNull();
      expect(vinculacion.searchParams.get('prompt')).toBe('select_account');
      expect(vinculacion.searchParams.get('redirect_uri')).toBe('http://localhost:5173/api/auth/google/callback');
    });
  });

  describe('CA2 · Una cuenta ya asociada a otra persona se rechaza', () => {
    it('la cuenta personal vinculada por un alumno no se asocia a otro', async () => {
      await vincular(await sesionDe(app, 'tomas'), 'personal-tomas');
      const catalina = await sesionDe(app, 'catalina');
      const res = await vincular(catalina, 'personal-tomas');
      expect(resultado(res)).toBe('cuenta_ocupada');
      expect((await perfil(catalina).expect(200)).body.cuentaPersonal).toBeNull();
      expect((await cuentas.obtener('u-tomas'))?.email).toBe('tomas.alcaino@example.invalid');
    });

    it('la cuenta institucional de otra persona se rechaza', async () => {
      const res = await vincular(await sesionDe(app, 'tomas'), 'institucional-de-diego');
      expect(resultado(res)).toBe('cuenta_ocupada');
      expect(cuentas.cuentas.size).toBe(0);
    });
  });

  describe('CA3 · La asociación persiste y se puede consultar desde mi perfil', () => {
    it('sin vinculación, el perfil lo informa', async () => {
      expect((await perfil(await sesionDe(app, 'tomas')).expect(200)).body).toEqual({ cuentaPersonal: null });
    });

    it('la asociación se mantiene en una sesión posterior', async () => {
      await vincular(await sesionDe(app, 'tomas'), 'personal-tomas');
      const nueva = await sesionDe(app, 'tomas');
      const { cuentaPersonal } = (await perfil(nueva).expect(200)).body;
      expect(cuentaPersonal.email).toBe('tomas.alcaino@example.invalid');
      expect(Number.isNaN(Date.parse(cuentaPersonal.verificadoEn))).toBe(false);
    });

    it('volver a vincular reemplaza la cuenta anterior de la misma persona', async () => {
      const sesion = await sesionDe(app, 'tomas');
      await vincular(sesion, 'personal-tomas');
      expect(resultado(await vincular(sesion, 'personal-tomas-nueva'))).toBe('vinculada');
      expect((await perfil(sesion).expect(200)).body.cuentaPersonal.email).toBe('tomas.nueva@example.invalid');
      // La cuenta liberada queda disponible y ya no identifica a Tomás.
      expect(resultado(await vincular(await sesionDe(app, 'catalina'), 'personal-tomas'))).toBe('vinculada');
    });

    it('el perfil sin sesión responde 401', async () => {
      await http().get('/api/cuenta-personal').expect(401);
    });

    it('cada alumno consulta solo su propia cuenta', async () => {
      await vincular(await sesionDe(app, 'tomas'), 'personal-tomas');
      const catalina = await sesionDe(app, 'catalina');
      // Un usuarioId enviado por el cliente se ignora: la persona sale de la sesión.
      const ajena = await http().get('/api/cuenta-personal?usuarioId=u-tomas').set('Cookie', catalina).expect(200);
      expect(ajena.body.cuentaPersonal).toBeNull();
    });
  });
});

// Reglas de la tabla cuenta_personal sobre PostgreSQL real (misma base dedicada que J1).
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('H43 · cuenta_personal en PostgreSQL', () => {
  let pool: Pool;
  let repo: PostgresCuentasPersonalesRepositorio;
  const esquema = 'test_' + randomUUID().replaceAll('-', '');
  let tomas: string, catalina: string;

  beforeAll(async () => {
    if (!new URL(url!).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en _test');
    const provision = new Pool({ connectionString: url });
    await provision.query('CREATE SCHEMA ' + esquema);
    await provision.end();
    pool = new Pool({ connectionString: url, options: '-c search_path=' + esquema + ',public', max: 5 });
    const dir = join(process.cwd(), 'db', 'migrations');
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await pool.query(readFileSync(join(dir, f), 'utf8'));
    repo = new PostgresCuentasPersonalesRepositorio(pool);
  }, 30000);
  afterAll(async () => {
    if (pool) {
      await pool.query('DROP SCHEMA IF EXISTS ' + esquema + ' CASCADE');
      await pool.end();
    }
  });
  beforeEach(async () => {
    tomas = randomUUID();
    catalina = randomUUID();
    await pool.query(
      `INSERT INTO usuario (id, email, google_sub) VALUES ($1::uuid, $2, $3), ($4::uuid, $5, NULL)`,
      [tomas, tomas + '@example.invalid', 'g-' + tomas, catalina, catalina + '@example.invalid'],
    );
  });

  it('CA3 · persiste la cuenta y la devuelve al consultar', async () => {
    expect(await repo.obtener(tomas)).toBeNull();
    expect(await repo.vincular(tomas, { sub: 'p-' + tomas, email: tomas + '@personal.invalid' })).toBe('VINCULADA');
    expect(await repo.obtener(tomas)).toMatchObject({ email: tomas + '@personal.invalid' });
  });

  it('CA2 · una cuenta de otra persona se rechaza, por sub o por correo', async () => {
    await repo.vincular(tomas, { sub: 'p-' + tomas, email: tomas + '@personal.invalid' });
    expect(await repo.vincular(catalina, { sub: 'p-' + tomas, email: 'otro-' + catalina + '@personal.invalid' })).toBe('OCUPADA');
    expect(await repo.vincular(catalina, { sub: 'p2-' + catalina, email: tomas + '@personal.invalid' })).toBe('OCUPADA');
    expect(await repo.obtener(catalina)).toBeNull();
  });

  it('CA2 · una cuenta institucional registrada no se vincula como personal', async () => {
    expect(await repo.vincular(catalina, { sub: 'g-' + tomas, email: 'x-' + catalina + '@personal.invalid' })).toBe('OCUPADA');
    expect(await repo.vincular(tomas, { sub: 'g-' + tomas, email: 'y-' + tomas + '@personal.invalid' })).toBe('INSTITUCIONAL');
  });

  it('CA2 · dos alumnos que vinculan la misma cuenta a la vez: solo uno la obtiene', async () => {
    const identidad = { sub: 'p-simultanea-' + tomas, email: 'simultanea-' + tomas + '@personal.invalid' };
    const resultados = await Promise.all([repo.vincular(tomas, identidad), repo.vincular(catalina, identidad)]);
    expect(resultados.sort()).toEqual(['OCUPADA', 'VINCULADA']);
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM cuenta_personal WHERE google_sub = $1', [identidad.sub]);
    expect(rows[0].n).toBe(1);
  });

  it('CA3 · la tabla exige correo en minúsculas y una sola cuenta por persona', async () => {
    await expect(pool.query(`INSERT INTO cuenta_personal (usuario_id, google_sub, email) VALUES ($1, 'p-x', 'Mayus@x.invalid')`, [tomas]))
      .rejects.toMatchObject({ code: '23514' });
    await repo.vincular(tomas, { sub: 'p-a-' + tomas, email: 'a-' + tomas + '@personal.invalid' });
    await repo.vincular(tomas, { sub: 'p-b-' + tomas, email: 'b-' + tomas + '@personal.invalid' });
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM cuenta_personal WHERE usuario_id = $1', [tomas]);
    expect(rows[0].n).toBe(1);
  });
});
