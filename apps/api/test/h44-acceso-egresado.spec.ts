/** H44 · Acceder al historial tras el egreso — evidencia de CA1, CA2 y CA3. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
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
import type { IdentidadGoogle } from '../src/modules/autenticacion/usuario-sesion.js';
import {
  CuentasPersonalesEnMemoria,
  cookieSesion,
  cookiesDe,
  crearApp,
  identidades,
  iniciarSesion,
  PeriodosEnMemoria,
  UG,
  UsuariosEnMemoria,
} from './apoyo.js';

const personal = (sub: string, email: string, extra: Partial<IdentidadGoogle> = {}): IdentidadGoogle => ({
  sub, email, nombre: email, emailVerificado: true, dominio: null, ...extra,
});

// Cuentas que "Google" confirma en el callback del ingreso de egresado.
Object.assign(identidades, {
  tomas: { sub: 'g-tomas', email: 'tomas@ug.cl', nombre: 'Tomás Alcaíno', emailVerificado: true, dominio: 'ug.cl' },
  'personal-tomas': personal('g-personal-tomas', 'tomas.alcaino@example.invalid'),
  'personal-tomas-nueva': personal('g-personal-tomas-2', 'tomas.nueva@example.invalid'),
  'personal-sin-vincular': personal('g-personal-libre', 'libre@example.invalid'),
  'personal-no-verificada': personal('g-personal-tomas', 'tomas.alcaino@example.invalid', { emailVerificado: false }),
  // Otra cuenta que declara el mismo correo de Tomás: la identidad se resuelve por sub, no por correo.
  'mismo-correo-otro-sub': personal('g-impostor', 'tomas.alcaino@example.invalid'),
});

const ALUMNO_UG = { ...UG, rol: 'ALUMNO' as const };
const cookieEgresado = (res: request.Response) => cookiesDe(res).find((c) => /^dc_egresado=[^;]+/.test(c));

describe('H44 · Acceder al historial tras el egreso', () => {
  let app: INestApplication;
  const usuarios = new UsuariosEnMemoria();
  const cuentas = new CuentasPersonalesEnMemoria(usuarios);

  beforeAll(async () => {
    app = await crearApp(usuarios, new PeriodosEnMemoria(usuarios), cuentas);
  });
  beforeEach(async () => {
    usuarios.reiniciar();
    // Tomás egresó: su cuenta institucional quedó inactiva, pero conserva su rol de alumno como antecedente.
    usuarios.usuarios.push({
      id: 'u-tomas', email: 'tomas@ug.cl', nombre: 'Tomás Alcaíno', activo: false, googleSub: 'g-tomas',
      roles: [ALUMNO_UG], esSuperadministrador: false,
    });
    cuentas.reiniciar();
    // Vinculada antes del egreso (H43).
    await cuentas.vincular('u-tomas', { sub: 'g-personal-tomas', email: 'tomas.alcaino@example.invalid' });
  });
  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());

  /** Recorre /auth/egresado → Google → /auth/google/callback. */
  async function ingresar(codigo: string) {
    const inicio = await http().get('/api/auth/egresado').expect(302);
    const state = new URL(inicio.headers.location).searchParams.get('state')!;
    const oidc = cookiesDe(inicio).find((c) => c.startsWith('dc_oidc='))!.split(';')[0];
    return http().get(`/api/auth/google/callback?code=${codigo}&state=${state}`).set('Cookie', oidc);
  }
  async function sesionEgresado(codigo = 'personal-tomas') {
    return cookieEgresado(await ingresar(codigo))!.split(';')[0];
  }
  const error = (res: request.Response) => new URL(res.headers.location).searchParams.get('error');

  describe('CA1 · La cuenta verificada identifica al mismo alumno aunque la institucional esté inactiva', () => {
    it('la cuenta institucional inactiva ya no permite ingresar', async () => {
      const res = await iniciarSesion(app, 'tomas');
      expect(error(res)).toBe('no_autorizado');
      expect(cookieSesion(res)).toBeUndefined();
    });

    it('la cuenta personal vinculada identifica a Tomás y emite solo la sesión de consulta', async () => {
      const res = await ingresar('personal-tomas');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('http://localhost:5173/');
      expect(cookieEgresado(res)).toMatch(/HttpOnly/i);
      expect(cookieSesion(res)).toBeUndefined();

      const sesion = await http().get('/api/egresado/sesion').set('Cookie', cookieEgresado(res)!.split(';')[0]).expect(200);
      expect(sesion.body).toEqual({
        usuarioId: 'u-tomas',
        nombre: 'Tomás Alcaíno',
        emailInstitucional: 'tomas@ug.cl',
        emailPersonal: 'tomas.alcaino@example.invalid',
        cuentaInstitucionalActiva: false,
        instituciones: [{ id: UG.institucionId, nombre: UG.institucion }],
      });
    });

    it('la identidad se resuelve por la cuenta de Google y no por el correo que declara', async () => {
      const res = await ingresar('mismo-correo-otro-sub');
      expect(error(res)).toBe('sin_vinculacion');
      expect(cookieEgresado(res)).toBeUndefined();
    });

    it('un correo no verificado por Google no identifica a nadie', async () => {
      const res = await ingresar('personal-no-verificada');
      expect(error(res)).toBe('no_verificada');
      expect(cookieEgresado(res)).toBeUndefined();
    });

    it('si la cuenta personal se reemplaza, la sesión emitida con la anterior deja de servir', async () => {
      const anterior = await sesionEgresado();
      await cuentas.vincular('u-tomas', { sub: 'g-personal-tomas-2', email: 'tomas.nueva@example.invalid' });
      await http().get('/api/egresado/sesion').set('Cookie', anterior).expect(401);
      const nueva = await sesionEgresado('personal-tomas-nueva');
      expect((await http().get('/api/egresado/sesion').set('Cookie', nueva).expect(200)).body.usuarioId).toBe('u-tomas');
    });

    it('Google ofrece la selección de cuentas sin limitarla al dominio institucional', async () => {
      const inicio = await http().get('/api/auth/egresado').expect(302);
      const oidc = cookiesDe(inicio).find((c) => c.startsWith('dc_oidc='));
      expect(oidc).toBeDefined();
      expect(new URL(inicio.headers.location).searchParams.get('hd')).toBeNull();
    });
  });

  describe('CA2 · El acceso permite solo consulta de su historial', () => {
    it('la sesión de egresado no sirve en ninguna ruta institucional', async () => {
      const egresado = await sesionEgresado();
      for (const ruta of ['/api/auth/me', '/api/sesion/instituciones', '/api/periodos', '/api/cuenta-personal', '/api/historial-academico/propio']) {
        await http().get(ruta).set('Cookie', egresado).expect(401);
      }
      await http().put('/api/sesion/institucion').set('Cookie', egresado).send({ institucionId: UG.institucionId }).expect(401);
      await http().post('/api/periodos').set('Cookie', egresado)
        .send({ nombre: '2027-1', fechaInicio: '2027-03-01', fechaFin: '2027-07-15' }).expect(401);
    });

    it('el token de egresado presentado como sesión institucional se rechaza', async () => {
      const token = (await sesionEgresado()).split('=')[1];
      await http().get('/api/auth/me').set('Cookie', `dc_sesion=${token}`).expect(401);
    });

    it('una sesión institucional no abre las rutas de egresado', async () => {
      usuarios.usuarios.find((u) => u.id === 'u-tomas')!.activo = true;
      const institucional = cookieSesion(await iniciarSesion(app, 'tomas'))!.split(';')[0];
      await http().get('/api/egresado/sesion').set('Cookie', institucional).expect(401);
      await http().get('/api/egresado/historial').set('Cookie', institucional).expect(401);
    });

    it('las rutas de egresado no admiten escrituras', async () => {
      const egresado = await sesionEgresado();
      const res = await http().post('/api/egresado/historial').set('Cookie', egresado).send({});
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('sin sesión de egresado la consulta responde 401', async () => {
      await http().get('/api/egresado/sesion').expect(401);
      await http().get('/api/egresado/historial').expect(401);
    });

    it('cerrar sesión borra la sesión de egresado', async () => {
      const egresado = await sesionEgresado();
      const res = await http().post('/api/auth/logout').set('Cookie', egresado).expect(204);
      expect(cookiesDe(res).some((c) => /^dc_egresado=;/.test(c))).toBe(true);
    });
  });

  describe('CA3 · Sin vinculación se informa el canal de asistencia', () => {
    it('una cuenta personal sin vincular vuelve con sin_vinculacion y sin sesión', async () => {
      const res = await ingresar('personal-sin-vincular');
      expect(res.headers.location).toBe('http://localhost:5173/?error=sin_vinculacion');
      expect(cookieEgresado(res)).toBeUndefined();
      expect(cookieSesion(res)).toBeUndefined();
    });

    it('la cuenta institucional no sirve como cuenta personal para el ingreso de egresado', async () => {
      const res = await ingresar('tomas');
      expect(error(res)).toBe('sin_vinculacion');
      expect(cookieEgresado(res)).toBeUndefined();
    });

    it('un callback con state alterado se rechaza sin emitir sesión', async () => {
      const inicio = await http().get('/api/auth/egresado').expect(302);
      const oidc = cookiesDe(inicio).find((c) => c.startsWith('dc_oidc='))!.split(';')[0];
      const res = await http().get('/api/auth/google/callback?code=personal-tomas&state=falso').set('Cookie', oidc);
      expect(error(res)).toBe('fallo_login');
      expect(cookieEgresado(res)).toBeUndefined();
    });
  });
});

