export const CONFIG = Symbol('CONFIG');
export interface Config {
  produccion:boolean; appUrl:string; databaseUrl:string; sessionSecret:string;
  sesionDuracionHoras:number; googleClientId:string; googleClientSecret:string; dominiosPermitidos:string[];
}
export function cargarConfig(env:NodeJS.ProcessEnv=process.env):Config {
  const produccion=env.NODE_ENV==='production';
  const sessionSecret=env.SESSION_SECRET ?? '';
  if(sessionSecret.length<32) throw new Error('SESSION_SECRET debe tener al menos 32 caracteres');
  const appUrl=(env.APP_URL ?? 'http://localhost:5173').replace(/\/$/,'');
  const url=new URL(appUrl);
  if(url.origin!==appUrl || !['http:','https:'].includes(url.protocol)) throw new Error('APP_URL debe ser un origen HTTP(S) sin ruta');
  if(produccion && url.protocol!=='https:') throw new Error('APP_URL debe usar HTTPS en producción');
  const horas=Number(env.SESION_DURACION_HORAS ?? 12);
  if(!Number.isFinite(horas) || horas<=0 || horas>72) throw new Error('SESION_DURACION_HORAS debe estar entre 0 (excluido) y 72');
  const dominios=(env.DOMINIOS_PERMITIDOS ?? '').split(',').map(d=>d.trim().toLowerCase()).filter(Boolean);
  if(produccion) {
    for(const clave of ['DATABASE_URL','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET']) {
      if(!env[clave]?.trim()) throw new Error('Falta '+clave+' en producción');
    }
    if(!dominios.length) throw new Error('DOMINIOS_PERMITIDOS es obligatorio en producción');
  }
  return {produccion,appUrl,sessionSecret,sesionDuracionHoras:horas,
    databaseUrl:env.DATABASE_URL ?? 'postgres://dualcampus:dualcampus@localhost:5433/dualcampus',
    googleClientId:env.GOOGLE_CLIENT_ID ?? '',googleClientSecret:env.GOOGLE_CLIENT_SECRET ?? '',
    dominiosPermitidos:dominios};
}
