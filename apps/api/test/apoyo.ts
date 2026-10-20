/**
 * Apoyo común de las pruebas: Google y la base de datos se reemplazan por dobles;
 * el resto (state, nonce, cookies, sesión firmada, guard y reglas) es código real.
 */
import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/app.setup.js';
import { CONFIG, cargarConfig } from '../src/config/config.js';
import { GoogleOidcAdapter } from '../src/modules/autenticacion/google-oidc.adapter.js';
import type { IdentidadGoogle, RolEnInstitucion } from '../src/modules/autenticacion/usuario-sesion.js';
import {
  ContextoConsultado,
  UsuarioRegistrado,
  UsuariosRepositorio,
} from '../src/modules/autenticacion/usuarios.repositorio.js';
import {
  NuevoPeriodo,
  Periodo,
  PeriodoDuplicadoError,
  PeriodosRepositorio,
} from '../src/modules/gestion-academica/periodos/periodos.repositorio.js';

export const SECRETO = 'secreto-de-prueba-con-mas-de-32-caracteres';
export const ID_UG = '11111111-1111-1111-1111-111111111111';
export const ID_ICS = '22222222-2222-2222-2222-222222222222';
export const ID_AJENA = '33333333-3333-3333-3333-333333333333';
export const UG: RolEnInstitucion = { institucionId: ID_UG, institucion: 'Universidad grande', rol: 'PROFESOR' };
export const ICS: RolEnInstitucion = { institucionId: ID_ICS, institucion: 'Instituto de Ciencias de la Salud', rol: 'PROFESOR' };

const identidad = (sub: string, email: string, nombre: string, extra: Partial<IdentidadGoogle> = {}): IdentidadGoogle => ({
  sub, email, nombre, emailVerificado: true, dominio: 'ug.cl', ...extra,
});

/** Cuentas que "Google" confirma según el código recibido en el callback. */
export const identidades: Record<string, IdentidadGoogle> = {
  benjamin: identidad('g-benjamin', 'benjamin@ug.cl', 'Benjamin Alonso'),
  diego: identidad('g-diego', 'diego@ug.cl', 'Diego Riquelme'),
  rodolfo: identidad('g-rodolfo', 'rodolfo@ug.cl', 'Rodolfo Ávila'),
  desconocido: identidad('g-x', 'nadie@ug.cl', 'Nadie'),
  inactivo: identidad('g-inactivo', 'inactivo@ug.cl', 'Inactivo'),
  sinrol: identidad('g-sinrol', 'sinrol@ug.cl', 'Sin Rol'),
  noverificado: identidad('g-benjamin', 'benjamin@ug.cl', 'Benjamin', { emailVerificado: false }),
  otrodominio: identidad('g-benjamin', 'benjamin@ug.cl', 'Benjamin', { dominio: 'gmail.com' }),
  suplantado: identidad('g-otra-persona', 'benjamin@ug.cl', 'Benjamin'),
};

export class GoogleFalso {
  urlAutorizacion(state: string, nonce: string) {
    return `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&nonce=${nonce}`;
  }
  async canjearCodigo(code: string): Promise<IdentidadGoogle> {
    const id = identidades[code];
    if (!id) throw new Error('código inválido');
    return id;
  }
}

export class UsuariosEnMemoria extends UsuariosRepositorio {
  usuarios: UsuarioRegistrado[] = [];
  /** Último valor de app.institucion_id con que se "consultó". */
  ultimoContexto: string | null = null;

  reiniciar() {
    this.ultimoContexto = null;
    this.usuarios = [
      // Profesor en ambas instituciones (Benjamin Alonso)
      { id: 'u-benjamin', email: 'benjamin@ug.cl', nombre: 'Benjamin Alonso', activo: true, googleSub: null, roles: [UG, ICS] },
      // Ayudante en una sola institución (Diego Riquelme)
      { id: 'u-diego', email: 'diego@ug.cl', nombre: 'Diego Riquelme', activo: true, googleSub: null, roles: [{ ...UG, rol: 'AYUDANTE' }] },
      // Administrador en ambas instituciones (Rodolfo Ávila)
      { id: 'u-rodolfo', email: 'rodolfo@ug.cl', nombre: 'Rodolfo Ávila', activo: true, googleSub: null,
        roles: [{ ...UG, rol: 'ADMINISTRADOR' }, { ...ICS, rol: 'ADMINISTRADOR' }] },
      { id: 'u-inactivo', email: 'inactivo@ug.cl', nombre: null, activo: false, googleSub: null, roles: [UG] },
      { id: 'u-sinrol', email: 'sinrol@ug.cl', nombre: null, activo: true, googleSub: null, roles: [] },
    ];
  }
  async buscarPorEmail(email: string) {
    return this.usuarios.find((u) => u.email === email) ?? null;
  }
  async buscarPorId(id: string) {
    return this.usuarios.find((u) => u.id === id) ?? null;
  }
  async registrarAcceso(id: string, sub: string) {
    const u = this.usuarios.find((x) => x.id === id)!;
    u.googleSub ??= sub;
  }
  async rolesEnInstitucionActiva(usuarioId: string, institucionId: string): Promise<ContextoConsultado | null> {
    this.ultimoContexto = institucionId;
    const roles = (await this.buscarPorId(usuarioId))?.roles.filter((r) => r.institucionId === institucionId) ?? [];
    if (roles.length === 0) return null;
    return { institucionContexto: institucionId, institucion: roles[0].institucion, roles: roles.map((r) => r.rol) };
  }
}

