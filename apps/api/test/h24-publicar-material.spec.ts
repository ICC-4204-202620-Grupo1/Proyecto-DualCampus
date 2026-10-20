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

describe.skipIf(!url)('H24 · Publicar material de curso (PostgreSQL con RLS)', () => {
  let pool: Pool, app: NestExpressApplication;
  const esquema = 'test_h24_' + randomUUID().replaceAll('-', '');

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

  const documento = (extra: Record<string,unknown> = {}) => ({
    titulo:'Guía de estudio',nombreArchivo:'guia.txt',tipo:'text/plain',
    contenidoBase64:Buffer.from('Contenido sintético de prueba').toString('base64'),...extra,
  });
  const subir = (datos = documento(), u = prof, i = inst) => request(app.getHttpServer())
    .post('/api/materiales/secciones/' + seccion).set('Cookie',cookie(u,i)).send(datos);
  const listar = (u = prof, i = inst) => get('materiales/secciones/' + seccion,u,i);

  it('CA1: persiste contenido y metadatos antes de mostrarlo; acepta carga mayor de 100 KB', async () => {
    const contenido = Buffer.alloc(150000,'a');
    const res = await subir(documento({contenidoBase64:contenido.toString('base64')})).expect(201);
    const lista = await listar(alumno1).expect(200);
    expect(lista.body.puedePublicar).toBe(false);
    expect(lista.body.materiales).toHaveLength(1);
    expect(lista.body.materiales[0].id).toBe(res.body.id);
    expect(lista.body.materiales[0].tamano).toBe(150000);
    expect(lista.body.materiales[0]).not.toHaveProperty('contenido');
    const almacenado = await app.get(ContextoInstitucion).ejecutar(inst, db => db.query('SELECT contenido FROM material_curso WHERE id=$1',[res.body.id]));
    expect(almacenado.rows[0].contenido.equals(contenido)).toBe(true);
  });

  it('CA2: rechaza archivo vacío, extensión no permitida, MIME discordante, PDF falso y TXT binario', async () => {
    for (const extra of [
      {contenidoBase64:''},{nombreArchivo:'archivo.exe'}, {tipo:'image/png'},
      {nombreArchivo:'guia.pdf',tipo:'application/pdf'}, {contenidoBase64:Buffer.from([0xff,0x00]).toString('base64')},
      {contenidoBase64:'***'}, {titulo:'   '}, {nombreArchivo:'../guia.txt'},
    ]) await subir(documento(extra)).expect(400);
    expect((await listar().expect(200)).body.materiales).toEqual([]);
  });

  it('CA2: rechaza sobre 1 MB, acepta el límite y responde 413 al exceder el cuerpo HTTP', async () => {
    await subir(documento({contenidoBase64:Buffer.alloc(1048577,'a').toString('base64')})).expect(400);
    await subir(documento({contenidoBase64:Buffer.alloc(1048576,'a').toString('base64')})).expect(201);
    await subir(documento({contenidoBase64:'a'.repeat(1600000)})).expect(413);
    expect((await listar().expect(200)).body.materiales).toHaveLength(1);
  });

  it('CA3: deniega ayudante, alumno, administrador y profesor ajeno', async () => {
    for (const u of [ayudante,alumno1,admin]) await subir(documento(),u).expect(403);
    await pool.query("INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,'PROFESOR')",[ajeno,inst]);
    await subir(documento(),ajeno).expect(403);
    await listar(ajeno).expect(403);
    expect((await listar().expect(200)).body.puedePublicar).toBe(true);
    expect((await listar(admin).expect(200)).body.puedePublicar).toBe(false);
    await request(app.getHttpServer()).post('/api/materiales/secciones/' + seccion).send(documento()).expect(401);
  });

  it('CA1: falla la transacción sin dejar material ni evento publicado', async () => {
    await pool.query("ALTER TABLE evento_academico ADD CONSTRAINT prueba_fallo_material CHECK (accion <> 'PUBLICAR_MATERIAL') NOT VALID");
    try {
      await subir().expect(500);
      expect((await listar().expect(200)).body.materiales).toEqual([]);
      const ev = await app.get(ContextoInstitucion).ejecutar(inst, db => db.query("SELECT 1 FROM evento_academico WHERE accion='PUBLICAR_MATERIAL'"));
      expect(ev.rowCount).toBe(0);
    } finally { await pool.query('ALTER TABLE evento_academico DROP CONSTRAINT prueba_fallo_material'); }
  });

  it('aísla otra institución y otra sección; no expone el archivo en rutas públicas', async () => {
    const res = await subir().expect(201);
    const otra = randomUUID();
    await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$2)',[otra,otra]);
    await pool.query("INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,'PROFESOR')",[prof,otra]);
    await subir(documento(),prof,otra).expect(404);
    await listar(prof,otra).expect(404);
    await get('materiales/secciones/' + randomUUID(),prof).expect(404);
    await request(app.getHttpServer()).get('/api/materiales/' + res.body.id).expect(404);
  });
});
