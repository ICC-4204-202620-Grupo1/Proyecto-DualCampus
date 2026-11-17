// Diagnostico seguro H55. Consulta respetando el RLS institucional.
// Uso: npm run avisos:diagnostico --workspace=apps/api
const path = require('node:path');
const { Pool } = require('pg');
try { process.loadEnvFile(path.join(__dirname, '..', '.env')); } catch {}
const url = process.env.DATABASE_URL || 'postgres://dualcampus:dualcampus@localhost:5433/dualcampus';
const pool = new Pool({ connectionString: url });

async function consultar(institucionId) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN READ ONLY');
    await db.query("SELECT set_config('app.institucion_id', $1, true)", [institucionId]);
    const { rows: eventos } = await db.query(`SELECT id, creado_en,
      datos->>'alumnoId' AS alumno_id
      FROM evento_academico WHERE accion = 'CORREGIR_NOTA_PUBLICADA'
      ORDER BY creado_en DESC LIMIT 10`);
    const { rows: avisos } = await db.query(`SELECT evento_id, estado, intentos,
      ultimo_error, creado_en, ultimo_intento_en, enviado_en,
      CASE WHEN destinatario_email ~ '^[^@]+@[^@]+$' THEN true ELSE false END AS email_formato_basico
      FROM aviso_correo ORDER BY creado_en DESC LIMIT 10`);
    await db.query('COMMIT');
    return { eventos, avisos };
  } catch (e) { await db.query('ROLLBACK'); throw e; }
  finally { db.release(); }
}

async function main() {
  const { rows: [db] } = await pool.query('SELECT current_database() AS nombre');
  console.log('Base:', db.nombre);
  console.log('Brevo API Key configurada:', Boolean(process.env.AVISOS_BREVO_API_KEY?.trim()));
  console.log('Remitente configurado:', Boolean(process.env.AVISOS_CORREO_REMITENTE?.trim()));
  const { rows: instituciones } = await pool.query('SELECT id, nombre FROM institucion ORDER BY nombre');
  if (!instituciones.length) console.log('No hay instituciones registradas');
  for (const inst of instituciones) {
    const { eventos, avisos } = await consultar(inst.id);
    console.log('\nInstitucion:', inst.nombre, '[' + inst.id + ']');
    console.log('Correcciones recientes:', eventos.length);
    console.log('Avisos recientes:', avisos.length);
    for (const v of avisos) console.log({
      estado: v.estado, intentos: v.intentos, ultimo_error: v.ultimo_error,
      creado_en: v.creado_en, ultimo_intento_en: v.ultimo_intento_en,
      email_formato_basico: v.email_formato_basico,
    });
    if (eventos.length && !avisos.length) console.warn('Hay correcciones pero ningun aviso visible; revisar fecha de instalacion H55 y servicio que se esta ejecutando.');
  }
}
main().catch(e => { console.error('Diagnostico H55:', e.message); process.exitCode = 1; })
  .finally(() => pool.end());
