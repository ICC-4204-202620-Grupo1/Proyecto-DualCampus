// Habilita una cuenta para iniciar sesión (mientras no exista la administración de usuarios).
// Uso: npm run usuario:habilitar -- correo@dominio.cl PROFESOR "Universidad grande" "Nombre Apellido"
const path = require('node:path');
const { Client } = require('pg');

try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}

const ROLES = ['ADMINISTRADOR', 'PROFESOR', 'AYUDANTE', 'ALUMNO', 'DIRECTOR'];

async function main() {
  const [email, rol, institucion = 'Universidad grande', nombre = null] = process.argv.slice(2);
  if (!email || !ROLES.includes(rol)) {
    console.error(`Uso: npm run usuario:habilitar -- <email> <${ROLES.join('|')}> ["Institución"] ["Nombre"]`);
    process.exit(1);
  }
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const inst = await db.query('SELECT id FROM institucion WHERE nombre = $1', [institucion]);
  if (inst.rows.length === 0) throw new Error(`No existe la institución "${institucion}". Corre npm run db:migrar -- --seed`);
  const u = await db.query(
    `INSERT INTO usuario (email, nombre) VALUES (lower($1), $2)
     ON CONFLICT (email) DO UPDATE SET activo = true, nombre = COALESCE(EXCLUDED.nombre, usuario.nombre)
     RETURNING id`,
    [email, nombre],
  );
  await db.query(
    `INSERT INTO rol_en_institucion (usuario_id, institucion_id, rol) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [u.rows[0].id, inst.rows[0].id, rol],
  );
  await db.end();
  console.log(`${email.toLowerCase()} habilitado como ${rol} en ${institucion}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
