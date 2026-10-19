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

describe.skipIf(!url)('H18 · Devolver evaluación observada (PostgreSQL con RLS)', () => {
  let pool: Pool, app: NestExpressApplication;
  const esquema = 'test_h18_' + randomUUID().replaceAll('-', '');

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

  it('CA1: exige comentario válido y conserva EN_REVISION si se rechaza', async () => {
    await enviar();
    for (const valor of ['', '   ', null, 123, 'a'.repeat(2001)]) await devolver(valor).expect(400);
    const res = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', prof).expect(200);
    expect(res.body.evaluacion.estado).toBe('EN_REVISION');
    expect(res.body.evaluacion.observacion).toBeNull();
  });

  it('CA1/CA2: profesor devuelve, conserva autor/fecha y ayudante corrige al reabrir', async () => {
    await enviar();
    const res = await devolver('  Revisar ausencia del segundo alumno  ').expect(201);
    expect(res.body.estado).toBe('DEVUELTA');
    expect(res.body.observacion).toBe('Revisar ausencia del segundo alumno');
    expect(res.body.devueltoPor).toBe(prof);
    expect(Number.isNaN(Date.parse(res.body.devueltoEn))).toBe(false);
    const lectura = await get('calificaciones/evaluaciones/' + evaluacion + '/notas').expect(200);
    expect(lectura.body.evaluacion.observacion).toBe(res.body.observacion);
    expect(lectura.body.evaluacion.devueltoEn).toBe(res.body.devueltoEn);
    expect(lectura.body.evaluacion.puedeDevolver).toBe(false);
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno2, valor: 6.2, esAusente: false }],
    }).expect(200);
    const corregida = await get('calificaciones/evaluaciones/' + evaluacion + '/notas').expect(200);
    expect(corregida.body.evaluacion.estado).toBe('DEVUELTA');
    expect(corregida.body.evaluacion.observacion).toBe(res.body.observacion);
    const fila = corregida.body.filas.find((f: { alumnoId: string }) => f.alumnoId === alumno2);
    expect(fila.valor).toBe(6.2);
    expect(fila.esAusente).toBe(false);
  });

  it('CA3: el alumno no consulta notas ni modifica una devolución', async () => {
    await enviar();
    await devolver().expect(201);
    await get('calificaciones/evaluaciones/' + evaluacion + '/notas', alumno1).expect(403);
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, valor: 7 }],
    }, alumno1).expect(403);
    await devolver('Comentario', alumno1).expect(403);
  });

  it('deniega ayudante y profesor ajeno, incluso con rol profesor institucional', async () => {
    await enviar();
    await devolver('Comentario', ayudante).expect(403);
    await pool.query("INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,'PROFESOR')", [ajeno, inst]);
    await devolver('Comentario', ajeno).expect(403);
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', { notas: [{ alumnoId: alumno1, valor: 7 }] }, prof).expect(409);
    await devolver().expect(201);
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', { notas: [{ alumnoId: alumno1, valor: 7 }] }, ajeno).expect(403);
  });

  it('administrador puede devolver; BORRADOR, DEVUELTA y PUBLICADA no admiten devolución', async () => {
    await devolver().expect(409);
    await enviar();
    await devolver('Revisar', admin).expect(201);
    await devolver().expect(409);
    await app.get(ContextoInstitucion).ejecutar(inst, db => db.query("UPDATE evaluacion SET estado='PUBLICADA' WHERE id=$1", [evaluacion]));
    await devolver().expect(409);
  });

  it('aísla la evaluación de otra institución', async () => {
    const otra = randomUUID();
    await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$2)', [otra, otra]);
    await pool.query("INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,'PROFESOR')", [prof, otra]);
    await devolver('Comentario', prof, otra).expect(404);
  });

  it('dos devoluciones simultáneas conservan un solo comentario y evento', async () => {
    await enviar();
    const res = await Promise.all([devolver('Primera'), devolver('Segunda')]);
    expect(res.map(r => r.status).sort()).toEqual([201, 409]);
    const eventos = await app.get(ContextoInstitucion).ejecutar(inst, db => db.query(
      "SELECT datos FROM evento_academico WHERE recurso_id=$1 AND accion='DEVOLVER_EVALUACION'", [evaluacion],
    ));
    expect(eventos.rowCount).toBe(1);
    expect(eventos.rows[0].datos.observacion).toBe(res.find(r => r.status === 201)!.body.observacion);
  });
});
