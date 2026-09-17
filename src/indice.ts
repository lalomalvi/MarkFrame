/**
 * El indice del documento: los titulos, para saltar entre ellos.
 *
 * Existe por los archivos largos. Un `ARCHITECTURE.md` de 28 KB tiene treinta
 * secciones, y moverse por el es hacer scroll a ciegas o buscar una palabra que
 * recuerdes. Con el indice se ve la forma del documento entera y se salta.
 *
 * ### Los titulos salen del arbol, no de una expresion regular
 *
 * Y eso importa: `# esto` **dentro de una cerca de codigo no es un titulo**, y
 * una expresion regular sobre el texto lo metería en el indice. El analizador
 * ya sabe distinguirlo, asi que se le pregunta a el. De paso salen gratis los
 * titulos «setext» —— los subrayados con `===` y `---`—, que una regex de
 * almohadillas no vería.
 */

import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'

export type Titulo = {
  /** El texto, ya sin almohadillas ni subrayado. */
  texto: string
  /** 1 a 6. */
  nivel: number
  /** Donde empieza en el documento, para saltar ahi. */
  desde: number
  /** Donde acaba, para saber en que seccion esta el cursor. */
  hasta: number
}

/**
 * Los titulos del documento, en orden.
 *
 * **Con tope.** Un archivo generado puede tener veinte mil titulos, y una lista
 * asi no sirve de indice: nadie la recorre. Se corta y se avisa —— mas vale un
 * indice parcial que una interfaz atascada pintando nodos.
 */
const TOPE_TITULOS = 500

export function titulosDe(estado: EditorState): Titulo[] {
  const salida: Titulo[] = []
  const doc = estado.doc

  syntaxTree(estado).iterate({
    enter: (n) => {
      if (salida.length >= TOPE_TITULOS) return false
      const m = /^(ATX|Setext)Heading([1-6])$/.exec(n.name)
      if (!m) return
      const crudo = doc.sliceString(n.from, n.to)
      const texto = m[1] === 'ATX'
        // `## Titulo ##` —— las almohadillas de cierre son opcionales.
        ? crudo.replace(/^#+[ \t]*/, '').replace(/[ \t]*#+[ \t]*$/, '')
        // Setext: el texto es la primera linea; la segunda es el subrayado.
        : crudo.split('\n')[0]
      salida.push({
        texto: texto.trim(),
        nivel: Number(m[2]),
        desde: n.from,
        hasta: n.to,
      })
      // No hace falta bajar dentro de un titulo: lo de dentro no es un titulo.
      return false
    },
  })
  return salida
}

/** En que titulo cae una posicion: el ultimo que empieza antes o en ella. */
export function tituloEn(titulos: Titulo[], pos: number): number {
  let cual = -1
  for (let i = 0; i < titulos.length; i++) {
    if (titulos[i].desde <= pos) cual = i
    else break
  }
  return cual
}

/**
 * Engancha el indice a un panel y a la vista que manda.
 *
 * Devuelve lo que hace falta para mantenerlo: `refrescar()` cuando cambia el
 * documento y `seguirCursor()` cuando solo se movio el cursor. Son dos cosas
 * distintas a proposito —— **recorrer el arbol en cada movimiento de cursor
 * seria pagar el indice entero por mover una flecha**.
 */
export function crearIndice(
  caja: HTMLElement,
  vistaActiva: () => EditorView,
) {
  let titulos: Titulo[] = []
  let marcado = -1

  const vacio = document.createElement('p')
  vacio.className = 'indice-vacio'
  vacio.textContent = 'Esta nota no tiene títulos.'

  /**
   * Mueve la marca de seccion actual.
   *
   * Se toca el DOM de dos filas, no se repinta la lista: repintarla en cada
   * movimiento de cursor haria parpadear el scroll del indice.
   */
  function marcar(cual: number) {
    if (cual === marcado) return
    caja.children[marcado]?.classList.remove('actual')
    caja.children[cual]?.classList.add('actual')
    caja.children[cual]?.scrollIntoView({ block: 'nearest' })
    marcado = cual
  }

  function pintar() {
    if (titulos.length === 0) {
      caja.replaceChildren(vacio)
      return
    }
    // El nivel mas alto del documento manda: si empieza en `##`, ese es el
    // primer escalon y no se sangra por un `#` que no existe.
    const minimo = Math.min(...titulos.map((t) => t.nivel))
    caja.replaceChildren(
      ...titulos.map((t, i) => {
        const fila = document.createElement('button')
        fila.className = 'indice-fila' + (i === marcado ? ' actual' : '')
        fila.style.paddingLeft = `${0.55 + (t.nivel - minimo) * 0.85}rem`
        fila.dataset.nivel = String(t.nivel)
        // Un titulo vacio existe --`##` a secas-- y sin esto seria una fila
        // invisible que no se puede picar.
        fila.textContent = t.texto || '(sin título)'
        fila.title = t.texto
        fila.addEventListener('click', () => {
          const v = vistaActiva()
          v.dispatch({
            selection: { anchor: t.desde },
            effects: EditorView.scrollIntoView(t.desde, { y: 'start', yMargin: 12 }),
          })
          v.focus()
          // La marca se mueve aqui mismo. Saltar desde el indice no dispara el
          // `mouseup` de la vista, asi que sin esto el indice seguiria
          // senalando la seccion anterior —— el cursor en un sitio y la marca en
          // otro. Visto al probarlo el 2026-09-17.
          marcar(i)
        })
        return fila
      }),
    )
  }

  return {
    /** El documento cambió: hay que volver a leer los títulos. */
    refrescar() {
      titulos = titulosDe(vistaActiva().state)
      marcado = tituloEn(titulos, vistaActiva().state.selection.main.head)
      pintar()
    },
    /**
     * Sólo se movió el cursor. No se recorre el árbol: se mueve la marca, y si
     * no cambió de sección no se toca el DOM.
     */
    seguirCursor() {
      marcar(tituloEn(titulos, vistaActiva().state.selection.main.head))
    },
    /** Cuántos títulos hay: para decidir si vale la pena mostrar el panel. */
    cuantos: () => titulos.length,
  }
}
