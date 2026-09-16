/**
 * Edicion «inside», al modo de Obsidian.
 *
 * El panel de presentacion muestra EL MISMO TEXTO que el de la fuente: lo unico
 * que hace este modulo es *decorar*. Los marcadores se ocultan con
 * `Decoration.replace`, que tapa caracteres sin tocarlos, y los bloques
 * dibujables (tablas, diagramas, formulas, imagenes) se tapan con un widget.
 * Todo vuelve a ser texto crudo en cuanto el cursor entra al renglon.
 *
 * Nada de esto modifica el documento. Apagar el plugin devuelve el markdown
 * intacto, caracter por caracter.
 *
 * POR QUE UN StateField Y NO UN ViewPlugin: CodeMirror prohibe que un plugin
 * de vista produzca decoraciones que se traguen saltos de linea, y un widget
 * de tabla o de diagrama hace justo eso. Los StateField si pueden. El precio
 * es recorrer el documento entero en vez de solo lo visible.
 */

import { syntaxTree } from '@codemirror/language'
import { StateField, type EditorState, type Extension, type Range } from '@codemirror/state'
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view'
import { WidgetCasilla, WidgetImagen, WidgetMate, WidgetMermaid, WidgetTabla } from './widgets'

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
}

/** Avisos al estilo de Obsidian: `> [!NOTA]`, `> [!AVISO]`, `> [!PELIGRO]`. */
const AVISOS: Record<string, string> = {
  nota: 'nota', note: 'nota', info: 'nota',
  tip: 'tip', consejo: 'tip', sugerencia: 'tip',
  aviso: 'aviso', warning: 'aviso', cuidado: 'aviso', precaucion: 'aviso',
  peligro: 'peligro', danger: 'peligro', error: 'peligro', alto: 'peligro',
  ejemplo: 'ejemplo', example: 'ejemplo',
  cita: 'cita', quote: 'cita',
}

const ocultar = Decoration.replace({})

function sinAcentos(s: string) {
  return s.replace(/[áàä]/gi, 'a').replace(/[éèë]/gi, 'e').replace(/[íìï]/gi, 'i')
          .replace(/[óòö]/gi, 'o').replace(/[úùü]/gi, 'u').toLowerCase()
}

