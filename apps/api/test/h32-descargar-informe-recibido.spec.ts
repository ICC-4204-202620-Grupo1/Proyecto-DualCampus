import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
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

describe.skipIf(!url)('H32 · Descargar un informe recibido (PostgreSQL con RLS)', () => {
  let pool: Pool, app: NestExpressApplication;
  const esquema = 'test_h32_' + randomUUID().replaceAll('-', '');

  let inst: string, otraInst: string;
  let admin: string, prof: string, ayudante: string, alumno1: string, alumno2: string, docenteAjeno: string;
  let seccion: string, actividad: string, entregaAlumno1Id: string;
  const contenidoOriginal = Buffer.from('Contenido del informe de Tomas - H32 prueba');

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

  const descargarEntrega = (u: string, entregaId: string, i = inst) =>
    http()
      .get(`/api/actividades/secciones/${seccion}/actividades/${actividad}/entregas/${entregaId}/descargar`)
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
          SESSION_SECRET: 'secreto-solo-pruebas-de-integracion-h32-123',
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

    const resEntrega = await entregar(alumno1, contenidoOriginal, 'informe_tomas.txt', 'text/plain').expect(201);
    entregaAlumno1Id = resEntrega.body.id;
  });

  it('CA1: el archivo descargado corresponde a la entrega seleccionada', async () => {
    // Profesor asignado descarga el informe
    const resProf = await descargarEntrega(prof, entregaAlumno1Id).expect(200);
    expect(resProf.headers['content-disposition']).toContain('informe_tomas.txt');
    expect(Buffer.isBuffer(resProf.body) ? resProf.body.equals(contenidoOriginal) : resProf.text === contenidoOriginal.toString()).toBe(true);

    // Ayudante asignado descarga el mismo informe
    const resAyudante = await descargarEntrega(ayudante, entregaAlumno1Id).expect(200);
    expect(resAyudante.headers['content-disposition']).toContain('informe_tomas.txt');
    expect(Buffer.isBuffer(resAyudante.body) ? resAyudante.body.equals(contenidoOriginal) : resAyudante.text === contenidoOriginal.toString()).toBe(true);
  });

  it('CA2: el alumno puede descargar solo su propia entrega', async () => {
    // Alumno 1 descarga su propia entrega
    const resAlumno1 = await descargarEntrega(alumno1, entregaAlumno1Id).expect(200);
    expect(resAlumno1.headers['content-disposition']).toContain('informe_tomas.txt');
    expect(Buffer.isBuffer(resAlumno1.body) ? resAlumno1.body.equals(contenidoOriginal) : resAlumno1.text === contenidoOriginal.toString()).toBe(true);
  });

  it('CA3: ni otro alumno ni un usuario ajeno obtienen el archivo', async () => {
    // Otro alumno intenta descargar la entrega de Tomás
    await descargarEntrega(alumno2, entregaAlumno1Id).expect(403);

    // Docente no asignado a la sección intenta descargar la entrega
    await descargarEntrega(docenteAjeno, entregaAlumno1Id).expect(403);

    // Solicitud no autenticada
    await http()
      .get(`/api/actividades/secciones/${seccion}/actividades/${actividad}/entregas/${entregaAlumno1Id}/descargar`)
      .expect(401);

    // Usuario en otra institución
    await descargarEntrega(prof, entregaAlumno1Id, otraInst).expect(403);
  });
});
