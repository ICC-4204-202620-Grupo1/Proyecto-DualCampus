// Aplica en orden los .sql de db/migrations que aún no se han aplicado.
// Uso: npm run db:migrar   (usa DATABASE_URL de apps/api/.env o del entorno)
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}

async function main() {
  const dir = path.join(__dirname, '..', 'db', 'migrations');
  const archivos = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migraciones (
    archivo text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())`);
  const { rows } = await db.query('SELECT archivo FROM schema_migraciones');
  const aplicadas = new Set(rows.map((r) => r.archivo));
  for (const archivo of archivos.filter((a) => !aplicadas.has(a))) {
    await db.query('BEGIN');
    try {
      await db.query(fs.readFileSync(path.join(dir, archivo), 'utf8'));
      await db.query('INSERT INTO schema_migraciones (archivo) VALUES ($1)', [archivo]);
      await db.query('COMMIT');
      console.log(`aplicada ${archivo}`);
    } catch (e) {
      await db.query('ROLLBACK');
      throw new Error(`${archivo}: ${e.message}`);
    }
  }
  if (process.argv.includes('--seed')) {
    await db.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'seeds', 'dev.sql'), 'utf8'));
    console.log('datos de desarrollo cargados');
  }
  await db.end();
  console.log('base de datos al día');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
