/**
 * Tema del editor. Los colores salen de variables CSS definidas en styles.css,
 * que es donde vive el claro/oscuro; aqui solo se consumen, para no tener la
 * paleta escrita en dos lugares.
 */

import { HighlightStyle } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

export const temaBase = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: 'var(--cuerpo)',
    color: 'var(--tinta)',
    backgroundColor: 'var(--papel)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--fuente-texto)',
    lineHeight: 'var(--interlineado)',
    padding: '1.4rem 1.2rem 40vh',
    overflow: 'auto',
  },
  // El ancho lo manda el panel de opciones: `none` deja el texto a lo ancho.
  '.cm-content': {
    caretColor: 'var(--acento)',
    maxWidth: 'var(--ancho-columna)',
    margin: '0 auto',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor, .cm-dropCursor': { borderLeft: '2px solid var(--acento)' },

  /*
   * La selección, **con el mismo selector largo que usa CodeMirror**.
   *
   * Esto no es rebuscado, es obligatorio: el tema base trae
   * `.ͼ2.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground`,
   * que son cinco clases. Un `&.cm-focused .cm-selectionBackground` son tres y
   * **pierde por especificidad**, sin avisar de nada.
   *
   * El efecto era que seleccionar no se veía: la selección existía —el programa
   * la tenía, copiar funcionaba—, pero se pintaba del lila de fábrica de
   * CodeMirror, que sobre el papel claro casi no se distingue y sobre el oscuro
   * desaparece. Diagnosticado el 2026-09-17 leyendo las reglas aplicadas en el
   * navegador, no a ojo.
   */
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'var(--seleccion)',
  },
  '& > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': {
    backgroundColor: 'var(--seleccion)',
  },
  '.cm-content ::selection': { backgroundColor: 'var(--seleccion)' },

  /*
   * Lo que encuentra el buscador. Mismo problema de especificidad que arriba:
   * el tema base trae `.ͼ2 .cm-searchMatch`, y una regla suelta en `styles.css`
   * es una sola clase y pierde. Por eso vive aquí y cuelga de `.cm-content`.
   *
   * La coincidencia en la que está el cursor **da un destello al llegar**: sin
   * él, buscar te deja en la zona correcta y tienes que encontrar la palabra
   * con la vista. El destello dura poco y no se repite.
   */
  '.cm-content .cm-searchMatch': {
    backgroundColor: 'color-mix(in srgb, var(--acento) 30%, transparent)',
    borderRadius: '2px',
    // Un contorno del color del texto: en amarillo puro sobre papel blanco, el
    // relleno solo no basta para ver donde acaba la palabra.
    boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--acento) 45%, transparent)',
  },
  '.cm-content .cm-searchMatch-selected': {
    backgroundColor: 'var(--resaltado-busqueda)',
    color: 'var(--resaltado-busqueda-tinta)',
    boxShadow: 'inset 0 0 0 2px var(--acento)',
    borderRadius: '2px',
    fontWeight: '600',
    animation: 'mf-destello .55s ease-out',
  },
  '.cm-activeLine': { backgroundColor: 'var(--linea-activa)' },
  '.cm-gutters': {
    backgroundColor: 'var(--papel)',
    color: 'var(--tenue)',
    border: 'none',
    fontFamily: 'var(--fuente-mono)',
    fontSize: '0.8em',
  },
  '.cm-activeLineGutter': { backgroundColor: 'var(--linea-activa)', color: 'var(--tinta)' },
})

export const resaltadoMarkdown = HighlightStyle.define([
  { tag: t.heading1, class: 'mf-t-h1' },
  { tag: t.heading2, class: 'mf-t-h2' },
  { tag: t.heading3, class: 'mf-t-h3' },
  { tag: [t.heading4, t.heading5, t.heading6], class: 'mf-t-h4' },
  { tag: t.strong, fontWeight: '700' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: [t.link, t.url], color: 'var(--enlace)' },
  { tag: [t.monospace], fontFamily: 'var(--fuente-mono)', color: 'var(--codigo)' },
  { tag: [t.processingInstruction, t.meta], color: 'var(--tenue)' },
  { tag: t.quote, color: 'var(--apagado)', fontStyle: 'italic' },
  { tag: t.keyword, color: 'var(--codigo-clave)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--codigo-cadena)' },
  { tag: [t.comment], color: 'var(--tenue)', fontStyle: 'italic' },
  { tag: [t.number, t.bool], color: 'var(--codigo-numero)' },
])
