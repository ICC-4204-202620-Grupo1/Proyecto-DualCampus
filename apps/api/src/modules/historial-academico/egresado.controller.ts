import { Controller, Get, UseGuards } from '@nestjs/common';
import { Publico } from '../../common/decorators/publico.decorator.js';
import type { EgresadoActual } from '../autenticacion/acceso-egresado.service.js';
import { Egresado, EgresadoGuard } from '../autenticacion/egresado.guard.js';
import { HistorialAcademicoService } from './historial-academico.service.js';

/**
 * H44 · Acceder al historial tras el egreso.
 * @Publico solo libera del guard institucional (dc_sesion); EgresadoGuard exige dc_egresado.
 * CA2: estas dos lecturas son todo lo que la sesión de egresado puede usar.
 */
@Publico()
@UseGuards(EgresadoGuard)
@Controller('egresado')
export class EgresadoController {
  constructor(private readonly historial: HistorialAcademicoService) {}

  /** CA1 · La persona identificada por la cuenta personal, aunque la institucional esté inactiva. */
  @Get('sesion')
  sesion(@Egresado() egresado: EgresadoActual) {
    return egresado;
  }

  /** CA2 · Solo su propio historial: la persona sale de la sesión, nunca de la petición. */
  @Get('historial')
  consultarHistorial(@Egresado() egresado: EgresadoActual) {
    return this.historial.consultarEgresado(egresado);
  }
}
