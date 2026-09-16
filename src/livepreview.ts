/**
 * Edicion «inside», al modo de Obsidian.
 *
 * El panel de presentacion muestra EL MISMO TEXTO que el de la fuente: lo unico
 * que hace este modulo es *decorar*. Los marcadores (`##`, `**`, `` ` ``) se
 * ocultan con `Decoration.replace`, que tapa caracteres sin tocarlos, y vuelven
 * a aparecer en cuanto el cursor entra a ese renglon para que puedas editarlos.
 *
 * Nada de esto modifica el documento. Apagar el plugin devuelve el markdown
 * intacto, caracter por caracter.
 */

import { syntaxTree } from '@codemirror/language'
import { type Range, type Extension } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView, ViewPlugin,
         type ViewUpdate } from '@codemirror/view'

/** Marcadores que se esconden cuando el cursor no esta en su renglon. */
const MARCADORES = new Set([
  'HeaderMark', 'EmphasisMark', 'StrongEmphasisMark', 'CodeMark',
  'StrikethroughMark', 'QuoteMark', 'LinkMark', 'SubscriptMark',
  'SuperscriptMark',
])

/** Nodos que reciben una clase en toda la linea. */
const LINEA: Record<string, string> = {
  ATXHeading1: 'mf-h1', ATXHeading2: 'mf-h2', ATXHeading3: 'mf-h3',
  ATXHeading4: 'mf-h4', ATXHeading5: 'mf-h5', ATXHeading6: 'mf-h6',
  SetextHeading1: 'mf-h1', SetextHeading2: 'mf-h2',
  Blockquote: 'mf-cita',
  FencedCode: 'mf-bloque-codigo',
  CodeBlock: 'mf-bloque-codigo',
  HorizontalRule: 'mf-regla',
}

/** Nodos que reciben una clase solo en su tramo. */
const TRAMO: Record<string, string> = {
  StrongEmphasis: 'mf-fuerte',
  Emphasis: 'mf-enfasis',
  InlineCode: 'mf-codigo',
  Strikethrough: 'mf-tachado',
  Link: 'mf-enlace',
  ListMark: 'mf-vineta',
  TableHeader: 'mf-tabla-encabezado',
  TableDelimiter: 'mf-tabla-borde',
}

const ocultar = Decoration.replace({})

function construir(vista: EditorView): DecorationSet {
  const marcas: Range<Decoration>[] = []
  const doc = vista.state.doc

  // Renglones que el cursor esta tocando: ahi los marcadores se muestran.
  const activas = new Set<number>()
  for (const r of vista.state.selection.ranges) {
    const desde = doc.lineAt(r.from).number
    const hasta = doc.lineAt(r.to).number
    for (let n = desde; n <= hasta; n++) activas.add(n)
  }

  const lineasVistas = new Set<number>()

  for (const { from, to } of vista.visibleRanges) {
    syntaxTree(vista.state).iterate({
      from, to,
      enter: (nodo) => {
        const nombre = nodo.name

        const claseLinea = LINEA[nombre]
        if (claseLinea) {
          const pri = doc.lineAt(nodo.from).number
          const ult = doc.lineAt(nodo.to).number
          for (let n = pri; n <= ult; n++) {
            const clave = n * 1000 + claseLinea.length
            if (lineasVistas.has(clave)) continue
            lineasVistas.add(clave)
            marcas.push(Decoration.line({ class: claseLinea }).range(doc.line(n).from))
          }
        }

        const claseTramo = TRAMO[nombre]
        if (claseTramo && nodo.to > nodo.from) {
          marcas.push(Decoration.mark({ class: claseTramo }).range(nodo.from, nodo.to))
        }

        // La direccion de un enlace `[texto](url)` se esconde junto con sus
        // corchetes: si solo se ocultan los marcadores, la url queda pegada al
        // texto y se lee «enlacehttps://…».
        const esDestinoDeEnlace =
          (nombre === 'URL' || nombre === 'LinkTitle') &&
          nodo.node.parent?.name === 'Link'

        if ((MARCADORES.has(nombre) || esDestinoDeEnlace) && nodo.to > nodo.from) {
          const linea = doc.lineAt(nodo.from).number
          if (!activas.has(linea)) {
            marcas.push(ocultar.range(nodo.from, nodo.to))
          }
        }
      },
    })
  }

  // `true` ordena los rangos: las decoraciones de linea y de tramo se generan
  // entremezcladas al recorrer el arbol y RangeSet las exige en orden.
  return Decoration.set(marcas, true)
}

export function vistaPresentacion(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(vista: EditorView) { this.decorations = construir(vista) }
      update(u: ViewUpdate) {
        // Tambien al mover el cursor: de eso depende que los marcadores vuelvan.
        if (u.docChanged || u.viewportChanged || u.selectionSet) {
          this.decorations = construir(u.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
