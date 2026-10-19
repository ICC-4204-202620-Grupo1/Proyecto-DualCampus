// Servidor exclusivo de pruebas: PostgreSQL real y sesiones firmadas por el test.
// No hay bypass de autenticación ni rutas de prueba dentro de la aplicación.
const {Pool}=require('pg');
const {randomUUID}=require('node:crypto');
const {readdirSync,readFileSync}=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const database=process.env.TEST_DATABASE_URL;
if(!database || !new URL(database).pathname.endsWith('_test')) throw new Error('Configura TEST_DATABASE_URL hacia una base exclusiva terminada en _test');
const schema='e2e_'+randomUUID().replaceAll('-','');
const secret='secreto-exclusivo-e2e-no-utilizar-en-produccion';
const ids={ug:'11111111-1111-4111-8111-111111111111',ics:'22222222-2222-4222-8222-222222222222',
 admin:'33333333-3333-4333-8333-333333333333',prof:'44444444-4444-4444-8444-444444444444',
 ayudante:'55555555-5555-4555-8555-555555555555',alumno:'66666666-6666-4666-8666-666666666666',
 director:'77777777-7777-4777-8777-777777777777'};
const pool=new Pool({connectionString:database,options:'-c search_path='+schema+',public'});
const children=[];
let creado=false,cerrando=false;
async function cerrar(){
 if(cerrando)return;cerrando=true;
 for(const c of children)c.kill();
 if(creado)await pool.query('DROP SCHEMA IF EXISTS '+schema+' CASCADE');
 await pool.end();process.exit(0);
}
process.on('SIGTERM',cerrar);process.on('SIGINT',cerrar);
async function main(){
 const rol=await pool.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
 if(rol.rows[0].rolsuper || rol.rows[0].rolbypassrls)throw new Error('Usa un rol sin SUPERUSER ni BYPASSRLS');
 await pool.query('CREATE SCHEMA '+schema);creado=true;
 const dir=path.join(root,'apps/api/db/migrations');
 for(const f of readdirSync(dir).filter(x=>x.endsWith('.sql')).sort()) await pool.query(readFileSync(path.join(dir,f),'utf8'));
 await pool.query('CREATE TABLE schema_migraciones(archivo text PRIMARY KEY)');
 await pool.query("INSERT INTO schema_migraciones VALUES ('003_configuracion_academica.sql')");
 await pool.query('INSERT INTO institucion(id,nombre) VALUES ($1,$2),($3,$4)',[ids.ug,'Universidad grande',ids.ics,'Instituto de Ciencias de la Salud']);
 for(const [key,rol,nombre] of [['admin','ADMINISTRADOR','Administración Demo'],['prof','PROFESOR','Profesora Demo'],
 ['ayudante','AYUDANTE','Ayudante Demo'],['alumno','ALUMNO','Estudiante Demo'],['director','DIRECTOR','Dirección Demo']]){
   await pool.query('INSERT INTO usuario(id,email,nombre) VALUES ($1,$2,$3)',[ids[key],key+'@example.invalid',nombre]);
   await pool.query('INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,$3)',[ids[key],ids.ug,rol]);
   if(['admin','prof'].includes(key))await pool.query('INSERT INTO rol_en_institucion(usuario_id,institucion_id,rol) VALUES ($1,$2,$3)',[ids[key],ids.ics,rol]);
 }
 const url=new URL(database);url.searchParams.set('options','-c search_path='+schema+',public');
 const env={...process.env,NODE_ENV:'test',DATABASE_URL:url.toString(),SESSION_SECRET:secret,
 APP_URL:'http://localhost:5173',PORT:'3000',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',DOMINIOS_PERMITIDOS:''};
 children.push(spawn(process.execPath,[path.join(root,'apps/api/dist/main.js')],{cwd:path.join(root,'apps/api'),env,stdio:'inherit'}));
 for(let n=0;n<100;n++){
   try{const r=await fetch('http://localhost:3000/api/health/ready');if(r.ok)break;}catch{}
   if(n===99)throw new Error('La API de prueba no arrancó');
   await new Promise(r=>setTimeout(r,100));
 }
 children.push(spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','localhost','--port','5173','--strictPort'],
 {cwd:path.join(root,'apps/web'),env,stdio:'inherit'}));
 for(const c of children)c.on('exit',code=>{if(!cerrando && code!==0){console.error('Proceso de prueba finalizado:',code);cerrar();}});
}
main().catch(async e=>{console.error(e.message);await cerrar();});
