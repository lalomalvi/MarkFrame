/**
 * El par de vistas.
 *
 * REGLA DEL PROYECTO (ver CLAUDE.md): aqui NUNCA se convierte HTML de vuelta a
 * markdown. Los dos paneles son dos `EditorView` de CodeMirror sobre el MISMO
 * documento; el de la derecha solo decora los marcadores para ocultarlos. No
 * existe serializador inverso, asi que es imposible que se pierda un renglon de
 * una tabla — que es justo lo que paso en el editor Folio.
 */

import { Annotation, Compartment, EditorState, Prec, type Extension } from '@codemirror/state'
import { EditorView, keymap, drawSelection, rectangularSelection,
         highlightActiveLine, highlightActiveLineGutter, lineNumbers,
         dropCursor, crosshairCursor } from '@codemirror/view'
import { history, defaultKeymap, undo, redo, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching,
         indentUnit } from '@codemirror/language'
import { searchKeymap } from '@codemirror/search'
import { vistaPresentacion } from './livepreview'
import { temaBase, resaltadoMarkdown } from './tema'

/** Marca una transaccion que ya viene reflejada de la otra vista: no se reenvia. */
const espejo = Annotation.define<boolean>()

export interface Par {
  fuente: EditorView
  presentacion: EditorView
  deshacer(): void
  rehacer(): void
  texto(): string
  cargar(texto: string): void
  enfocar(): void
  /** Numeros de linea en el panel de fuente. */
  verNumeros(ver: boolean): void
  /** `'tab'` o el numero de espacios, como cadena. */
  fijarSangria(s: string): void
  /** Que el scroll de un panel arrastre al del otro. */
  ligarScroll(ligado: boolean): void
}

export function crearPar(
  cajaFuente: HTMLElement,
  cajaPresentacion: HTMLElement,
  texto: string,
  alEditar: () => void,
): Par {
  let fuente: EditorView
  let presentacion: EditorView

  const numeros = new Compartment()
  const sangria = new Compartment()

  const deshacer = () => { undo(fuente); undo(presentacion); return true }
  const rehacer = () => { redo(fuente); redo(presentacion); return true }

  /**
   * Deshacer y rehacer se sacan del `historyKeymap` de CodeMirror a proposito.
   * Ese ejecuta el undo SOLO en la vista enfocada, y aqui eso deja las dos
   * historias desfasadas: el panel donde escribiste deshace y el otro no.
   * Verificado: con historyKeymap, Ctrl+Z no llegaba nunca al archivo.
   */
  const atajos = Prec.high(keymap.of([
    { key: 'Mod-z', run: deshacer, preventDefault: true },
    { key: 'Mod-y', run: rehacer, preventDefault: true },
    { key: 'Mod-Shift-z', run: rehacer, preventDefault: true },
  ]))

  function comunes(): Extension[] {
    return [
      history(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      bracketMatching(),
      highlightActiveLine(),
      EditorState.allowMultipleSelections.of(true),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(resaltadoMarkdown, { fallback: true }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      EditorView.lineWrapping,
      sangria.of(indentUnit.of('    ')),
      temaBase,
      atajos,
      keymap.of([...defaultKeymap, ...searchKeymap, indentWithTab]),
      EditorView.updateListener.of((u) => { if (u.docChanged) alEditar() }),
    ]
  }

  /**
   * Refleja los cambios de una vista en la otra.
   *
   * Deshacer y rehacer NO se reenvian: se ejecutan en las dos vistas a la vez.
   * Como ambas reciben exactamente los mismos cambios en el mismo orden, sus
   * historias son identicas. Reenviar el resultado de un undo lo registraria en
   * la otra como un cambio nuevo y partiria las historias.
   */
  const reflejar = (otra: () => EditorView) =>
    (trs: readonly any[], vista: EditorView) => {
      vista.update(trs as any)
      for (const tr of trs) {
        if (tr.changes.empty) continue
        if (tr.annotation(espejo)) continue
        if (tr.isUserEvent('undo') || tr.isUserEvent('redo')) continue
        otra().dispatch({ changes: tr.changes, annotations: espejo.of(true) })
      }
    }

  const estadoFuente = (doc: string) => EditorState.create({
    doc,
    extensions: [numeros.of([lineNumbers(), highlightActiveLineGutter()]), ...comunes()],
  })

  const estadoPresentacion = (doc: string) => EditorState.create({
    doc,
    extensions: [...comunes(), vistaPresentacion()],
  })

  fuente = new EditorView({
    state: estadoFuente(texto),
    parent: cajaFuente,
    dispatchTransactions: reflejar(() => presentacion),
  })

  presentacion = new EditorView({
    state: estadoPresentacion(texto),
    parent: cajaPresentacion,
    dispatchTransactions: reflejar(() => fuente),
  })

  // --- scroll ligado ---------------------------------------------------------

  let ligado = false
  let sincronizando = false

  /**
   * Se liga POR RENGLON, no por pixeles.
   *
   * Los dos paneles no miden lo mismo de alto: una tabla dibujada ocupa mas que
   * su markdown y un diagrama mucho mas. Igualar `scrollTop` los desalinea a los
   * pocos bloques. Llevando el renglon de arriba al renglon de arriba, la
   * correspondencia se mantiene fiel por largo que sea el documento.
   */
  const seguir = (origen: EditorView, destino: EditorView) => () => {
    if (!ligado || sincronizando) return
    const caja = origen.scrollDOM.getBoundingClientRect()
    const pos = origen.posAtCoords({ x: caja.left + 8, y: caja.top + 2 })
    if (pos == null) return
    sincronizando = true
    destino.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start' }) })
    requestAnimationFrame(() => { sincronizando = false })
  }

  fuente.scrollDOM.addEventListener('scroll', seguir(fuente, presentacion), { passive: true })
  presentacion.scrollDOM.addEventListener('scroll', seguir(presentacion, fuente), { passive: true })

  return {
    fuente,
    presentacion,
    deshacer,
    rehacer,
    texto() { return fuente.state.doc.toString() },
    /** Abrir otro archivo: estados nuevos, para que la historia empiece limpia. */
    cargar(nuevo: string) {
      fuente.setState(estadoFuente(nuevo))
      presentacion.setState(estadoPresentacion(nuevo))
    },
    enfocar() {
      if (cajaPresentacion.offsetParent !== null) presentacion.focus()
      else fuente.focus()
    },
    verNumeros(ver: boolean) {
      fuente.dispatch({
        effects: numeros.reconfigure(ver ? [lineNumbers(), highlightActiveLineGutter()] : []),
      })
    },
    fijarSangria(s: string) {
      const unidad = s === 'tab' ? '\t' : ' '.repeat(Number(s) || 4)
      for (const v of [fuente, presentacion]) {
        v.dispatch({ effects: sangria.reconfigure(indentUnit.of(unidad)) })
      }
    },
    ligarScroll(v: boolean) { ligado = v },
  }
}
