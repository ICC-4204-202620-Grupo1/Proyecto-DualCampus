import { useState, type ChangeEvent, type FormEvent } from 'react';
import { confirmarCargaUsuarios, validarCargaUsuarios, type FilaCargaUsuarios, type InstitucionGlobal,
  type ResultadoFilaCarga, type ResumenCargaUsuarios } from '../../lib/api';

/** El servidor acepta cuerpos de hasta 100 KB; se deja margen para el resto de la solicitud. */
const MAX_CARACTERES = 95_000;
const PLANTILLA = 'email,nombre,rol,universidad\nana.perez@miuandes.cl,Ana Pérez,ALUMNO,\njuan.soto@miuandes.cl,Juan Soto,PROFESOR,\n';
const ETIQUETAS: Record<ResultadoFilaCarga, string> = {
  CREAR: 'Usuario nuevo',
  ASIGNAR_ROL: 'Rol nuevo',
  SIN_CAMBIOS: 'Ya registrado',
  RECHAZADA: 'Rechazada',
};
const errorDe = (e: unknown) => e instanceof Error ? e.message : 'Operación fallida';

export function CargaMasivaUsuarios({ universidades, onCargado }: { universidades: InstitucionGlobal[]; onCargado: () => void }) {
  const [csv, setCsv] = useState('');
  const [institucionId, setInstitucionId] = useState('');
  const [previa, setPrevia] = useState<{ filas: FilaCargaUsuarios[]; resumen: ResumenCargaUsuarios } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  function cambiarCsv(texto: string) { setCsv(texto); setPrevia(null); setAviso(''); }

  async function leerArchivo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setError('');
    if (archivo.size > MAX_CARACTERES) { setError('El archivo es demasiado grande. Divídelo en partes de hasta 1000 filas.'); return; }
    try { cambiarCsv(await archivo.text()); }
    catch { setError('No se pudo leer el archivo. Selecciónalo nuevamente.'); }
  }

  function descargarPlantilla() {
    const url = URL.createObjectURL(new Blob(['﻿' + PLANTILLA], { type: 'text/csv;charset=utf-8' }));
    const enlace = document.createElement('a');
    enlace.href = url; enlace.download = 'plantilla-usuarios.csv'; enlace.click();
    URL.revokeObjectURL(url);
  }

  async function previsualizar(e: FormEvent) {
    e.preventDefault(); setError(''); setAviso('');
    if (csv.length > MAX_CARACTERES) { setError('El contenido es demasiado grande. Divídelo en partes de hasta 1000 filas.'); return; }
    setOcupado(true);
    try { setPrevia(await validarCargaUsuarios(csv, institucionId)); }
    catch (e) { setPrevia(null); setError(errorDe(e)); }
    finally { setOcupado(false); }
  }

  async function confirmar() {
    setOcupado(true); setError('');
    try {
      const r = await confirmarCargaUsuarios(csv, institucionId);
      setAviso(`Carga completada: ${r.crear} usuarios nuevos, ${r.asignarRol} roles asignados, ${r.sinCambios} sin cambios.`);
      setCsv(''); setPrevia(null); onCargado();
    } catch (e) { setError(errorDe(e)); }
    finally { setOcupado(false); }
  }

  const cambios = previa ? previa.resumen.crear + previa.resumen.asignarRol : 0;
  const puedeConfirmar = !!previa && previa.resumen.rechazadas === 0 && cambios > 0;

  return <section aria-label="Carga masiva de usuarios">
    <h3>Carga masiva desde CSV</h3>
    <p className="texto-suave">
      Columnas: <code>email,nombre,rol</code> y opcionalmente <code>universidad</code> (su nombre exacto).
      Roles válidos: ADMINISTRADOR, PROFESOR, AYUDANTE, ALUMNO, DIRECTOR. Se acepta coma o punto y coma; máximo 1000 filas.
      Primero revisa la vista previa: no se guarda nada hasta confirmar.
    </p>
    <button type="button" className="boton-secundario" onClick={descargarPlantilla}>Descargar plantilla</button>
    <form onSubmit={e => void previsualizar(e)}>
      <label>Universidad para filas sin universidad
        <select value={institucionId} onChange={e => { setInstitucionId(e.target.value); setPrevia(null); }}>
          <option value="">Ninguna: cada fila indica su universidad</option>
          {universidades.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
        </select>
      </label>
      <label>Archivo CSV<input type="file" accept=".csv,text/csv,text/plain" onChange={e => void leerArchivo(e)} /></label>
      <label>Contenido del CSV
        <textarea rows={6} required value={csv} onChange={e => cambiarCsv(e.target.value)}
          placeholder={'email,nombre,rol,universidad\nana.perez@miuandes.cl,Ana Pérez,ALUMNO,'} />
      </label>
      <button disabled={ocupado || !csv.trim()}>{ocupado && !previa ? 'Validando…' : 'Previsualizar carga'}</button>
    </form>
    {error && <p className="alerta" role="alert">{error}</p>}
    {aviso && <p className="exito" role="status">{aviso}</p>}
    {previa && <div className="preview" aria-label="Vista previa de la carga masiva">
      <p>
        {previa.resumen.total} filas · {previa.resumen.crear} usuarios nuevos · {previa.resumen.asignarRol} roles nuevos
        · {previa.resumen.sinCambios} sin cambios · {previa.resumen.rechazadas} rechazadas
      </p>
      {previa.resumen.rechazadas > 0 && <p className="alerta">Corrige las filas rechazadas en el CSV y vuelve a previsualizar. No se guardará nada mientras haya filas rechazadas.</p>}
      <div className="tabla-contenedor"><table>
        <thead><tr><th>Fila</th><th>Correo</th><th>Nombre</th><th>Universidad</th><th>Rol</th><th>Resultado</th></tr></thead>
        <tbody>{previa.filas.map(f => <tr key={f.fila}>
          <td>{f.fila}</td><td>{f.email || '—'}</td><td>{f.nombre || '—'}</td><td>{f.universidad || '—'}</td><td>{f.rol || '—'}</td>
          <td>{f.resultado === 'RECHAZADA' ? `Rechazada: ${f.motivo}` : ETIQUETAS[f.resultado]}</td>
        </tr>)}</tbody>
      </table></div>
      <button type="button" disabled={ocupado || !puedeConfirmar} onClick={() => void confirmar()}>
        {ocupado ? 'Guardando…' : `Confirmar carga (${cambios} cambios)`}
      </button>
    </div>}
  </section>;
}
