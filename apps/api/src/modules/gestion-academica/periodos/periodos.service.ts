import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AutorizacionService } from '../../autorizacion/autorizacion.service';
import { Periodo, PeriodoDuplicadoError, PeriodosRepositorio } from './periodos.repositorio';

export interface CrearPeriodoDto {
  nombre?: unknown;
  fechaInicio?: unknown;
  fechaFin?: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** true si es una fecha de calendario real con formato YYYY-MM-DD. */
function esFechaValida(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}

@Injectable()
export class PeriodosService {
  constructor(
    private readonly periodos: PeriodosRepositorio,
    private readonly autorizacion: AutorizacionService,
  ) {}

  async crear(usuarioId: string, institucionId: string, dto: CrearPeriodoDto): Promise<Periodo> {
    await this.autorizacion.exigirRol(usuarioId, institucionId, 'ADMINISTRADOR');

    const errores: string[] = [];
    const nombre = typeof dto.nombre === 'string' ? dto.nombre.trim() : '';
    if (nombre.length < 1 || nombre.length > 100) errores.push('El nombre es obligatorio (máximo 100 caracteres)');
    if (!esFechaValida(dto.fechaInicio)) errores.push('La fecha de inicio no es una fecha válida (AAAA-MM-DD)');
    if (!esFechaValida(dto.fechaFin)) errores.push('La fecha de término no es una fecha válida (AAAA-MM-DD)');
    if (errores.length === 0 && (dto.fechaInicio as string) >= (dto.fechaFin as string)) {
      errores.push('La fecha de inicio debe ser anterior a la fecha de término');
    }
    if (errores.length > 0) throw new BadRequestException(errores);

    try {
      return await this.periodos.crear(institucionId, {
        nombre,
        fechaInicio: dto.fechaInicio as string,
        fechaFin: dto.fechaFin as string,
        creadoPor: usuarioId,
      });
    } catch (e) {
      if (e instanceof PeriodoDuplicadoError) {
        throw new ConflictException(`Ya existe un período llamado "${nombre}" en esta institución`);
      }
      throw e;
    }
  }

  /** Cualquier rol de la institución puede ver sus períodos (VER · PERIODO). */
  async listar(usuarioId: string, institucionId: string): Promise<Periodo[]> {
    await this.autorizacion.exigirRol(usuarioId, institucionId, 'ADMINISTRADOR', 'PROFESOR', 'AYUDANTE', 'ALUMNO', 'DIRECTOR');
    return this.periodos.listar(institucionId);
  }

  async obtener(usuarioId: string, institucionId: string, id: string): Promise<Periodo> {
    await this.autorizacion.exigirRol(usuarioId, institucionId, 'ADMINISTRADOR', 'PROFESOR', 'AYUDANTE', 'ALUMNO', 'DIRECTOR');
    const periodo = UUID.test(id) ? await this.periodos.obtener(institucionId, id) : null;
    if (!periodo) throw new NotFoundException('Período no encontrado');
    return periodo;
  }
}
