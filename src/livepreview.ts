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
import { WidgetCasilla, WidgetImagen, WidgetMate, WidgetMermaid, WidgetTabla } from './widgets.ts'
import { esOscuro } from './contexto.ts'
import { refrescarPresentacion } from './refresco.ts'

export { refrescarPresentacion } from './refresco.ts'

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

/**
 * Avisos, con los 13 tipos de Obsidian y sus alias, en ingles y en espanol.
 *
 * GitHub solo reconoce cinco (NOTE, TIP, IMPORTANT, WARNING, CAUTION) y los
 * escribe en mayuscula; GitLab los escribe en minuscula. Aqui se aceptan las
 * dos formas y tambien el espanol, porque lo que se teclea en esta maquina
 * esta en espanol. **Ojo al exportar: `[!NOTA]` no lo renderiza nadie fuera
 * de MarkFlow y se degrada a cita.**
 */
const AVISOS: Record<string, string> = {
  nota: 'nota', note: 'nota', info: 'nota', informacion: 'nota',
  tip: 'tip', hint: 'tip', consejo: 'tip', sugerencia: 'tip', pista: 'tip',
  importante: 'importante', important: 'importante',
  aviso: 'aviso', warning: 'aviso', caution: 'aviso', cuidado: 'aviso',
  precaucion: 'aviso', atencion: 'aviso', attention: 'aviso',
  peligro: 'peligro', danger: 'peligro', error: 'peligro', alto: 'peligro',
  exito: 'exito', success: 'exito', check: 'exito', done: 'exito', hecho: 'exito',
  fallo: 'fallo', failure: 'fallo', fail: 'fallo', missing: 'fallo', falta: 'fallo',
  pregunta: 'pregunta', question: 'pregunta', help: 'pregunta', faq: 'pregunta',
  duda: 'pregunta', ayuda: 'pregunta',
  resumen: 'resumen', abstract: 'resumen', summary: 'resumen', tldr: 'resumen',
  pendiente: 'pendiente', todo: 'pendiente',
  bicho: 'bicho', bug: 'bicho',
  ejemplo: 'ejemplo', example: 'ejemplo',
  cita: 'cita', quote: 'cita',
}

/**
 * Caracteres invisibles que se usan para esconder instrucciones.
 *
 * Espacios y marcas de ancho cero, controles de direccion, y la zona de
 * etiquetas de Unicode (U+E0000 a U+E007F), que es la que se emplea para
 * colar texto que un humano no ve. En un editor que abre archivos de
 * terceros, no verlos es el problema.
 */
const RE_INVISIBLES = new RegExp(
  [
    '[\\u200B-\\u200F]',       // anchos cero y marcas de direccion
    '[\\u2028\\u2029]',        // separadores de linea y parrafo
    '[\\u202A-\\u202E]',       // anulaciones de direccion
    '[\\u2060-\\u2064]',       // uniones y separadores invisibles
    '\\uFEFF',                 // marca de orden de bytes suelta
    '[\\u{E0000}-\\u{E007F}]',   // zona de etiquetas
  ].join('|'),
  'gu',
)

/**
 * Tope de tamano para el panel de presentacion.
 *
 * Esta es la red de seguridad de toda una familia de fallos, no el parche de
 * uno. `construir()` recorre el documento entero, sin presupuesto de tiempo, en
 * el hilo de la interfaz, y se reejecuta en cada tecla y cada movimiento de
 * cursor. La auditoria del 2026-09-16 encontro dos expresiones con coste
 * cuadratico ahi dentro; se arreglaron las dos, pero el validador lo dijo
 * mejor que nadie: parchear una a una es jugar al topo.
 *
 * Con este tope, la proxima expresion mal escrita apaga la vista y avisa, en
 * vez de colgar el programa -- que en esta aplicacion, ademas, significa una
 * ventana sin botones que cerrar, porque la barra de titulo es HTML.
 *
 * 2 MB son mas de un millon de caracteres: ningun documento escrito a mano se
 * acerca, y el panel de fuente sigue funcionando igual.
 */
const TOPE_VISTA = 2 * 1024 * 1024

const ocultar = Decoration.replace({})

function sinAcentos(s: string) {
  return s.replace(/[áàä]/gi, 'a').replace(/[éèë]/gi, 'e').replace(/[íìï]/gi, 'i')
          .replace(/[óòö]/gi, 'o').replace(/[úùü]/gi, 'u').toLowerCase()
}

