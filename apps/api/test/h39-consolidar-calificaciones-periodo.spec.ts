import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

describe.skipIf(!url)('H39 · Consolidar calificaciones por período (PostgreSQL con RLS)', () => {
  let pool: Pool;
  let app: NestExpressApplication;
  const esquema = 'test_h39_' + randomUUID().replaceAll('-', '');
  let instA: string, instB: string, alumno: string, otroAlumno: string, adminA: string;
  let periodoNotas: string, periodoSinNotas: string, periodoSinMatricula: string;

  const cookie = (usuarioId: string, institucionId: string) =>
    'dc_sesion=' + app.get(SesionService).emitir({
      usuarioId,
      email: 'prueba@example.invalid',
      nombre: 'Prueba',
      institucionActivaId: institucionId,
      roles: [],
    });

  const historial = (usuarioId = alumno, institucionId = instA, query = '') =>
    request(app.getHttpServer())
      .get('/api/historial-academico/propio' + query)
      .set('Cookie', cookie(usuarioId, institucionId));

  beforeAll(async () => {
    if (!new URL(url!).pathname.endsWith('_test')) {
      throw new Error('TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en _test');
    }
    const provision = new Pool({ connectionString: url });
    await provision.query('CREATE SCHEMA ' + esquema);
    await provision.end();

    pool = new Pool({ connectionString: url, options: '-c search_path=' + esquema + ',public', max: 5 });
    const dir = join(process.cwd(), 'db', 'migrations');
    for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
      await pool.query(readFileSync(join(dir, f), 'utf8'));
    }

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONFIG)
      .useValue(cargarConfig({
        SESSION_SECRET: 'secreto-solo-pruebas-h39-con-longitud-adecuada',
        APP_URL: 'http://localhost:5173',
      }))
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .compile();
    app = configurarApp(modulo.createNestApplication<NestExpressApplication>());
    await app.init();

    instA = randomUUID(); instB = randomUUID();
    await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$2),($3,$4)',
      [instA, instA, instB, instB]);

    async function usuario(rol: Rol, institucionId: string) {
      const id = randomUUID();
      await pool.query('INSERT INTO usuario(id,email,nombre) VALUES ($1,$2,$3)',
        [id, id + '@example.invalid', rol + ' demo']);
      await pool.query('INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,$3)',
        [id, institucionId, rol]);
      return id;
    }
    adminA = await usuario('ADMINISTRADOR', instA);
    const adminB = await usuario('ADMINISTRADOR', instB);
    alumno = await usuario('ALUMNO', instA);
    otroAlumno = await usuario('ALUMNO', instA);
    await pool.query("INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,'ALUMNO')",
      [alumno, instB]);

    const contexto = app.get(ContextoInstitucion);
    async function crearPeriodo(institucionId: string, adminId: string, nombre: string, inicio: string, fin: string) {
      return contexto.ejecutar(institucionId, async db => {
        const r = await db.query(
          'INSERT INTO periodo(institucion_id,nombre,fecha_inicio,fecha_fin,creado_por) VALUES ($1,$2,$3,$4,$5) RETURNING id',
          [institucionId, nombre, inicio, fin, adminId]);
        return r.rows[0].id as string;
      });
    }
    async function crearSeccion(institucionId: string, adminId: string, periodoId: string, codigo: string) {
      return contexto.ejecutar(institucionId, async db => {
        const curso = (await db.query(
          'INSERT INTO curso(institucion_id,periodo_id,codigo,nombre,creado_por) VALUES ($1,$2,$3,$4,$5) RETURNING id',
          [institucionId, periodoId, codigo, 'Asignatura ' + codigo, adminId])).rows[0].id;
        const seccion = (await db.query(
          'INSERT INTO seccion(institucion_id,periodo_id,curso_id,codigo,creado_por) VALUES ($1,$2,$3,$4,$5) RETURNING id',
          [institucionId, periodoId, curso, '01', adminId])).rows[0].id;
        return seccion as string;
      });
    }
    async function agregarEvaluacion(institucionId: string, adminId: string, seccionId: string, estado: string, nota: number) {
      await contexto.ejecutar(institucionId, async db => {
        const evalId = (await db.query(
          `INSERT INTO evaluacion(institucion_id,seccion_id,nombre,fecha,ponderacion,estado,creado_por,publicado_por,publicado_en)
           VALUES ($1,$2,$3,'2026-09-15',20,$4,$5,$6,$7) RETURNING id`,
          [institucionId, seccionId, estado === 'PUBLICADA' ? 'Control publicado' : 'Control borrador',
            estado, adminId, estado === 'PUBLICADA' ? adminId : null,
            estado === 'PUBLICADA' ? new Date() : null])).rows[0].id;
        await db.query(
          'INSERT INTO nota(institucion_id,evaluacion_id,usuario_id,valor,modificado_por) VALUES ($1,$2,$3,$4,$5)',
          [institucionId, evalId, alumno, nota, adminId]);
        if (institucionId === instA && estado === 'PUBLICADA') {
          await db.query(
            'INSERT INTO nota(institucion_id,evaluacion_id,usuario_id,valor,modificado_por) VALUES ($1,$2,$3,$4,$5)',
            [institucionId, evalId, otroAlumno, 2.2, adminId]);
        }
      });
    }

    periodoNotas = await crearPeriodo(instA, adminA, '2026-2', '2026-08-01', '2026-12-20');
    periodoSinNotas = await crearPeriodo(instA, adminA, '2026-1', '2026-03-01', '2026-07-15');
    periodoSinMatricula = await crearPeriodo(instA, adminA, '2025-2', '2025-08-01', '2025-12-20');
    const s1 = await crearSeccion(instA, adminA, periodoNotas, 'ICC-4204');
    const s2 = await crearSeccion(instA, adminA, periodoSinNotas, 'MAT-1000');
    await contexto.ejecutar(instA, async db => {
      for (const sec of [s1, s2]) {
        await db.query('INSERT INTO matricula(institucion_id,seccion_id,usuario_id) VALUES ($1,$2,$3)',
          [instA, sec, alumno]);
      }
      await db.query('INSERT INTO matricula(institucion_id,seccion_id,usuario_id) VALUES ($1,$2,$3)',
        [instA, s1, otroAlumno]);
    });
    await agregarEvaluacion(instA, adminA, s1, 'PUBLICADA', 5.5);
    await agregarEvaluacion(instA, adminA, s1, 'BORRADOR', 6.5);

    const periodoB = await crearPeriodo(instB, adminB, '2026-2', '2026-08-01', '2026-12-20');
    const sB = await crearSeccion(instB, adminB, periodoB, 'BIO-101');
    await contexto.ejecutar(instB, async db => {
      await db.query('INSERT INTO matricula(institucion_id,seccion_id,usuario_id) VALUES ($1,$2,$3)',
        [instB, sB, alumno]);
    });
    await agregarEvaluacion(instB, adminB, sB, 'PUBLICADA', 4.4);
  }, 30000);

  afterAll(async () => {
    if (pool) {
      await pool.query('DROP SCHEMA IF EXISTS ' + esquema + ' CASCADE');
      if (app) await app.close();
      else await pool.end();
    }
  });

  it('CA1: agrupa períodos, asignaturas y exclusivamente notas publicadas propias', async () => {
    const res = await historial().expect(200);
    const p = res.body.find((x: { id: string }) => x.id === periodoNotas);
    expect(p.nombre).toBe('2026-2');
    expect(p.asignaturas).toHaveLength(1);
    expect(p.asignaturas[0].cursoCodigo).toBe('ICC-4204');
    expect(p.asignaturas[0].cursoNombre).toBe('Asignatura ICC-4204');
    expect(p.asignaturas[0].notas).toHaveLength(1);
    expect(p.asignaturas[0].notas[0].valor).toBe(5.5);
    expect(p.asignaturas[0].notas[0].nombre).toBe('Control publicado');
    expect(JSON.stringify(res.body)).not.toContain('Control borrador');
    expect(JSON.stringify(res.body)).not.toContain('2.2');
    expect(JSON.stringify(res.body)).not.toContain(otroAlumno);
  });

  it('CA2: incluye períodos sin notas con arreglo vacío para mostrar Sin datos', async () => {
    const res = await historial().expect(200);
    expect(res.body).toHaveLength(3);
    const sinNotas = res.body.find((x: { id: string }) => x.id === periodoSinNotas);
    expect(sinNotas.asignaturas).toHaveLength(1);
    expect(sinNotas.asignaturas[0].notas).toEqual([]);
    const sinMatricula = res.body.find((x: { id: string }) => x.id === periodoSinMatricula);
    expect(sinMatricula.asignaturas).toEqual([]);
  });

  it('CA3: al cambiar institución no mezcla períodos ni notas aunque el alumno tenga acceso a ambas', async () => {
    const a = await historial(alumno, instA).expect(200);
    const b = await historial(alumno, instB).expect(200);
    expect(a.body).toHaveLength(3);
    expect(b.body).toHaveLength(1);
    expect(b.body[0].asignaturas[0].cursoCodigo).toBe('BIO-101');
    expect(b.body[0].asignaturas[0].notas[0].valor).toBe(4.4);
    expect(JSON.stringify(a.body)).not.toContain('BIO-101');
    expect(JSON.stringify(b.body)).not.toContain('ICC-4204');
  });

  it('ignora identificadores de terceros y rechaza accesos sin rol o sin sesión', async () => {
    const falsificada = await historial(alumno, instA, '?alumnoId=' + otroAlumno).expect(200);
    expect(falsificada.body.find((x: { id: string }) => x.id === periodoNotas).asignaturas[0].notas[0].valor).toBe(5.5);
    await historial(adminA, instA).expect(403);
    await historial(otroAlumno, instB).expect(403);
    await request(app.getHttpServer()).get('/api/historial-academico/propio').expect(401);
  });
});
