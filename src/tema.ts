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
    lineHeight: '1.7',
    padding: '1.4rem 1.2rem 40vh',
    overflow: 'auto',
  },
  '.cm-content': { caretColor: 'var(--acento)', maxWidth: '46rem', margin: '0 auto' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor, .cm-dropCursor': { borderLeft: '2px solid var(--acento)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--seleccion)',
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
