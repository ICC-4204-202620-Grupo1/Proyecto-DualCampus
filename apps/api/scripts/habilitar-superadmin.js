// H57: concesion inicial solo mediante CLI con acceso a la base. No existe endpoint de autopromocion.
const path = require('node:path');
const { Client } = require('pg');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}
const url = process.env.DATABASE_URL || 'postgres://dualcampus:dualcampus@localhost:5433/dualcampus';
async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Uso: npm run superadmin:habilitar -- correo@dominio');
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    const { rows } = await db.query('SELECT id FROM usuario WHERE email = $1 AND activo', [email]);
    if (rows.length !== 1) throw new Error('Primero debes habilitar el usuario con usuario:habilitar');
    await db.query('INSERT INTO superadministrador (usuario_id) VALUES ($1) ON CONFLICT DO NOTHING', [rows[0].id]);
    console.log('Permiso de superadministrador concedido a ' + email + '. Cierra sesion e ingresa de nuevo.');
  } finally { await db.end(); }
}
main().catch(e=>{console.error(e.message); process.exitCode=1;});
