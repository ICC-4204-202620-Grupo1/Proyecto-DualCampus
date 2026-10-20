import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/app.setup.js';
import { CONFIG, cargarConfig } from '../src/config/config.js';
import { PG_POOL } from '../src/database/pg-pool.token.js';
import { SesionService } from '../src/modules/autenticacion/sesion.service.js';
import type { Rol } from '../src/modules/autenticacion/usuario-sesion.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('H14 · Crear una evaluación presencial (PostgreSQL con RLS)', () => {
  let pool: Pool, app: NestExpressApplication;
  const esquema = 'test_' + randomUUID().replaceAll('-', '');
  let inst: string, otra: string;
  let admin: string, prof: string, ayudante: string, alumno: string, ajeno: string;
  let periodo: string, curso: string, seccion: string;

  const cookie = (usuarioId: string, institucionId = inst) =>
    'dc_sesion=' +
    app.get(SesionService).emitir({
      usuarioId,
      email: 'prueba@example.invalid',
      nombre: 'Prueba',
      institucionActivaId: institucionId,
      roles: [],
    });

  const get = (ruta: string, u = admin, i = inst) =>
    request(app.getHttpServer())
      .get('/api/' + ruta)
      .set('Cookie', cookie(u, i));

  const post = (ruta: string, datos: unknown, u = prof, i = inst) =>
    request(app.getHttpServer())
      .post('/api/' + ruta)
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
          SESSION_SECRET: 'secreto-solo-pruebas-de-integracion-123456789',
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
    otra = randomUUID();
    await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$3),($2,$4)', [inst, otra, inst, otra]);

    const crearUsuario = async (rol: Rol, i = inst) => {
      const uid = randomUUID();
      await pool.query('INSERT INTO usuario(id,email,nombre) VALUES ($1,$2,$3)', [uid, uid + '@example.invalid', rol + ' demo']);
      await pool.query('INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,$3)', [uid, i, rol]);
      return uid;
    };

    admin = await crearUsuario('ADMINISTRADOR');
    prof = await crearUsuario('PROFESOR');
    ayudante = await crearUsuario('AYUDANTE');
    alumno = await crearUsuario('ALUMNO');
    ajeno = await crearUsuario('PROFESOR');

    // Crear período, curso y sección con el admin
    const pRes = await request(app.getHttpServer())
      .post('/api/periodos')
      .set('Cookie', cookie(admin))
      .send({ nombre: '2026-2', fechaInicio: '2026-08-01', fechaFin: '2026-12-20' });
    periodo = pRes.body.id;

    const cRes = await request(app.getHttpServer())
      .post('/api/academico/cursos')
      .set('Cookie', cookie(admin))
      .send({ periodoId: periodo, codigo: 'ICC-4204', nombre: 'Ingeniería de Software' });
    curso = cRes.body.id;

    const sRes = await request(app.getHttpServer())
      .post('/api/academico/secciones')
      .set('Cookie', cookie(admin))
      .send({ periodoId: periodo, cursoId: curso, codigo: '01' });
    seccion = sRes.body.id;

    // Asignar al profesor y al ayudante a la sección
    await request(app.getHttpServer())
      .put('/api/academico/secciones/' + seccion + '/equipo')
      .set('Cookie', cookie(admin))
      .send({ profesorId: prof, ayudanteIds: [ayudante] });

    // Matricular al alumno
    await request(app.getHttpServer())
      .post('/api/academico/secciones/' + seccion + '/nomina')
      .set('Cookie', cookie(admin))
      .send({ emails: [alumno + '@example.invalid'] });
  });

  it('CA1: Profesor asignado crea una evaluación con nombre y fecha válidos', async () => {
    const res = await post('calificaciones/secciones/' + seccion + '/evaluaciones', {
      nombre: 'Control 1',
      fecha: '2026-09-15',
      ponderacion: 20,
    }, prof).expect(201);

    expect(res.body).toMatchObject({
      nombre: 'Control 1',
      fecha: '2026-09-15',
      ponderacion: '20.00',
      estado: 'BORRADOR',
    });

    // CA3: Usa escala definida para la institución (1.0 a 7.0, aprobación 4.0)
    expect(res.body.escalaMinima).toBe('1.0');
    expect(res.body.escalaMaxima).toBe('7.0');
    expect(res.body.escalaAprobacion).toBe('4.0');
  });

  it('CA2: El ayudante asignado NO puede crear evaluaciones (403 Forbidden)', async () => {
    const res = await post('calificaciones/secciones/' + seccion + '/evaluaciones', {
      nombre: 'Control 2',
      fecha: '2026-09-22',
      ponderacion: 15,
    }, ayudante).expect(403);

    expect(res.body.message).toContain('Los ayudantes no tienen permiso para crear evaluaciones');
  });

  it('Un profesor ajeno a la sección no puede crear evaluaciones (403 Forbidden)', async () => {
    await post('calificaciones/secciones/' + seccion + '/evaluaciones', {
      nombre: 'Control 3',
      fecha: '2026-10-01',
    }, ajeno).expect(403);
  });

  it('Un alumno no puede crear evaluaciones (403 Forbidden)', async () => {
    await post('calificaciones/secciones/' + seccion + '/evaluaciones', {
      nombre: 'Control Alumno',
      fecha: '2026-10-01',
    }, alumno).expect(403);
  });

  it('El administrador puede crear evaluaciones en la sección', async () => {
    const res = await post('calificaciones/secciones/' + seccion + '/evaluaciones', {
      nombre: 'Examen Final',
      fecha: '2026-12-10',
      ponderacion: 30,
    }, admin).expect(201);

    expect(res.body.nombre).toBe('Examen Final');
  });

  it('Rechaza evaluaciones con datos inválidos o ponderación incorrecta', async () => {
    // Sin nombre
    await post('calificaciones/secciones/' + seccion + '/evaluaciones', {
      nombre: '',
      fecha: '2026-09-15',
    }, prof).expect(400);

    // Fecha con formato inválido
    await post('calificaciones/secciones/' + seccion + '/evaluaciones', {
      nombre: 'Solemne 1',
      fecha: '15-09-2026',
    }, prof).expect(400);

    // Ponderación negativa
    await post('calificaciones/secciones/' + seccion + '/evaluaciones', {
      nombre: 'Solemne 1',
      fecha: '2026-09-15',
      ponderacion: -5,
    }, prof).expect(400);

    // Ponderación mayor a 100
    await post('calificaciones/secciones/' + seccion + '/evaluaciones', {
      nombre: 'Solemne 1',
      fecha: '2026-09-15',
      ponderacion: 105,
    }, prof).expect(400);
  });

  it('Rechaza nombres duplicados en la misma sección (409 Conflict)', async () => {
    await post('calificaciones/secciones/' + seccion + '/evaluaciones', {
      nombre: 'Solemne 1',
      fecha: '2026-09-15',
    }, prof).expect(201);

    await post('calificaciones/secciones/' + seccion + '/evaluaciones', {
      nombre: '  solemne 1  ',
      fecha: '2026-09-20',
    }, prof).expect(409);
  });

  it('Lista las evaluaciones de la sección en orden de fecha', async () => {
    await post('calificaciones/secciones/' + seccion + '/evaluaciones', {
      nombre: 'Solemne 2',
      fecha: '2026-11-15',
    }, prof).expect(201);

    await post('calificaciones/secciones/' + seccion + '/evaluaciones', {
      nombre: 'Solemne 1',
      fecha: '2026-09-15',
    }, prof).expect(201);

    const res = await get('calificaciones/secciones/' + seccion + '/evaluaciones', prof).expect(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].nombre).toBe('Solemne 1');
    expect(res.body[1].nombre).toBe('Solemne 2');
  });

  it('Aislamiento RLS: Otra institución no ve ni puede crear evaluaciones en la sección', async () => {
    await post('calificaciones/secciones/' + seccion + '/evaluaciones', {
      nombre: 'Control 1',
      fecha: '2026-09-15',
    }, prof).expect(201);

    // Intentar listar desde otra institución devuelve 403 o sección no encontrada
    await get('calificaciones/secciones/' + seccion + '/evaluaciones', admin, otra).expect(403);
  });
});
