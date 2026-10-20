import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { ContextoInstitucion } from '../../database/contexto-institucion.js';
import { AutorizacionService } from '../autorizacion/autorizacion.service.js';

type Datos = Record<string, unknown>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(valor: unknown): string {
  if (typeof valor !== 'string' || !UUID.test(valor)) throw new BadRequestException('Identificador inválido');
  return valor;
}
function texto(valor: unknown, campo: string, max: number): string {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > max) {
    throw new BadRequestException(campo + ': obligatorio, máximo ' + max + ' caracteres');
  }
  return valor.trim();
}

@Injectable()
export class AcademicoService {
  constructor(private readonly contexto: ContextoInstitucion, private readonly autorizacion: AutorizacionService) {}

  private async ejecutar<T>(institucion: string, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    try { return await this.contexto.ejecutar(institucion, fn); }
    catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ConflictException('El código ya existe en este ámbito');
      if ((e as { code?: string }).code === '23503') throw new ConflictException('La referencia o el rol ya no están disponibles; actualiza la página');
      throw e;
    }
  }

  private async registrar(db: PoolClient, institucion: string, actor: string, recurso: string, accion: string, datos: unknown) {
    await db.query('INSERT INTO evento_academico(institucion_id,actor_id,recurso_id,accion,datos) VALUES ($1,$2,$3,$4,$5)',
      [institucion, actor, recurso, accion, JSON.stringify(datos)]);
  }

  async cursos(actor: string, institucion: string, periodo: unknown) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR');
    const periodoId = id(periodo);
    return this.ejecutar(institucion, async db => (await db.query('SELECT id,codigo,nombre FROM curso WHERE periodo_id=$1 ORDER BY codigo',[periodoId])).rows);
  }

  async crearCurso(actor: string, institucion: string, dto: Datos) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR');
    const periodo = id(dto.periodoId);
    const codigo = texto(dto.codigo, 'Código', 30).toUpperCase();
    const nombre = texto(dto.nombre, 'Nombre', 150);
    return this.ejecutar(institucion, async db => {
      if (!(await db.query('SELECT 1 FROM periodo WHERE id=$1',[periodo])).rowCount) throw new BadRequestException('El período debe pertenecer a la institución activa');
      const { rows } = await db.query('INSERT INTO curso(institucion_id,periodo_id,codigo,nombre,creado_por) VALUES ($1,$2,$3,$4,$5) RETURNING id,codigo,nombre',
        [institucion,periodo,codigo,nombre,actor]);
      await this.registrar(db,institucion,actor,rows[0].id,'CREAR_CURSO',{codigo,nombre});
      return rows[0];
    });
  }

  async secciones(actor: string, institucion: string, periodo?: string) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR','PROFESOR','AYUDANTE','ALUMNO');
    if (periodo) id(periodo);
    return this.ejecutar(institucion, async db => {
      const { rows } = await db.query(`
        SELECT s.id,s.codigo,s.periodo_id AS "periodoId",p.nombre AS periodo,
               c.codigo AS "cursoCodigo",c.nombre AS curso,
               (SELECT count(*)::int FROM matricula m WHERE m.seccion_id=s.id) AS "totalAlumnos"
          FROM seccion s JOIN curso c ON c.id=s.curso_id JOIN periodo p ON p.id=s.periodo_id
         WHERE ($3::uuid IS NULL OR s.periodo_id=$3)
           AND (
             EXISTS (SELECT 1 FROM rol_en_institucion r WHERE r.usuario_id=$1 AND r.institucion_id=$2 AND r.rol='ADMINISTRADOR')
             OR EXISTS (SELECT 1 FROM equipo_docente e JOIN rol_en_institucion r
               ON (r.usuario_id,r.institucion_id,r.rol)=(e.usuario_id,e.institucion_id,e.rol)
               WHERE e.seccion_id=s.id AND e.usuario_id=$1)
             OR EXISTS (SELECT 1 FROM matricula m WHERE m.seccion_id=s.id AND m.usuario_id=$1)
           )
         ORDER BY c.codigo,s.codigo`, [actor,institucion,periodo || null]);
      return rows;
    });
  }

  async crearSeccion(actor: string, institucion: string, dto: Datos) {
    await this.autorizacion.exigirRol(actor,institucion,'ADMINISTRADOR');
    const periodo = id(dto.periodoId), curso = id(dto.cursoId), codigo = texto(dto.codigo,'Sección',30).toUpperCase();
    return this.ejecutar(institucion, async db => {
      const refs = await db.query('SELECT 1 FROM periodo p,curso c WHERE p.id=$1 AND c.id=$2 AND c.periodo_id=p.id', [periodo,curso]);
      if (!refs.rowCount) throw new BadRequestException('El curso debe pertenecer al período y a la institución activa');
      const { rows } = await db.query('INSERT INTO seccion(institucion_id,periodo_id,curso_id,codigo,creado_por) VALUES ($1,$2,$3,$4,$5) RETURNING id,codigo',
        [institucion,periodo,curso,codigo,actor]);
      await this.registrar(db,institucion,actor,rows[0].id,'CREAR_SECCION',{periodoId:periodo,cursoId:curso,codigo});
      return rows[0];
    });
  }

  private async exigirSeccion(db: PoolClient, actor: string, institucion: string, seccion: string, soloAdmin = false) {
    id(seccion);
    // Serializa cambios de equipo y nómina de la misma sección.
    const recurso = await db.query('SELECT id FROM seccion WHERE id=$1 FOR UPDATE', [seccion]);
    if (!recurso.rowCount) throw new NotFoundException('Sección no encontrada');
    const permisos = await db.query(`
      SELECT 1 FROM rol_en_institucion r
       JOIN usuario u ON u.id=r.usuario_id AND u.activo
       WHERE r.usuario_id=$1 AND r.institucion_id=$2
         AND (r.rol='ADMINISTRADOR' OR (NOT $4::boolean AND r.rol IN ('PROFESOR','AYUDANTE')
           AND EXISTS (SELECT 1 FROM equipo_docente e WHERE e.usuario_id=r.usuario_id
             AND e.rol=r.rol AND e.seccion_id=$3)))`, [actor,institucion,seccion,soloAdmin]);
    if (!permisos.rowCount) throw new ForbiddenException('No tienes permiso sobre esta sección');
  }

  async candidatos(actor: string, institucion: string) {
    await this.autorizacion.exigirRol(actor,institucion,'ADMINISTRADOR');
    return this.ejecutar(institucion, async db => (await db.query(`
      SELECT u.id,u.nombre,u.email,r.rol FROM usuario u JOIN rol_en_institucion r ON r.usuario_id=u.id
       WHERE u.activo AND r.institucion_id=$1 AND r.rol IN ('PROFESOR','AYUDANTE')
       ORDER BY u.nombre,u.email`,[institucion])).rows);
  }

  async detalle(actor: string, institucion: string, seccion: string) {
    await this.autorizacion.exigirRol(actor,institucion,'ADMINISTRADOR','PROFESOR','AYUDANTE');
    return this.ejecutar(institucion, async db => {
      await this.exigirSeccion(db,actor,institucion,seccion);
      const equipo = await db.query(`SELECT u.id,u.nombre,u.email,e.rol FROM equipo_docente e
        JOIN usuario u ON u.id=e.usuario_id WHERE e.seccion_id=$1 ORDER BY e.rol,u.nombre`,[seccion]);
      const nomina = await db.query(`SELECT u.id,u.nombre,u.email FROM matricula m
        JOIN usuario u ON u.id=m.usuario_id WHERE m.seccion_id=$1 ORDER BY u.nombre,u.email`,[seccion]);
      const eventos = await db.query(`SELECT e.id,e.accion,e.creado_en AS fecha,u.nombre AS autor
        FROM evento_academico e JOIN usuario u ON u.id=e.actor_id
        WHERE e.recurso_id=$1 ORDER BY e.creado_en DESC,e.id DESC LIMIT 50`,[seccion]);
      return { equipo:equipo.rows, nomina:nomina.rows, eventos:eventos.rows };
    });
  }

  async asignar(actor: string, institucion: string, seccion: string, dto: Datos) {
    await this.autorizacion.exigirRol(actor,institucion,'ADMINISTRADOR');
    const profesorId = id(dto.profesorId);
    if (!Array.isArray(dto.ayudanteIds) || dto.ayudanteIds.length > 30) throw new BadRequestException('Indica hasta 30 ayudantes');
    const ayudantes = [...new Set(dto.ayudanteIds.map(id))];
    if (ayudantes.includes(profesorId)) throw new BadRequestException('El profesor no puede ser su propio ayudante');
    return this.ejecutar(institucion, async db => {
      await this.exigirSeccion(db,actor,institucion,seccion,true);
      const miembros = [{usuario:profesorId,rol:'PROFESOR'},...ayudantes.map(usuario=>({usuario,rol:'AYUDANTE'}))];
      for (const m of miembros) {
        const habilitado = await db.query(`SELECT 1 FROM rol_en_institucion r JOIN usuario u ON u.id=r.usuario_id
          WHERE r.usuario_id=$1 AND r.institucion_id=$2 AND r.rol=$3 AND u.activo`,[m.usuario,institucion,m.rol]);
        if (!habilitado.rowCount) throw new BadRequestException('Todos los docentes deben estar habilitados con el rol correspondiente en esta institución');
      }
      const anterior = (await db.query('SELECT usuario_id,rol FROM equipo_docente WHERE seccion_id=$1',[seccion])).rows;
      await db.query('DELETE FROM equipo_docente WHERE seccion_id=$1',[seccion]);
      for (const m of miembros) await db.query('INSERT INTO equipo_docente(institucion_id,seccion_id,usuario_id,rol) VALUES ($1,$2,$3,$4)',
        [institucion,seccion,m.usuario,m.rol]);
      await this.registrar(db,institucion,actor,seccion,'ASIGNAR_EQUIPO',{anterior,nuevo:miembros});
      return { mensaje:'Equipo docente guardado' };
    });
  }

  private async analizar(db: PoolClient, institucion: string, valores: unknown) {
    if (!Array.isArray(valores) || !valores.length || valores.length>500) throw new BadRequestException('La nómina debe contener entre 1 y 500 correos');
    const vistos = new Set<string>();
    const filas: {fila:number;email:string;usuarioId:string|null;motivo:string|null}[] = [];
    for (const [indice, valor] of valores.entries()) {
      const email = typeof valor === 'string' ? valor.trim().toLowerCase() : '';
      let motivo: string | null = null;
      let usuarioId: string | null = null;
      if (!email || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) motivo='Correo inválido';
      else if (vistos.has(email)) motivo='Correo repetido en el archivo';
      else {
        const r = await db.query(`SELECT u.id FROM usuario u JOIN rol_en_institucion r ON r.usuario_id=u.id
          WHERE u.email=$1 AND u.activo AND r.institucion_id=$2 AND r.rol='ALUMNO'`,[email,institucion]);
        if (!r.rowCount) motivo='No existe un alumno habilitado en esta institución';
        else usuarioId=r.rows[0].id;
      }
      vistos.add(email);
      filas.push({fila:indice+1,email,usuarioId,motivo});
    }
    return filas;
  }

  async nomina(actor: string, institucion: string, seccion: string, dto: Datos, confirmar: boolean) {
    await this.autorizacion.exigirRol(actor,institucion,'ADMINISTRADOR');
    return this.ejecutar(institucion, async db => {
      await this.exigirSeccion(db,actor,institucion,seccion,true);
      const filas = await this.analizar(db,institucion,dto.emails);
      const valida = filas.every(f=>!f.motivo);
      if (!confirmar) return {filas,valida};
      if (!valida) throw new BadRequestException({message:'Corrige las filas inválidas antes de confirmar',filas});
      // Siempre se revalida en el servidor. El resultado de la vista previa no otorga permiso.
      let agregados=0;
      for (const f of filas) {
        const r = await db.query('INSERT INTO matricula(institucion_id,seccion_id,usuario_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [institucion,seccion,f.usuarioId]);
        agregados+=r.rowCount ?? 0;
      }
      const total=(await db.query('SELECT count(*)::int AS total FROM matricula WHERE seccion_id=$1',[seccion])).rows[0].total;
      await this.registrar(db,institucion,actor,seccion,'CARGAR_NOMINA',{recibidos:filas.length,agregados,total});
      return {agregados,total,mensaje:'Nómina guardada'};
    });
  }
}
