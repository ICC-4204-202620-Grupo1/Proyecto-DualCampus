import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';
import { CONFIG, cargarConfig } from '../src/config/config';
import { PG_POOL } from '../src/database/pg-pool.token';
import { SesionService } from '../src/modules/autenticacion/sesion.service';
import type { Rol } from '../src/modules/autenticacion/usuario-sesion';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('H15 · Ingresar notas en borrador (PostgreSQL con RLS)', () => {
  let pool: Pool, app: NestExpressApplication;
  const esquema = 'test_' + randomUUID().replaceAll('-', '');
  let inst: string, otra: string;
  let admin: string, prof: string, ayudante: string, alumno1: string, alumno2: string, ajeno: string;
  let periodo: string, curso: string, seccion: string, evaluacion: string;

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
    alumno1 = await crearUsuario('ALUMNO');
    alumno2 = await crearUsuario('ALUMNO');
    ajeno = await crearUsuario('AYUDANTE');

    // Configurar período, curso y sección
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

    // Asignar equipo
    await request(app.getHttpServer())
      .put('/api/academico/secciones/' + seccion + '/equipo')
      .set('Cookie', cookie(admin))
      .send({ profesorId: prof, ayudanteIds: [ayudante] });

    // Matricular alumnos
    await request(app.getHttpServer())
      .post('/api/academico/secciones/' + seccion + '/nomina')
      .set('Cookie', cookie(admin))
      .send({ emails: [alumno1 + '@example.invalid', alumno2 + '@example.invalid'] });

    // Crear evaluación en borrador (H14)
    const evRes = await request(app.getHttpServer())
      .post('/api/calificaciones/secciones/' + seccion + '/evaluaciones')
      .set('Cookie', cookie(prof))
      .send({ nombre: 'Control 1', fecha: '2026-09-15', ponderacion: 20 });
    evaluacion = evRes.body.id;
  });

  it('CA1: El ayudante asignado (Diego Riquelme) ingresa notas válidas y se recuperan al reabrir', async () => {
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [
        { alumnoId: alumno1, valor: 6.2 },
        { alumnoId: alumno2, valor: 4.5 },
      ],
    }, ayudante).expect(200);

    const res = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', ayudante).expect(200);
    expect(res.body.evaluacion.estado).toBe('BORRADOR');
    expect(res.body.filas).toHaveLength(2);

    const a1 = res.body.filas.find((f: { alumnoId: string }) => f.alumnoId === alumno1);
    const a2 = res.body.filas.find((f: { alumnoId: string }) => f.alumnoId === alumno2);
    expect(a1.valor).toBe(6.2);
    expect(a2.valor).toBe(4.5);
  });

  it('Profesor asignado y Administrador también pueden ingresar notas', async () => {
    // Profesor ingresa nota
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, valor: 5.8 }],
    }, prof).expect(200);

    let res = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', prof).expect(200);
    expect(res.body.filas.find((f: { alumnoId: string }) => f.alumnoId === alumno1).valor).toBe(5.8);

    // Administrador actualiza nota
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, valor: 6.5 }],
    }, admin).expect(200);

    res = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', admin).expect(200);
    expect(res.body.filas.find((f: { alumnoId: string }) => f.alumnoId === alumno1).valor).toBe(6.5);
  });

  it('CA2: Un valor fuera de escala no reemplaza la última nota válida', async () => {
    // 1. Guardar una nota válida inicial (5.5)
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, valor: 5.5 }],
    }, ayudante).expect(200);

    // 2. Intentar guardar un valor fuera de escala (8.0 > 7.0)
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, valor: 8.0 }],
    }, ayudante).expect(400);

    // 3. Intentar guardar un valor bajo la escala (0.5 < 1.0)
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, valor: 0.5 }],
    }, ayudante).expect(400);

    // 4. Verificar que la nota anterior (5.5) sigue intacta
    const res = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', ayudante).expect(200);
    const a1 = res.body.filas.find((f: { alumnoId: string }) => f.alumnoId === alumno1);
    expect(a1.valor).toBe(5.5);
  });

  it('CA3: El alumno no ve valores en el borrador (403 Forbidden)', async () => {
    // El ayudante ingresa una nota
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, valor: 6.0 }],
    }, ayudante).expect(200);

    // El alumno intenta consultar las notas de la evaluación en BORRADOR
    const res = await get('calificaciones/evaluaciones/' + evaluacion + '/notas', alumno1).expect(403);
    expect(res.body.message).toContain('El alumno no ve valores en el borrador');
  });

  it('Un ayudante ajeno a la sección no puede ingresar notas (403 Forbidden)', async () => {
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumno1, valor: 5.0 }],
    }, ajeno).expect(403);
  });

  it('Rechaza calificar a un alumno que no pertenece a la sección (400 Bad Request)', async () => {
    const alumnoExterno = randomUUID();
    await pool.query('INSERT INTO usuario(id,email) VALUES ($1,$2)', [alumnoExterno, alumnoExterno + '@example.invalid']);
    await pool.query("INSERT INTO rol_en_institucion VALUES ($1,$2,'ALUMNO',now())", [alumnoExterno, inst]);

    await put('calificaciones/evaluaciones/' + evaluacion + '/notas', {
      notas: [{ alumnoId: alumnoExterno, valor: 5.0 }],
    }, ayudante).expect(400);
  });
});
