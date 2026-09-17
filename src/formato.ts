/**
 * El panel que sale al seleccionar texto.
 *
 * Selecciona una frase y aparece encima una barrita con resaltar, negrita,
 * cursiva y tachado. **Los botones se encienden si el texto ya lleva ese
 * formato**, y pulsarlos entonces lo quita. Se va sola al soltar la seleccion o
 * al picar en otro sitio.
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
import { EditorState, type EditorSelection } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

/** Las marcas que envuelven a cada formato. Abren y cierran igual. */
export const MARCAS = {
  resaltar: '==',
  negrita: '**',
  cursiva: '*',
  tachado: '~~',
} as const

export type Formato = keyof typeof MARCAS

/**
 * El nodo del arbol que corresponde a cada formato.
 *
 * `resaltar` no tiene: `==texto==` **no es markdown estandar** y el analizador
 * de CodeMirror no lo conoce, asi que ese se detecta mirando el texto. Los otros
 * tres si, y por eso se encuentran aunque las marcas esten a parrafos de
 * distancia de lo seleccionado.
 */
const NODO: Record<Formato, string | null> = {
  negrita: 'StrongEmphasis',
  cursiva: 'Emphasis',
  tachado: 'Strikethrough',
  resaltar: null,
}

const BOTONES: { formato: Formato; letra: string; titulo: string; clase: string }[] = [
  { formato: 'resaltar', letra: '', titulo: 'Resaltar (==texto==)', clase: 'fmt-resaltar' },
  { formato: 'negrita', letra: 'N', titulo: 'Negrita (**texto**)', clase: 'fmt-negrita' },
  { formato: 'cursiva', letra: 'K', titulo: 'Cursiva (*texto*)', clase: 'fmt-cursiva' },
  { formato: 'tachado', letra: 'S', titulo: 'Tachado (~~texto~~)', clase: 'fmt-tachado' },
]

/**
 * Recorta los huecos de los extremos de la seleccion antes de envolverla.
 *
 * Dos motivos, y los dos importan:
 *
 * 1. **En markdown, `** texto **` no es negrita.** Las marcas tienen que ir
 *    pegadas al texto. Envolver una seleccion con espacios de sobra produce
 *    algo que no se ve como el usuario esperaba.
 *
 * 2. **En la vista los marcadores estan ocultos**, asi que lo que se selecciona
 *    con el raton no coincide con los limites del documento. Al seleccionar el
 *    texto de un titulo, la seleccion empezaba en el espacio que sigue a la
 *    almohadilla y salia `#==Titulo==` —— sin espacio detras del `#`, que **deja
 *    de ser un titulo**. Visto el 2026-09-17 en un archivo de prueba de Lalo.
 *
 * Los saltos de linea se recortan por lo mismo: una marca justo antes de un
 * salto no envuelve nada.
 */
export function acotada(estado: EditorState, desde: number, hasta: number) {
  const doc = estado.doc
  // Se ordena y se mete en el documento antes de mirar nada.
  //
  // CodeMirror nunca da un rango al reves --`from` es siempre el menor-- asi que
  // esto no arregla un fallo de hoy: **cierra la clase de fallo**. Un rango
  // invertido saliendo de aqui acabaria en un `changes` con `from > to`, que
  // lanza dentro de un `dispatch` y se lleva la vista por delante. Lo encontro
  // una prueba de frontera el 2026-09-17, probando `(7, 2)` a proposito.
  if (desde > hasta) [desde, hasta] = [hasta, desde]
  desde = Math.max(0, Math.min(desde, doc.length))
  hasta = Math.max(0, Math.min(hasta, doc.length))

  const hueco = (p: number) => /[ \t\r\n]/.test(doc.sliceString(p, p + 1))
  while (desde < hasta && hueco(desde)) desde++
  while (hasta > desde && hueco(hasta - 1)) hasta--
  return { desde, hasta }
}

/** El tramo que hay que quitar para deshacer un formato: texto y sus marcas. */
export type Tramo = { desde: number; hasta: number; abre: number; cierra: number }

/**
 * Busca `==...==` alrededor de la seleccion, dentro del mismo bloque.
 *
 * El resaltado no esta en el arbol, asi que se busca a mano. Se acota al bloque
 * —— nunca al documento entero—— porque esto corre cada vez que alguien suelta el
 * raton y no puede recorrer un archivo grande.
 */
function resaltadoAlrededor(estado: EditorState, desde: number, hasta: number): Tramo | null {
  const marca = MARCAS.resaltar
  // El bloque de alrededor: el hijo directo de la raiz que contiene la posicion.
  let nodo = syntaxTree(estado).resolveInner(desde, 1)
  while (nodo.parent && nodo.parent.parent) nodo = nodo.parent
  const desdeBloque = nodo.from
  const texto = estado.doc.sliceString(desdeBloque, nodo.to)

  for (const m of texto.matchAll(/==([^=]|=(?!=))+==/g)) {
    const a = desdeBloque + m.index!
    const b = a + m[0].length
    if (a <= desde && b >= hasta) {
      return { desde: a + marca.length, hasta: b - marca.length, abre: a, cierra: b }
    }
  }
  return null
}

