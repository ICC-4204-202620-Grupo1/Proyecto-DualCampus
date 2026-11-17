export type Rol = 'ADMINISTRADOR' | 'PROFESOR' | 'AYUDANTE' | 'ALUMNO' | 'DIRECTOR';

export interface RolEnInstitucion {
  institucionId: string;
  institucion: string;
  rol: Rol;
}

/** Objeto de valor que viaja en la cookie de sesión (Entrega 3, 4.2). */
export interface UsuarioSesion {
  usuarioId: string;
  email: string;
  nombre: string;
  /** Se define al seleccionar institución (H02). */
  institucionActivaId: string | null;
  roles: RolEnInstitucion[];
}

/** Lo que Google confirma de la persona tras validar el id_token. */
export interface IdentidadGoogle {
  sub: string;
  email: string;
  emailVerificado: boolean;
  nombre: string;
  /** Dominio de Google Workspace (claim hd); null en cuentas personales. */
  dominio: string | null;
}
