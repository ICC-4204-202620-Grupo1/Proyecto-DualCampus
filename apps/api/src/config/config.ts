export const CONFIG = Symbol('CONFIG');
export interface Config {
  produccion:boolean; appUrl:string; databaseUrl:string; sessionSecret:string;
  sesionDuracionHoras:number; googleClientId:string; googleClientSecret:string; dominiosPermitidos:string[];
  /** Orígenes desde los que se aceptan escrituras: APP_URL más ORIGENES_PERMITIDOS. */
  origenesPermitidos:string[];
}
function validarOrigen(valor:string, clave:string, produccion:boolean):string {
  const origen=valor.trim().replace(/\/$/,'');
  let url:URL;
  try { url=new URL(origen); } catch { throw new Error(clave+' debe ser un origen HTTP(S) sin ruta'); }
  if(url.origin!==origen || !['http:','https:'].includes(url.protocol)) throw new Error(clave+' debe ser un origen HTTP(S) sin ruta');
  if(produccion && url.protocol!=='https:') throw new Error(clave+' debe usar HTTPS en producción');
  return origen;
}
export function cargarConfig(env:NodeJS.ProcessEnv=process.env):Config {
  const produccion=env.NODE_ENV==='production';
  const sessionSecret=env.SESSION_SECRET ?? '';
  if(sessionSecret.length<32) throw new Error('SESSION_SECRET debe tener al menos 32 caracteres');
  const appUrl=validarOrigen(env.APP_URL ?? 'http://localhost:5173','APP_URL',produccion);
  const adicionales=(env.ORIGENES_PERMITIDOS ?? '').split(',').filter(o=>o.trim())
    .map(o=>validarOrigen(o,'ORIGENES_PERMITIDOS',produccion));
  const origenesPermitidos=[...new Set([appUrl,...adicionales])];
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
    dominiosPermitidos:dominios,origenesPermitidos};
}
