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

function fechaValida(valor: unknown): string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new BadRequestException('Fecha: formato inválido (YYYY-MM-DD)');
  }
  const d = new Date(valor + 'T00:00:00Z');
  if (isNaN(d.getTime())) throw new BadRequestException('Fecha inválida');
  return valor;
}

@Injectable()
export class EvaluacionesService {
  constructor(
    private readonly contexto: ContextoInstitucion,
    private readonly autorizacion: AutorizacionService,
  ) {}

  private async ejecutar<T>(institucion: string, fn: (db: PoolClient) => Promise<T>): Promise<T> {
    try {
      return await this.contexto.ejecutar(institucion, fn);
    } catch (e) {
      if ((e as { code?: string }).code === '23505') {
        throw new ConflictException('Ya existe una evaluación con ese nombre en esta sección');
      }
      throw e;
    }
  }

  private async registrar(db: PoolClient, institucion: string, actor: string, recurso: string, accion: string, datos: unknown) {
    await db.query(
      'INSERT INTO evento_academico(institucion_id,actor_id,recurso_id,accion,datos) VALUES ($1,$2,$3,$4,$5)',
      [institucion, actor, recurso, accion, JSON.stringify(datos)],
    );
  }

  /**
   * Lista evaluaciones de una sección.
   * Visible para Administradores, Docentes de la sección y Alumnos inscritos.
   */
  async listar(actor: string, institucion: string, seccionId: string) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR', 'AYUDANTE', 'ALUMNO');
    const sid = id(seccionId);
    return this.ejecutar(institucion, async (db) => {
      const tieneAcceso = await db.query(
        `SELECT r.rol = 'ADMINISTRADOR' OR EXISTS (
           SELECT 1 FROM equipo_docente e WHERE e.seccion_id=$3 AND e.usuario_id=$1
         ) AS "puedeGestionar" FROM rol_en_institucion r
         WHERE r.usuario_id = $1 AND r.institucion_id = $2
           AND (
             r.rol = 'ADMINISTRADOR'
             OR EXISTS (SELECT 1 FROM equipo_docente e WHERE e.seccion_id = $3 AND e.usuario_id = $1)
             OR EXISTS (SELECT 1 FROM matricula m WHERE m.seccion_id = $3 AND m.usuario_id = $1)
           )`,
        [actor, institucion, sid],
      );
      if (!tieneAcceso.rowCount) throw new ForbiddenException('No tienes acceso a esta sección');

      const { rows } = await db.query(
        `SELECT id, seccion_id AS "seccionId", nombre, fecha, ponderacion,
                escala_minima AS "escalaMinima", escala_maxima AS "escalaMaxima",
                escala_aprobacion AS "escalaAprobacion", estado, creado_en AS "creadoEn",
                enviado_por AS "enviadoPor", enviado_en AS "enviadoEn"
         FROM evaluacion
         WHERE seccion_id = $1 AND ($2::boolean OR estado='PUBLICADA')
         ORDER BY fecha ASC, creado_en ASC`,
        [sid, tieneAcceso.rows.some((r: { puedeGestionar: boolean }) => r.puedeGestionar)],
      );
      return rows;
    });
  }

  /**
   * H14 · Registrar una evaluación presencial.
   * CA1: Nombre y fecha válidos crean una evaluación.
   * CA2: El ayudante no puede crearla (solo profesor asignado o admin).
   * CA3: Usa escala de la institución (1.0 a 7.0, aprobación 4.0).
   */
  async crear(actor: string, institucion: string, seccionId: string, dto: Datos) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR', 'AYUDANTE');
    const sid = id(seccionId);
    const nombre = texto(dto.nombre, 'Nombre de la evaluación', 100);
    const fecha = fechaValida(dto.fecha);

    let ponderacion = 0;
    if (dto.ponderacion !== undefined && dto.ponderacion !== null && dto.ponderacion !== '') {
      ponderacion = Number(dto.ponderacion);
      if (isNaN(ponderacion) || ponderacion < 0 || ponderacion > 100) {
        throw new BadRequestException('Ponderación: debe ser un número entre 0 y 100');
      }
    }

    return this.ejecutar(institucion, async (db) => {
      const seccionRes = await db.query('SELECT id FROM seccion WHERE id = $1', [sid]);
      if (!seccionRes.rowCount) throw new NotFoundException('Sección no encontrada');

      // CA2: El ayudante no puede crearla
      const rolAdmin = await db.query(
        `SELECT 1 FROM rol_en_institucion WHERE usuario_id = $1 AND institucion_id = $2 AND rol = 'ADMINISTRADOR'`,
        [actor, institucion],
      );
      const esAdmin = (rolAdmin.rowCount ?? 0) > 0;

      if (!esAdmin) {
        const docenteRes = await db.query(
          `SELECT rol FROM equipo_docente WHERE seccion_id = $1 AND usuario_id = $2`,
          [sid, actor],
        );
        if (!docenteRes.rowCount) {
          throw new ForbiddenException('No perteneces al equipo docente de esta sección');
        }
        const rolEnSeccion = docenteRes.rows[0].rol;
        if (rolEnSeccion === 'AYUDANTE') {
          throw new ForbiddenException('Los ayudantes no tienen permiso para crear evaluaciones');
        }
      }

      // Escala estándar de la institución (CA3)
      const escalaMin = 1.0;
      const escalaMax = 7.0;
      const escalaApr = 4.0;

      const { rows } = await db.query(
        `INSERT INTO evaluacion (
           institucion_id, seccion_id, nombre, fecha, ponderacion,
           escala_minima, escala_maxima, escala_aprobacion, estado, creado_por
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'BORRADOR', $9)
         RETURNING id, seccion_id AS "seccionId", nombre, fecha, ponderacion,
                   escala_minima AS "escalaMinima", escala_maxima AS "escalaMaxima",
                   escala_aprobacion AS "escalaAprobacion", estado, creado_en AS "creadoEn"`,
        [institucion, sid, nombre, fecha, ponderacion, escalaMin, escalaMax, escalaApr, actor],
      );

      const evaluacion = rows[0];
      await this.registrar(db, institucion, actor, sid, 'CREAR_EVALUACION', {
        evaluacionId: evaluacion.id,
        nombre: evaluacion.nombre,
        fecha: evaluacion.fecha,
        ponderacion: evaluacion.ponderacion,
      });

      return evaluacion;
    });
  }

  /**
   * H17 · Enviar evaluación a revisión.
   * CA1: Todas las filas deben tener nota válida o ausencia explícita.
   * CA2: El envío cambia el estado a "EN_REVISION" y bloquea nuevas ediciones.
   * CA3: Se conservan autor y fecha del envío.
   * Permitido para: Ayudante y Profesor asignados (quien cargó el borrador).
   */
  async enviarARevision(actor: string, institucion: string, evaluacionId: string) {
    return this.enviar(actor, institucion, evaluacionId, false);
  }

  async reenviarARevision(actor: string, institucion: string, evaluacionId: string) {
    return this.enviar(actor, institucion, evaluacionId, true);
  }

  private async enviar(actor: string, institucion: string, evaluacionId: string, reenvio: boolean) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR', 'AYUDANTE');
    const eid = id(evaluacionId);

    return this.ejecutar(institucion, async (db) => {
      // Obtener la evaluación
      const evRes = await db.query(
        `SELECT e.id, e.seccion_id AS "seccionId", e.estado
         FROM evaluacion e
         WHERE e.id = $1 FOR UPDATE`,
        [eid],
      );
      if (!evRes.rowCount) throw new NotFoundException('Evaluación no encontrada');
      const evaluacion = evRes.rows[0];

      const estadoOrigen = reenvio ? 'DEVUELTA' : 'BORRADOR';
      if (evaluacion.estado !== estadoOrigen) {
        throw new ConflictException(
          `La evaluación ya está en estado "${evaluacion.estado}". Solo se puede ${reenvio ? 'reenviar' : 'enviar'} desde ${estadoOrigen}.`,
        );
      }

      // Verificar que el actor pertenece al equipo de la sección o es admin
      const rolAdmin = await db.query(
        `SELECT 1 FROM rol_en_institucion WHERE usuario_id = $1 AND institucion_id = $2 AND rol = 'ADMINISTRADOR'`,
        [actor, institucion],
      );
      const esAdmin = (rolAdmin.rowCount ?? 0) > 0;

      if (!esAdmin) {
        const docenteRes = await db.query(
          `SELECT rol FROM equipo_docente WHERE seccion_id = $1 AND usuario_id = $2`,
          [evaluacion.seccionId, actor],
        );
        if (!docenteRes.rowCount) {
          throw new ForbiddenException('No perteneces al equipo docente de esta sección');
        }
      }

      // CA1: Todas las filas deben tener nota válida o ausencia explícita
      const filasSinCalificar = await db.query(
        `SELECT u.id, u.nombre
         FROM matricula m
         JOIN usuario u ON u.id = m.usuario_id
         LEFT JOIN nota n ON n.evaluacion_id = $1 AND n.usuario_id = u.id
         WHERE m.seccion_id = $2
           AND (n.id IS NULL OR NOT (
             (n.es_ausente = true AND n.valor IS NULL)
             OR (n.es_ausente = false AND n.valor BETWEEN 1.0 AND 7.0)
           ) OR (n.es_ausente = false AND n.valor IS NULL))`,
        [eid, evaluacion.seccionId],
      );

      if ((filasSinCalificar.rowCount ?? 0) > 0) {
        const nombres = filasSinCalificar.rows
          .slice(0, 3)
          .map((r: { nombre: string }) => r.nombre)
          .join(', ');
        const total = filasSinCalificar.rowCount ?? 0;
        throw new BadRequestException(
          `Faltan ${total} alumno${total !== 1 ? 's' : ''} sin nota ni ausencia: ${nombres}${total > 3 ? '…' : ''}.`,
        );
      }

      // CA2: Cambiar estado a EN_REVISION
      // CA3: Guardar autor y fecha del envío
      const { rows } = await db.query(
        `UPDATE evaluacion
         SET estado = 'EN_REVISION',
             enviado_por = CASE WHEN $3 THEN enviado_por ELSE $2 END,
             enviado_en = CASE WHEN $3 THEN enviado_en ELSE now() END,
             reenviado_por = CASE WHEN $3 THEN $2 ELSE reenviado_por END,
             reenviado_en = CASE WHEN $3 THEN now() ELSE reenviado_en END
         WHERE id = $1
         RETURNING id, nombre, estado,
                   enviado_por AS "enviadoPor",
                   enviado_en AS "enviadoEn", observacion,
                   reenviado_por AS "reenviadoPor", reenviado_en AS "reenviadoEn"`,
        [eid, actor, reenvio],
      );

      await this.registrar(db, institucion, actor, eid, reenvio ? 'REENVIAR_A_REVISION' : 'ENVIAR_A_REVISION', {
        evaluacionId: eid,
        enviadoEn: rows[0].enviadoEn,
        reenviadoEn: rows[0].reenviadoEn,
      });

      return rows[0];
    });
  }

  /** H18: únicamente el profesor asignado o un administrador pueden devolver. */
  async devolver(actor: string, institucion: string, evaluacionId: string, dto: Datos) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR', 'PROFESOR');
    const eid = id(evaluacionId);
    const observacion = texto(dto.observacion, 'Observación', 2000);
    return this.ejecutar(institucion, async (db) => {
      const res = await db.query(
        'SELECT id, seccion_id, estado FROM evaluacion WHERE id = $1 FOR UPDATE', [eid],
      );
      if (!res.rowCount) throw new NotFoundException('Evaluación no encontrada');
      const evaluacion = res.rows[0];
      const permiso = await db.query(
        `SELECT 1 FROM rol_en_institucion r
         WHERE r.usuario_id = $1 AND r.institucion_id = $2
           AND (r.rol = 'ADMINISTRADOR' OR (r.rol = 'PROFESOR' AND EXISTS (
             SELECT 1 FROM equipo_docente e WHERE e.seccion_id = $3
               AND e.usuario_id = $1 AND e.rol = 'PROFESOR'
           )))`, [actor, institucion, evaluacion.seccion_id],
      );
      if (!permiso.rowCount) throw new ForbiddenException('Solo el profesor asignado puede devolver esta evaluación');
      if (evaluacion.estado !== 'EN_REVISION') {
        throw new ConflictException('Solo se puede devolver una evaluación en revisión');
      }
      const { rows } = await db.query(
        `UPDATE evaluacion SET estado = 'DEVUELTA', observacion = $2,
           devuelto_por = $3, devuelto_en = now()
         WHERE id = $1 RETURNING id, estado, observacion,
           devuelto_por AS "devueltoPor", devuelto_en AS "devueltoEn"`,
        [eid, observacion, actor],
      );
      await this.registrar(db, institucion, actor, eid, 'DEVOLVER_EVALUACION', {
        observacion, devueltoEn: rows[0].devueltoEn,
      });
      return rows[0];
    });
  }


  /** H20: publicar exige profesor asignado, incluso para administradores. */
  async publicar(actor: string, institucion: string, evaluacionId: string) {
    await this.autorizacion.exigirRol(actor, institucion, 'PROFESOR');
    const eid = id(evaluacionId);
    return this.ejecutar(institucion, async (db) => {
      const res = await db.query('SELECT id, seccion_id, estado FROM evaluacion WHERE id=$1 FOR UPDATE', [eid]);
      if (!res.rowCount) throw new NotFoundException('Evaluación no encontrada');
      const evaluacion = res.rows[0];
      const permiso = await db.query(
        "SELECT 1 FROM equipo_docente WHERE seccion_id=$1 AND usuario_id=$2 AND rol='PROFESOR'",
        [evaluacion.seccion_id, actor],
      );
      if (!permiso.rowCount) throw new ForbiddenException('Solo el profesor asignado puede publicar esta evaluación');
      if (evaluacion.estado !== 'EN_REVISION') {
        throw new ConflictException('Solo se puede publicar una evaluación en revisión');
      }
      // Revalidar la nómina: puede haber cambiado desde el envío.
      const pendientes = await db.query(
        `SELECT 1 FROM matricula m LEFT JOIN nota n ON n.evaluacion_id=$1 AND n.usuario_id=m.usuario_id
         JOIN evaluacion e ON e.id=$1
         WHERE m.seccion_id=$2 AND (n.id IS NULL OR
           NOT COALESCE((n.es_ausente AND n.valor IS NULL) OR
             (NOT n.es_ausente AND n.valor BETWEEN e.escala_minima AND e.escala_maxima), false)) LIMIT 1`,
        [eid, evaluacion.seccion_id],
      );
      if (pendientes.rowCount) throw new BadRequestException('La nómina tiene alumnos sin nota válida ni ausencia. Devuelve la evaluación para corregirla.');
      const { rows } = await db.query(
        `UPDATE evaluacion SET estado='PUBLICADA', publicado_por=$2, publicado_en=now()
         WHERE id=$1 RETURNING id, estado, publicado_por AS "publicadoPor", publicado_en AS "publicadoEn"`,
        [eid, actor],
      );
      await this.registrar(db, institucion, actor, eid, 'PUBLICAR_EVALUACION', { publicadoEn: rows[0].publicadoEn });
      return rows[0];
    });
  }


  /** H23: consulta administrativa, sin rutas para modificar el historial. */
  async auditoria(actor: string, institucion: string, evaluacionId: string) {
    await this.autorizacion.exigirRol(actor, institucion, 'ADMINISTRADOR');
    const eid = id(evaluacionId);
    return this.ejecutar(institucion, async (db) => {
      const evaluacion = await db.query('SELECT id, seccion_id FROM evaluacion WHERE id=$1', [eid]);
      if (!evaluacion.rowCount) throw new NotFoundException('Evaluación no encontrada');
      const { rows } = await db.query(
        `SELECT e.id, e.accion, COALESCE(NULLIF(u.nombre,''), u.email) AS autor,
           e.creado_en AS fecha, e.datos
         FROM evento_academico e JOIN usuario u ON u.id=e.actor_id
         WHERE e.recurso_id=$1 OR (e.recurso_id=$2 AND e.accion='CREAR_EVALUACION'
           AND e.datos->>'evaluacionId'=$1::text)
         ORDER BY e.creado_en ASC, e.id ASC`,
        [eid, evaluacion.rows[0].seccion_id],
      );
      return rows;
    });
  }

}
