import { Body, Controller, ForbiddenException, Get, HttpCode, Logger, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Publico } from '../../common/decorators/publico.decorator.js';
import { AutenticacionService, DOMINIO_PRUEBA } from './autenticacion.service.js';
import { correoPrueba, CuentasPruebaService, ROLES_PRUEBA } from './cuentas-prueba.service.js';
import { COOKIE_EGRESADO, COOKIE_SESION, SesionService } from './sesion.service.js';

/**
 * «Crear y probar usuarios» del login: cuentas @testing.com sin contraseña ni administrador,
 * disponibles en todos los entornos. Es una herramienta para la etapa de pruebas: para retirarla,
 * eliminar este controlador, CuentasPruebaService y el componente CuentasPrueba de la web.
 */
@Publico()
@Controller('cuentas-prueba')
export class CuentasPruebaController {
  private readonly log = new Logger(CuentasPruebaController.name);

  constructor(
    private readonly cuentas: CuentasPruebaService,
    private readonly autenticacion: AutenticacionService,
    private readonly sesion: SesionService,
  ) {}

  /** Dominio y roles que ofrece el formulario. */
  @Get('opciones')
  opciones() {
    return { dominio: DOMINIO_PRUEBA, roles: ROLES_PRUEBA };
  }

  @Get('instituciones')
  instituciones() {
    return this.cuentas.instituciones();
  }

  @Post()
  async crear(@Body() datos: Record<string, unknown>) {
    const cuenta = await this.cuentas.crear(datos);
    this.log.warn(`Cuenta de prueba creada: ${cuenta.email} (${cuenta.rol})`);
    return cuenta;
  }

  /** Ingreso sin Google ni contraseña, solo para cuentas @testing.com. */
  @Post('ingresar')
  @HttpCode(200)
  async ingresar(@Body() datos: { email?: unknown }, @Res({ passthrough: true }) res: Response) {
    const email = correoPrueba(datos?.email);
    const usuario = email ? await this.autenticacion.autorizarCuentaPrueba(email) : null;
    if (!usuario) throw new ForbiddenException(`No hay una cuenta de prueba habilitada con ese correo. Solo se aceptan cuentas ${DOMINIO_PRUEBA}.`);
    this.log.warn(`Ingreso con cuenta de prueba: ${usuario.email}`);
    res.clearCookie(COOKIE_EGRESADO, this.sesion.opcionesBorrado());
    res.cookie(COOKIE_SESION, this.sesion.emitir(usuario), this.sesion.opcionesCookieSesion());
    return usuario;
  }
}
