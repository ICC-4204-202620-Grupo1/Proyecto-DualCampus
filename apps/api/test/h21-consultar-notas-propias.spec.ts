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
import { ContextoInstitucion } from '../src/database/contexto-institucion.js';
import { PG_POOL } from '../src/database/pg-pool.token.js';
import { SesionService } from '../src/modules/autenticacion/sesion.service.js';
import type { Rol } from '../src/modules/autenticacion/usuario-sesion.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('H21 · Consultar notas propias (PostgreSQL con RLS)', () => {
  let pool: Pool, app: NestExpressApplication;
  const esquema = 'test_h21_' + randomUUID().replaceAll('-', '');

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

  const propias = (u = alumno1, i = inst, extra = '') => get('calificaciones/secciones/' + seccion + '/mis-notas' + extra, u, i);

  it('CA1: muestra solo nota propia publicada, evaluación y fecha', async () => {
    await enviar(); await publicar().expect(201);
    const res = await propias().expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nombre).toBe('Control 1');
    expect(res.body[0].valor).toBe(5.5);
    expect(res.body[0].esAusente).toBe(false);
    expect(res.body[0].publicadoEn).toBeTruthy();
    expect(res.body[0]).not.toHaveProperty('email');
    expect(res.body[0]).not.toHaveProperty('observacion');
    const ausente = await propias(alumno2).expect(200);
    expect(ausente.body[0].esAusente).toBe(true);
    expect(ausente.body[0].valor).toBeNull();
  });

  it('CA2: oculta BORRADOR, EN_REVISION y DEVUELTA incluso en listado heredado', async () => {
    for (const estado of ['BORRADOR','EN_REVISION','DEVUELTA']) {
      await app.get(ContextoInstitucion).ejecutar(inst, db => db.query('UPDATE evaluacion SET estado=$2 WHERE id=$1', [evaluacion,estado]));
      expect((await propias().expect(200)).body).toEqual([]);
      const listado = await get('calificaciones/secciones/' + seccion + '/evaluaciones', alumno1).expect(200);
      expect(listado.body).toEqual([]);
      await get('calificaciones/evaluaciones/' + evaluacion + '/notas', alumno1).expect(403);
    }
    const docente = await get('calificaciones/secciones/' + seccion + '/evaluaciones', prof).expect(200);
    expect(docente.body).toHaveLength(1);
  });

  it('CA3: identificadores de otro alumno no cambian la identidad de la sesión', async () => {
    await enviar(); await publicar().expect(201);
    const res = await propias(alumno1, inst, '?alumnoId=' + alumno2 + '&usuarioId=' + alumno2).expect(200);
    expect(res.body[0].valor).toBe(5.5);
    expect(res.body[0].esAusente).toBe(false);
    const heredada = await get('calificaciones/evaluaciones/' + evaluacion + '/notas?alumnoId=' + alumno2, alumno1).expect(200);
    expect(heredada.body.filas).toHaveLength(1);
    expect(heredada.body.filas[0].alumnoId).toBe(alumno1);
  });

  it('rechaza alumnos no inscritos, roles docentes e identificadores inválidos', async () => {
    await pool.query("INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,'ALUMNO')", [ajeno,inst]);
    await propias(ajeno).expect(403);
    await propias(prof).expect(403);
    await get('calificaciones/secciones/no-es-uuid/mis-notas', alumno1).expect(400);
    await request(app.getHttpServer()).get('/api/calificaciones/secciones/' + seccion + '/mis-notas').expect(401);
  });

  it('aísla datos de otras instituciones', async () => {
    const otra = randomUUID();
    await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$2)', [otra,otra]);
    await pool.query("INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,'ALUMNO')", [alumno1,otra]);
    await propias(alumno1,otra).expect(403);
  });
});
