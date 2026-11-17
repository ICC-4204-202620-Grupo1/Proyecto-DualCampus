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

describe.skipIf(!url)('H26 · Reutilizar material entre períodos', () => {
  let pool: Pool, app: NestExpressApplication;
  const esquema = 'test_h26_' + randomUUID().replaceAll('-', '');
  let inst: string, admin: string, profesor: string, profesorAjeno: string, alumno: string;
  let origen: string, destino: string, material: string;

  const cookie = (usuarioId: string, institucionId = inst) => 'dc_sesion=' + app.get(SesionService).emitir({
    usuarioId,email:'prueba@example.invalid',nombre:'Prueba',institucionActivaId:institucionId,roles:[],
  });
  const get = (ruta: string, usuario = profesor, institucion = inst) => request(app.getHttpServer())
    .get('/api/' + ruta).set('Cookie',cookie(usuario,institucion));
  const post = (ruta: string, datos: unknown = {}, usuario = profesor, institucion = inst) => request(app.getHttpServer())
    .post('/api/' + ruta).set('Cookie',cookie(usuario,institucion)).send(datos);
  const put = (ruta: string, datos: unknown, usuario = profesor, institucion = inst) => request(app.getHttpServer())
    .put('/api/' + ruta).set('Cookie',cookie(usuario,institucion)).send(datos);

  beforeAll(async () => {
    if (!new URL(url!).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL debe terminar en _test');
    const provision = new Pool({connectionString:url});
    await provision.query('CREATE SCHEMA ' + esquema); await provision.end();
    pool = new Pool({connectionString:url,options:'-c search_path=' + esquema + ',public',max:5});
    const dir = join(process.cwd(),'db','migrations');
    for (const archivo of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
      await pool.query(readFileSync(join(dir,archivo),'utf8'));
    }
    const modulo = await Test.createTestingModule({imports:[AppModule]})
      .overrideProvider(CONFIG).useValue(cargarConfig({SESSION_SECRET:'secreto-solo-pruebas-h26-123456789',APP_URL:'http://localhost:5173'}))
      .overrideProvider(PG_POOL).useValue(pool).compile();
    app = configurarApp(modulo.createNestApplication<NestExpressApplication>()); await app.init();
  },30000);

  afterAll(async () => {
    if (pool) { await pool.query('DROP SCHEMA IF EXISTS ' + esquema + ' CASCADE'); if (app) await app.close(); else await pool.end(); }
  });

  beforeEach(async () => {
    inst=randomUUID(); await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$2)',[inst,inst]);
    const usuario = async (rol: Rol) => {
      const id=randomUUID(); await pool.query('INSERT INTO usuario(id,email,nombre) VALUES ($1,$2,$3)',[id,id+'@example.invalid',rol]);
      await pool.query('INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,$3)',[id,inst,rol]); return id;
    };
    admin=await usuario('ADMINISTRADOR'); profesor=await usuario('PROFESOR'); profesorAjeno=await usuario('PROFESOR'); alumno=await usuario('ALUMNO');
    const crearSeccion = async (nombre:string,inicio:string,fin:string,codigo:string) => {
      const p=(await post('periodos',{nombre,fechaInicio:inicio,fechaFin:fin},admin)).body.id;
      const c=(await post('academico/cursos',{periodoId:p,codigo:'ICC-'+codigo,nombre:'Curso '+codigo},admin)).body.id;
      const s=(await post('academico/secciones',{periodoId:p,cursoId:c,codigo:'01'},admin)).body.id;
      await put('academico/secciones/'+s+'/equipo',{profesorId:profesor,ayudanteIds:[]},admin).expect(200);
      return s as string;
    };
    origen=await crearSeccion('2025-2','2025-08-01','2025-12-20','2025');
    destino=await crearSeccion('2026-2','2026-08-01','2026-12-20','2026');
    await post('academico/secciones/'+destino+'/nomina',{emails:[alumno+'@example.invalid']},admin).expect(201);
    material=(await post('materiales/secciones/'+origen,{
      titulo:'Guía original',nombreArchivo:'guia.txt',tipo:'text/plain',contenidoBase64:Buffer.from('contenido original').toString('base64'),
    }).expect(201)).body.id;
  });

  it('CA1: ofrece solo materiales de otra sección autorizada de la institución activa', async () => {
    const opciones=await get('materiales/secciones/'+destino+'/reutilizacion/opciones').expect(200);
    expect(opciones.body).toEqual([expect.objectContaining({id:material,seccionId:origen,periodo:'2025-2',titulo:'Guía original'})]);
    await get('materiales/secciones/'+destino+'/reutilizacion/opciones',profesorAjeno).expect(403);
    await post('materiales/secciones/'+destino+'/reutilizaciones',{materialOrigenId:material},profesorAjeno).expect(403);
  });

  it('CA2: crea borrador invisible para el alumno y lo publica solo en un segundo paso', async () => {
    const copia=await post('materiales/secciones/'+destino+'/reutilizaciones',{materialOrigenId:material}).expect(201);
    const listaProfesor=await get('materiales/secciones/'+destino).expect(200);
    expect(listaProfesor.body.materiales).toEqual([]);
    expect(listaProfesor.body.borradores).toEqual([expect.objectContaining({id:copia.body.id,origenMaterialId:material})]);
    const listaAlumno=await get('materiales/secciones/'+destino,alumno).expect(200);
    expect(listaAlumno.body.materiales).toEqual([]); expect(listaAlumno.body.borradores).toEqual([]);
    await get('materiales/secciones/'+destino+'/materiales/'+copia.body.id+'/descargar',alumno).expect(404);

    await post('materiales/secciones/'+destino+'/borradores/'+copia.body.id+'/publicar').expect(201);
    const publicada=await get('materiales/secciones/'+destino,alumno).expect(200);
    expect(publicada.body.materiales).toEqual([expect.objectContaining({id:copia.body.id,titulo:'Guía original'})]);
    const descarga=await get('materiales/secciones/'+destino+'/materiales/'+copia.body.id+'/descargar',alumno).expect(200);
    expect(Buffer.isBuffer(descarga.body) ? descarga.body.toString() : descarga.text).toBe('contenido original');
    await post('materiales/secciones/'+destino+'/borradores/'+copia.body.id+'/publicar').expect(409);
  });

  it('CA3: editar la copia conserva intactos el título y contenido originales', async () => {
    const copia=(await post('materiales/secciones/'+destino+'/reutilizaciones',{materialOrigenId:material}).expect(201)).body.id;
    await put('materiales/secciones/'+destino+'/borradores/'+copia,{titulo:'Guía actualizada 2026'}).expect(200);
    await post('materiales/secciones/'+destino+'/borradores/'+copia+'/publicar').expect(201);
    const filas=await app.get(ContextoInstitucion).ejecutar(inst,db => db.query(
      'SELECT id,titulo,contenido,origen_material_id FROM material_curso WHERE id=ANY($1::uuid[]) ORDER BY id',[ [material,copia] ]));
    const original=filas.rows.find(f => f.id===material), copiada=filas.rows.find(f => f.id===copia);
    expect(original.titulo).toBe('Guía original'); expect(original.origen_material_id).toBeNull();
    expect(copiada.titulo).toBe('Guía actualizada 2026'); expect(copiada.origen_material_id).toBe(material);
    expect(copiada.contenido.equals(original.contenido)).toBe(true);
  });

  it('revierte copia o publicación si no puede registrar su evento de auditoría', async () => {
    await pool.query("ALTER TABLE evento_academico ADD CONSTRAINT fallo_h26 CHECK (accion NOT IN ('PREPARAR_COPIA_MATERIAL','PUBLICAR_COPIA_MATERIAL')) NOT VALID");
    try {
      await post('materiales/secciones/'+destino+'/reutilizaciones',{materialOrigenId:material}).expect(500);
      const cantidad=await app.get(ContextoInstitucion).ejecutar(inst,db => db.query("SELECT count(*)::int n FROM material_curso WHERE seccion_id=$1 AND estado='BORRADOR'",[destino]));
      expect(cantidad.rows[0].n).toBe(0);
    } finally { await pool.query('ALTER TABLE evento_academico DROP CONSTRAINT fallo_h26'); }
  });
});
