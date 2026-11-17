import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContextoInstitucion } from '../../database/contexto-institucion.js';
import { AutorizacionService } from '../autorizacion/autorizacion.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** H46. Agregados sin información identificable de alumnos. */
@Injectable()
export class DistribucionNotasService {
  constructor(private readonly contexto: ContextoInstitucion, private readonly autorizacion: AutorizacionService) {}

  async consultar(actor: string, institucion: string, seccionId: string) {
    if (!UUID.test(seccionId)) throw new BadRequestException('Sección inválida');
    await this.autorizacion.exigirRol(actor, institucion, 'PROFESOR');
    return this.contexto.ejecutar(institucion, async db => {
      const seccion = await db.query(
        `SELECT s.id, s.codigo, c.codigo AS "cursoCodigo", c.nombre AS curso,
                p.id AS "periodoId", p.nombre AS periodo
         FROM seccion s JOIN curso c ON c.id=s.curso_id
         JOIN periodo p ON p.id=s.periodo_id
         WHERE s.id=$1 AND s.institucion_id=$2`,
        [seccionId, institucion],
      );
      if (!seccion.rowCount) throw new NotFoundException('Sección no encontrada');
      const asignacion = await db.query(
        `SELECT 1 FROM equipo_docente WHERE institucion_id=$1 AND seccion_id=$2
          AND usuario_id=$3 AND rol='PROFESOR'`,
        [institucion, seccionId, actor],
      );
      if (!asignacion.rowCount) throw new ForbiddenException('No estás asignado como profesor a esta sección');

      // Solo evaluaciones publicadas y notas numéricas. Ausencias o notas sin valor no se convierten en cero.
      // Se incluye historial de alumnos retirados, pues las notas publicadas no se eliminan con el retiro.
      const resultado = await db.query(
        `SELECT n.valor::float8 AS valor
         FROM evaluacion e JOIN nota n ON n.evaluacion_id=e.id AND n.institucion_id=e.institucion_id
         JOIN matricula m ON m.seccion_id=e.seccion_id AND m.usuario_id=n.usuario_id
         WHERE e.institucion_id=$1 AND e.seccion_id=$2 AND e.estado='PUBLICADA'
           AND n.valor IS NOT NULL AND n.es_ausente=false`,
        [institucion, seccionId],
      );
      const conteos = Array(6).fill(0) as number[];
      for (const fila of resultado.rows as {valor: number}[]) {
        const nota=Number(fila.valor);
        if (Number.isFinite(nota) && nota>=1 && nota<=7) {
          const indice=Math.min(6, Math.floor(nota));
          conteos[indice-1] += 1;
        }
      }
      const rangos=['1,0–1,9','2,0–2,9','3,0–3,9','4,0–4,9','5,0–5,9','6,0–7,0'];
      const total=conteos.reduce((a,b)=>a+b,0);
      return {
        seccion: seccion.rows[0],
        cantidadNotas: total,
        distribucion: rangos.map((rango,indice)=>({rango,cantidad:conteos[indice]})),
      };
    });
  }
}
