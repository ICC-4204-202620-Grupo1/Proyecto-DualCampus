// Cliente base para llamar a la API de DualCampus (mismo origen: /api).
export const API_URL = import.meta.env.VITE_API_URL ?? '/api';

let institucionEsperada: string | null = null;
function contextoHeaders(): Record<string,string> {
  return institucionEsperada ? { 'X-Institucion-Id': institucionEsperada } : {};
}

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
  const usuario: UsuarioSesion = await res.json();
  institucionEsperada = usuario.institucionActivaId;
  return usuario;
}

export async function cerrarSesion(): Promise<void> {
  const res = await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error('No se pudo cerrar la sesión');
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
  const usuario = await json<UsuarioSesion>(res);
  institucionEsperada = usuario.institucionActivaId;
  return usuario;
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
  if (res.status === 401) window.dispatchEvent(new Event('sesion-expirada'));
  if (!res.ok) {
    const m = cuerpo.message ?? `Error ${res.status}`;
    throw new ErrorApi(res.status, Array.isArray(m) ? m : [m]);
  }
  return cuerpo as T;
}

export async function listarPeriodos(): Promise<Periodo[]> {
  return api<Periodo[]>('/periodos');
}

export async function crearPeriodo(datos: { nombre: string; fechaInicio: string; fechaFin: string }): Promise<Periodo> {
  const res = await fetch(`${API_URL}/periodos`, {
    method: 'POST',
    credentials: 'include',
    headers: { ...contextoHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
  return cuerpoOError(res);
}

/** Operaciones del recorrido académico; todos los datos se validan nuevamente en la API. */
export async function api<T>(ruta:string,method='GET',datos?:unknown):Promise<T> {
  const res=await fetch(API_URL+ruta,{
    method,credentials:'include',
    headers:{...contextoHeaders(),...(datos===undefined?{}:{'Content-Type':'application/json'})},
    ...(datos===undefined?{}:{body:JSON.stringify(datos)}),
  });
  return cuerpoOError<T>(res);
}

/** Descarga protegida mediante la misma cookie de sesión y el contexto institucional. */
export async function descargarMaterial(seccionId: string, materialId: string, nombreArchivo: string): Promise<void> {
  const res = await fetch(`${API_URL}/materiales/secciones/${encodeURIComponent(seccionId)}/materiales/${encodeURIComponent(materialId)}/descargar`, {
    credentials: 'include', headers: contextoHeaders(),
  });
  if (!res.ok) {
    await cuerpoOError(res);
    return;
  }
  const archivo = await res.blob();
  const url = URL.createObjectURL(archivo);
  try {
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
