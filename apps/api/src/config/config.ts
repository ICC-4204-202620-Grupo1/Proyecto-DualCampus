export const CONFIG = Symbol('CONFIG');

export interface Config {
  produccion: boolean;
  /** Origen público de la aplicación web (ej. http://localhost:5173). La API se sirve bajo {appUrl}/api. */
  appUrl: string;
  databaseUrl: string;
  sessionSecret: string;
  sesionDuracionHoras: number;
  googleClientId: string;
  googleClientSecret: string;
  /** Dominios de Google Workspace aceptados (claim hd). Vacío = cualquier dominio. */
  dominiosPermitidos: string[];
}

export function cargarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const produccion = env.NODE_ENV === 'production';
  const sessionSecret = env.SESSION_SECRET ?? '';
  if (sessionSecret.length < 32) {
    throw new Error(
      'SESSION_SECRET debe tener al menos 32 caracteres. Copia apps/api/.env.example a apps/api/.env y complétalo.',
    );
  }
  return {
    produccion,
    appUrl: (env.APP_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
    databaseUrl: env.DATABASE_URL ?? 'postgres://dualcampus:dualcampus@localhost:5433/dualcampus',
    sessionSecret,
    sesionDuracionHoras: Number(env.SESION_DURACION_HORAS ?? 12),
    googleClientId: env.GOOGLE_CLIENT_ID ?? '',
    googleClientSecret: env.GOOGLE_CLIENT_SECRET ?? '',
    dominiosPermitidos: (env.DOMINIOS_PERMITIDOS ?? '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  };
}
