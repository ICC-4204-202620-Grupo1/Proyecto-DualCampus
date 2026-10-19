/**
 * H16 · Registrar ausencias en borrador
 *
 * CA1. La ausencia se guarda como un estado distinto de cero.
 * CA2. El profesor ve la marca al revisar el borrador.
 * CA3. Solo profesor o ayudante asignado pueden modificarla.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';
import { CONFIG, cargarConfig } from '../src/config/config';
import { PG_POOL } from '../src/database/pg-pool.token';
import { SesionService } from '../src/modules/autenticacion/sesion.service';
import type { Rol } from '../src/modules/autenticacion/usuario-sesion';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('H16 · Registrar ausencias en borrador (PostgreSQL con RLS)', () => {
  let pool: Pool, app: NestExpressApplication;
  const esquema = 'test_h16_' + randomUUID().replaceAll('-', '');

  let inst: string;
  let admin: string, prof: string, ayudante: string;
  let alumno1: string, alumno2: string, ajeno: string;
  let seccion: string, evaluacion: string;

  const cookie = (usuarioId: string, institucionId = inst) =>
    'dc_sesion=' +
    app.get(SesionService).emitir({
      usuarioId,
      email: 'prueba@example.invalid',
      nombre: 'Prueba',
      institucionActivaId: institucionId,
      roles: [],
    });

  const get = (ruta: string, u = ayudante, i = inst) =>
    request(app.getHttpServer())
      .get('/api/' + ruta)
      .set('Cookie', cookie(u, i));

  const put = (ruta: string, datos: unknown, u = ayudante, i = inst) =>
    request(app.getHttpServer())
      .put('/api/' + ruta)
      .set('Cookie', cookie(u, i))
      .send(datos);

  beforeAll(async () => {
    if (!new URL(url!).pathname.endsWith('_test')) {
      throw new Error('TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en _test');
    }
    const provision = new Pool({ connectionString: url });
    await provision.query('CREATE SCHEMA ' + esquema);
    await provision.end();

    pool = new Pool({ connectionString: url, options: '-c search_path=' + esquema + ',public', max: 5 });
    const dir = join(process.cwd(), 'db', 'migrations');
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      await pool.query(readFileSync(join(dir, f), 'utf8'));
    }

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONFIG)
      .useValue(
        cargarConfig({
          SESSION_SECRET: 'secreto-solo-pruebas-de-integracion-h16-789',
          APP_URL: 'http://localhost:5173',
        }),
      )
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .compile();

    app = configurarApp(modulo.createNestApplication<NestExpressApplication>());
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (pool) {
      await pool.query('DROP SCHEMA IF EXISTS ' + esquema + ' CASCADE');
      if (app) await app.close();
      else await pool.end();
    }
  });

  beforeEach(async () => {
    inst = randomUUID();
    await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$2)', [inst, inst]);

    const crearUsuario = async (rol: Rol, i = inst) => {
      const uid = randomUUID();
      await pool.query('INSERT INTO usuario(id,email,nombre) VALUES ($1,$2,$3)', [uid, uid + '@example.invalid', rol + ' demo']);
      await pool.query('INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,$3)', [uid, i, rol]);
      return uid;
    };

    admin = await crearUsuario('ADMINISTRADOR');
    prof = await crearUsuario('PROFESOR');
    ayudante = await crearUsuario('AYUDANTE');
    alumno1 = await crearUsuario('ALUMNO');
    alumno2 = await crearUsuario('ALUMNO');
    ajeno = await crearUsuario('AYUDANTE');

    const pRes = await request(app.getHttpServer())
      .post('/api/periodos')
      .set('Cookie', cookie(admin))
      .send({ nombre: '2026-2', fechaInicio: '2026-08-01', fechaFin: '2026-12-20' });
    const periodo = pRes.body.id;

    const cRes = await request(app.getHttpServer())
      .post('/api/academico/cursos')
      .set('Cookie', cookie(admin))
      .send({ periodoId: periodo, codigo: 'ICC-4204', nombre: 'Ingeniería de Software' });
    const curso = cRes.body.id;

    const sRes = await request(app.getHttpServer())
      .post('/api/academico/secciones')
      .set('Cookie', cookie(admin))
      .send({ periodoId: periodo, cursoId: curso, codigo: '01' });
    seccion = sRes.body.id;

    await request(app.getHttpServer())
      .put('/api/academico/secciones/' + seccion + '/equipo')
      .set('Cookie', cookie(admin))
      .send({ profesorId: prof, ayudanteIds: [ayudante] });

    await request(app.getHttpServer())
      .post('/api/academico/secciones/' + seccion + '/nomina')
      .set('Cookie', cookie(admin))
      .send({ emails: [alumno1 + '@example.invalid', alumno2 + '@example.invalid'] });

    const evRes = await request(app.getHttpServer())
      .post('/api/calificaciones/secciones/' + seccion + '/evaluaciones')
      .set('Cookie', cookie(prof))
      .send({ nombre: 'Control 1', fecha: '2026-09-15', ponderacion: 20 });
    evaluacion = evRes.body.id;
  });

  it('CA1: La ausencia se guarda como un estado distinto de cero (valor NULL, no 0)', async () => {
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, esAusente: true }],
    }, ayudante).expect(200);

    // Verificar via API: esAusente=true y valor null (no cero)
    const res = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', ayudante).expect(200);
    const fila = res.body.filas.find((f: { alumnoId: string }) => f.alumnoId === alumno1);
    expect(fila.esAusente).toBe(true);
    // CA1: valor null, no cero
    expect(fila.valor).toBeNull();
  });

  it('CA1: La ausencia se recupera al reabrir la planilla', async () => {
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, esAusente: true }],
    }, ayudante).expect(200);

    const res = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', ayudante).expect(200);
    const fila = res.body.filas.find((f: { alumnoId: string }) => f.alumnoId === alumno1);
    expect(fila.esAusente).toBe(true);
    expect(fila.valor).toBeNull();
  });

  it('CA2: El profesor ve la marca de ausencia al revisar el borrador', async () => {
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, esAusente: true }],
    }, ayudante).expect(200);

    // El profesor consulta la planilla y ve esAusente=true
    const res = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', prof).expect(200);
    const fila = res.body.filas.find((f: { alumnoId: string }) => f.alumnoId === alumno1);
    expect(fila.esAusente).toBe(true);
  });

  it('CA2: La planilla distingue entre ausente y alumno sin calificar', async () => {
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, esAusente: true }],
    }, prof).expect(200);

    const res = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', prof).expect(200);
    const a1 = res.body.filas.find((f: { alumnoId: string }) => f.alumnoId === alumno1);
    const a2 = res.body.filas.find((f: { alumnoId: string }) => f.alumnoId === alumno2);
    expect(a1.esAusente).toBe(true);
    expect(a1.valor).toBeNull();
    // alumno2 no tiene registro → sin calificar (no ausente)
    expect(a2.esAusente).toBe(false);
    expect(a2.valor).toBeNull();
  });

  it('CA3: Un ayudante ajeno a la sección no puede registrar ausencias (403)', async () => {
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, esAusente: true }],
    }, ajeno).expect(403);
  });

  it('CA3: El alumno no puede modificar ausencias (403)', async () => {
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, esAusente: true }],
    }, alumno1).expect(403);
  });

  it('Se puede combinar nota de un alumno y ausencia de otro en un mismo guardado', async () => {
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [
        { alumnoId: alumno1, valor: 5.5 },
        { alumnoId: alumno2, esAusente: true },
      ],
    }, prof).expect(200);

    const res = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', prof).expect(200);
    const a1 = res.body.filas.find((f: { alumnoId: string }) => f.alumnoId === alumno1);
    const a2 = res.body.filas.find((f: { alumnoId: string }) => f.alumnoId === alumno2);
    expect(a1.valor).toBe(5.5);
    expect(a1.esAusente).toBe(false);
    expect(a2.esAusente).toBe(true);
    expect(a2.valor).toBeNull();
  });

  it('Si se envía esAusente=true con valor, el valor se descarta (ausencia tiene prioridad)', async () => {
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, valor: 3.0, esAusente: true }],
    }, ayudante).expect(200);

    // Verificar via API que el valor fue descartado y es_ausente es true
    const res = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', ayudante).expect(200);
    const fila = res.body.filas.find((f: { alumnoId: string }) => f.alumnoId === alumno1);
    expect(fila.esAusente).toBe(true);
    // Ausente siempre tiene valor null, no el 3.0 enviado
    expect(fila.valor).toBeNull();
  });
});
