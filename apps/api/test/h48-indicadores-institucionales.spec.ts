/** H48 · Consultar indicadores institucionales — evidencia de CA1, CA2 y CA3. */
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
import {
  DatosGrupo,
  indicadoresDeGrupo,
  indicadoresTotales,
  MINIMO_ALUMNOS,
} from '../src/modules/reporteria/anonimizacion.js';

/** Construye un grupo: notas[i] y marcas[i] son las del alumno i. */
function grupo(notas: number[][], marcas: boolean[][] = []): DatosGrupo {
  const n = Math.max(notas.length, marcas.length);
  const alumnos = Array.from({ length: n }, (_, i) => `a${i}`);
  return {
    alumnos: new Set(alumnos),
    notas: notas.flatMap((ns, i) => ns.map((valor) => ({ alumno: alumnos[i], valor, aprueba: valor >= 4 }))),
    marcas: marcas.flatMap((ms, i) => ms.map((presente) => ({ alumno: alumnos[i], presente }))),
  };
}
const celdas = (g: ReturnType<typeof indicadoresDeGrupo>) => g.distribucion.rangos.map((c) => c.cantidad);

describe('H48 · Reglas de anonimización', () => {
  it('el mínimo de alumnos es cinco', () => {
    expect(MINIMO_ALUMNOS).toBe(5);
  });

  describe('CA2 · Grupos con menos de cinco alumnos', () => {
    it('un grupo de cuatro alumnos se suprime completo, incluido su tamaño', () => {
      const r = indicadoresDeGrupo(grupo([[2], [3], [5], [6]], [[true], [false], [true], [true]]));
      expect(r.alumnos).toBeNull();
      expect(r.motivo).toBe('grupo_pequeno');
      expect([r.promedioNotas.valor, r.aprobacion.valor, r.asistencia.valor]).toEqual([null, null, null]);
      expect(celdas(r).every((c) => c === null)).toBe(true);
    });

    it('con cinco alumnos y resultados variados se publica', () => {
      const r = indicadoresDeGrupo(grupo([[3, 5], [3, 5], [3, 5], [3, 5], [3, 5]], [[true, false], [true], [true], [true], [true]]));
      expect(r.alumnos).toBe(5);
      expect(r.promedioNotas.valor).toBe(4);
      expect(r.aprobacion.valor).toBe(50);
      expect(r.asistencia.valor).toBe(83.3);
      expect(celdas(r)).toEqual([0, 0, 5, 0, 5, 0]);
    });

    it('cada indicador exige cinco alumnos que aporten datos, aunque el grupo sea mayor', () => {
      // Seis matriculados, pero solo cuatro tienen notas.
      const d = grupo([[3], [5], [6], [2], [], []], [[true], [false], [true], [true], [true], [false]]);
      const r = indicadoresDeGrupo(d);
      expect(r.alumnos).toBe(6);
      expect(r.promedioNotas).toEqual({ valor: null, motivo: 'grupo_pequeno' });
      expect(r.aprobacion).toEqual({ valor: null, motivo: 'grupo_pequeno' });
      expect(r.distribucion.motivo).toBe('grupo_pequeno');
      expect(r.asistencia.valor).toBe(66.7);
    });
  });

  describe('CA2 · Combinaciones reveladoras', () => {
    it('100 % de aprobación o de asistencia revelaría el resultado de cada alumno', () => {
      const r = indicadoresDeGrupo(grupo([[5], [6], [4.5], [5.5], [6.5]], [[true], [true], [true], [true], [true]]));
      expect(r.aprobacion).toEqual({ valor: null, motivo: 'unanime' });
      expect(r.asistencia).toEqual({ valor: null, motivo: 'unanime' });
      expect(r.promedioNotas.valor).toBe(5.5);
    });

    it('0 % de aprobación también se suprime', () => {
      expect(indicadoresDeGrupo(grupo([[2], [3], [3.5], [1], [2.5]])).aprobacion.motivo).toBe('unanime');
    });

    it('si todas las notas son iguales, se suprimen el promedio y la distribución', () => {
      const r = indicadoresDeGrupo(grupo([[6.5], [6.5], [6.5], [6.5], [6.5]]));
      expect(r.promedioNotas.motivo).toBe('unanime');
      expect(r.distribucion.motivo).toBe('unanime');
    });

    it('si todas las notas caen en un mismo rango, la distribución se suprime', () => {
      const r = indicadoresDeGrupo(grupo([[6.0], [6.2], [6.5], [6.8], [7.0]]));
      expect(r.distribucion.motivo).toBe('unanime');
      expect(r.promedioNotas.valor).toBe(6.5);
    });

    it('una celda con menos de cinco alumnos se oculta, y otra más por complemento', () => {
      // Rango 2: un alumno; rango 3: seis; rango 5: seis; rango 6: cinco.
      const notas = [[2.5], ...Array(6).fill([3.5]), ...Array(6).fill([5.5]), ...Array(5).fill([6.5])];
      const r = indicadoresDeGrupo(grupo(notas));
      expect(celdas(r)).toEqual([0, null, 6, 0, 6, null]);
      expect(r.distribucion.rangos[1].motivo).toBe('grupo_pequeno');
      expect(r.distribucion.rangos[5].motivo).toBe('complementaria');
    });

    it('las celdas se cuentan por alumnos distintos, no por notas', () => {
      // Un solo alumno con cinco notas en el rango 2 no forma un grupo de cinco.
      const notas = [[2.1, 2.2, 2.3, 2.4, 2.5], ...Array(6).fill([5.5]), ...Array(6).fill([6.5])];
      const r = indicadoresDeGrupo(grupo(notas));
      expect(r.distribucion.rangos[1]).toMatchObject({ cantidad: null, motivo: 'grupo_pequeno' });
    });

    it('el total institucional no incluye grupos ni celdas suprimidos', () => {
      const grande = grupo([[2.5], ...Array(6).fill([3.5]), ...Array(6).fill([5.5]), ...Array(5).fill([6.5])]);
      const chico = grupo([[1.0], [1.0], [1.0]]);
      chico.alumnos = new Set(['c0', 'c1', 'c2']);
      chico.notas = chico.notas.map((n, i) => ({ ...n, alumno: `c${i}` }));
      const grupos = [grande, chico].map((datos) => ({ datos, publicos: indicadoresDeGrupo(datos) }));
      const total = indicadoresTotales(grupos);
      expect(total.alumnos).toBe(18);
      // El rango 1 del grupo chico y las celdas ocultas del grande no aparecen en el total.
      expect(total.distribucion.rangos.map((c) => c.cantidad)).toEqual([0, 0, 6, 0, 6, 0]);
      // El promedio total es el del grupo grande: las notas 1,0 del grupo chico no entran.
      expect(total.promedioNotas.valor).toBe(grupos[0].publicos.promedioNotas.valor);
    });

    it('si hay notas pero ninguna celda es publicable, el total lo informa como oculto y no como sin datos', () => {
      // Ocho alumnos repartidos de a uno o dos por rango: ninguna celda llega a cinco alumnos.
      const d = grupo([[2.5], [3.2], [3.8], [4.1], [4.5], [5.0], [6.2], [6.8]]);
      const total = indicadoresTotales([{ datos: d, publicos: indicadoresDeGrupo(d) }]);
      expect(total.distribucion.motivo).toBe('grupo_pequeno');
      expect(total.promedioNotas.valor).toBe(4.5);
      const vacio = grupo([[], [], [], [], []]);
      expect(indicadoresTotales([{ datos: vacio, publicos: indicadoresDeGrupo(vacio) }]).distribucion.motivo).toBe('sin_datos');
    });

    it('una institución con menos de cinco alumnos en total no publica nada', () => {
      const d = grupo([[3], [5], [6]]);
      const total = indicadoresTotales([{ datos: d, publicos: indicadoresDeGrupo(d) }]);
      expect(total.alumnos).toBeNull();
      expect(total.motivo).toBe('grupo_pequeno');
    });
  });
});

