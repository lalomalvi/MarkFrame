/**
 * El panel que sale al seleccionar texto en el panel de presentacion.
 *
 * Selecciona una frase y aparece encima una barrita con resaltar, negrita,
 * cursiva y tachado. Se va sola al soltar la seleccion o al picar en otro sitio.
 *
 * ### Esto escribe en el documento, y por eso importa como
 *
 * Igual que las tablas editables: **se reemplaza un tramo conocido**, nunca se
 * reconstruye nada. La seleccion de CodeMirror ya viene en posiciones del
 * documento, asi que envolver es insertar dos marcas y quitar es borrarlas. No
 * se lee el HTML en ningun momento.
 *
 * ### Sintaxis, y por que esta y no otra
 *
 * Las cuatro son markdown de toda la vida: `==resaltado==`, `**negrita**`,
 * `*cursiva*` y `~~tachado~~`. Lalo eligio el 2026-09-17 quedarse con un solo
 * color de resaltado en vez de inventar marcas propias para tres, y tachado en
 * lugar de subrayado —— que en markdown no existe sin meter HTML.
 *
 * La ganancia es que un `.md` tocado aqui se abre igual en Obsidian, en GitHub o
 * en el Bloc de notas. Este programa no crea documentos que solo el entienda.
 */

import { EditorView } from '@codemirror/view'
import type { EditorSelection } from '@codemirror/state'

/** Las marcas que envuelven a cada formato. Abren y cierran igual. */
const MARCAS = {
  resaltar: '==',
  negrita: '**',
  cursiva: '*',
  tachado: '~~',
} as const

type Formato = keyof typeof MARCAS

const BOTONES: { formato: Formato; letra: string; titulo: string; clase: string }[] = [
  { formato: 'resaltar', letra: '', titulo: 'Resaltar (==texto==)', clase: 'fmt-resaltar' },
  { formato: 'negrita', letra: 'N', titulo: 'Negrita (**texto**)', clase: 'fmt-negrita' },
  { formato: 'cursiva', letra: 'K', titulo: 'Cursiva (*texto*)', clase: 'fmt-cursiva' },
  { formato: 'tachado', letra: 'S', titulo: 'Tachado (~~texto~~)', clase: 'fmt-tachado' },
]

/**
 * Si el tramo ya esta envuelto en esa marca.
 *
 * Se mira **por fuera** de la seleccion, no dentro: quien selecciona una palabra
 * ya puesta en negrita selecciona la palabra, no los asteriscos. Sin esto, el
 * boton volveria a envolver lo ya envuelto y saldria `****texto****`.
 */
function yaEnvuelto(vista: EditorView, desde: number, hasta: number, marca: string) {
  const doc = vista.state.doc
  const largo = marca.length
  if (desde - largo < 0 || hasta + largo > doc.length) return false
  return (
    doc.sliceString(desde - largo, desde) === marca &&
    doc.sliceString(hasta, hasta + largo) === marca
  )
}

/** Pone o quita la marca alrededor de lo seleccionado. */
function alternar(vista: EditorView, formato: Formato) {
  const sel = vista.state.selection.main
  if (sel.empty) return
  const marca = MARCAS[formato]
  const largo = marca.length

  if (yaEnvuelto(vista, sel.from, sel.to, marca)) {
    // Quitar. Se borran los dos tramos de marca y la seleccion se queda sobre
    // el texto, que es donde el usuario espera encontrarla.
    vista.dispatch({
      changes: [
        { from: sel.from - largo, to: sel.from },
        { from: sel.to, to: sel.to + largo },
      ],
      selection: { anchor: sel.from - largo, head: sel.to - largo },
    })
    return
  }

  // Poner. Se insertan las marcas sin tocar el texto de en medio.
  vista.dispatch({
    changes: [
      { from: sel.from, insert: marca },
      { from: sel.to, insert: marca },
    ],
    selection: { anchor: sel.from + largo, head: sel.to + largo },
  })
}

/**
 * Engancha el panel a una vista.
 *
 * Devuelve una funcion para soltarlo —— hoy nadie la llama, porque las vistas
 * viven lo que vive el programa, pero deja el modulo cerrado sobre si mismo.
 */
export function panelDeFormato(vista: EditorView, raiz: HTMLElement): () => void {
  const panel = document.createElement('div')
  panel.className = 'panel-formato'
  panel.hidden = true
  panel.setAttribute('role', 'toolbar')
  panel.setAttribute('aria-label', 'Formato del texto seleccionado')

  for (const b of BOTONES) {
    const bt = document.createElement('button')
    bt.className = 'fmt-boton ' + b.clase
    bt.title = b.titulo
    bt.setAttribute('aria-label', b.titulo)
    bt.textContent = b.letra
    // `mousedown` y no `click`: para cuando llega el `click`, el navegador ya
    // deshizo la seleccion y no habria nada que envolver.
    bt.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      alternar(vista, b.formato)
      esconder()
    })
    panel.append(bt)
  }
  raiz.append(panel)

  function esconder() {
    panel.hidden = true
  }

  function colocar(sel: EditorSelection['main']) {
    const inicio = vista.coordsAtPos(sel.from)
    const fin = vista.coordsAtPos(sel.to)
    if (!inicio || !fin) return esconder()

    // Se muestra antes de medir: oculto no tiene tamano.
    panel.hidden = false
    const caja = raiz.getBoundingClientRect()
    const ancho = panel.offsetWidth
    const alto = panel.offsetHeight

    const centro = (Math.min(inicio.left, fin.left) + Math.max(inicio.right, fin.right)) / 2
    let x = centro - caja.left - ancho / 2
    let y = Math.min(inicio.top, fin.top) - caja.top - alto - 8

    // Si no cabe arriba --seleccion en la primera linea-- se pone debajo.
    if (y < 4) y = Math.max(inicio.bottom, fin.bottom) - caja.top + 8
    // Y nunca se sale por los lados.
    x = Math.max(4, Math.min(x, caja.width - ancho - 4))

    panel.style.left = x + 'px'
    panel.style.top = y + 'px'
  }

  function revisar() {
    const sel = vista.state.selection.main
    if (sel.empty || !vista.hasFocus) return esconder()
    colocar(sel)
  }

  // El panel se coloca al SOLTAR el raton, no mientras se arrastra: si no,
  // persigue al cursor por la pantalla mientras se elige el texto.
  const alSoltar = () => window.setTimeout(revisar, 0)
  vista.dom.addEventListener('mouseup', alSoltar)
  // Con teclado (Shift+flechas) no hay `mouseup`, asi que tambien se revisa al
  // soltar una tecla de movimiento.
  vista.dom.addEventListener('keyup', (e) => {
    if (e.shiftKey || e.key === 'Shift') revisar()
    else if (e.key === 'Escape') esconder()
  })
  // Picar en cualquier otro sitio lo cierra, que es lo que pidio Lalo.
  const alPicarFuera = (e: MouseEvent) => {
    if (!panel.hidden && !panel.contains(e.target as Node)) esconder()
  }
  document.addEventListener('mousedown', alPicarFuera, true)
  // Y si el texto se mueve bajo el panel, deja de tener sentido donde esta.
  vista.scrollDOM.addEventListener('scroll', esconder)

  return () => {
    vista.dom.removeEventListener('mouseup', alSoltar)
    document.removeEventListener('mousedown', alPicarFuera, true)
    vista.scrollDOM.removeEventListener('scroll', esconder)
    panel.remove()
  }
}
