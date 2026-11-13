import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContextoInstitucion } from '../../database/contexto-institucion.js';
import { AutorizacionService } from '../autorizacion/autorizacion.service.js';

interface NotaPublicada {
  id: string;
  nombre: string;
  fecha: string;
  ponderacion: number;
  valor: number | null;
  esAusente: boolean;
  escalaAprobacion: number;
  publicadoEn: string;
}

interface AsignaturaHistorial {
  seccionId: string;
  seccionCodigo: string;
  cursoId: string;
  cursoCodigo: string;
  cursoNombre: string;
  notas: NotaPublicada[];
}

interface PeriodoHistorial {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  asignaturas: AsignaturaHistorial[];
}

/** H39 · Consolidar notas publicadas propias por período y asignatura. */
@Injectable()
export class HistorialAcademicoService {
  constructor(
    private readonly contexto: ContextoInstitucion,
    private readonly autorizacion: AutorizacionService,
  ) {}

  async consultar(alumnoId: string, institucionId: string): Promise<PeriodoHistorial[]> {
    // El rol y la institución se verifican en servidor. No se acepta alumnoId del cliente.
    await this.autorizacion.exigirRol(alumnoId, institucionId, 'ALUMNO');

    return this.contexto.ejecutar(institucionId, async (db) => {
      // Incluye también períodos sin calificaciones, para mostrar «Sin datos» (CA2).
      const { rows: periodos } = await db.query<{
        id: string; nombre: string; fechaInicio: string; fechaFin: string;
      }>(`
        SELECT id, nombre, fecha_inicio AS "fechaInicio", fecha_fin AS "fechaFin"
          FROM periodo
         WHERE institucion_id = $1
         ORDER BY fecha_inicio DESC, id DESC
      `, [institucionId]);

      // Solo cursos donde el alumno está efectivamente matriculado.
      const { rows: matriculas } = await db.query<{
        periodoId: string; seccionId: string; seccionCodigo: string;
        cursoId: string; cursoCodigo: string; cursoNombre: string;
      }>(`
        SELECT s.periodo_id AS "periodoId", s.id AS "seccionId",
               s.codigo AS "seccionCodigo", c.id AS "cursoId",
               c.codigo AS "cursoCodigo", c.nombre AS "cursoNombre"
          FROM matricula m
          JOIN seccion s ON s.id = m.seccion_id AND s.institucion_id = m.institucion_id
          JOIN curso c ON c.id = s.curso_id AND c.institucion_id = s.institucion_id
         WHERE m.usuario_id = $1 AND m.institucion_id = $2
         ORDER BY c.codigo, c.nombre, s.codigo, s.id
      `, [alumnoId, institucionId]);

      // Comprobación doble: la nota es propia, está publicada y sigue vinculada
      // a una matrícula del usuario. BORRADOR, EN_REVISION y DEVUELTA no aparecen.
      const { rows: notas } = await db.query<{
        seccionId: string; id: string; nombre: string; fecha: string;
        ponderacion: string; valor: string | null; esAusente: boolean;
        escalaAprobacion: string; publicadoEn: string;
      }>(`
        SELECT s.id AS "seccionId", e.id, e.nombre, e.fecha, e.ponderacion,
               n.valor, n.es_ausente AS "esAusente",
               e.escala_aprobacion AS "escalaAprobacion",
               e.publicado_en AS "publicadoEn"
          FROM nota n
          JOIN evaluacion e ON e.id = n.evaluacion_id
                           AND e.institucion_id = n.institucion_id
          JOIN seccion s ON s.id = e.seccion_id
                       AND s.institucion_id = e.institucion_id
          JOIN matricula m ON m.seccion_id = s.id
                          AND m.institucion_id = s.institucion_id
                          AND m.usuario_id = n.usuario_id
         WHERE n.usuario_id = $1 AND n.institucion_id = $2
           AND e.estado = 'PUBLICADA'
         ORDER BY e.fecha, e.creado_en, e.id
      `, [alumnoId, institucionId]);

      const historial: PeriodoHistorial[] = periodos.map(p => ({ ...p, asignaturas: [] }));
      const porPeriodo = new Map(historial.map(p => [p.id, p]));
      const porSeccion = new Map<string, AsignaturaHistorial>();

      for (const m of matriculas) {
        const periodo = porPeriodo.get(m.periodoId);
        if (!periodo) continue;
        const asignatura: AsignaturaHistorial = {
          seccionId: m.seccionId,
          seccionCodigo: m.seccionCodigo,
          cursoId: m.cursoId,
          cursoCodigo: m.cursoCodigo,
          cursoNombre: m.cursoNombre,
          notas: [],
        };
        periodo.asignaturas.push(asignatura);
        porSeccion.set(m.seccionId, asignatura);
      }
      for (const n of notas) {
        const asignatura = porSeccion.get(n.seccionId);
        if (!asignatura) continue;
        asignatura.notas.push({
          id: n.id,
          nombre: n.nombre,
          fecha: n.fecha,
          ponderacion: Number(n.ponderacion),
          valor: n.valor === null ? null : Number(n.valor),
          esAusente: n.esAusente,
          escalaAprobacion: Number(n.escalaAprobacion),
          publicadoEn: n.publicadoEn,
        });
      }
      return historial;
    });
  }

