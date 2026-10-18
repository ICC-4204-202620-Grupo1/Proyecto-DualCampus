import type { UsuarioSesion } from '../../lib/api';

const NOMBRE_ROL: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  PROFESOR: 'Profesor',
  AYUDANTE: 'Ayudante',
  ALUMNO: 'Alumno',
  DIRECTOR: 'Director',
};

/** Vista provisoria tras iniciar sesión: confirma la identidad y los roles. */
export function Inicio({ usuario, onSalir }: { usuario: UsuarioSesion; onSalir: () => void }) {
  return (
    <>
      <header className="barra">
        <div className="marca">
          <span className="marca-logo">D</span> DualCampus
        </div>
        <div className="barra-usuario">
          <span>{usuario.nombre}</span>
          <button className="boton-secundario" onClick={onSalir}>
            Cerrar sesión
          </button>
        </div>
      </header>
      <main className="contenido">
        <h1>Hola, {usuario.nombre}</h1>
        <p className="texto-suave">{usuario.email}</p>
        <h2>Tus roles</h2>
        <ul className="roles">
          {usuario.roles.map((r) => (
            <li key={r.institucionId + r.rol}>
              <strong>{NOMBRE_ROL[r.rol]}</strong> · {r.institucion}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