/** Simula la tabla periodo: unicidad por institución y aislamiento por institución activa. */
export class PeriodosEnMemoria extends PeriodosRepositorio {
  periodos: Periodo[] = [];
  constructor(private readonly usuarios: UsuariosEnMemoria) {
    super();
  }
  reiniciar() {
    this.periodos = [];
  }
  async crear(institucionId: string, d: NuevoPeriodo) {
    const clave = d.nombre.trim().toLowerCase();
    if (this.periodos.some((p) => p.institucionId === institucionId && p.nombre.trim().toLowerCase() === clave)) {
      throw new PeriodoDuplicadoError();
    }
    const u = (await this.usuarios.buscarPorId(d.creadoPor))!;
    const p: Periodo = {
      id: `0000000${this.periodos.length + 1}-0000-0000-0000-000000000000`.slice(-36),
      institucionId,
      nombre: d.nombre,
      fechaInicio: d.fechaInicio,
      fechaFin: d.fechaFin,
      creadoPor: { id: u.id, nombre: u.nombre, email: u.email },
      creadoEn: new Date().toISOString(),
    };
    this.periodos.push(p);
    return p;
  }
  async listar(institucionId: string) {
    return this.periodos.filter((p) => p.institucionId === institucionId);
  }
  async obtener(institucionId: string, id: string) {
    return this.periodos.find((p) => p.institucionId === institucionId && p.id === id) ?? null;
  }
}

export async function crearApp(
  repo: UsuariosRepositorio,
  periodos: PeriodosRepositorio = new PeriodosEnMemoria(repo as UsuariosEnMemoria),
): Promise<INestApplication> {
  const config = cargarConfig({
    SESSION_SECRET: SECRETO,
    APP_URL: 'http://localhost:5173',
    DOMINIOS_PERMITIDOS: 'ug.cl',
    SESION_DURACION_HORAS: '12',
  });
  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CONFIG).useValue(config)
    .overrideProvider(GoogleOidcAdapter).useClass(GoogleFalso)
    .overrideProvider(UsuariosRepositorio).useValue(repo)
    .overrideProvider(PeriodosRepositorio).useValue(periodos)
    .compile();
  const app = configurarApp(modulo.createNestApplication<NestExpressApplication>());
  await app.init();
  return app;
}

export function cookiesDe(res: request.Response): string[] {
  const c = res.headers['set-cookie'] as unknown as string[] | string | undefined;
  return Array.isArray(c) ? c : c ? [c] : [];
}

/** Cookie de sesión con valor (las de borrado llegan vacías). */
export function cookieSesion(res: request.Response): string | undefined {
  return cookiesDe(res).find((c) => /^dc_sesion=[^;]+/.test(c));
}

/** Recorre el flujo completo: /auth/google → Google → /auth/google/callback. */
export async function iniciarSesion(app: INestApplication, codigo: string) {
  const inicio = await request(app.getHttpServer()).get('/api/auth/google').expect(302);
  const state = new URL(inicio.headers.location).searchParams.get('state')!;
  const cookieOidc = cookiesDe(inicio).find((c) => c.startsWith('dc_oidc='))!;
  return request(app.getHttpServer())
    .get(`/api/auth/google/callback?code=${codigo}&state=${state}`)
    .set('Cookie', cookieOidc);
}

/** Inicia sesión y devuelve solo "dc_sesion=<token>" para enviarlo en peticiones. */
export async function sesionDe(app: INestApplication, codigo: string): Promise<string> {
  return cookieSesion(await iniciarSesion(app, codigo))!.split(';')[0];
}

/** Inicia sesión y deja activa la institución indicada. */
export async function sesionEn(app: INestApplication, codigo: string, institucionId: string): Promise<string> {
  const cookie = await sesionDe(app, codigo);
  const res = await request(app.getHttpServer())
    .put('/api/sesion/institucion')
    .set('Cookie', cookie)
    .send({ institucionId })
    .expect(200);
  return cookieSesion(res)!.split(';')[0];
}
