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

const url=process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('H33 · Reintentar una carga interrumpida',()=>{
  let pool:Pool,app:NestExpressApplication;
  const esquema='test_h33_'+randomUUID().replaceAll('-','');
  let inst:string,admin:string,prof:string,alumno:string,seccion:string,actividad:string;
  const cookie=(usuario:string)=>'dc_sesion='+app.get(SesionService).emitir({usuarioId:usuario,email:'prueba@example.invalid',nombre:'Prueba',institucionActivaId:inst,roles:[]});
  const http=()=>request(app.getHttpServer());
  const configurar=(aperturaEn:string,cierreEn:string)=>http().put(`/api/actividades/secciones/${seccion}/actividades/${actividad}/configuracion`)
    .set('Cookie',cookie(prof)).send({aperturaEn,cierreEn,formatosPermitidos:['txt'],tamanoMaximoMb:1});
  const entregar=(clave:string,contenido=Buffer.from('informe'),nombre='informe.txt',tipo='text/plain')=>http()
    .post(`/api/actividades/secciones/${seccion}/actividades/${actividad}/entrega`)
    .set('Cookie',cookie(alumno)).set('X-Idempotency-Key',clave).attach('archivo',contenido,{filename:nombre,contentType:tipo});
  const listar=()=>http().get('/api/actividades/secciones/'+seccion).set('Cookie',cookie(alumno));

  beforeAll(async()=>{
    if(!new URL(url!).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL debe terminar en _test');
    const provision=new Pool({connectionString:url}); await provision.query('CREATE SCHEMA '+esquema); await provision.end();
    pool=new Pool({connectionString:url,options:'-c search_path='+esquema+',public',max:5});
    const dir=join(process.cwd(),'db','migrations');
    for(const archivo of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) await pool.query(readFileSync(join(dir,archivo),'utf8'));
    const modulo=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(CONFIG)
      .useValue(cargarConfig({SESSION_SECRET:'secreto-solo-pruebas-h33-123456789',APP_URL:'http://localhost:5173'}))
      .overrideProvider(PG_POOL).useValue(pool).compile();
    app=configurarApp(modulo.createNestApplication<NestExpressApplication>()); await app.init();
  },30000);
  afterAll(async()=>{if(pool){await pool.query('DROP SCHEMA IF EXISTS '+esquema+' CASCADE');if(app)await app.close();else await pool.end();}});

  beforeEach(async()=>{
    inst=randomUUID();await pool.query('INSERT INTO institucion(id,nombre) VALUES($1,$2)',[inst,inst]);
    const crear=async(rol:Rol)=>{const id=randomUUID();await pool.query('INSERT INTO usuario(id,email,nombre) VALUES($1,$2,$3)',[id,id+'@example.invalid',rol]);
      await pool.query('INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES($1,$2,$3)',[id,inst,rol]);return id;};
    admin=await crear('ADMINISTRADOR');prof=await crear('PROFESOR');alumno=await crear('ALUMNO');
    const periodo=(await http().post('/api/periodos').set('Cookie',cookie(admin)).send({nombre:'2026-2',fechaInicio:'2026-08-01',fechaFin:'2026-12-20'})).body.id;
    const curso=(await http().post('/api/academico/cursos').set('Cookie',cookie(admin)).send({periodoId:periodo,codigo:'ICC-4204',nombre:'Software'})).body.id;
    seccion=(await http().post('/api/academico/secciones').set('Cookie',cookie(admin)).send({periodoId:periodo,cursoId:curso,codigo:'01'})).body.id;
    await http().put('/api/academico/secciones/'+seccion+'/equipo').set('Cookie',cookie(admin)).send({profesorId:prof,ayudanteIds:[]}).expect(200);
    await http().post('/api/academico/secciones/'+seccion+'/nomina').set('Cookie',cookie(admin)).send({emails:[alumno+'@example.invalid']}).expect(201);
    actividad=(await http().post('/api/actividades/secciones/'+seccion).set('Cookie',cookie(prof)).send({titulo:'Informe',instrucciones:'Subir TXT'})).body.id;
    await configurar(new Date(Date.now()-3600000).toISOString(),new Date(Date.now()+3600000).toISOString()).expect(200);
  });

  it('CA1: repetir el mismo intento devuelve un solo comprobante sin cambiar su fecha',async()=>{
    const clave=randomUUID();
    const [primero,segundo]=await Promise.all([entregar(clave),entregar(clave)]);
    expect(primero.status).toBe(201);expect(segundo.status).toBe(201);
    expect(segundo.body.id).toBe(primero.body.id);
    expect(new Date(segundo.body.recibidoEn).getTime()).toBe(new Date(primero.body.recibidoEn).getTime());
    expect([primero.body.reintento,segundo.body.reintento].sort()).toEqual([false,true]);
    const filas=await app.get(ContextoInstitucion).ejecutar(inst,db=>db.query('SELECT id,clave_idempotencia FROM entrega_archivo WHERE actividad_id=$1 AND alumno_id=$2',[actividad,alumno]));
    expect(filas.rows).toEqual([{id:primero.body.id,clave_idempotencia:clave}]);
  });

  it('CA2: un fallo informa la causa y no genera comprobante; luego permite reintentar',async()=>{
    const clave=randomUUID();
    const fallo=await entregar(clave,Buffer.from('contenido'),'informe.pdf','application/pdf').expect(400);
    expect(fallo.body.message).toContain('PDF inválido');
    expect((await listar().expect(200)).body.actividades[0].comprobante).toBeNull();
    const reintento=await entregar(clave).expect(201);
    expect(reintento.body.nombreArchivo).toBe('informe.txt');
    expect((await listar().expect(200)).body.actividades[0].comprobante.id).toBe(reintento.body.id);
  });

  it('CA3: el reintento cerrado se rechaza y funciona después de una reapertura autorizada',async()=>{
    const clave=randomUUID();
    await configurar(new Date(Date.now()-7200000).toISOString(),new Date(Date.now()-3600000).toISOString()).expect(200);
    const cerrado=await entregar(clave).expect(400); expect(cerrado.body.message).toContain('plazo');
    expect((await listar().expect(200)).body.actividades[0].comprobante).toBeNull();
    await configurar(new Date(Date.now()-7200000).toISOString(),new Date(Date.now()+3600000).toISOString()).expect(200);
    await entregar(clave).expect(201);
  });

  it('una selección nueva usa otra clave y reemplaza la entrega sin duplicar la fila',async()=>{
    const primera=await entregar(randomUUID(),Buffer.from('uno'),'uno.txt').expect(201);
    const segunda=await entregar(randomUUID(),Buffer.from('dos'),'dos.txt').expect(201);
    expect(segunda.body.id).toBe(primera.body.id); expect(segunda.body.nombreArchivo).toBe('dos.txt');
    const cantidad=await app.get(ContextoInstitucion).ejecutar(inst,db=>db.query('SELECT count(*) n FROM entrega_archivo WHERE actividad_id=$1',[actividad]));
    expect(Number(cantidad.rows[0].n)).toBe(1);
  });
});