function construir(estado: EditorState): DecorationSet {
  const marcas: Range<Decoration>[] = []
  const doc = estado.doc

  // Renglones que el cursor esta tocando: ahi todo vuelve a ser texto crudo.
  const activas = new Set<number>()
  for (const r of estado.selection.ranges) {
    const desde = doc.lineAt(r.from).number
    const hasta = doc.lineAt(r.to).number
    for (let n = desde; n <= hasta; n++) activas.add(n)
  }

  /** ¿El cursor esta dentro de este tramo, aunque sea rozando un renglon? */
  const tocado = (desde: number, hasta: number) => {
    const pri = doc.lineAt(desde).number
    const ult = doc.lineAt(hasta).number
    for (let n = pri; n <= ult; n++) if (activas.has(n)) return true
    return false
  }

  /** Tramos de codigo, donde no se buscan formulas. */
  const codigo: Array<[number, number]> = []
  const lineasVistas = new Set<string>()
  /** Bloques ya tapados por un widget: dentro no se decora nada mas. */
  const tapados: Array<[number, number]> = []
  const estaTapado = (p: number) => tapados.some(([a, b]) => p >= a && p < b)

  syntaxTree(estado).iterate({
    enter: (nodo) => {
      const nombre = nodo.name

      if (nombre === 'InlineCode' || nombre === 'FencedCode' || nombre === 'CodeBlock') {
        codigo.push([nodo.from, nodo.to])
      }

      // --- bloques que se dibujan -------------------------------------------

      if (nombre === 'Table') {
        if (!tocado(nodo.from, nodo.to)) {
          const texto = doc.sliceString(nodo.from, nodo.to)
          marcas.push(Decoration.replace({
            widget: new WidgetTabla(texto, nodo.from),
            block: true,
          }).range(doc.lineAt(nodo.from).from, doc.lineAt(nodo.to).to))
          tapados.push([nodo.from, nodo.to])
        }
        return false
      }

      if (nombre === 'FencedCode') {
        const texto = doc.sliceString(nodo.from, nodo.to)
        const m = texto.match(/^([`~]{3,})[ \t]*([\w-]*)\n([\s\S]*?)\n?[`~]{3,}[ \t]*$/)
        if (m && m[2].toLowerCase() === 'mermaid' && !tocado(nodo.from, nodo.to)) {
          marcas.push(Decoration.replace({
            widget: new WidgetMermaid(m[3], nodo.from),
            block: true,
          }).range(doc.lineAt(nodo.from).from, doc.lineAt(nodo.to).to))
          tapados.push([nodo.from, nodo.to])
          return false
        }
      }

      if (nombre === 'Image') {
        const texto = doc.sliceString(nodo.from, nodo.to)
        const m = texto.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/)
        if (m && !tocado(nodo.from, nodo.to)) {
          marcas.push(Decoration.replace({
            widget: new WidgetImagen(m[2], m[1], nodo.from),
          }).range(nodo.from, nodo.to))
          tapados.push([nodo.from, nodo.to])
          return false
        }
      }

      if (nombre === 'TaskMarker') {
        // `[ ]` o `[x]`: la marca real es el caracter de en medio.
        if (!tocado(nodo.from, nodo.to)) {
          const dentro = doc.sliceString(nodo.from + 1, nodo.to - 1)
          marcas.push(Decoration.replace({
            widget: new WidgetCasilla(dentro.trim() !== '', nodo.from + 1),
          }).range(nodo.from, nodo.to))
        }
        return false
      }

      if (estaTapado(nodo.from)) return false

      // --- avisos destacados -------------------------------------------------

      if (nombre === 'Blockquote') {
        const primera = doc.lineAt(nodo.from)
        const m = primera.text.match(/^\s*>\s*\[!(\w+)\]/)
        if (m) {
          const tipo = AVISOS[sinAcentos(m[1])] ?? 'nota'
          const ult = doc.lineAt(nodo.to).number
          for (let n = primera.number; n <= ult; n++) {
            marcas.push(Decoration.line({ class: `mf-aviso mf-aviso-${tipo}` })
              .range(doc.line(n).from))
          }
          if (!activas.has(primera.number)) {
            // Se tapa solo la etiqueta `[!TIPO]`: dos corchetes, el signo y el
            // nombre. El titulo que venga despues se queda a la vista.
            const ini = primera.from + primera.text.indexOf('[!')
            marcas.push(ocultar.range(ini, ini + m[1].length + 3))
          }
        }
      }

      // --- clases de linea y de tramo ----------------------------------------

      const claseLinea = LINEA[nombre]
      if (claseLinea) {
        const pri = doc.lineAt(nodo.from).number
        const ult = doc.lineAt(nodo.to).number
        for (let n = pri; n <= ult; n++) {
          const clave = `${n}:${claseLinea}`
          if (lineasVistas.has(clave)) continue
          lineasVistas.add(clave)
          marcas.push(Decoration.line({ class: claseLinea }).range(doc.line(n).from))
        }
      }

      const claseTramo = TRAMO[nombre]
      if (claseTramo && nodo.to > nodo.from) {
        marcas.push(Decoration.mark({ class: claseTramo }).range(nodo.from, nodo.to))
      }

      // --- marcadores que se esconden ----------------------------------------

      // La direccion de un enlace se esconde junto con sus corchetes: si solo
      // se ocultan los marcadores, la url queda pegada al texto y se lee
      // «enlacehttps://…».
      const esDestinoDeEnlace =
        (nombre === 'URL' || nombre === 'LinkTitle') && nodo.node.parent?.name === 'Link'

      if ((MARCADORES.has(nombre) || esDestinoDeEnlace) && nodo.to > nodo.from) {
        if (!activas.has(doc.lineAt(nodo.from).number)) {
          marcas.push(ocultar.range(nodo.from, nodo.to))
        }
      }
      return undefined
    },
  })

  // --- formulas -------------------------------------------------------------
  // El markdown de CodeMirror no conoce `$...$`, asi que se buscan a mano
  // sobre el texto, descartando lo que caiga dentro de codigo.

  const texto = doc.toString()
  const enCodigo = (p: number) => codigo.some(([a, b]) => p >= a && p < b)

  for (const m of texto.matchAll(/\$\$([\s\S]+?)\$\$/g)) {
    const desde = m.index!
    const hasta = desde + m[0].length
    if (enCodigo(desde) || estaTapado(desde) || tocado(desde, hasta)) continue
    marcas.push(Decoration.replace({
      widget: new WidgetMate(m[1].trim(), true, desde),
      block: true,
    }).range(doc.lineAt(desde).from, doc.lineAt(hasta).to))
    tapados.push([desde, hasta])
  }

  // Inline: se exige que no haya espacio pegado a los delimitadores, para no
  // confundir «$100 y $200» con una formula.
  for (const m of texto.matchAll(/\$(?![\s$])((?:[^$\n\\]|\\.)+?)(?<![\s\\])\$/g)) {
    const desde = m.index!
    const hasta = desde + m[0].length
    if (enCodigo(desde) || estaTapado(desde) || tocado(desde, hasta)) continue
    marcas.push(Decoration.replace({
      widget: new WidgetMate(m[1], false, desde),
    }).range(desde, hasta))
  }

  // `true` ordena los rangos: se generan entremezclados al recorrer el arbol y
  // RangeSet los exige en orden.
  return Decoration.set(marcas, true)
}

export function vistaPresentacion(): Extension {
  return StateField.define<DecorationSet>({
    create: (estado) => construir(estado),
    update(valor, tr) {
      // Tambien al mover el cursor: de eso depende que el texto crudo vuelva.
      if (tr.docChanged || tr.selection) return construir(tr.state)
      return valor.map(tr.changes)
    },
    provide: (f) => EditorView.decorations.from(f),
  })
}
