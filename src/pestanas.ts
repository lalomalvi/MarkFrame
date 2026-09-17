/**
 * Pestañas.
 *
 * Cada pestaña es un documento completo: su ruta, su estado de guardado y —lo
 * que de verdad cuesta— sus DOS estados de CodeMirror, donde viven la historia
 * de deshacer y la selección. Volver a una pestaña la devuelve tal como estaba,
 * no la reabre desde el disco.
 *
 * El editor sigue siendo UNO. Cambiar de pestaña guarda los estados de la que
 * sale y le pone al editor los de la que entra.
 */

import type { EditorState } from '@codemirror/state'
import type { FinDeLinea } from './archivo'

export interface Pestana {
  id: number
  ruta: string | null
  nombre: string
  finDeLinea: FinDeLinea
  soloLectura: boolean
  sucio: boolean
  /** Sólo de la pestaña que no está activa; la activa los tiene en el editor. */
  estadoF: EditorState | null
  estadoP: EditorState | null
}

/**
 * Tope de pestañas abiertas.
 *
 * No es capricho: cada pestaña guarda dos `EditorState` completos, y un `.md`
 * de 100 KB con su árbol sintáctico y su historia ronda unos pocos MB. Treinta
 * es holgado para trabajar y deja el consumo donde no molesta. Al llegar, el
 * programa lo dice en vez de tragar hasta atragantarse.
 */
export const TOPE = 30

let siguienteId = 1

export function crear(datos: Partial<Pestana> = {}): Pestana {
  return {
    id: siguienteId++,
    ruta: null,
    nombre: 'Sin título',
    finDeLinea: 'lf',
    soloLectura: false,
    sucio: false,
    estadoF: null,
    estadoP: null,
    ...datos,
  }
}

/**
 * Cuántos caracteres del nombre caben, según cuántas pestañas hay abiertas.
 *
 * Con pocas se lee el nombre casi entero; con muchas se recorta para que quepan
 * sin que la barra se vuelva un carrusel infinito. Nunca baja de 6: por debajo
 * de eso todas las pestañas se parecen y dejan de servir para distinguir.
 */
export function limiteNombre(cuantas: number): number {
  if (cuantas <= 3) return 26
  if (cuantas <= 6) return 18
  if (cuantas <= 10) return 12
  if (cuantas <= 16) return 9
  return 6
}

/** Recorta por el final, conservando la extensión si cabe. */
export function rotulo(nombre: string, limite: number): string {
  if (nombre.length <= limite) return nombre
  const punto = nombre.lastIndexOf('.')
  const ext = punto > 0 && nombre.length - punto <= 5 ? nombre.slice(punto) : ''
  const cuerpo = ext ? nombre.slice(0, punto) : nombre
  const sitio = limite - ext.length - 1
  if (sitio < 3) return nombre.slice(0, Math.max(1, limite - 1)) + '…'
  return cuerpo.slice(0, sitio) + '…' + ext
}

/** Índice de la pestaña que ya tiene abierto ese archivo, o -1. */
export function buscarPorRuta(lista: Pestana[], ruta: string): number {
  const norma = (r: string) => r.replace(/\//g, '\\').toLowerCase()
  return lista.findIndex((p) => p.ruta != null && norma(p.ruta) === norma(ruta))
}