// Endpoint completo sobre PostgreSQL con RLS (misma base dedicada que H39, H43 y H44).
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('H48 · Indicadores institucionales en PostgreSQL', () => {
  let pool: Pool;
  let app: NestExpressApplication;
  const esquema = 'test_h48_' + randomUUID().replaceAll('-', '');
  let instA: string, instB: string, director: string, adminA: string, profesor: string;
  let periodo: string, periodoB: string, seccionGrande: string, evaluacionGrande: string;
  const alumnos: { id: string; email: string; nombre: string }[] = [];

  const cookie = (usuarioId: string, institucionId = instA) =>
    'dc_sesion=' + app.get(SesionService).emitir({
      usuarioId, email: 'prueba@example.invalid', nombre: 'Prueba', institucionActivaId: institucionId,
      roles: [], esSuperadministrador: false,
    });
  const http = () => request(app.getHttpServer());
  const indicadores = (usuarioId = director, query = '?periodoId=' + periodo, institucionId = instA) =>
    http().get('/api/reporteria/indicadores-institucionales' + query).set('Cookie', cookie(usuarioId, institucionId));

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
      .useValue(cargarConfig({ SESSION_SECRET: 'secreto-solo-pruebas-h48-con-longitud-adecuada', APP_URL: 'http://localhost:5173' }))
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .compile();
    app = configurarApp(modulo.createNestApplication<NestExpressApplication>());
    await app.init();

    instA = randomUUID(); instB = randomUUID();
    await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$2),($3,$4)', [instA, 'A ' + instA, instB, 'B ' + instB]);
    async function usuario(rol: string, institucionId: string, nombre = rol + ' demo') {
      const id = randomUUID();
      const email = id + '@example.invalid';
      await pool.query('INSERT INTO usuario(id,email,nombre) VALUES ($1,$2,$3)', [id, email, nombre]);
      await pool.query('INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,$3)', [id, institucionId, rol]);
      return { id, email, nombre };
    }
    director = (await usuario('DIRECTOR', instA)).id;
    adminA = (await usuario('ADMINISTRADOR', instA)).id;
    profesor = (await usuario('PROFESOR', instA)).id;
    const adminB = (await usuario('ADMINISTRADOR', instB)).id;
    for (let i = 0; i < 21; i++) alumnos.push(await usuario('ALUMNO', instA, `Alumna Sintética ${i}`));

    const contexto = app.get(ContextoInstitucion);
    periodo = await contexto.ejecutar(instA, async (db) => (await db.query(
      `INSERT INTO periodo(institucion_id,nombre,fecha_inicio,fecha_fin,creado_por) VALUES ($1,'2026-2','2026-08-01','2026-12-20',$2) RETURNING id`,
      [instA, adminA])).rows[0].id);
    periodoB = await contexto.ejecutar(instB, async (db) => (await db.query(
      `INSERT INTO periodo(institucion_id,nombre,fecha_inicio,fecha_fin,creado_por) VALUES ($1,'2026-2','2026-08-01','2026-12-20',$2) RETURNING id`,
      [instB, adminB])).rows[0].id);

    /** Crea curso, sección, matrículas, una evaluación publicada por columna de notas y una clase. */
    async function curso(codigo: string, ids: string[], notas: number[][], presentes: boolean[]) {
      return contexto.ejecutar(instA, async (db) => {
        const c = (await db.query('INSERT INTO curso(institucion_id,periodo_id,codigo,nombre,creado_por) VALUES ($1,$2,$3,$4,$5) RETURNING id',
          [instA, periodo, codigo, 'Asignatura ' + codigo, adminA])).rows[0].id;
        const s = (await db.query(`INSERT INTO seccion(institucion_id,periodo_id,curso_id,codigo,creado_por) VALUES ($1,$2,$3,'01',$4) RETURNING id`,
          [instA, periodo, c, adminA])).rows[0].id;
        await db.query(`INSERT INTO equipo_docente(institucion_id,seccion_id,usuario_id,rol) VALUES ($1,$2,$3,'PROFESOR')`, [instA, s, profesor]);
        for (const id of ids) await db.query('INSERT INTO matricula(institucion_id,seccion_id,usuario_id) VALUES ($1,$2,$3)', [instA, s, id]);
        const columnas = Math.max(...notas.map((n) => n.length));
        let primera = '';
        for (let k = 0; k < columnas; k++) {
          const e = (await db.query(
            `INSERT INTO evaluacion(institucion_id,seccion_id,nombre,fecha,ponderacion,estado,creado_por,publicado_por,publicado_en)
             VALUES ($1,$2,$3,'2026-09-15',20,'PUBLICADA',$4,$4,now()) RETURNING id`, [instA, s, 'Evaluación ' + (k + 1), adminA])).rows[0].id;
          primera ||= e;
          for (let i = 0; i < ids.length; i++) {
            const v = notas[i]?.[k];
            if (v !== undefined) await db.query('INSERT INTO nota(institucion_id,evaluacion_id,usuario_id,valor,modificado_por) VALUES ($1,$2,$3,$4,$5)', [instA, e, ids[i], v, adminA]);
          }
        }
        // Un borrador con notas extremas: no debe influir en ningún indicador.
        const borrador = (await db.query(`INSERT INTO evaluacion(institucion_id,seccion_id,nombre,fecha,ponderacion,estado,creado_por)
          VALUES ($1,$2,'Borrador','2026-10-15',20,'BORRADOR',$3) RETURNING id`, [instA, s, adminA])).rows[0].id;
        for (const id of ids) await db.query('INSERT INTO nota(institucion_id,evaluacion_id,usuario_id,valor,modificado_por) VALUES ($1,$2,$3,1.0,$4)', [instA, borrador, id, adminA]);
        const clase = (await db.query(`INSERT INTO clase(institucion_id,seccion_id,fecha,creado_por) VALUES ($1,$2,'2026-09-01',$3) RETURNING id`, [instA, s, profesor])).rows[0].id;
        for (let i = 0; i < presentes.length; i++) {
          await db.query('INSERT INTO asistencia_clase(institucion_id,clase_id,alumno_id,presente,autor_id) VALUES ($1,$2,$3,$4,$5)', [instA, clase, ids[i], presentes[i], profesor]);
        }
        return { seccion: s as string, evaluacion: primera };
      });
    }
    const ids = alumnos.map((a) => a.id);
    // GRANDE (12 alumnos): rango 2 con dos alumnos (se oculta) y rango 6 con cinco (complementaria).
    const notasGrande = ids.slice(0, 12).map((_, i) => [i < 6 ? 4.2 : 5.4, i < 6 ? 3.5 : i < 11 ? 6.2 : 2.1, ...(i === 0 ? [2.8] : [])]);
    const grande = await curso('GRANDE', ids.slice(0, 12), notasGrande, ids.slice(0, 12).map((_, i) => i < 10));
    seccionGrande = grande.seccion; evaluacionGrande = grande.evaluacion;
    // CHICO (3 alumnos): se suprime completo.
    await curso('CHICO', ids.slice(12, 15), [[7.0], [1.0], [1.0]], [false, false, false]);
    // HOMOGENEO (6 alumnos): todos 6,5 y todos presentes.
    await curso('HOMOGENEO', ids.slice(15, 21), ids.slice(15, 21).map(() => [6.5]), ids.slice(15, 21).map(() => true));
  }, 60000);

  afterAll(async () => {
    if (pool) {
      await pool.query('DROP SCHEMA IF EXISTS ' + esquema + ' CASCADE');
      if (app) await app.close();
      else await pool.end();
    }
  });

  const porCodigo = (body: { cursos: { codigo: string }[] }, codigo: string) =>
    body.cursos.find((c) => c.codigo === codigo) as Record<string, any>;

  it('CA1 · la vista no contiene nombres, correos ni identificadores de alumnos ni de secciones', async () => {
    const res = await indicadores().expect(200);
    const texto = JSON.stringify(res.body);
    for (const a of alumnos) {
      expect(texto).not.toContain(a.id);
      expect(texto).not.toContain(a.email);
      expect(texto).not.toContain(a.nombre);
    }
    expect(texto).not.toContain(seccionGrande);
    expect(texto).not.toContain(evaluacionGrande);
    expect(Object.keys(porCodigo(res.body, 'GRANDE')).sort()).toEqual(
      ['alumnos', 'aprobacion', 'asistencia', 'codigo', 'distribucion', 'motivo', 'nombre', 'promedioNotas'],
    );
  });

  it('CA2 · un curso grande publica sus indicadores y oculta las celdas pequeñas', async () => {
    const g = porCodigo((await indicadores().expect(200)).body, 'GRANDE');
    expect(g.alumnos).toBe(12);
    // 25 notas publicadas: (12×4,2..5,4 + 6×3,5 + 5×6,2 + 2,1 + 2,8) / 25 = 4,58; aprueban 17 de 25.
    expect(g.promedioNotas.valor).toBe(4.6);
    expect(g.aprobacion.valor).toBe(68);
    expect(g.asistencia.valor).toBe(83.3);
    expect(g.distribucion.rangos.map((c: { cantidad: number | null }) => c.cantidad)).toEqual([0, null, 6, 6, 6, null]);
  });

  it('CA2 · un curso con menos de cinco alumnos se suprime completo', async () => {
    const c = porCodigo((await indicadores().expect(200)).body, 'CHICO');
    expect(c).toMatchObject({ alumnos: null, motivo: 'grupo_pequeno' });
    expect([c.promedioNotas.valor, c.aprobacion.valor, c.asistencia.valor]).toEqual([null, null, null]);
  });

  it('CA2 · resultados unánimes no se publican', async () => {
    const h = porCodigo((await indicadores().expect(200)).body, 'HOMOGENEO');
    expect(h.alumnos).toBe(6);
    expect(h.promedioNotas.motivo).toBe('unanime');
    expect(h.aprobacion.motivo).toBe('unanime');
    expect(h.asistencia.motivo).toBe('unanime');
    expect(h.distribucion.motivo).toBe('unanime');
  });

  it('CA2 · el total de la institución no permite deducir lo suprimido', async () => {
    const { body } = await indicadores().expect(200);
    expect(body.minimoAlumnos).toBe(5);
    expect(body.institucion.alumnos).toBe(18);
    // Solo entran los datos publicados del curso GRANDE.
    expect(body.institucion.promedioNotas.valor).toBe(4.6);
    expect(body.institucion.aprobacion.valor).toBe(68);
    expect(body.institucion.asistencia.valor).toBe(83.3);
    expect(body.institucion.distribucion.rangos.map((c: { cantidad: number | null }) => c.cantidad)).toEqual([0, 0, 6, 6, 6, 0]);
  });

  it('CA3 · parámetros adicionales no cambian la respuesta ni agregan detalle', async () => {
    const normal = await indicadores().expect(200);
    const forzada = await indicadores(director, `?periodoId=${periodo}&detalle=1&alumnoId=${alumnos[0].id}&minimo=1&seccionId=${seccionGrande}`).expect(200);
    expect(forzada.body).toEqual(normal.body);
  });

  it('CA3 · el director no accede por petición directa a reportes por sección ni a notas', async () => {
    await http().get(`/api/calificaciones/secciones/${seccionGrande}/distribucion-notas`).set('Cookie', cookie(director)).expect(403);
    await http().get(`/api/reporteria/secciones/${seccionGrande}/asistencia-agregada`).set('Cookie', cookie(director)).expect(403);
    await http().get(`/api/calificaciones/evaluaciones/${evaluacionGrande}/notas`).set('Cookie', cookie(director)).expect((r) => expect([403, 404]).toContain(r.status));
    await http().get(`/api/academico/secciones/${seccionGrande}`).set('Cookie', cookie(director)).expect(403);
  });

  it('CA3 · solo el director consulta los indicadores, y solo de su institución', async () => {
    await indicadores(profesor).expect(403);
    await indicadores(adminA).expect(403);
    await indicadores(alumnos[0].id).expect(403);
    await http().get('/api/reporteria/indicadores-institucionales?periodoId=' + periodo).expect(401);
    await indicadores(director, '?periodoId=' + periodoB).expect(404);
    await indicadores(director, '?periodoId=no-es-uuid').expect(400);
    await indicadores(director, '').expect(400);
  });
});
