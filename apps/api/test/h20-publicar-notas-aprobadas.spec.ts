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
import { ContextoInstitucion } from '../src/database/contexto-institucion';
import { PG_POOL } from '../src/database/pg-pool.token';
import { SesionService } from '../src/modules/autenticacion/sesion.service';
import type { Rol } from '../src/modules/autenticacion/usuario-sesion';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('H20 · Publicar notas aprobadas (PostgreSQL con RLS)', () => {
  let pool: Pool, app: NestExpressApplication;
  const esquema = 'test_h20_' + randomUUID().replaceAll('-', '');

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

  const devolver = (observacion: unknown = 'Corregir la nota del control', u = prof, i = inst) =>
    request(app.getHttpServer()).post('/api/calificaciones/evaluaciones/' + evaluacion + '/devolver')
      .set('Cookie', cookie(u, i)).send({ observacion });

  async function enviar() {
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, valor: 5.5 }, { alumnoId: alumno2, esAusente: true }],
    }).expect(200);
    await request(app.getHttpServer()).post('/api/calificaciones/evaluaciones/' + evaluacion + '/enviar-revision')
      .set('Cookie', cookie(ayudante)).send({}).expect(201);
  }

  const publicar = (u = prof, i = inst) => request(app.getHttpServer())
    .post('/api/calificaciones/evaluaciones/' + evaluacion + '/publicar')
    .set('Cookie', cookie(u, i)).send({});

  it('CA1/CA2: profesor asignado publica y conserva autor y fecha al reabrir', async () => {
    await enviar();
    const res = await publicar().expect(201);
    expect(res.body.estado).toBe('PUBLICADA');
    expect(res.body.publicadoPor).toBe(prof);
    expect(Number.isNaN(Date.parse(res.body.publicadoEn))).toBe(false);
    const lectura = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', prof).expect(200);
    expect(lectura.body.evaluacion.publicadoEn).toBe(res.body.publicadoEn);
    expect(lectura.body.evaluacion.publicadoPor).toBe(prof);
    expect(lectura.body.evaluacion.puedePublicar).toBe(true);
    await publicar().expect(409);
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', { notas: [{ alumnoId: alumno1, valor: 7 }] }, prof).expect(409);
    await devolver().expect(409);
  });

  it('CA3: deniega ayudante, alumno, administrador sin asignación y profesor ajeno', async () => {
    await enviar();
    await publicar(ayudante).expect(403);
    await publicar(alumno1).expect(403);
    await publicar(admin).expect(403);
    await pool.query("INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,'PROFESOR')", [ajeno, inst]);
    await publicar(ajeno).expect(403);
    const lectura = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', admin).expect(200);
    expect(lectura.body.evaluacion.puedePublicar).toBe(false);
  });

  it('CA1: rechaza BORRADOR y DEVUELTA', async () => {
    await publicar().expect(409);
    await enviar();
    await devolver().expect(201);
    await publicar().expect(409);
  });

  it('solo expone la nota propia publicada y oculta observaciones docentes', async () => {
    await enviar();
    await get('calificaciones/evaluaciones/' + evaluacion + '/notas', alumno1).expect(403);
    await publicar().expect(201);
    const res = await get('calificaciones/evaluaciones/' + evaluacion + '/notas?alumnoId=' + alumno2, alumno1).expect(200);
    expect(res.body.filas).toHaveLength(1);
    expect(res.body.filas[0].alumnoId).toBe(alumno1);
    expect(res.body.filas[0].valor).toBe(5.5);
    expect(res.body.evaluacion.observacion).toBeNull();
    expect(res.body.evaluacion.puedePublicar).toBe(false);
    const ausente = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', alumno2).expect(200);
    expect(ausente.body.filas[0].esAusente).toBe(true);
    expect(ausente.body.filas[0].valor).toBeNull();
  });

  it('aísla la evaluación de otra institución', async () => {
    const otra = randomUUID();
    await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$2)', [otra, otra]);
    await pool.query("INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,'PROFESOR')", [prof, otra]);
    await publicar(prof, otra).expect(404);
  });

  it('revalida alumnos incorporados después del envío', async () => {
    await enviar();
    const nuevo = randomUUID();
    await pool.query('INSERT INTO usuario(id,email) VALUES ($1,$2)', [nuevo, nuevo+'@example.invalid']);
    await pool.query("INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,'ALUMNO')", [nuevo, inst]);
    await app.get(ContextoInstitucion).ejecutar(inst, db => db.query(
      'INSERT INTO matricula(institucion_id,seccion_id,usuario_id) VALUES ($1,$2,$3)', [inst,seccion,nuevo],
    ));
    await publicar().expect(400);
    const lectura = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', prof).expect(200);
    expect(lectura.body.evaluacion.estado).toBe('EN_REVISION');
    expect(lectura.body.evaluacion.publicadoEn).toBeNull();
  });

  it('dos publicaciones simultáneas generan un solo evento', async () => {
    await enviar();
    const res = await Promise.all([publicar(), publicar()]);
    expect(res.map(r => r.status).sort()).toEqual([201,409]);
    const eventos = await app.get(ContextoInstitucion).ejecutar(inst, db => db.query(
      "SELECT count(*)::int AS total FROM evento_academico WHERE recurso_id=$1 AND accion='PUBLICAR_EVALUACION'", [evaluacion],
    ));
    expect(eventos.rows[0].total).toBe(1);
  });
});