/**
 * Si lo seleccionado ya lleva ese formato, devuelve el tramo entero que lo
 * lleva —— **no solo la seleccion**.
 *
 * Esto es lo que hace que el panel pueda encender el boton correcto. Y es mas
 * que comprobar si las marcas estan pegadas a la seleccion: en un parrafo
 * entero en cursiva, seleccionar tres palabras de en medio **tambien** es
 * cursiva, y el usuario espera que el panel lo diga. Lo pidio Lalo el
 * 2026-09-17 tras ver que el panel callaba sobre un texto que ya estaba en
 * cursiva.
 */
export function tramoConFormato(
  estado: EditorState,
  desde: number,
  hasta: number,
  formato: Formato,
): Tramo | null {
  const nombre = NODO[formato]
  if (nombre === null) return resaltadoAlrededor(estado, desde, hasta)

  const largo = MARCAS[formato].length
  // Se sube por el arbol desde dentro de la seleccion. `desde + 1` evita el
  // borde: en la posicion exacta de una marca, `resolveInner` puede devolver el
  // nodo de al lado en vez del que envuelve.
  const arranque = Math.min(desde + 1, Math.max(desde, hasta - 1), estado.doc.length)
  let nodo: ReturnType<typeof syntaxTree>['topNode'] | null =
    syntaxTree(estado).resolveInner(arranque, 1)

  while (nodo) {
    if (nodo.name === nombre && nodo.from <= desde && nodo.to >= hasta) {
      return {
        desde: nodo.from + largo,
        hasta: nodo.to - largo,
        abre: nodo.from,
        cierra: nodo.to,
      }
    }
    nodo = nodo.parent
  }
  return null
}

/** Qué formatos lleva ya lo seleccionado. Para encender los botones. */
export function formatosActivos(
  estado: EditorState,
  desde: number,
  hasta: number,
): Set<Formato> {
  const puestos = new Set<Formato>()
  for (const f of Object.keys(MARCAS) as Formato[]) {
    if (tramoConFormato(estado, desde, hasta, f)) puestos.add(f)
  }
  return puestos
}

/** Pone o quita la marca. */
function alternar(vista: EditorView, formato: Formato) {
  const bruta = vista.state.selection.main
  if (bruta.empty) return

  const { desde, hasta } = acotada(vista.state, bruta.from, bruta.to)
  // Una seleccion de puros espacios no se envuelve: no hay nada que marcar.
  if (desde >= hasta) return

  const marca = MARCAS[formato]
  const largo = marca.length
  const ya = tramoConFormato(vista.state, desde, hasta, formato)

  if (ya) {
    // **Se quita del tramo entero**, no solo de lo seleccionado. Si un parrafo
    // esta en cursiva y se marcan tres palabras, partir la cursiva en tres
    // trozos dejaria un markdown peor del que habia: lo que el usuario pide al
    // pulsar un boton encendido es quitar ese formato.
    vista.dispatch({
      changes: [
        { from: ya.abre, to: ya.abre + largo },
        { from: ya.cierra - largo, to: ya.cierra },
      ],
      selection: { anchor: ya.desde - largo, head: ya.hasta - largo },
    })
    return
  }

  // Poner. Se insertan las marcas sin tocar el texto de en medio.
  vista.dispatch({
    changes: [
      { from: desde, insert: marca },
      { from: hasta, insert: marca },
    ],
    selection: { anchor: desde + largo, head: hasta + largo },
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

  const botones = new Map<Formato, HTMLButtonElement>()

  for (const b of BOTONES) {
    const bt = document.createElement('button')
    bt.className = 'fmt-boton ' + b.clase
    bt.title = b.titulo
    bt.setAttribute('aria-label', b.titulo)
    bt.setAttribute('aria-pressed', 'false')
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
    botones.set(b.formato, bt)
  }
  raiz.append(panel)

  function esconder() {
    panel.hidden = true
  }

  /** Enciende los botones de los formatos que el texto ya lleva. */
  function pintarEstado(desde: number, hasta: number) {
    const puestos = formatosActivos(vista.state, desde, hasta)
    for (const [formato, bt] of botones) {
      const activo = puestos.has(formato)
      bt.classList.toggle('activo', activo)
      bt.setAttribute('aria-pressed', String(activo))
      const base = BOTONES.find((b) => b.formato === formato)!.titulo
      bt.title = activo ? base.replace(/ \(/, ' — puesto, pulsa para quitar (') : base
    }
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
    const { desde, hasta } = acotada(vista.state, sel.from, sel.to)
    if (desde >= hasta) return esconder()
    pintarEstado(desde, hasta)
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
