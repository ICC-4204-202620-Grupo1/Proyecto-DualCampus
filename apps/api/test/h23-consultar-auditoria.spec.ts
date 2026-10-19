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

describe.skipIf(!url)('H23 · Consultar auditoría de calificaciones (PostgreSQL con RLS)', () => {
  let pool: Pool, app: NestExpressApplication;
  const esquema = 'test_h23_' + randomUUID().replaceAll('-', '');

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

  const historial = (u = admin, i = inst) => get('calificaciones/evaluaciones/' + evaluacion + '/auditoria', u, i);

  it('CA1: recupera creación heredada, guardado, envío, devolución, reenvío y publicación con autor/fecha', async () => {
    await enviar(); await devolver('Revisar ausencia').expect(201);
    await request(app.getHttpServer()).post('/api/calificaciones/evaluaciones/' + evaluacion + '/reenviar-revision')
      .set('Cookie', cookie(ayudante)).send({}).expect(201);
    await publicar().expect(201);
    const res = await historial().expect(200);
    const acciones = res.body.map((e: { accion: string }) => e.accion);
    expect(acciones).toEqual(['CREAR_EVALUACION','GUARDAR_NOTAS_BORRADOR','ENVIAR_A_REVISION','DEVOLVER_EVALUACION','REENVIAR_A_REVISION','PUBLICAR_EVALUACION']);
    for (const evento of res.body) {
      expect(evento.autor).toBeTruthy();
      expect(Number.isNaN(Date.parse(evento.fecha))).toBe(false);
    }
    expect(res.body.find((e: { accion: string }) => e.accion === 'DEVOLVER_EVALUACION').datos.observacion).toBe('Revisar ausencia');
  });

  it('CA2: no ofrece escritura y la base impide modificar o eliminar eventos', async () => {
    const antes = await historial().expect(200);
    const ruta = '/api/calificaciones/evaluaciones/' + evaluacion + '/auditoria';
    await request(app.getHttpServer()).put(ruta).set('Cookie',cookie(admin)).send({}).expect(404);
    await request(app.getHttpServer()).delete(ruta).set('Cookie',cookie(admin)).send({}).expect(404);
    for (const sentencia of ['UPDATE evento_academico SET accion=accion WHERE id=$1','DELETE FROM evento_academico WHERE id=$1']) {
      await expect(app.get(ContextoInstitucion).ejecutar(inst, db => db.query(sentencia,[antes.body[0].id]))).rejects.toThrow('La bitácora es de solo lectura');
    }
    expect((await historial().expect(200)).body).toEqual(antes.body);
  });

  it('CA3: muestra antecedentes de corrección sin modificar el evento previo', async () => {
    const antes = await historial().expect(200);
    // Evento sintético: H22 aún no implementa la operación de corregir notas publicadas.
    await app.get(ContextoInstitucion).ejecutar(inst, db => db.query(
      "INSERT INTO evento_academico(institucion_id,actor_id,recurso_id,accion,datos) VALUES ($1,$2,$3,'CORREGIR_NOTA_PUBLICADA',$4)",
      [inst,admin,evaluacion,JSON.stringify({valorPrevio:5.5,valorNuevo:6.0,motivo:'Solicitud formal',referencia:'DEMO-001'})],
    ));
    const despues = await historial().expect(200);
    expect(despues.body).toHaveLength(2);
    expect(despues.body[0]).toEqual(antes.body[0]);
    expect(despues.body[1].datos).toEqual({valorPrevio:5.5,valorNuevo:6,motivo:'Solicitud formal',referencia:'DEMO-001'});
  });

  it('solo administrador: rechaza profesor, ayudante, alumno y solicitudes sin sesión', async () => {
    for (const u of [prof,ayudante,alumno1]) await historial(u).expect(403);
    await request(app.getHttpServer()).get('/api/calificaciones/evaluaciones/' + evaluacion + '/auditoria').expect(401);
  });

  it('no mezcla creación de otra evaluación de la misma sección', async () => {
    await request(app.getHttpServer()).post('/api/calificaciones/secciones/' + seccion + '/evaluaciones')
      .set('Cookie',cookie(prof)).send({nombre:'Otra evaluación',fecha:'2026-10-20'}).expect(201);
    const res = await historial().expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].datos.evaluacionId).toBe(evaluacion);
  });

  it('aísla instituciones y rechaza evaluaciones inexistentes o IDs inválidos', async () => {
    const otra = randomUUID();
    await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$2)', [otra,otra]);
    await pool.query("INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,'ADMINISTRADOR')", [admin,otra]);
    await historial(admin,otra).expect(404);
    await get('calificaciones/evaluaciones/' + randomUUID() + '/auditoria',admin).expect(404);
    await get('calificaciones/evaluaciones/invalido/auditoria',admin).expect(400);
  });
});
