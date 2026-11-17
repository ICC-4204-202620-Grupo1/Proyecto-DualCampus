/** Preferencias de navegación por usuario e institución. No contiene datos académicos. */
export function leerPreferencia(clave: string): string {
  try { return window.sessionStorage.getItem('dualcampus:ux:' + clave) ?? ''; }
  catch { return ''; }
}
export function guardarPreferencia(clave: string, valor: string): void {
  try { window.sessionStorage.setItem('dualcampus:ux:' + clave, valor); }
  catch { /* La navegación continúa aunque el navegador bloquee el almacenamiento. */ }
}
