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
import { bloqueEn, campoEco, marcarEco } from './resalte'
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
  /** Que picar un bloque lleve el otro panel al mismo bloque. */
  activarEco(activo: boolean): void
  /** Estados vivos de las dos vistas, para guardarlos en una pestana. */
  capturar(): { f: EditorState; p: EditorState }
  /** Devuelve a las vistas unos estados guardados antes. */
  restaurar(f: EditorState, p: EditorState): void
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
      campoEco(),
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

  // --- eco entre paneles -----------------------------------------------------

  let eco = true
  let temporizador: number | undefined
  const DURACION_ECO = 2600

  /**
   * Lleva el otro panel al bloque que se acaba de picar y lo enmarca.
   *
   * Se dispara con el clic, no con el scroll: asi el otro panel solo se mueve
   * cuando se le pide. Es lo que sustituyo al scroll ligado.
   */
  const ecoAlPicar = (origen: EditorView, destino: EditorView) => (e: MouseEvent) => {
    if (!eco) return
    // Si el destino esta tapado (modo de un solo panel), no hay nada que hacer.
    if ((destino.dom.parentElement as HTMLElement)?.offsetParent === null) return
    const pos = origen.posAtCoords({ x: e.clientX, y: e.clientY })
    if (pos == null) return
    const b = bloqueEn(origen.state, pos)
    window.clearTimeout(temporizador)
    destino.dispatch({
      effects: [EditorView.scrollIntoView(b.desde, { y: 'center' }), marcarEco.of(b)],
    })
    temporizador = window.setTimeout(() => {
      destino.dispatch({ effects: marcarEco.of(null) })
    }, DURACION_ECO)
  }

  fuente.dom.addEventListener('mouseup', ecoAlPicar(fuente, presentacion))
  presentacion.dom.addEventListener('mouseup', ecoAlPicar(presentacion, fuente))

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
    activarEco(v: boolean) { eco = v },
    /**
     * Cada pestana se lleva sus DOS estados completos, no solo su texto: ahi
     * viven la historia de deshacer, la seleccion y los plegados. Volver a una
     * pestana devuelve el editor tal como estaba.
     */
    capturar() { return { f: fuente.state, p: presentacion.state } },
    restaurar(f: EditorState, p: EditorState) {
      fuente.setState(f)
      presentacion.setState(p)
    },
  }
}
