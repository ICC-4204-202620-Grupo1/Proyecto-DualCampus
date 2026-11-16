import { type FormEvent, useEffect, useState } from 'react';
import { crearPeriodo, listarPeriodos, type Periodo, type Rol } from '../../lib/api';
import { Academico } from './Academico';
import type { DestinoNavegacion } from '../acceso/MenuLateral';
import { HistorialAcademico } from '../historial-academico/HistorialAcademico';
import { CalendarioPeriodo } from './CalendarioPeriodo';

export function Periodos({roles,navegacionDestino}:{roles:Rol[];navegacionDestino:DestinoNavegacion}) {
  const [periodos,setPeriodos]=useState<Periodo[]>([]);
  const [activo,setActivo]=useState('');
  const [form,setForm]=useState({nombre:'',fechaInicio:'',fechaFin:''});
  const [error,setError]=useState('');
  const [guardando,setGuardando]=useState(false);
  const [cargando,setCargando]=useState(true);
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    let vigente=true;setCargando(true);setError('');
    listarPeriodos().then(p=>{if(vigente){setPeriodos(p);setActivo(a=>p.some(periodo=>periodo.id===a) ? a : (p[0]?.id || ''));}})
      .catch(e=>{if(vigente)setError(e.message);}).finally(()=>{if(vigente)setCargando(false);});
    return ()=>{vigente=false;};
  },[version]);
  async function enviar(e:FormEvent) {
    e.preventDefault();setError('');setGuardando(true);
    try {
      const p=await crearPeriodo(form);setPeriodos(xs=>[p,...xs]);setActivo(p.id);setForm({nombre:'',fechaInicio:'',fechaFin:''});
    } catch(e){setError(e instanceof Error?e.message:'No se pudo guardar el período');}
    finally{setGuardando(false);}
  }
  const seleccionado=periodos.find(p=>p.id===activo);
  const vistaPeriodos = navegacionDestino === 'periodos-academicos';
  const vistaCalendario = navegacionDestino === 'calendario-periodo';
  const vistaHistorial = navegacionDestino === 'historial-academico';
  return <>
    {!vistaHistorial && !vistaCalendario && <section id="periodos-academicos" className="panel"><p className="etiqueta">01 · Calendario académico</p><h2>{vistaPeriodos ? 'Períodos académicos' : 'Período de trabajo'}</h2>
      {vistaPeriodos && roles.includes('ADMINISTRADOR') && <form className="formulario-fila" onSubmit={enviar}>
        <label>Nombre<input required maxLength={100} placeholder="2026 · Segundo semestre" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/></label>
        <label>Inicio<input required type="date" value={form.fechaInicio} onChange={e=>setForm({...form,fechaInicio:e.target.value})}/></label>
        <label>Término<input required type="date" value={form.fechaFin} onChange={e=>setForm({...form,fechaFin:e.target.value})}/></label>
        <button disabled={guardando}>{guardando?'Guardando…':'Crear período'}</button>
      </form>}
      {error && <p className="alerta" role="alert">{error} <button type="button" onClick={()=>setVersion(v=>v+1)}>Reintentar carga</button></p>}
      {cargando?<p role="status">Cargando períodos…</p>:!periodos.length?<p className="vacio">Sin períodos registrados.</p>:
        <label className="selector-periodo">Período de trabajo<select value={activo} onChange={e=>setActivo(e.target.value)}>{periodos.map(p=><option value={p.id} key={p.id}>{p.nombre}</option>)}</select></label>}
      {seleccionado && <p className="texto-suave">Del {seleccionado.fechaInicio} al {seleccionado.fechaFin}. Registrado por {seleccionado.creadoPor.nombre || seleccionado.creadoPor.email} · {new Date(seleccionado.creadoEn).toLocaleString('es-CL')}.</p>}
    </section>}
    {vistaCalendario && <CalendarioPeriodo periodos={periodos} seleccionado={seleccionado} cargando={cargando} error={error} onSeleccionar={setActivo} onReintentar={()=>setVersion(v=>v+1)} />}
    {vistaHistorial && roles.includes('ALUMNO') && <HistorialAcademico />}
    {!vistaPeriodos && !vistaHistorial && !vistaCalendario && activo && roles.some(r=>['ADMINISTRADOR','PROFESOR','AYUDANTE','ALUMNO'].includes(r)) && <Academico key={activo} periodoId={activo} roles={roles} navegacionDestino={navegacionDestino}/>}
    {vistaPeriodos && roles.every(r=>r==='DIRECTOR') && <section className="panel"><h2>Consulta institucional</h2><p>Puedes consultar el calendario académico. La reportería agregada se incorporará en una próxima iteración.</p></section>}
  </>;
}
