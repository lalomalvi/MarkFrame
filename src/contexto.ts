/**
 * La carpeta del archivo abierto.
 *
 * Hace falta para las imagenes: en un `.md` la ruta `![](croquis.png)` es
 * relativa al archivo, pero el webview no tiene idea de donde vive ese archivo.
 */

let carpeta: string | null = null

export const fijarCarpeta = (ruta: string | null) => {
  carpeta = ruta ? ruta.replace(/[\\/][^\\/]*$/, '') : null
}

export const carpetaActual = () => carpeta

/** ¿Estamos en oscuro ahora mismo? Manda `data-tema`; si no, lo dice Windows. */
export function esOscuro(): boolean {
  const forzado = document.documentElement.getAttribute('data-tema')
  if (forzado === 'oscuro') return true
  if (forzado === 'claro') return false
  return matchMedia('(prefers-color-scheme: dark)').matches
}
