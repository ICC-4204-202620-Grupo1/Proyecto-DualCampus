import type { Rol } from '../autenticacion/usuario-sesion.js';

/** Carga masiva de usuarios: lectura del CSV y validación sin acceso a la base. */

export const ROLES_CARGA: Rol[] = ['ADMINISTRADOR', 'PROFESOR', 'AYUDANTE', 'ALUMNO', 'DIRECTOR'];
export const MAX_FILAS_CARGA = 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ResultadoFila = 'CREAR' | 'ASIGNAR_ROL' | 'SIN_CAMBIOS' | 'RECHAZADA';

export interface FilaCarga {
  fila: number;
  email: string;
  nombre: string;
  universidad: string;
  rol: string;
  resultado: ResultadoFila;
  motivo?: string;
  /** Solo para uso interno del servidor al confirmar. */
  institucionId?: string;
}

export interface InstitucionCarga { id: string; nombre: string }
export interface UsuarioExistente { id: string; activo: boolean; roles: { institucionId: string; rol: string }[] }

/** Separa el texto en filas y columnas. Acepta coma o punto y coma y campos entre comillas. */
export function leerCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const primera = limpio.split('\n', 1)[0] ?? '';
  const separador = primera.includes(';') && !primera.includes(',') ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"' && campo.trim() === '') { comillas = true; campo = ''; }
    else if (c === separador) { fila.push(campo.trim()); campo = ''; }
    else if (c === '\n') { fila.push(campo.trim()); filas.push(fila); fila = []; campo = ''; }
    else campo += c;
  }
  if (campo.trim() !== '' || fila.length) { fila.push(campo.trim()); filas.push(fila); }
  return filas.filter((f) => f.some((v) => v !== ''));
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Interpreta el CSV y valida cada fila contra las universidades y usuarios existentes. */
export function validarCarga(
  texto: string,
  instituciones: InstitucionCarga[],
  existentes: Map<string, UsuarioExistente>,
  institucionPorDefecto?: InstitucionCarga,
): { filas: FilaCarga[]; error?: string } {
  const tabla = leerCsv(texto);
  if (!tabla.length) return { filas: [], error: 'El archivo está vacío.' };
  const encabezado = tabla[0].map(normalizar);
  const col = (nombre: string) => encabezado.indexOf(nombre);
  const faltantes = ['email', 'nombre', 'rol'].filter((c) => col(c) < 0);
  if (faltantes.length) {
    return { filas: [], error: `Faltan columnas en el encabezado: ${faltantes.join(', ')}. Usa email,nombre,rol y opcionalmente universidad.` };
  }
  const datos = tabla.slice(1);
  if (!datos.length) return { filas: [], error: 'El archivo no tiene filas de usuarios.' };
  if (datos.length > MAX_FILAS_CARGA) return { filas: [], error: `El archivo supera el máximo de ${MAX_FILAS_CARGA} filas.` };

  const porNombre = new Map(instituciones.map((i) => [normalizar(i.nombre), i]));
  const vistos = new Set<string>();
  const nuevos = new Set<string>();
  const filas = datos.map((valores, i): FilaCarga => {
    const valor = (c: string) => (col(c) >= 0 ? valores[col(c)] ?? '' : '').trim();
    const email = valor('email').toLowerCase();
    const nombre = valor('nombre').replace(/\s+/g, ' ');
    const rol = valor('rol').toUpperCase();
    const universidad = valor('universidad');
    const base = { fila: i + 2, email, nombre, rol, universidad: universidad || institucionPorDefecto?.nombre || '' };
    const rechazar = (motivo: string): FilaCarga => ({ ...base, resultado: 'RECHAZADA', motivo });

    if (!email || email.length > 254 || !EMAIL.test(email)) return rechazar('Correo inválido');
    if (nombre.length < 2 || nombre.length > 150) return rechazar('El nombre debe tener entre 2 y 150 caracteres');
    if (!ROLES_CARGA.includes(rol as Rol)) return rechazar(`Rol inválido: usa ${ROLES_CARGA.join(', ')}`);
    const inst = universidad ? porNombre.get(normalizar(universidad)) : institucionPorDefecto;
    if (!inst) return rechazar(universidad ? 'La universidad no existe o está inactiva' : 'Falta la universidad');

    const clave = `${email}|${inst.id}|${rol}`;
    if (vistos.has(clave)) return rechazar('Fila repetida en el archivo');
    vistos.add(clave);

    const fila = { ...base, universidad: inst.nombre, institucionId: inst.id };
    const usuario = existentes.get(email);
    if (!usuario) {
      // Un correo nuevo con varios roles se crea una vez; sus filas siguientes solo agregan rol.
      if (nuevos.has(email)) return { ...fila, resultado: 'ASIGNAR_ROL' };
      nuevos.add(email);
      return { ...fila, resultado: 'CREAR' };
    }
    if (!usuario.activo) return { ...fila, resultado: 'RECHAZADA', motivo: 'El usuario existe pero está inactivo' };
    const tieneRol = usuario.roles.some((r) => r.institucionId === inst.id && r.rol === rol);
    return { ...fila, resultado: tieneRol ? 'SIN_CAMBIOS' : 'ASIGNAR_ROL' };
  });
  return { filas };
}

/** Quita los datos internos antes de responder al navegador. */
export function filaPublica({ institucionId: _id, ...fila }: FilaCarga): Omit<FilaCarga, 'institucionId'> {
  return fila;
}
