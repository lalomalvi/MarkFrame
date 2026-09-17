/**
 * El eco entre paneles.
 *
 * Al picar un bloque en un panel, el otro salta a ese mismo bloque y lo enmarca
 * un momento. Sustituye al scroll ligado, que se quito el 2026-09-16: forzar el
 * scroll del otro panel mientras el usuario mueve la rueda se siente como una
 * resistencia rara, porque los dos scrolls se pelean por el mismo gesto.
 *
 * Aqui el otro panel solo se mueve cuando se le pide, con un clic.
 */

import { syntaxTree } from '@codemirror/language'
import { StateEffect, StateField, type EditorState, type Extension } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'

/** `null` borra el eco. */
export const marcarEco = StateEffect.define<{ desde: number; hasta: number } | null>()

export function campoEco(): Extension {
  return StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(valor, tr) {
      valor = valor.map(tr.changes)
      for (const e of tr.effects) {
        if (!e.is(marcarEco)) continue
        if (!e.value) return Decoration.none
        const doc = tr.state.doc
        const pri = doc.lineAt(e.value.desde).number
        const ult = doc.lineAt(Math.min(e.value.hasta, doc.length)).number
        const marcas = []
        for (let n = pri; n <= ult; n++) {
          marcas.push(Decoration.line({ class: 'mf-eco' }).range(doc.line(n).from))
        }
        return Decoration.set(marcas)
      }
      return valor
    },
    provide: (f) => EditorView.decorations.from(f),
  })
}

/**
 * El bloque de nivel superior que contiene esa posicion: un parrafo, una tabla,
 * un titulo, una lista entera. Se sube por el arbol hasta el hijo directo del
 * documento, que es la unidad que el usuario reconoce como «esto de aqui».
 */
export function bloqueEn(estado: EditorState, pos: number): { desde: number; hasta: number } {
  const linea = estado.doc.lineAt(pos)
  let nodo = syntaxTree(estado).resolveInner(pos, 1)
  while (nodo.parent && nodo.parent.name !== 'Document') nodo = nodo.parent

  // Si el clic cae en un hueco entre bloques, `resolveInner` devuelve la raiz
  // del documento, y tomarla por «el bloque» enmarca el archivo entero. Paso
  // el 2026-09-16. En ese caso, y en cualquier nodo vacio o desmesurado, se
  // recurre al renglon, que siempre es una respuesta razonable.
  const raiz = nodo.name === 'Document' || !nodo.parent
  const vacio = nodo.from >= nodo.to
  const desmesurado = nodo.to - nodo.from > estado.doc.length * 0.6

  if (raiz || vacio || desmesurado) return { desde: linea.from, hasta: linea.to }
  return { desde: nodo.from, hasta: nodo.to }
}
