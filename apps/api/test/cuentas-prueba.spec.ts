/** Cuentas de prueba @testing.com sin contraseña: «Crear y probar usuarios» del login. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/app.setup.js';
import { CONFIG, cargarConfig } from '../src/config/config.js';
import { PG_POOL } from '../src/database/pg-pool.token.js';
import { cookieSesion } from './apoyo.js';

const SECRETO = 'secreto-solo-pruebas-cuentas-prueba-123456789';
const PRODUCCION = {
  NODE_ENV: 'production', SESSION_SECRET: SECRETO, APP_URL: 'https://campus.example.invalid',
  DATABASE_URL: 'postgres://no-se-usa', GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secreto', DOMINIOS_PERMITIDOS: 'ug.cl',
};

async function crearApp(env: NodeJS.ProcessEnv, pool: unknown) {
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CONFIG).useValue(cargarConfig(env))
    .overrideProvider(PG_POOL).useValue(pool)
    .compile();
  const app = configurarApp(modulo.createNestApplication<NestExpressApplication>());
  await app.init();
  return app;
}

describe('Cuentas de prueba · disponibilidad', () => {
  it('están disponibles también con la configuración de producción', async () => {
    const pool = { query: async () => ({ rows: [] }), connect: async () => { throw new Error('sin base'); }, end: async () => {} };
    const app = await crearApp(PRODUCCION, pool);
    try {
      const http = () => request(app.getHttpServer());
      expect((await http().get('/api/cuentas-prueba/opciones').expect(200)).body.dominio).toBe('@testing.com');
      // Responden (validación) en vez de 404; ninguna de estas peticiones llega a la base.
      await http().post('/api/cuentas-prueba').send({ usuario: 'ana maria', rol: 'ALUMNO' }).expect(400);
      const ingreso = await http().post('/api/cuentas-prueba/ingresar').send({ email: 'real@ug.cl' }).expect(403);
      expect(cookieSesion(ingreso)).toBeUndefined();
    } finally {
      await app.close();
    }
  });
});

// El alta escribe directamente en PostgreSQL: se prueba contra la base dedicada (igual que J1).
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('Cuentas de prueba · crear e ingresar (PostgreSQL)', () => {
  let pool: Pool;
  let app: NestExpressApplication;
  const esquema = 'test_' + randomUUID().replaceAll('-', '');
  let inst: string;
  let inactiva: string;

  beforeAll(async () => {
    if (!new URL(url!).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en _test');
    const provision = new Pool({ connectionString: url });
    await provision.query('CREATE SCHEMA ' + esquema);
    await provision.end();
    pool = new Pool({ connectionString: url, options: '-c search_path=' + esquema + ',public', max: 5 });
    const dir = join(process.cwd(), 'db', 'migrations');
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await pool.query(readFileSync(join(dir, f), 'utf8'));
    app = await crearApp({ SESSION_SECRET: SECRETO, APP_URL: 'http://localhost:5173' }, pool);
  }, 30000);
  afterAll(async () => {
    if (pool) {
      await pool.query('DROP SCHEMA IF EXISTS ' + esquema + ' CASCADE');
      if (app) await app.close(); else await pool.end();
    }
  });
  beforeEach(async () => {
    inst = randomUUID();
    inactiva = randomUUID();
    await pool.query('INSERT INTO institucion (id, nombre) VALUES ($1::uuid, $2)', [inst, 'Institución ' + inst]);
    await pool.query('INSERT INTO institucion (id, nombre, activa) VALUES ($1::uuid, $2, false)', [inactiva, 'Inactiva ' + inactiva]);
  });

  const http = () => request(app.getHttpServer());
  const unico = (prefijo: string) => `${prefijo}.${randomUUID().slice(0, 8)}`;
  const crear = (datos: Record<string, unknown>) => http().post('/api/cuentas-prueba').send(datos);
  async function ingresar(email: string) {
    const res = await http().post('/api/cuentas-prueba/ingresar').send({ email });
    return { res, cookie: cookieSesion(res)?.split(';')[0] };
  }

  it('entrega el dominio y los roles, del alumno al superadministrador', async () => {
    expect((await http().get('/api/cuentas-prueba/opciones').expect(200)).body).toEqual({
      dominio: '@testing.com',
      roles: ['ALUMNO', 'AYUDANTE', 'PROFESOR', 'DIRECTOR', 'ADMINISTRADOR', 'SUPERADMINISTRADOR'],
    });
  });

  it('lista solo instituciones activas para elegir', async () => {
    const ids = (await http().get('/api/cuentas-prueba/instituciones').expect(200)).body.map((i: { id: string }) => i.id);
    expect(ids).toContain(inst);
    expect(ids).not.toContain(inactiva);
  });

  it.each(['ALUMNO', 'AYUDANTE', 'PROFESOR', 'DIRECTOR', 'ADMINISTRADOR'])(
    'crea una cuenta %s sin administrador e ingresa con ella sin Google ni contraseña',
    async (rol) => {
      const usuario = unico(rol.toLowerCase());
      const creada = (await crear({ usuario, nombre: 'Prueba ' + rol, rol, institucionId: inst }).expect(201)).body;
      expect(creada).toEqual({ email: usuario + '@testing.com', nombre: 'Prueba ' + rol, rol, institucion: 'Institución ' + inst });

      const { res, cookie } = await ingresar(usuario + '@testing.com');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ email: usuario + '@testing.com', institucionActivaId: inst, esSuperadministrador: false });
      const contexto = await http().get('/api/sesion/contexto').set('Cookie', cookie!).expect(200);
      expect(contexto.body.roles).toEqual([rol]);
    },
  );

  it('crea un superadministrador sin institución, que accede a la administración global', async () => {
    const usuario = unico('super');
    expect((await crear({ usuario, rol: 'SUPERADMINISTRADOR' }).expect(201)).body.institucion).toBeNull();
    const { res, cookie } = await ingresar(usuario);
    expect(res.body).toMatchObject({ esSuperadministrador: true, roles: [], institucionActivaId: null });
    await http().get('/api/superadmin/instituciones').set('Cookie', cookie!).expect(200);
  });

  it('acepta el correo completo o solo el usuario, sin distinguir mayúsculas', async () => {
    const usuario = unico('ana');
    expect((await crear({ usuario: ` ${usuario.toUpperCase()}@Testing.com `, rol: 'ALUMNO', institucionId: inst }).expect(201)).body.email)
      .toBe(usuario + '@testing.com');
    expect((await ingresar(usuario.toUpperCase())).res.status).toBe(200);
  });

  it('sin nombre usa el usuario como nombre visible', async () => {
    const usuario = unico('sin-nombre');
    expect((await crear({ usuario, rol: 'ALUMNO', institucionId: inst }).expect(201)).body.nombre).toBe(usuario);
  });

  it('una cuenta que ya existe se rechaza', async () => {
    const usuario = unico('repetida');
    await crear({ usuario, rol: 'ALUMNO', institucionId: inst }).expect(201);
    const res = await crear({ usuario, rol: 'PROFESOR', institucionId: inst }).expect(409);
    expect(res.body.message).toContain(usuario + '@testing.com');
  });

  it.each([
    ['un usuario con espacios', { usuario: 'ana maria', rol: 'ALUMNO' }],
    ['un correo de otro dominio', { usuario: 'ana@gmail.com', rol: 'ALUMNO' }],
    ['un usuario vacío', { usuario: '', rol: 'ALUMNO' }],
    ['un rol inexistente', { usuario: 'ana', rol: 'RECTOR' }],
    ['un rol institucional sin institución', { usuario: 'ana', rol: 'PROFESOR' }],
  ])('rechaza %s', async (_, datos) => {
    await crear({ institucionId: datos.rol === 'PROFESOR' ? undefined : inst, ...datos }).expect(400);
  });

  it('una institución inactiva o inexistente no crea la cuenta', async () => {
    const usuario = unico('inactiva');
    await crear({ usuario, rol: 'ALUMNO', institucionId: inactiva }).expect(400);
    await crear({ usuario, rol: 'ALUMNO', institucionId: randomUUID() }).expect(400);
    const { rowCount } = await pool.query('SELECT 1 FROM usuario WHERE email = $1', [usuario + '@testing.com']);
    expect(rowCount).toBe(0);
  });

  it('no permite ingresar sin contraseña con una cuenta real, aunque exista y esté habilitada', async () => {
    const real = randomUUID();
    await pool.query('INSERT INTO usuario (id, email, nombre) VALUES ($1, $2, $3)', [real, `real.${real}@ug.cl`, 'Cuenta real']);
    await pool.query("INSERT INTO rol_en_institucion (usuario_id, institucion_id, rol) VALUES ($1, $2, 'ADMINISTRADOR')", [real, inst]);
    for (const email of [`real.${real}@ug.cl`, `real.${real}@ug.cl@testing.com`]) {
      const { res, cookie } = await ingresar(email);
      expect(res.status).toBe(403);
      expect(cookie).toBeUndefined();
    }
  });

  it('una cuenta de prueba inexistente o desactivada no obtiene sesión', async () => {
    expect((await ingresar(unico('nadie'))).res.status).toBe(403);
    const usuario = unico('desactivada');
    await crear({ usuario, rol: 'ALUMNO', institucionId: inst }).expect(201);
    await pool.query('UPDATE usuario SET activo = false WHERE email = $1', [usuario + '@testing.com']);
    const { res, cookie } = await ingresar(usuario);
    expect(res.status).toBe(403);
    expect(cookie).toBeUndefined();
  });

  it('el ingreso rechaza peticiones desde otro origen', async () => {
    const usuario = unico('origen');
    await crear({ usuario, rol: 'ALUMNO', institucionId: inst }).expect(201);
    await http().post('/api/cuentas-prueba/ingresar').set('Origin', 'https://otro.example.invalid').send({ email: usuario }).expect(403);
  });
});
