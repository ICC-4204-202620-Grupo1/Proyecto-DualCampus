import { useEffect, useState } from 'react';

type Tema = 'auto' | 'claro' | 'oscuro';
const CLAVE = 'dualcampus:tema';

function leerTema(): Tema {
  try {
    const valor = window.localStorage.getItem(CLAVE);
    if (valor === 'claro' || valor === 'oscuro' || valor === 'auto') return valor;
  } catch { /* Almacenamiento no disponible */ }
  return 'auto';
}

export function SelectorTema() {
  const [tema, setTema] = useState<Tema>(leerTema);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const actualizar = () => {
      const efectivo = tema === 'auto' ? (media.matches ? 'oscuro' : 'claro') : tema;
      document.documentElement.dataset.tema = efectivo;
      document.documentElement.style.colorScheme = efectivo === 'oscuro' ? 'dark' : 'light';
    };
    actualizar();
    media.addEventListener('change', actualizar);
    return () => media.removeEventListener('change', actualizar);
  }, [tema]);
  function cambiar(nuevo: Tema) {
    setTema(nuevo);
    try { window.localStorage.setItem(CLAVE, nuevo); } catch { /* Se mantiene en esta visita */ }
  }
  return <label className="selector-tema" title="Personalizar apariencia">
    <span>Apariencia</span>
    <select aria-label="Apariencia" value={tema} onChange={e => cambiar(e.target.value as Tema)}>
      <option value="auto">Automático</option>
      <option value="claro">Claro</option>
      <option value="oscuro">Oscuro</option>
    </select>
  </label>;
}
