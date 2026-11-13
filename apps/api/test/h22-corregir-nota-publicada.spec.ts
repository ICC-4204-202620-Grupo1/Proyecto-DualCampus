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

describe.skipIf(!url)('H22 · Corregir nota publicada (PostgreSQL con RLS)', () => {
  let pool: Pool, app: NestExpressApplication;
  const esquema = 'test_h22_' + randomUUID().replaceAll('-', '');

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

  async function preparar() { await enviar(); await publicar().expect(201); }
  async function datos(alumnoId=alumno1) {
    const res = await get('calificaciones/evaluaciones/' + evaluacion + '/notas',admin).expect(200);
    const f=res.body.filas.find((r: {alumnoId:string})=>r.alumnoId===alumnoId);
    return {valor:6.2,motivo:'Error de transcripción',referencia:'SOL-001',valorPrevio:f.valor,ausentePrevio:f.esAusente,actualizadoEn:f.actualizadoEn};
  }
  const corregir=(dto:unknown,u=admin,alumnoId=alumno1,i=inst)=>request(app.getHttpServer())
    .post('/api/calificaciones/evaluaciones/' + evaluacion + '/notas/' + alumnoId + '/correcciones')
    .set('Cookie',cookie(u,i)).send(dto);

  it('CA1/CA2: registra cambio, motivo y solicitud; preserva publicación y evidencia previa',async()=>{
    await preparar(); const dto=await datos();
    const antes=await app.get(ContextoInstitucion).ejecutar(inst,db=>db.query('SELECT publicado_en FROM evaluacion WHERE id=$1',[evaluacion]));
    await corregir(dto).expect(201);
    const lectura=await get('calificaciones/evaluaciones/' + evaluacion + '/notas',admin).expect(200);
    expect(lectura.body.evaluacion.estado).toBe('PUBLICADA');
    expect(lectura.body.evaluacion.publicadoEn).toBe(antes.rows[0].publicado_en.toISOString());
    const audit=await get('calificaciones/evaluaciones/' + evaluacion + '/auditoria',admin).expect(200);
    const e=audit.body.find((x:{accion:string})=>x.accion==='CORREGIR_NOTA_PUBLICADA');
    expect(e.datos).toMatchObject({alumnoId:alumno1,valorPrevio:5.5,valorNuevo:6.2,motivo:dto.motivo,referencia:dto.referencia});
    expect(e.autor).toBeTruthy(); expect(Date.parse(e.fecha)).not.toBeNaN();
    expect(audit.body.some((x:{accion:string})=>x.accion==='PUBLICAR_EVALUACION')).toBe(true);
    const fila=await app.get(ContextoInstitucion).ejecutar(inst,db=>db.query('SELECT modificado_por FROM nota WHERE evaluacion_id=$1 AND usuario_id=$2',[evaluacion,alumno1]));
    expect(fila.rows[0].modificado_por).toBe(admin);
  });

  it('CA3: alumno ve valor vigente en nota propia e historial por período',async()=>{
    await preparar();await corregir(await datos()).expect(201);
    const propias=await get('calificaciones/secciones/' + seccion + '/mis-notas',alumno1).expect(200);
    expect(propias.body[0].valor).toBe(6.2);
    const historial=await get('historial-academico/propio',alumno1).expect(200);
    const notas=historial.body.flatMap((p:{asignaturas:{notas:unknown[]}[]})=>p.asignaturas.flatMap(a=>a.notas));
    expect(notas.some((n:{id:string;valor:number})=>n.id===evaluacion&&n.valor===6.2)).toBe(true);
    const otro=await get('calificaciones/evaluaciones/' + evaluacion + '/notas',alumno2).expect(200);
    expect(otro.body.filas).toHaveLength(1);expect(otro.body.filas[0].esAusente).toBe(true);
  });

  it('CA1: rechaza valores, motivo o referencia inválidos sin sustituir nota válida',async()=>{
    await preparar();const dto=await datos();
    for(const extra of [{valor:0},{valor:8},{valor:null},{valor:'6.2'},{valor:6.25},{motivo:''},{motivo:'   '},{referencia:''},{referencia:'x'.repeat(201)}]) {
      await corregir({...dto,...extra}).expect(400);
    }
    const f=(await datos());expect(f.valorPrevio).toBe(5.5);
    await corregir({...dto,valor:5.5}).expect(400);
  });

  it('CA3: profesor, ayudante y alumno no pueden corregir ni usar guardado de borrador',async()=>{
    await preparar();const dto=await datos();
    for(const u of [prof,ayudante,alumno1]) await corregir(dto,u).expect(403);
    await put('calificaciones/evaluaciones/' + evaluacion + '/notas',{notas:[{alumnoId:alumno1,valor:7}]},admin).expect(409);
    await request(app.getHttpServer()).post('/api/calificaciones/evaluaciones/' + evaluacion + '/notas/' + alumno1 + '/correcciones').send(dto).expect(401);
  });

  it('rechaza estados no publicados, alumnos ajenos e instituciones distintas',async()=>{
    const dto=await datos();await corregir(dto).expect(409);
    await preparar();const actual=await datos();
    await corregir(actual,admin,ajeno).expect(404);
    const otra=randomUUID();await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$2)',[otra,otra]);
    await pool.query("INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,'ADMINISTRADOR')",[admin,otra]);
    await corregir(actual,admin,alumno1,otra).expect(404);
  });

  it('convierte ausencia en nota y conserva ausencia previa en auditoría',async()=>{
    await preparar();await corregir(await datos(alumno2),admin,alumno2).expect(201);
    const f=await datos(alumno2);expect(f.valorPrevio).toBe(6.2);expect(f.ausentePrevio).toBe(false);
    const audit=await get('calificaciones/evaluaciones/' + evaluacion + '/auditoria',admin).expect(200);
    expect(audit.body.find((x:{accion:string})=>x.accion==='CORREGIR_NOTA_PUBLICADA').datos).toMatchObject({valorPrevio:null,ausentePrevio:true,valorNuevo:6.2});
  });

  it('serializa correcciones simultáneas y rechaza la planilla obsoleta',async()=>{
    await preparar();const dto=await datos();
    const res=await Promise.all([corregir(dto),corregir({...dto,valor:6.8})]);
    expect(res.map(r=>r.status).sort()).toEqual([201,409]);
    const audit=await get('calificaciones/evaluaciones/' + evaluacion + '/auditoria',admin).expect(200);
    expect(audit.body.filter((x:{accion:string})=>x.accion==='CORREGIR_NOTA_PUBLICADA')).toHaveLength(1);
  });
  it('revierte la nota si falla el registro obligatorio de auditoría',async()=>{
    await preparar(); const dto=await datos();
    await pool.query("ALTER TABLE evento_academico ADD CONSTRAINT fallo_correccion CHECK (accion <> 'CORREGIR_NOTA_PUBLICADA') NOT VALID");
    try {
      await corregir(dto).expect(500);
      expect((await datos()).valorPrevio).toBe(5.5);
    } finally { await pool.query('ALTER TABLE evento_academico DROP CONSTRAINT fallo_correccion'); }
  });

});
