import { afterAll,beforeAll,beforeEach,describe,expect,it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';
import { CONFIG,cargarConfig } from '../src/config/config';
import { PG_POOL } from '../src/database/pg-pool.token';
import { SesionService } from '../src/modules/autenticacion/sesion.service';
import { ContextoInstitucion } from '../src/database/contexto-institucion';
import type { Rol } from '../src/modules/autenticacion/usuario-sesion';

// Solo una base dedicada: nunca modifica el esquema public ni una base de producción.
const url=process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('J1 · API y PostgreSQL real con RLS',()=>{
  let pool:Pool,app:NestExpressApplication;
  const esquema='test_'+randomUUID().replaceAll('-','');
  let inst:string,otra:string,admin:string,prof:string,ayudante:string,alumno:string,director:string,ajeno:string;
  let periodo:string,curso:string,seccion:string;
  const cookie=(usuarioId:string,institucionId=inst)=>'dc_sesion='+app.get(SesionService).emitir({
    usuarioId,email:'prueba@example.invalid',nombre:'Prueba',institucionActivaId:institucionId,roles:[],
  });
  const get=(ruta:string,u=admin,i=inst)=>request(app.getHttpServer()).get('/api/'+ruta).set('Cookie',cookie(u,i));
  const post=(ruta:string,datos:unknown,u=admin,i=inst)=>request(app.getHttpServer()).post('/api/'+ruta).set('Cookie',cookie(u,i)).send(datos);
  const put=(ruta:string,datos:unknown,u=admin)=>request(app.getHttpServer()).put('/api/'+ruta).set('Cookie',cookie(u)).send(datos);
  const ctx=<T>(fn:(db:import('pg').PoolClient)=>Promise<T>,i=inst)=>app.get(ContextoInstitucion).ejecutar(i,fn);
  beforeAll(async()=>{
    if(!new URL(url!).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en _test');
    const provision=new Pool({connectionString:url});
    const permisos=await provision.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
    if(permisos.rows[0].rolsuper || permisos.rows[0].rolbypassrls) throw new Error('Las pruebas deben usar un rol sin SUPERUSER ni BYPASSRLS');
    await provision.query('CREATE SCHEMA '+esquema);
    await provision.end();
    pool=new Pool({connectionString:url,options:'-c search_path='+esquema+',public',max:5});
    const dir=join(process.cwd(),'db','migrations');
    for(const f of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) await pool.query(readFileSync(join(dir,f),'utf8'));
    await pool.query('CREATE TABLE schema_migraciones(archivo text PRIMARY KEY)');
    await pool.query("INSERT INTO schema_migraciones VALUES ('003_configuracion_academica.sql')");
    const modulo=await Test.createTestingModule({imports:[AppModule]})
      .overrideProvider(CONFIG).useValue(cargarConfig({SESSION_SECRET:'secreto-solo-pruebas-de-integracion-123456789',APP_URL:'http://localhost:5173'}))
      .overrideProvider(PG_POOL).useValue(pool).compile();
    app=configurarApp(modulo.createNestApplication<NestExpressApplication>());
    await app.init();
  },30000);
  afterAll(async()=>{
    if(pool) {
      // esquema generado por esta suite, nunca interpolado desde el entorno.
      await pool.query('DROP SCHEMA IF EXISTS '+esquema+' CASCADE');
      if(app)await app.close();else await pool.end();
    }
  });
  beforeEach(async()=>{
    inst=randomUUID();otra=randomUUID();
    await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$3),($2,$4)',[inst,otra,inst,otra]);
    const crearUsuario=async(rol:Rol,i=inst)=>{
      const uid=randomUUID();
      await pool.query('INSERT INTO usuario(id,email,nombre) VALUES ($1,$2,$3)',[uid,uid+'@example.invalid',rol+' sintético']);
      await pool.query('INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,$3)',[uid,i,rol]);
      return uid;
    };
    admin=await crearUsuario('ADMINISTRADOR');prof=await crearUsuario('PROFESOR');
    ayudante=await crearUsuario('AYUDANTE');alumno=await crearUsuario('ALUMNO');
    director=await crearUsuario('DIRECTOR');ajeno=await crearUsuario('PROFESOR');
    await pool.query("INSERT INTO rol_en_institucion VALUES ($1,$2,'ADMINISTRADOR',now())",[admin,otra]);
    periodo=(await post('periodos',{nombre:'2026-2',fechaInicio:'2026-08-01',fechaFin:'2026-12-20'}).expect(201)).body.id;
    curso=(await post('academico/cursos',{periodoId:periodo,codigo:'ICC-4204',nombre:'Introducción al software'}).expect(201)).body.id;
    seccion=(await post('academico/secciones',{periodoId:periodo,cursoId:curso,codigo:'01'}).expect(201)).body.id;
  });
  it('persiste período, curso y sección y rechaza duplicados normalizados',async()=>{
    expect((await get('academico/secciones').expect(200)).body[0]).toMatchObject({id:seccion,cursoCodigo:'ICC-4204'});
    await post('academico/cursos',{periodoId:periodo,codigo:' icc-4204 ',nombre:'Duplicado'}).expect(409);
    await post('academico/secciones',{periodoId:periodo,cursoId:curso,codigo:'01'}).expect(409);
    expect((await get('periodos/'+periodo).expect(200)).body.creadoPor.id).toBe(admin);
  });
  it('no admite referencias ni lecturas cruzadas entre instituciones',async()=>{
    await post('academico/secciones',{periodoId:periodo,cursoId:curso,codigo:'02'},admin,otra).expect(400);
    expect((await get('academico/secciones',admin,otra).expect(200)).body).toEqual([]);
    await get('academico/secciones/'+seccion,admin,otra).expect(404);
    const r=await ctx(db=>db.query('SELECT * FROM curso WHERE id=$1',[curso]),otra);
    expect(r.rowCount).toBe(0);
    await expect(ctx(db=>db.query('INSERT INTO seccion(institucion_id,periodo_id,curso_id,codigo,creado_por) VALUES ($1,$2,$3,$4,$5)',
      [otra,periodo,curso,'x',admin]),otra)).rejects.toMatchObject({code:'23503'});
    await expect(ctx(db=>db.query('INSERT INTO curso(institucion_id,periodo_id,codigo,nombre,creado_por) VALUES ($1,$2,$3,$4,$5)',
      [otra,periodo,'X','Intento',admin]))).rejects.toMatchObject({code:'42501'});
  });
  it('asigna equipo, lo recupera y deniega a un docente ajeno',async()=>{
    await put('academico/secciones/'+seccion+'/equipo',{profesorId:prof,ayudanteIds:[ayudante]}).expect(200);
    expect((await get('academico/secciones',prof).expect(200)).body).toHaveLength(1);
    expect((await get('academico/secciones/'+seccion,ayudante).expect(200)).body.equipo).toHaveLength(2);
    await get('academico/secciones/'+seccion,ajeno).expect(403);
    expect((await get('academico/secciones',ajeno).expect(200)).body).toHaveLength(0);
  });
  it('rechaza roles incorrectos sin borrar el equipo anterior',async()=>{
    const ruta='academico/secciones/'+seccion+'/equipo';
    await put(ruta,{profesorId:prof,ayudanteIds:[ayudante]}).expect(200);
    await put(ruta,{profesorId:alumno,ayudanteIds:[]}).expect(400);
    const externo=randomUUID();
    await pool.query('INSERT INTO usuario(id,email) VALUES ($1,$2)',[externo,externo+'@example.invalid']);
    await pool.query("INSERT INTO rol_en_institucion VALUES ($1,$2,'PROFESOR',now())",[externo,otra]);
    await put(ruta,{profesorId:externo,ayudanteIds:[]}).expect(400);
    expect((await get('academico/secciones/'+seccion).expect(200)).body.equipo).toHaveLength(2);
  });
  it('una reasignación revoca el acceso del docente anterior y conserva auditoría',async()=>{
    const ruta='academico/secciones/'+seccion+'/equipo';
    await put(ruta,{profesorId:prof,ayudanteIds:[]}).expect(200);
    await put(ruta,{profesorId:ajeno,ayudanteIds:[]}).expect(200);
    await get('academico/secciones/'+seccion,prof).expect(403);
    const d=(await get('academico/secciones/'+seccion,ajeno).expect(200)).body;
    expect(d.eventos.filter((e:{accion:string})=>e.accion==='ASIGNAR_EQUIPO')).toHaveLength(2);
  });
  it('permite validar nómina antes de asignar equipo, según H10 → H07',async()=>{
    await post('academico/secciones/'+seccion+'/nomina/validar',{emails:[alumno+'@example.invalid']}).expect(201);
  });
  it('identifica filas inválidas sin guardar ninguna y revalida al confirmar',async()=>{
    await put('academico/secciones/'+seccion+'/equipo',{profesorId:prof,ayudanteIds:[]}).expect(200);
    const emails=[alumno+'@example.invalid','incorrecto','desconocido@example.invalid',alumno+'@example.invalid'];
    const r=await post('academico/secciones/'+seccion+'/nomina/validar',{emails}).expect(201);
    expect(r.body.valida).toBe(false);expect(r.body.filas.filter((f:{motivo:string|null})=>f.motivo)).toHaveLength(3);
    await post('academico/secciones/'+seccion+'/nomina',{emails}).expect(400);
    expect((await get('academico/secciones/'+seccion).expect(200)).body.nomina).toHaveLength(0);
    await post('academico/secciones/'+seccion+'/nomina/validar',{emails:[alumno+'@example.invalid']}).expect(201);
    await pool.query('UPDATE usuario SET activo=false WHERE id=$1',[alumno]);
    await post('academico/secciones/'+seccion+'/nomina',{emails:[alumno+'@example.invalid']}).expect(400);
  });
  it('carga idempotente; profesor consulta nómina y alumno solo sus secciones',async()=>{
    await put('academico/secciones/'+seccion+'/equipo',{profesorId:prof,ayudanteIds:[ayudante]}).expect(200);
    const ruta='academico/secciones/'+seccion+'/nomina',datos={emails:[alumno+'@example.invalid']};
    expect((await post(ruta,datos).expect(201)).body.agregados).toBe(1);
    expect((await post(ruta,datos).expect(201)).body).toMatchObject({agregados:0,total:1});
    expect((await get('academico/secciones/'+seccion,prof).expect(200)).body.nomina[0].id).toBe(alumno);
    expect((await get('academico/secciones',alumno).expect(200)).body).toHaveLength(1);
    await get('academico/secciones/'+seccion,alumno).expect(403);
  });
  it('dos cargas concurrentes no duplican alumnos',async()=>{
    await put('academico/secciones/'+seccion+'/equipo',{profesorId:prof,ayudanteIds:[]}).expect(200);
    const ruta='academico/secciones/'+seccion+'/nomina',datos={emails:[alumno+'@example.invalid']};
    const resultados=await Promise.all([post(ruta,datos).expect(201),post(ruta,datos).expect(201)]);
    expect(resultados.reduce((n,r)=>n+r.body.agregados,0)).toBe(1);
  });
  it('director no accede a nóminas ni listados personales',async()=>{
    await get('periodos',director).expect(200);
    await get('academico/secciones',director).expect(403);
    await get('academico/docentes',director).expect(403);
    await get('academico/secciones/'+seccion,director).expect(403);
  });
  it('deniega escritura a profesor, ayudante y alumno incluso vía API',async()=>{
    for(const u of [prof,ayudante,alumno,director]) {
      await post('academico/cursos',{codigo:'NO',nombre:'No'},u).expect(403);
      await put('academico/secciones/'+seccion+'/equipo',{profesorId:prof,ayudanteIds:[]},u).expect(403);
      await post('academico/secciones/'+seccion+'/nomina',{emails:[alumno+'@example.invalid']},u).expect(403);
    }
  });
  it('revoca cuentas inactivas y rechaza sesión ausente y origen ajeno',async()=>{
    await request(app.getHttpServer()).get('/api/academico/secciones').expect(401);
    const c=cookie(admin);
    await request(app.getHttpServer()).post('/api/academico/cursos').set('Cookie',c).set('Origin','https://ajeno.invalid').send({codigo:'X',nombre:'X'}).expect(403);
    await pool.query('UPDATE usuario SET activo=false WHERE id=$1',[admin]);
    await request(app.getHttpServer()).get('/api/academico/secciones').set('Cookie',c).expect(401);
  });
  it('valida entradas de API y conserva la bitácora inmutable',async()=>{
    await post('academico/cursos',{codigo:' ',nombre:'X'}).expect(400);
    await post('academico/secciones',{periodoId:'inválido',cursoId:curso,codigo:'02'}).expect(400);
    await get('academico/secciones/no-uuid').expect(400);
    await expect(ctx(db=>db.query('UPDATE evento_academico SET accion=$1',['ALTERADO']))).rejects.toThrow('solo lectura');
    await request(app.getHttpServer()).get('/api/health/ready').expect(200);
  });

  it('H06 separa cursos por período y H07 impide enlazarlos al período equivocado',async()=>{
    const p=(await post('periodos',{nombre:'2027-1',fechaInicio:'2027-03-01',fechaFin:'2027-07-01'}).expect(201)).body.id;
    await post('academico/cursos',{periodoId:p,codigo:'ICC-4204',nombre:'Curso siguiente'}).expect(201);
    expect((await get('academico/cursos?periodoId='+periodo).expect(200)).body.map((c:{id:string})=>c.id)).toEqual([curso]);
    await post('academico/secciones',{periodoId:p,cursoId:curso,codigo:'02'}).expect(400);
  });
  it('H03 una escritura denegada no cambia datos',async()=>{
    const antes=await ctx(db=>db.query('SELECT count(*)::int AS n FROM curso'));
    await post('academico/cursos',{periodoId:periodo,codigo:'NO',nombre:'No'},prof).expect(403);
    expect((await ctx(db=>db.query('SELECT count(*)::int AS n FROM curso'))).rows).toEqual(antes.rows);
  });
  it('H10 rechaza alumnos habilitados solamente en otra institución',async()=>{
    const uid=randomUUID(),email=uid+'@example.invalid';
    await pool.query('INSERT INTO usuario(id,email) VALUES ($1,$2)',[uid,email]);
    await pool.query("INSERT INTO rol_en_institucion VALUES ($1,$2,'ALUMNO',now())",[uid,otra]);
    const r=await post('academico/secciones/'+seccion+'/nomina/validar',{emails:[email]}).expect(201);
    expect(r.body.valida).toBe(false);
    await post('academico/secciones/'+seccion+'/nomina',{emails:[email]}).expect(400);
  });
  it('rechaza una pantalla con institución desactualizada antes de escribir',async()=>{
    await request(app.getHttpServer()).post('/api/periodos').set('Cookie',cookie(admin,otra))
      .set('X-Institucion-Id',inst).send({nombre:'No guardar',fechaInicio:'2027-01-01',fechaFin:'2027-02-01'}).expect(409);
    expect((await get('periodos',admin,otra).expect(200)).body).toHaveLength(0);
  });
});
