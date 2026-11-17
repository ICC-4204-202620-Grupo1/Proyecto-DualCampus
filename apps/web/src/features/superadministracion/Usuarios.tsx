import { useEffect, useState, type FormEvent } from 'react';
import { asignarRolGlobal, crearUsuarioGlobal, listarInstitucionesGlobales, listarUsuariosGlobales, quitarRolGlobal,
  type InstitucionGlobal, type Rol, type UsuarioGlobal } from '../../lib/api';
import { CargaMasivaUsuarios } from './CargaMasivaUsuarios';
const roles: Rol[] = ['ADMINISTRADOR','PROFESOR','AYUDANTE','ALUMNO','DIRECTOR'];
const errorDe = (e:unknown) => e instanceof Error ? e.message : 'Operación fallida';

export function Usuarios() {
  const [usuarios,setUsuarios] = useState<UsuarioGlobal[]>([]);
  const [universidades,setUniversidades] = useState<InstitucionGlobal[]>([]);
  const [nombre,setNombre] = useState(''); const [email,setEmail] = useState('');
  const [usuarioId,setUsuarioId] = useState(''); const [institucionId,setInstitucionId] = useState('');
  const [rol,setRol] = useState<Rol>('ALUMNO');
  const [cargando,setCargando] = useState(true); const [ocupado,setOcupado] = useState(false);
  const [error,setError] = useState(''); const [aviso,setAviso] = useState(''); const [version,setVersion] = useState(0);
  useEffect(()=> {let vivo=true;setCargando(true);setError('');
    Promise.all([listarUsuariosGlobales(),listarInstitucionesGlobales()])
      .then(([u,i])=>{if(vivo){setUsuarios(u);setUniversidades(i.filter(x=>x.activa));}})
      .catch(e=>{if(vivo)setError(errorDe(e));})
      .finally(()=>{if(vivo)setCargando(false);});
    return ()=>{vivo=false;};
  },[version]);
  async function operar(e:FormEvent,accion:'crear'|'asignar') {
    e.preventDefault();setOcupado(true);setError('');setAviso('');
    try {
      if(accion==='crear') {await crearUsuarioGlobal({nombre,email,institucionId,rol});setNombre('');setEmail('');setAviso('Usuario creado con su rol institucional.');}
      else {await asignarRolGlobal(usuarioId,institucionId,rol);setAviso('Rol institucional asignado.');}
      setVersion(v=>v+1);
    }catch(e){setError(errorDe(e));}finally{setOcupado(false);}
  }
  async function quitar(id:string,institucion:string,rolActual:Rol) {
    if(!window.confirm('¿Quitar esta asignación?')) return;
    setOcupado(true);setError('');setAviso('');
    try {await quitarRolGlobal(id,institucion,rolActual);setAviso('Asignación eliminada.');setVersion(v=>v+1);}
    catch(e){setError(errorDe(e));}finally{setOcupado(false);}
  }
  return <section className="panel" aria-label="Administración global de usuarios">
    <p className="etiqueta">Administración global · H58</p><h2>Usuarios y roles</h2>
    <p className="texto-suave">Registra cuentas habilitadas y asigna sus permisos por universidad. El ingreso utiliza la autenticación institucional existente; aquí no se generan contraseñas.</p>
    {error && <p className="alerta" role="alert">{error}</p>}{aviso && <p className="exito" role="status">{aviso}</p>}
    <div className="dos-columnas">
      <form onSubmit={e=>void operar(e,'crear')}><h3>Registrar usuario</h3>
        <label>Nombre<input required minLength={2} maxLength={150} value={nombre} onChange={e=>setNombre(e.target.value)}/></label>
        <label>Correo institucional<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
        <label>Universidad<select required value={institucionId} onChange={e=>setInstitucionId(e.target.value)}><option value="">Selecciona universidad</option>{universidades.map(i=><option key={i.id} value={i.id}>{i.nombre}</option>)}</select></label>
        <label>Rol<select value={rol} onChange={e=>setRol(e.target.value as Rol)}>{roles.map(r=><option key={r} value={r}>{r}</option>)}</select></label>
        <button disabled={ocupado||!universidades.length}>Crear usuario</button>
      </form>
      <form onSubmit={e=>void operar(e,'asignar')}><h3>Asignar otro rol</h3>
        <label>Usuario<select value={usuarioId} required onChange={e=>setUsuarioId(e.target.value)}><option value="">Selecciona usuario</option>{usuarios.map(u=><option key={u.id} value={u.id}>{u.nombre || u.email} · {u.email}</option>)}</select></label>
        <label>Universidad<select required value={institucionId} onChange={e=>setInstitucionId(e.target.value)}><option value="">Selecciona universidad</option>{universidades.map(i=><option key={i.id} value={i.id}>{i.nombre}</option>)}</select></label>
        <label>Rol<select value={rol} onChange={e=>setRol(e.target.value as Rol)}>{roles.map(r=><option key={r} value={r}>{r}</option>)}</select></label>
        <button disabled={ocupado||!usuarioId||!institucionId}>Asignar rol</button>
      </form>
    </div>
    <CargaMasivaUsuarios universidades={universidades} onCargado={()=>setVersion(v=>v+1)}/>
    <h3>Usuarios registrados</h3>
    {cargando?<p role="status">Cargando usuarios…</p>:!usuarios.length?<p className="vacio">Todavía no hay usuarios.</p>:
      <div className="tabla-contenedor"><table><thead><tr><th>Nombre</th><th>Correo</th><th>Roles por universidad</th></tr></thead><tbody>
      {usuarios.map(u=><tr key={u.id}><td>{u.nombre||'—'}</td><td>{u.email}</td><td>{u.roles.length?u.roles.map(a=><div key={a.institucionId+'-'+a.rol} style={{marginBottom:'.5rem'}}>{a.institucion} · {a.rol} <button type="button" className="boton-secundario" disabled={ocupado} onClick={()=>void quitar(u.id,a.institucionId,a.rol)}>Quitar</button></div>):'Sin asignaciones'}</td></tr>)}
      </tbody></table></div>}
  </section>;
}