/**
 * Se exporta para que las pruebas puedan mirar QUE decora un documento sin
 * abrir una ventana. `toDOM` no se llama aqui, asi que no hace falta DOM.
 */
export function construir(estado: EditorState): DecorationSet {
  const marcas: Range<Decoration>[] = []
  const doc = estado.doc

  // Por encima del tope, el panel muestra el texto tal cual: sin decorar, pero
  // vivo y con el documento intacto.
  if (doc.length > TOPE_VISTA) return Decoration.none

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

  /**
   * Un nodo esta tapado solo si cabe ENTERO dentro de un bloque tapado.
   *
   * Comparar unicamente su inicio no sirve: el nodo raiz del documento empieza
   * en 0, asi que un frontmatter que tape desde 0 lo daba por tapado y cortaba
   * el recorrido del arbol de raiz — el panel de presentacion se quedaba sin
   * decorar nada. Paso el 2026-09-16.
   */
  const estaTapado = (desde: number, hasta = desde) =>
    tapados.some(([a, b]) => desde >= a && hasta <= b)

  // --- frontmatter YAML -----------------------------------------------------
  // Sin esto, los `---` que lo cierran hacen que markdown lea la linea de
  // arriba como titulo subrayado, y la cabecera entera sale en letra enorme.
  // Los .md de DOCs ocr empiezan todos asi, de modo que se nota siempre.
  if (doc.lines >= 2 && doc.line(1).text.trim() === '---') {
    for (let n = 2; n <= doc.lines; n++) {
      const l = doc.line(n)
      if (l.text.trim() === '---' || l.text.trim() === '...') {
        for (let k = 1; k <= n; k++) {
          marcas.push(Decoration.line({ class: 'mf-frontmatter' }).range(doc.line(k).from))
        }
        tapados.push([0, l.to])
        break
      }
    }
  }

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
        // Para saber SI es mermaid basta la primera linea. Antes se aplicaba la
        // expresion al bloque entero, con un `[`~]{3,}` codicioso dentro de un
        // `[\s\S]*?` perezoso: coste ~3R²/2, y repagado en cada tecla. Con 30 KB
        // de virgulillas eran segundos por pulsacion. Medido en la auditoria.
        const primeraLinea = doc.lineAt(nodo.from).text
        const cerca = /^\s*([`~]{3,})[ \t]*([\w-]*)\s*$/.exec(primeraLinea)
        const esMermaid = cerca !== null && cerca[2].toLowerCase() === 'mermaid'
        const texto = esMermaid ? doc.sliceString(nodo.from, nodo.to) : ''
        const m = esMermaid
          ? /^[`~]{3,}[^\n]*\n([\s\S]*?)\n?[`~]{3,}[ \t]*$/.exec(texto)
          : null
        if (m && !tocado(nodo.from, nodo.to)) {
          marcas.push(Decoration.replace({
            widget: new WidgetMermaid(m[1], nodo.from, esOscuro()),
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

      if (estaTapado(nodo.from, nodo.to)) return false

      // --- avisos destacados -------------------------------------------------

      if (nombre === 'Blockquote') {
        const primera = doc.lineAt(nodo.from)
        // `[!tipo]`, con `+`/`-` opcional al estilo de Obsidian y un titulo
        // propio despues del corchete.
        const m = primera.text.match(/^\s*>\s*\[!(\w+)\]([+-]?)/)
        if (m) {
          const tipo = AVISOS[sinAcentos(m[1])] ?? 'nota'
          const ult = doc.lineAt(nodo.to).number
          for (let n = primera.number; n <= ult; n++) {
            const clases = n === primera.number
              ? `mf-aviso mf-aviso-${tipo} mf-aviso-cabeza`
              : `mf-aviso mf-aviso-${tipo}`
            marcas.push(Decoration.line({ class: clases }).range(doc.line(n).from))
          }
          if (!activas.has(primera.number)) {
            // Se tapa la etiqueta entera, incluido el `+`/`-` del plegado. El
            // titulo que venga despues se queda a la vista, en negrita.
            const ini = primera.from + primera.text.indexOf('[!')
            marcas.push(ocultar.range(ini, ini + m[1].length + 3 + m[2].length))
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
    if (enCodigo(desde) || estaTapado(desde, hasta) || tocado(desde, hasta)) continue
    marcas.push(Decoration.replace({
      widget: new WidgetMate(m[1].trim(), true, desde),
      block: true,
    }).range(doc.lineAt(desde).from, doc.lineAt(hasta).to))
    tapados.push([desde, hasta])
  }

  // --- notas al pie, resaltado y caracteres invisibles ----------------------
  // Ninguna de las tres las conoce el markdown de CodeMirror, asi que se
  // buscan sobre el texto igual que las formulas.

  /**
   * Notas al pie `[^1]`.
   *
   * Es la unica extension posterior a GFM que implementan TODOS -- GitHub,
   * GitLab, Pandoc, Obsidian, Typora, Quarto -- y por eso entra antes que
   * cualquier otra cosa. La definicion `[^1]: texto` se marca al margen; la
   * referencia se dibuja en volado.
   */
  for (const m of texto.matchAll(/^[ \t]*\[\^([^[\]\s]+)\]:/gm)) {
    const desde = m.index!
    if (enCodigo(desde) || estaTapado(desde, desde + m[0].length)) continue
    marcas.push(Decoration.line({ class: 'mf-nota-def' }).range(doc.lineAt(desde).from))
    if (!activas.has(doc.lineAt(desde).number)) {
      const abre = desde + m[0].indexOf('[^')
      marcas.push(ocultar.range(abre, abre + 2))
      marcas.push(ocultar.range(desde + m[0].length - 2, desde + m[0].length))
    }
  }

  // La clase excluye `[` a proposito. Sin eso, el corchete -- que es a la vez
  // el arranque de cada intento -- se queda dentro de la parte repetida y el
  // motor recorre el mismo tramo una vez por posicion: coste n²/2, o sea
  // 5×10¹¹ pasos con un megabyte de `[^` repetido. Medido en la auditoria.
  for (const m of texto.matchAll(/\[\^([^[\]\s]+)\](?!:)/g)) {
    const desde = m.index!
    const hasta = desde + m[0].length
    if (enCodigo(desde) || estaTapado(desde, hasta) || tocado(desde, hasta)) continue
    marcas.push(Decoration.mark({ class: 'mf-nota-ref' }).range(desde, hasta))
    marcas.push(ocultar.range(desde, desde + 2))
    marcas.push(ocultar.range(hasta - 1, hasta))
  }

  /** `==resaltado==`: Obsidian, Typora, Pandoc y Joplin coinciden en esta. */
  for (const m of texto.matchAll(/==(?!\s)((?:[^=\n]|=(?!=))+?)(?<!\s)==/g)) {
    const desde = m.index!
    const hasta = desde + m[0].length
    if (enCodigo(desde) || estaTapado(desde, hasta)) continue
    marcas.push(Decoration.mark({ class: 'mf-resaltado' }).range(desde, hasta))
    if (!tocado(desde, hasta)) {
      marcas.push(ocultar.range(desde, desde + 2))
      marcas.push(ocultar.range(hasta - 2, hasta))
    }
  }

  /**
   * Caracteres invisibles.
   *
   * Espacios de ancho cero y la zona de etiquetas de Unicode se usan para
   * esconder instrucciones dentro de un texto que parece inocente. En un
   * editor que abre archivos de terceros, no verlos es el problema: aqui se
   * marcan con un recuadro para que salten a la vista.
   */
  for (const m of texto.matchAll(RE_INVISIBLES)) {
    const desde = m.index!
    marcas.push(
      Decoration.mark({ class: 'mf-invisible', attributes: { title: 'Carácter invisible' } })
        .range(desde, desde + m[0].length),
    )
  }

  // Inline: se exige que no haya espacio pegado a los delimitadores, para no
  // confundir «$100 y $200» con una formula.
  // Misma familia que la de nota al pie: la alternativa `\\.` podia atravesar
  // el `$` de cierre y hacer que el motor reintentara desde cada posicion. Se
  // acota la longitud, que es lo que corta el crecimiento cuadratico sin
  // cambiar lo que se reconoce en un texto real.
  for (const m of texto.matchAll(/\$(?![\s$])((?:[^$\n\\]|\\[^\n]){1,400}?)(?<![\s\\])\$/g)) {
    const desde = m.index!
    const hasta = desde + m[0].length
    if (enCodigo(desde) || estaTapado(desde, hasta) || tocado(desde, hasta)) continue
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
      if (tr.effects.some((e) => e.is(refrescarPresentacion))) return construir(tr.state)
      return valor.map(tr.changes)
    },
    provide: (f) => EditorView.decorations.from(f),
  })
}
