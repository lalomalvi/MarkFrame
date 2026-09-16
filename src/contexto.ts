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
