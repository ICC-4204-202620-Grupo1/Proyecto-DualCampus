import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { exportarIndicadoresCsv } from '../src/modules/reporteria/exportar-indicadores.js';
import { ReporteriaController } from '../src/modules/reporteria/reporteria.controller.js';
import type { IndicadoresInstitucionales } from '../src/modules/reporteria/indicadores-institucionales.service.js';
import type { UsuarioSesion } from '../src/modules/autenticacion/usuario-sesion.js';

const sinDatos = { valor: null, motivo: 'sin_datos' as const };
const oculto = { valor: null, motivo: 'grupo_pequeno' as const };
const reporte: IndicadoresInstitucionales = {
  periodo: { id: '11111111-1111-4111-8111-111111111111', nombre: '2026-2', fechaInicio: '2026-08-01', fechaFin: '2026-12-31' },
  filtros: { facultad: 'Ingeniería' },
  facultades: ['Ingeniería'],
  minimoAlumnos: 5,
  denominadores: { alumnos: 8, notas: 8, asistencia: null },
  institucion: {
    alumnos: 8, motivo: null, promedioNotas: { valor: 5.2, motivo: null },
    aprobacion: { valor: 75, motivo: null }, asistencia: sinDatos,
    distribucion: { motivo: null, rangos: [
      { rango: '1,0–1,9', cantidad: null, motivo: 'grupo_pequeno' },
      { rango: '5,0–5,9', cantidad: 6, motivo: null },
    ] },
  },
  cursos: [
    { codigo: 'MAT101', nombre: 'Álgebra', alumnos: 8, motivo: null,
      promedioNotas: { valor: 5.2, motivo: null }, aprobacion: { valor: 75, motivo: null }, asistencia: sinDatos,
      distribucion: { motivo: 'grupo_pequeno', rangos: [] } },
    { codigo: '=FIS101', nombre: 'Física', alumnos: null, motivo: 'grupo_pequeno',
      promedioNotas: oculto, aprobacion: oculto, asistencia: oculto,
      distribucion: { motivo: 'grupo_pequeno', rangos: [] } },
  ],
};

describe('H50: exportar reporte agregado', () => {
  it('exporta fecha, filtros y solo cifras públicas; conserva supresiones', () => {
    const csv = exportarIndicadoresCsv(reporte, new Date('2026-11-17T12:00:00.000Z'));
    expect(csv).toContain('2026-11-17T12:00:00.000Z');
    expect(csv).toContain('Ingeniería');
    expect(csv).toContain('"Institución","","8","5.2","75","Sin datos"');
    expect(csv).toContain('"\'=FIS101 · Física","Oculto: menos de cinco alumnos"');
    expect(csv).toContain('"1,0–1,9","Oculto: menos de cinco alumnos"');
    expect(csv).not.toContain(reporte.periodo.id);
    expect(csv).not.toContain('alumno@example.org');
    expect(csv).not.toContain('"11"'); // El curso oculto de tres alumnos no entra en el total.
  });

  it('deniega la descarga si el rol vigente no autoriza consultar indicadores', async () => {
    const consultar = vi.fn().mockRejectedValue(new ForbiddenException());
    const controller = new ReporteriaController({} as never, { consultar } as never);
    const usuario = { usuarioId: 'sin-rol' } as UsuarioSesion;
    await expect(controller.exportarIndicadores(usuario, 'institucion', reporte.periodo.id, 'Ingeniería'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(consultar).toHaveBeenCalledWith('sin-rol', 'institucion', reporte.periodo.id, 'Ingeniería');
  });
});
