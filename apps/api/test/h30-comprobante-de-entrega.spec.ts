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
import { SesionService } from '../src/modules/autenticacion/sesion.service.js';
import type { Rol } from '../src/modules/autenticacion/usuario-sesion.js';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('H30 · Obtener comprobante de entrega (PostgreSQL con RLS)', () => {
  let pool: Pool, app: NestExpressApplication;
  const esquema = 'test_h30_' + randomUUID().replaceAll('-', '');

  let inst: string;
  let admin: string, prof: string, alumno1: string, alumno2: string;
  let seccion: string, actividad: string;

  const cookie = (usuarioId: string) =>
    'dc_sesion=' +
    app.get(SesionService).emitir({
      usuarioId,
      email: 'prueba@example.invalid',
      nombre: 'Prueba',
      institucionActivaId: inst,
      roles: [],
    });

  const http = () => request(app.getHttpServer());
  const listar = (u: string) =>
    http().get('/api/actividades/secciones/' + seccion).set('Cookie', cookie(u));
  const entregar = (u: string, contenido: Buffer, filename: string, contentType: string) =>
    http()
      .post('/api/actividades/secciones/' + seccion + '/actividades/' + actividad + '/entrega')
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
    const dir = join(process.cwd(), 'db', 'migrations');
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      await pool.query(readFileSync(join(dir, f), 'utf8'));
    }

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONFIG)
      .useValue(
        cargarConfig({
          SESSION_SECRET: 'secreto-solo-pruebas-de-integracion-h30-123',
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

    const crearUsuario = async (rol: Rol) => {
      const uid = randomUUID();
      await pool.query('INSERT INTO usuario(id,email,nombre) VALUES ($1,$2,$3)', [uid, uid + '@example.invalid', rol + ' demo']);
      await pool.query('INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,$3)', [uid, inst, rol]);
      return uid;
    };

    admin = await crearUsuario('ADMINISTRADOR');
    prof = await crearUsuario('PROFESOR');
    alumno1 = await crearUsuario('ALUMNO');
    alumno2 = await crearUsuario('ALUMNO');

    const periodo = (await http().post('/api/periodos').set('Cookie', cookie(admin))
      .send({ nombre: '2026-2', fechaInicio: '2026-08-01', fechaFin: '2026-12-20' }).expect(201)).body.id;
    const curso = (await http().post('/api/academico/cursos').set('Cookie', cookie(admin))
      .send({ periodoId: periodo, codigo: 'ICC-4204', nombre: 'Ingeniería de Software' }).expect(201)).body.id;
    seccion = (await http().post('/api/academico/secciones').set('Cookie', cookie(admin))
      .send({ periodoId: periodo, cursoId: curso, codigo: '01' }).expect(201)).body.id;
    await http().put('/api/academico/secciones/' + seccion + '/equipo').set('Cookie', cookie(admin))
      .send({ profesorId: prof, ayudanteIds: [] }).expect(200);
    await http().post('/api/academico/secciones/' + seccion + '/nomina').set('Cookie', cookie(admin))
      .send({ emails: [alumno1 + '@example.invalid', alumno2 + '@example.invalid'] }).expect(201);

    actividad = (await http().post('/api/actividades/secciones/' + seccion).set('Cookie', cookie(prof))
      .send({ titulo: 'Informe 1', instrucciones: 'Subir el informe en TXT' }).expect(201)).body.id;
    await http().put('/api/actividades/secciones/' + seccion + '/actividades/' + actividad + '/configuracion')
      .set('Cookie', cookie(prof))
      .send({
        aperturaEn: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        cierreEn: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        formatosPermitidos: ['txt'],
        tamanoMaximoMb: 1,
      })
      .expect(200);
  });

  it('CA1: un envío rechazado no genera comprobante', async () => {
    await entregar(alumno1, Buffer.alloc(0), 'tarea.txt', 'text/plain').expect(400);
    await entregar(alumno1, Buffer.from('no es png'), 'tarea.png', 'image/png').expect(400);
    await entregar(alumno1, Buffer.from([0xff, 0xfe, 0x00]), 'tarea.txt', 'text/plain').expect(400);
    const res = await listar(alumno1).expect(200);
    expect(res.body.actividades[0].comprobante).toBeNull();
  });

  it('CA2: el comprobante muestra archivo, actividad y fecha de recepción', async () => {
    const res = await entregar(alumno1, Buffer.from('mi tarea'), 'tarea.txt', 'text/plain').expect(201);
    expect(res.body.nombreArchivo).toBe('tarea.txt');
    expect(res.body.actividad).toBe('Informe 1');
    expect(Number.isFinite(new Date(res.body.recibidoEn).getTime())).toBe(true);
    expect(res.body).not.toHaveProperty('contenido');
  });

  it('CA3: al reabrir la actividad se consulta el mismo comprobante', async () => {
    const subida = await entregar(alumno1, Buffer.from('mi tarea'), 'tarea.txt', 'text/plain').expect(201);
    const c = (await listar(alumno1).expect(200)).body.actividades[0].comprobante;
    expect(c.id).toBe(subida.body.id);
    expect(c.nombreArchivo).toBe('tarea.txt');
    expect(c.tamanoBytes).toBe(8);
    expect(new Date(c.recibidoEn).getTime()).toBe(new Date(subida.body.recibidoEn).getTime());
    expect(c).not.toHaveProperty('contenido');
  });

  it('el comprobante es solo del alumno que entregó', async () => {
    await entregar(alumno1, Buffer.from('mi tarea'), 'tarea.txt', 'text/plain').expect(201);
    expect((await listar(alumno2).expect(200)).body.actividades[0].comprobante).toBeNull();
    expect((await listar(prof).expect(200)).body.actividades[0].comprobante).toBeNull();
  });
});
