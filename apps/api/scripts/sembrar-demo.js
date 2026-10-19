const fs=require('node:fs');
const path=require('node:path');
const {Client}=require('pg');
try{process.loadEnvFile(path.join(__dirname,'..','.env'));}catch{}
if(process.env.NODE_ENV==='production' && !process.argv.includes('--piloto')){
 console.error('Para el entorno piloto publicado, revisa el destino y ejecuta con --piloto explícito.');process.exit(1);
}
async function main(){
 const db=new Client({connectionString:process.env.DATABASE_URL || 'postgres://dualcampus:dualcampus@localhost:5433/dualcampus'});
 await db.connect();
 try{
  await db.query('BEGIN');
  await db.query(fs.readFileSync(path.join(__dirname,'../db/seeds/dev.sql'),'utf8'));
  await db.query(fs.readFileSync(path.join(__dirname,'../db/seeds/demo.sql'),'utf8'));
  await db.query('COMMIT');
  console.log('Instituciones piloto y dos alumnos sintéticos preparados. No se habilitó acceso Google.');
 }catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
