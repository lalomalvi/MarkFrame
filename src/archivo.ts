/** Puente con el nucleo nativo. Ver src-tauri/src/lib.rs. */

import { invoke } from '@tauri-apps/api/core'
import { open as dialogoAbrir, save as dialogoGuardar } from '@tauri-apps/plugin-dialog'

export type FinDeLinea = 'lf' | 'crlf'

export interface Documento {
  texto: string
  ruta: string
  nombre: string
  fin_de_linea: FinDeLinea
  solo_lectura: boolean
}

const FILTRO = [{ name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] }]

export const leer = (ruta: string) => invoke<Documento>('leer', { ruta })

export const escribir = (ruta: string, texto: string, finDeLinea: FinDeLinea) =>
  invoke<void>('escribir', { ruta, texto, finDeLinea })

export const archivoInicial = () => invoke<string | null>('archivo_inicial')

export async function pedirArchivo(): Promise<string | null> {
  const r = await dialogoAbrir({ multiple: false, directory: false, filters: FILTRO })
  return typeof r === 'string' ? r : null
}

export async function pedirDestino(nombre: string): Promise<string | null> {
  const r = await dialogoGuardar({ defaultPath: nombre, filters: FILTRO })
  return typeof r === 'string' ? r : null
}
