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
