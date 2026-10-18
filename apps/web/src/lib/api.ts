// Cliente base para llamar a la API de DualCampus (mismo origen: /api).
export const API_URL = import.meta.env.VITE_API_URL ?? '/api';

export type Rol = 'ADMINISTRADOR' | 'PROFESOR' | 'AYUDANTE' | 'ALUMNO' | 'DIRECTOR';

export interface UsuarioSesion {
  usuarioId: string;
  email: string;
  nombre: string;
  institucionActivaId: string | null;
  roles: { institucionId: string; institucion: string; rol: Rol }[];
}

/** Devuelve la sesión actual, o null si no hay sesión o venció (401). */
export async function obtenerSesion(): Promise<UsuarioSesion | null> {
  const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Error ${res.status} al consultar la sesión`);
  return res.json();
}

export async function cerrarSesion(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
}

export const URL_INICIAR_SESION = `${API_URL}/auth/google`;

export interface InstitucionAutorizada {
  id: string;
  nombre: string;
  roles: Rol[];
}

export interface ContextoInstitucion {
  institucionActivaId: string;
  institucionContexto: string;
  institucion: string;
  roles: Rol[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

/** Solo las instituciones en que el usuario tiene un rol. */
export async function obtenerInstituciones(): Promise<InstitucionAutorizada[]> {
  const res = await fetch(`${API_URL}/sesion/instituciones`, { credentials: 'include' });
  return (await json<{ instituciones: InstitucionAutorizada[] }>(res)).instituciones;
}

/** Cambia la institución activa; la API reemite la cookie y devuelve la sesión nueva. */
export async function seleccionarInstitucion(institucionId: string): Promise<UsuarioSesion> {
  const res = await fetch(`${API_URL}/sesion/institucion`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ institucionId }),
  });
  return json<UsuarioSesion>(res);
}

/** Consulta hecha en el contexto de la institución activa. */
export async function obtenerContexto(): Promise<ContextoInstitucion> {
  return json<ContextoInstitucion>(await fetch(`${API_URL}/sesion/contexto`, { credentials: 'include' }));
}

export interface Periodo {
  id: string;
  institucionId: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  creadoPor: { id: string; nombre: string | null; email: string };
  creadoEn: string;
}

/** Error de la API con sus mensajes (Nest entrega string o lista). */
export class ErrorApi extends Error {
  constructor(public status: number, public mensajes: string[]) {
    super(mensajes.join('. '));
  }
}

async function cuerpoOError<T>(res: Response): Promise<T> {
  const cuerpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    const m = cuerpo.message ?? `Error ${res.status}`;
    throw new ErrorApi(res.status, Array.isArray(m) ? m : [m]);
  }
  return cuerpo as T;
}

export async function listarPeriodos(): Promise<Periodo[]> {
  return cuerpoOError(await fetch(`${API_URL}/periodos`, { credentials: 'include' }));
}

export async function crearPeriodo(datos: { nombre: string; fechaInicio: string; fechaFin: string }): Promise<Periodo> {
  const res = await fetch(`${API_URL}/periodos`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  return cuerpoOError(res);
}