  async confirmarLote(actor: string, institucionId: string, body: { huella?: string; filas?: unknown[]; totalValidas?: number }) {
    await this.autorizacion.exigirRol(actor, institucionId, 'ADMINISTRADOR');
    const filas = Array.isArray(body.filas) ? body.filas : [];
    const huella = typeof body.huella === 'string' ? body.huella.trim() : '';
    const totalValidas = Number(body.totalValidas);
    if (!huella || !filas.length || !Number.isInteger(totalValidas) || totalValidas !== filas.length) {
      throw new BadRequestException('El lote debe estar validado y conciliado antes de confirmarlo');
    }
    return this.contexto.ejecutar(institucionId, async db => {
      const existente = await db.query('SELECT id, total_filas AS "totalFilas", total_validas AS "totalValidas", responsable_id AS "responsableId", confirmado_en AS "confirmadoEn" FROM lote_historico WHERE institucion_id=$1 AND huella=$2', [institucionId, huella]);
      if (existente.rowCount) return { ...existente.rows[0], duplicado: true };
      const creado = await db.query('INSERT INTO lote_historico (institucion_id, huella, filas, total_filas, total_validas, responsable_id) VALUES ($1,$2,$3,$4,$4,$5) RETURNING id, total_filas AS "totalFilas", total_validas AS "totalValidas", responsable_id AS "responsableId", confirmado_en AS "confirmadoEn"', [institucionId, huella, JSON.stringify(filas), filas.length, actor]);
      return { ...creado.rows[0], duplicado: false };
    });
  }

  async importadas(alumnoId: string, institucionId: string) {
    await this.autorizacion.exigirRol(alumnoId, institucionId, 'ALUMNO');
    return this.contexto.ejecutar(institucionId, async db => {
      const usuario = await db.query<{email:string}>('SELECT email FROM usuario WHERE id=$1', [alumnoId]);
      const email = usuario.rows[0]?.email;
      if (!email) return [];
      const lotes = await db.query<{id:string; confirmadoEn:string; filas: unknown[]}>('SELECT id, confirmado_en AS "confirmadoEn", filas FROM lote_historico WHERE institucion_id=$1 AND revertido_en IS NULL ORDER BY confirmado_en DESC', [institucionId]);
      return lotes.rows.flatMap(lote => (Array.isArray(lote.filas) ? lote.filas : [])
        .filter((fila): fila is Record<string, unknown> => !!fila && typeof fila === 'object' && (fila as Record<string, unknown>).identidad === email)
        .map(fila => ({ ...fila, loteId: lote.id, origen: 'Importación histórica', confirmadoEn: lote.confirmadoEn })));
    });
  }

  async revertirLote(actor: string, institucionId: string, loteId: string, motivo?: string) {
    await this.autorizacion.exigirRol(actor, institucionId, 'ADMINISTRADOR');
    if (!/^[0-9a-f-]{36}$/i.test(loteId) || !motivo?.trim()) throw new BadRequestException('Se requiere un lote válido y un motivo');
    return this.contexto.ejecutar(institucionId, async db => {
      const result = await db.query(`UPDATE lote_historico SET revertido_en=now(), revertido_por=$1, motivo_reversion=$2 WHERE id=$3 AND institucion_id=$4 AND revertido_en IS NULL RETURNING id, revertido_en AS "revertidoEn", revertido_por AS "revertidoPor", motivo_reversion AS "motivo"`, [actor, motivo.trim(), loteId, institucionId]);
      if (!result.rowCount) throw new NotFoundException('El lote no existe o ya fue revertido');
      return result.rows[0];
    });
  }
}
