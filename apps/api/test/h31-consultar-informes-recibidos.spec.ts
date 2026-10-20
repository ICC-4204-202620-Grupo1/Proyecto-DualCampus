import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/app.setup.js';
import { CONFIG, cargarConfig } from '../src/config/config.js';
import { PG_POOL } from '../src/database/pg-pool.token.js';
import { SesionService } from '../src/modules/autenticacion/sesion.service.js';
import type { Rol } from '../src/modules/autenticacion/usuario-sesion.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('H31 · Consultar informes recibidos (PostgreSQL con RLS)', () => {
  let pool: Pool, app: NestExpressApplication;
  const esquema = 'test_h31_' + randomUUID().replaceAll('-', '');

  let inst: string, otraInst: string;
  let admin: string, prof: string, ayudante: string, alumno1: string, alumno2: string, docenteAjeno: string;
  let seccion: string, actividad: string;

  const cookie = (usuarioId: string, institucionId = inst) =>
    'dc_sesion=' +
    app.get(SesionService).emitir({
      usuarioId,
      email: 'prueba@example.invalid',
      nombre: 'Prueba',
      institucionActivaId: institucionId,
      roles: [],
    });

  const http = () => request(app.getHttpServer());

  const consultarEntregasActividad = (u: string, i = inst) =>
    http()
      .get(`/api/actividades/secciones/${seccion}/actividades/${actividad}/entregas`)
      .set('Cookie', cookie(u, i));

  const consultarEntregasSeccion = (u: string, i = inst) =>
    http()
      .get(`/api/actividades/secciones/${seccion}/entregas`)
      .set('Cookie', cookie(u, i));

  const entregar = (u: string, contenido: Buffer, filename: string, contentType: string) =>
    http()
      .post(`/api/actividades/secciones/${seccion}/actividades/${actividad}/entrega`)
      .set('Cookie', cookie(u))
      .attach('archivo', contenido, { filename, contentType });

  beforeAll(async () => {
    if (!new URL(url!).pathname.endsWith('_test')) {
      throw new Error('TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en _test');
    }
    const provision = new Pool({ connectionString: url });
    await provision.query('CREATE SCHEMA ' + esquema);
    await provision.end();

    pool = new Pool({ connectionString: url, options: '-c search_path=' + esquema + ',public', max: 5 });
    const dir = existsSync(join(process.cwd(), 'db', 'migrations'))
      ? join(process.cwd(), 'db', 'migrations')
      : join(process.cwd(), 'apps', 'api', 'db', 'migrations');
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      await pool.query(readFileSync(join(dir, f), 'utf8'));
    }

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONFIG)
      .useValue(
        cargarConfig({
          SESSION_SECRET: 'secreto-solo-pruebas-de-integracion-h31-123',
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
    otraInst = randomUUID();
    await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$2),($3,$4)', [
      inst,
      'Institucion Demo ' + inst,
      otraInst,
      'Otra Institucion ' + otraInst,
    ]);

    const crearUsuario = async (rol: Rol, institucionId = inst, nombre = rol + ' demo') => {
      const uid = randomUUID();
      await pool.query('INSERT INTO usuario(id,email,nombre) VALUES ($1,$2,$3)', [
        uid,
        uid + '@example.invalid',
        nombre,
      ]);
      await pool.query('INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,$3)', [
        uid,
        institucionId,
        rol,
      ]);
      return uid;
    };

    admin = await crearUsuario('ADMINISTRADOR');
    prof = await crearUsuario('PROFESOR', inst, 'Javiera Profesora');
    ayudante = await crearUsuario('AYUDANTE', inst, 'Diego Ayudante');
    alumno1 = await crearUsuario('ALUMNO', inst, 'Tomas Alumno 1');
    alumno2 = await crearUsuario('ALUMNO', inst, 'Pedro Alumno 2');
    docenteAjeno = await crearUsuario('PROFESOR', inst, 'Profesor No Asignado');

    const periodo = (
      await http()
        .post('/api/periodos')
        .set('Cookie', cookie(admin))
        .send({ nombre: '2026-2', fechaInicio: '2026-08-01', fechaFin: '2026-12-20' })
        .expect(201)
    ).body.id;

    const curso = (
      await http()
        .post('/api/academico/cursos')
        .set('Cookie', cookie(admin))
        .send({ periodoId: periodo, codigo: 'ICC-4204', nombre: 'Ingeniería de Software' })
        .expect(201)
    ).body.id;

    seccion = (
      await http()
        .post('/api/academico/secciones')
        .set('Cookie', cookie(admin))
        .send({ periodoId: periodo, cursoId: curso, codigo: '01' })
        .expect(201)
    ).body.id;

    await http()
      .put('/api/academico/secciones/' + seccion + '/equipo')
      .set('Cookie', cookie(admin))
      .send({ profesorId: prof, ayudanteIds: [ayudante] })
      .expect(200);

    await http()
      .post('/api/academico/secciones/' + seccion + '/nomina')
      .set('Cookie', cookie(admin))
      .send({ emails: [alumno1 + '@example.invalid', alumno2 + '@example.invalid'] })
      .expect(201);

    actividad = (
      await http()
        .post('/api/actividades/secciones/' + seccion)
        .set('Cookie', cookie(prof))
        .send({ titulo: 'Informe 1', instrucciones: 'Subir el informe en TXT' })
        .expect(201)
    ).body.id;

    await http()
      .put(`/api/actividades/secciones/${seccion}/actividades/${actividad}/configuracion`)
      .set('Cookie', cookie(prof))
      .send({
        aperturaEn: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        cierreEn: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        formatosPermitidos: ['txt'],
        tamanoMaximoMb: 1,
      })
      .expect(200);
  });

  it('CA1: profesor y ayudante asignados ven autor, archivo y fecha', async () => {
    await entregar(alumno1, Buffer.from('informe alumno 1'), 'informe_tomas.txt', 'text/plain').expect(201);
    await entregar(alumno2, Buffer.from('informe alumno 2'), 'informe_pedro.txt', 'text/plain').expect(201);

    // Consulta del profesor asignado por actividad
    const resProf = await consultarEntregasActividad(prof).expect(200);
    expect(resProf.body).toHaveLength(2);
    expect(resProf.body[0]).toHaveProperty('autor');
    expect(resProf.body[0]).toHaveProperty('nombreArchivo');
    expect(resProf.body[0]).toHaveProperty('recibidoEn');
    expect(resProf.body[0]).not.toHaveProperty('contenido');

    const autores = resProf.body.map((e: { autor: string }) => e.autor);
    expect(autores).toContain('Tomas Alumno 1');
    expect(autores).toContain('Pedro Alumno 2');

    const archivos = resProf.body.map((e: { nombreArchivo: string }) => e.nombreArchivo);
    expect(archivos).toContain('informe_tomas.txt');
    expect(archivos).toContain('informe_pedro.txt');

    // Consulta del ayudante asignado por actividad
    const resAyudante = await consultarEntregasActividad(ayudante).expect(200);
    expect(resAyudante.body).toHaveLength(2);
    expect(resAyudante.body[0]).toHaveProperty('autor');
    expect(resAyudante.body[0]).toHaveProperty('nombreArchivo');
    expect(resAyudante.body[0]).toHaveProperty('recibidoEn');

    // Consulta a nivel de sección
    const resSeccion = await consultarEntregasSeccion(prof).expect(200);
    expect(resSeccion.body).toHaveLength(2);
    expect(resSeccion.body[0].actividadTitulo).toBe('Informe 1');
  });

  it('CA2: una sección sin entregas muestra ese estado', async () => {
    // Consulta sin entregas cargadas
    const resActividad = await consultarEntregasActividad(prof).expect(200);
    expect(resActividad.body).toEqual([]);

    const resSeccion = await consultarEntregasSeccion(prof).expect(200);
    expect(resSeccion.body).toEqual([]);
  });

  it('CA3: un docente no asignado no consulta la lista', async () => {
    await entregar(alumno1, Buffer.from('informe alumno 1'), 'informe.txt', 'text/plain').expect(201);

    // Docente de la misma institución pero no asignado a la sección
    await consultarEntregasActividad(docenteAjeno).expect(403);
    await consultarEntregasSeccion(docenteAjeno).expect(403);

    // Alumno matriculado tampoco puede ver la nómina de entregas de sus compañeros
    await consultarEntregasActividad(alumno1).expect(403);
    await consultarEntregasSeccion(alumno1).expect(403);

    // Solicitud sin autenticación
    await http().get(`/api/actividades/secciones/${seccion}/actividades/${actividad}/entregas`).expect(401);
    await http().get(`/api/actividades/secciones/${seccion}/entregas`).expect(401);

    // Docente en otra institución
    await consultarEntregasActividad(prof, otraInst).expect(403);
  });
});
