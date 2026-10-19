import { Injectable } from '@nestjs/common';
import { ContextoInstitucion } from '../../../database/contexto-institucion.js';

export interface Periodo {
  id: string;
  institucionId: string;
  nombre: string;
  fechaInicio: string; // YYYY-MM-DD
  fechaFin: string;
  creadoPor: { id: string; nombre: string | null; email: string };
  creadoEn: string;
}

export interface NuevoPeriodo {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  creadoPor: string;
}

export class PeriodoDuplicadoError extends Error {}

/** Todas las operaciones corren en el contexto de la institución activa. */
export abstract class PeriodosRepositorio {
  abstract crear(institucionId: string, datos: NuevoPeriodo): Promise<Periodo>;
  abstract listar(institucionId: string): Promise<Periodo[]>;
  abstract obtener(institucionId: string, id: string): Promise<Periodo | null>;
}

const SELECT_PERIODO = `
  SELECT p.id, p.institucion_id, p.nombre, p.fecha_inicio, p.fecha_fin, p.creado_en,
         u.id AS creador_id, u.nombre AS creador_nombre, u.email AS creador_email
    FROM periodo p
    JOIN usuario u ON u.id = p.creado_por
   WHERE p.institucion_id = current_setting('app.institucion_id')::uuid`;

function aPeriodo(f: Record<string, any>): Periodo {
  return {
    id: f.id,
    institucionId: f.institucion_id,
    nombre: f.nombre,
    fechaInicio: f.fecha_inicio,
    fechaFin: f.fecha_fin,
    creadoPor: { id: f.creador_id, nombre: f.creador_nombre, email: f.creador_email },
    creadoEn: new Date(f.creado_en).toISOString(),
  };
}

@Injectable()
export class PostgresPeriodosRepositorio extends PeriodosRepositorio {
  constructor(private readonly contexto: ContextoInstitucion) {
    super();
  }

  crear(institucionId: string, d: NuevoPeriodo): Promise<Periodo> {
    return this.contexto.ejecutar(institucionId, async (db) => {
      try {
        const { rows } = await db.query(
          `INSERT INTO periodo (institucion_id, nombre, fecha_inicio, fecha_fin, creado_por)
           VALUES (current_setting('app.institucion_id')::uuid, $1, $2, $3, $4)
           RETURNING id`,
          [d.nombre, d.fechaInicio, d.fechaFin, d.creadoPor],
        );
        const creado = await db.query(`${SELECT_PERIODO} AND p.id = $1`, [rows[0].id]);
        return aPeriodo(creado.rows[0]);
      } catch (e) {
        if ((e as { code?: string }).code === '23505') throw new PeriodoDuplicadoError();
        throw e;
      }
    });
  }

  listar(institucionId: string): Promise<Periodo[]> {
    return this.contexto.ejecutar(institucionId, async (db) => {
      const { rows } = await db.query(`${SELECT_PERIODO} ORDER BY p.fecha_inicio DESC, p.nombre`);
      return rows.map(aPeriodo);
    });
  }

  obtener(institucionId: string, id: string): Promise<Periodo | null> {
    return this.contexto.ejecutar(institucionId, async (db) => {
      const { rows } = await db.query(`${SELECT_PERIODO} AND p.id = $1::uuid`, [id]);
      return rows.length ? aPeriodo(rows[0]) : null;
    });
  }
}