// Historial del egresado sobre PostgreSQL real con RLS (misma base dedicada que H39 y H43).
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('H44 · Historial del egresado en PostgreSQL', () => {
  let pool: Pool;
  let app: NestExpressApplication;
  const esquema = 'test_h44_' + randomUUID().replaceAll('-', '');
  let instA: string, instB: string, alumno: string, otroAlumno: string;
  const correoPersonal = 'egresado-' + randomUUID().slice(0, 8) + '@example.invalid';

  const http = () => request(app.getHttpServer());
  /** Ingreso local sin Google: identifica por el sub que crea dev-vincular. */
  async function sesionEgresado(correo = correoPersonal) {
    const res = await http().get('/api/auth/dev-egresado?email=' + encodeURIComponent(correo)).expect(302);
    return cookiesDe(res).find((c) => /^dc_egresado=[^;]+/.test(c))?.split(';')[0];
  }

  beforeAll(async () => {
    if (!new URL(url!).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en _test');
    const provision = new Pool({ connectionString: url });
    await provision.query('CREATE SCHEMA ' + esquema);
    await provision.end();
    pool = new Pool({ connectionString: url, options: '-c search_path=' + esquema + ',public', max: 5 });
    const dir = join(process.cwd(), 'db', 'migrations');
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) await pool.query(readFileSync(join(dir, f), 'utf8'));

    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONFIG)
      .useValue(cargarConfig({ SESSION_SECRET: 'secreto-solo-pruebas-h44-con-longitud-adecuada', APP_URL: 'http://localhost:5173' }))
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .compile();
    app = configurarApp(modulo.createNestApplication<NestExpressApplication>());
    await app.init();

    instA = randomUUID(); instB = randomUUID();
    await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$2),($3,$4)', [instA, 'A ' + instA, instB, 'B ' + instB]);
    async function usuario(rol: string, institucionId: string) {
      const id = randomUUID();
      await pool.query('INSERT INTO usuario(id,email,nombre) VALUES ($1,$2,$3)', [id, id + '@example.invalid', rol + ' demo']);
      await pool.query('INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,$3)', [id, institucionId, rol]);
      return id;
    }
    const adminA = await usuario('ADMINISTRADOR', instA);
    const adminB = await usuario('ADMINISTRADOR', instB);
    alumno = await usuario('ALUMNO', instA);
    otroAlumno = await usuario('ALUMNO', instA);
    await pool.query("INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,'ALUMNO')", [alumno, instB]);

    const contexto = app.get(ContextoInstitucion);
    async function cursoConNotas(institucionId: string, adminId: string, codigo: string, notas: [string, number][]) {
      await contexto.ejecutar(institucionId, async (db) => {
        const periodo = (await db.query(
          `INSERT INTO periodo(institucion_id,nombre,fecha_inicio,fecha_fin,creado_por) VALUES ($1,'2026-2','2026-08-01','2026-12-20',$2) RETURNING id`,
          [institucionId, adminId])).rows[0].id;
        const curso = (await db.query(
          'INSERT INTO curso(institucion_id,periodo_id,codigo,nombre,creado_por) VALUES ($1,$2,$3,$4,$5) RETURNING id',
          [institucionId, periodo, codigo, 'Asignatura ' + codigo, adminId])).rows[0].id;
        const seccion = (await db.query(
          `INSERT INTO seccion(institucion_id,periodo_id,curso_id,codigo,creado_por) VALUES ($1,$2,$3,'01',$4) RETURNING id`,
          [institucionId, periodo, curso, adminId])).rows[0].id;
        const evaluacion = (await db.query(
          `INSERT INTO evaluacion(institucion_id,seccion_id,nombre,fecha,ponderacion,estado,creado_por,publicado_por,publicado_en)
           VALUES ($1,$2,'Control publicado','2026-09-15',20,'PUBLICADA',$3,$3,now()) RETURNING id`,
          [institucionId, seccion, adminId])).rows[0].id;
        for (const [usuarioId, valor] of notas) {
          await db.query('INSERT INTO matricula(institucion_id,seccion_id,usuario_id) VALUES ($1,$2,$3)', [institucionId, seccion, usuarioId]);
          await db.query('INSERT INTO nota(institucion_id,evaluacion_id,usuario_id,valor,modificado_por) VALUES ($1,$2,$3,$4,$5)',
            [institucionId, evaluacion, usuarioId, valor, adminId]);
        }
      });
    }
    await cursoConNotas(instA, adminA, 'ICC-4204', [[alumno, 5.5], [otroAlumno, 2.2]]);
    await cursoConNotas(instB, adminB, 'BIO-101', [[alumno, 4.4]]);

    // Vinculó su cuenta personal antes de egresar (H43) y luego su cuenta institucional quedó inactiva.
    await pool.query('INSERT INTO cuenta_personal(usuario_id,google_sub,email) VALUES ($1,$2,$3)',
      [alumno, 'dev-personal-' + correoPersonal, correoPersonal]);
    await pool.query('UPDATE usuario SET activo=false WHERE id=$1', [alumno]);
  }, 30000);

  afterAll(async () => {
    if (pool) {
      await pool.query('DROP SCHEMA IF EXISTS ' + esquema + ' CASCADE');
      if (app) await app.close();
      else await pool.end();
    }
  });

  it('CA1 · con la institucional inactiva, la cuenta personal identifica al mismo alumno', async () => {
    const institucional = 'dc_sesion=' + app.get(SesionService).emitir({
      usuarioId: alumno, email: alumno + '@example.invalid', nombre: 'Alumno', institucionActivaId: instA,
      roles: [{ institucionId: instA, institucion: 'A', rol: 'ALUMNO' }], esSuperadministrador: false,
    });
    await http().get('/api/historial-academico/propio').set('Cookie', institucional).expect(401);

    const egresado = (await sesionEgresado())!;
    const sesion = await http().get('/api/egresado/sesion').set('Cookie', egresado).expect(200);
    expect(sesion.body.usuarioId).toBe(alumno);
    expect(sesion.body.cuentaInstitucionalActiva).toBe(false);
  });

  it('CA2 · consulta solo su historial, en cada institución donde fue alumno', async () => {
    const egresado = (await sesionEgresado())!;
    const res = await http().get('/api/egresado/historial?alumnoId=' + otroAlumno).set('Cookie', egresado).expect(200);
    const porInstitucion = new Map(res.body.map((h: { institucionId: string }) => [h.institucionId, h]));
    expect(porInstitucion.size).toBe(2);
    const a = porInstitucion.get(instA) as { periodos: { asignaturas: { cursoCodigo: string; notas: { valor: number }[] }[] }[] };
    const b = porInstitucion.get(instB) as typeof a;
    expect(a.periodos[0].asignaturas[0].cursoCodigo).toBe('ICC-4204');
    expect(a.periodos[0].asignaturas[0].notas.map((n) => n.valor)).toEqual([5.5]);
    expect(b.periodos[0].asignaturas[0].notas.map((n) => n.valor)).toEqual([4.4]);
    expect(JSON.stringify(res.body)).not.toContain('2.2');
    expect(JSON.stringify(res.body)).not.toContain(otroAlumno);
  });

  it('CA3 · una cuenta personal sin vincular no obtiene sesión', async () => {
    const res = await http().get('/api/auth/dev-egresado?email=nadie-' + randomUUID().slice(0, 8) + '@example.invalid').expect(302);
    expect(res.headers.location).toBe('http://localhost:5173/?error=sin_vinculacion');
    expect(cookiesDe(res).some((c) => /^dc_egresado=[^;]+/.test(c))).toBe(false);
  });
});
