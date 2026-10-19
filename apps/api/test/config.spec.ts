import { describe,expect,it } from 'vitest';
import { cargarConfig } from '../src/config/config';
const base={SESSION_SECRET:'secreto-exclusivo-de-pruebas-1234567890'};
describe('Configuración de despliegue',()=>{
 it('rechaza producción sin OAuth, base o dominios',()=>{
   expect(()=>cargarConfig({...base,NODE_ENV:'production',APP_URL:'https://campus.example.invalid'})).toThrow('DATABASE_URL');
   expect(()=>cargarConfig({...base,NODE_ENV:'production',APP_URL:'https://campus.example.invalid',DATABASE_URL:'postgres://ejemplo',GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secreto'})).toThrow('DOMINIOS_PERMITIDOS');
 });
 it('rechaza URL insegura o con ruta y duraciones inválidas',()=>{
   expect(()=>cargarConfig({...base,NODE_ENV:'production',APP_URL:'http://campus.example.invalid'})).toThrow('HTTPS');
   expect(()=>cargarConfig({...base,APP_URL:'https://campus.example.invalid/ruta'})).toThrow('origen');
   for(const duracion of ['NaN','0','-1','73'])expect(()=>cargarConfig({...base,SESION_DURACION_HORAS:duracion})).toThrow('SESION');
 });
 it('admite configuración institucional completa',()=>{
   expect(cargarConfig({...base,NODE_ENV:'production',APP_URL:'https://campus.example.invalid/',DATABASE_URL:'postgres://ejemplo',
    GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secreto',DOMINIOS_PERMITIDOS:' UG.CL , ICS.CL '}).dominiosPermitidos).toEqual(['ug.cl','ics.cl']);
 });
});
