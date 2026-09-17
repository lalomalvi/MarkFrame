/**
 * Buscar dentro de la nota abierta.
 *
 * **Busca en este archivo y en ninguno mas.** Decision de Lalo del 2026-09-17,
 * sobre tres opciones: sólo el archivo, la carpeta al vuelo, o un indice
 * persistente de carpetas registradas. La tercera habria sido una boveda, que es
 * justo lo que este programa no tiene.
 *
 * La caja vive en la barra, no en un panel que aparece y desaparece: es el gesto
 * que mas se repite y no tiene por que moverse de sitio.
 *
 * El motor es `@codemirror/search` —— `SearchQuery` y los comandos de saltar—,
 * asi que el resaltado de coincidencias y el recorrido ya estan resueltos y
 * probados. Aqui solo se conecta a los controles.
 */

import { EditorView } from '@codemirror/view'
import {
  SearchQuery, setSearchQuery, findNext, findPrevious, search,
} from '@codemirror/search'
import type { Extension } from '@codemirror/state'

/**
 * La extension que hay que montar en la vista para que la busqueda funcione.
 *
 * `top: false` y el panel propio apagado: la caja la dibuja `index.html`, y un
 * panel de CodeMirror abriendose por su cuenta encima seria otra barra mas.
 */
export function busqueda(): Extension {
  return search({ top: false, createPanel: () => ({ dom: document.createElement('div') }) })
}

export type Controles = {
  campo: HTMLInputElement
  cuenta: HTMLElement
  caja: HTMLElement
  antes: HTMLElement
  despues: HTMLElement
  cerrar: HTMLElement
}

/**
 * Cuantas veces aparece el texto, y en cual esta el cursor.
 *
 * Se cuenta a mano sobre el documento en vez de pedirselo a CodeMirror, que no
 * lo expone. **Con tope**: pasadas mil coincidencias el numero exacto no le dice
 * nada a nadie, y contarlas todas en un documento grande se paga en cada tecla.
 */
const TOPE_CUENTA = 1000

function contar(vista: EditorView, texto: string): { total: number; actual: number; tope: boolean } {
  if (texto === '') return { total: 0, actual: 0, tope: false }
  const doc = vista.state.doc.toString()
  const aguja = texto.toLowerCase()
  const pajar = doc.toLowerCase()
  const cursor = vista.state.selection.main.from

  let total = 0
  let actual = 0
  let i = pajar.indexOf(aguja)
  while (i !== -1) {
    total++
    if (i <= cursor) actual = total
    if (total >= TOPE_CUENTA) return { total, actual, tope: true }
    i = pajar.indexOf(aguja, i + Math.max(1, aguja.length))
  }
  return { total, actual, tope: false }
}

export function conectarBuscador(
  c: Controles,
  vistaActiva: () => EditorView,
) {
  let ultimo = ''

  function pintarCuenta() {
    const texto = c.campo.value
    c.caja.classList.toggle('con-texto', texto !== '')
    if (texto === '') {
      c.cuenta.textContent = ''
      c.caja.classList.remove('sin-nada')
      return
    }
    const { total, actual, tope } = contar(vistaActiva(), texto)
    c.caja.classList.toggle('sin-nada', total === 0)
    c.cuenta.textContent = total === 0
      ? 'nada'
      : tope
        ? `${actual}/${TOPE_CUENTA}+`
        : `${actual}/${total}`
  }

  function aplicar(saltar: boolean) {
    const vista = vistaActiva()
    const texto = c.campo.value
    vista.dispatch({
      effects: setSearchQuery.of(new SearchQuery({
        search: texto,
        caseSensitive: false,
        // Literal: quien busca `**` en una nota quiere esos dos asteriscos, no
        // una expresion regular a medio escribir.
        regexp: false,
        literal: true,
      })),
    })
    // Al escribir se salta a la primera coincidencia desde donde esta el cursor,
    // pero sin robarle el foco a la caja: se sigue escribiendo.
    if (saltar && texto !== '' && texto !== ultimo) findNext(vista)
    ultimo = texto
    pintarCuenta()
  }

  function paso(haciaAtras: boolean) {
    const vista = vistaActiva()
    if (c.campo.value === '') return
    ;(haciaAtras ? findPrevious : findNext)(vista)
    pintarCuenta()
  }

  function limpiar() {
    c.campo.value = ''
    ultimo = ''
    aplicar(false)
    vistaActiva().focus()
  }

  c.campo.addEventListener('input', () => aplicar(true))
  c.campo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      paso(e.shiftKey)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      limpiar()
    }
  })
  c.antes.addEventListener('click', () => paso(true))
  c.despues.addEventListener('click', () => paso(false))
  c.cerrar.addEventListener('click', limpiar)

  return {
    /** Ctrl+F: al campo, y con lo que haya escrito ya seleccionado. */
    enfocar() {
      c.campo.focus()
      c.campo.select()
    },
    /** Al cambiar de pestaña, lo buscado en la anterior no vale para la nueva. */
    olvidar() {
      c.campo.value = ''
      ultimo = ''
      c.caja.classList.remove('con-texto', 'sin-nada')
      c.cuenta.textContent = ''
    },
    /** Tras cargar otro documento hay que rehacer la consulta sobre él. */
    refrescar: pintarCuenta,
  }
}
