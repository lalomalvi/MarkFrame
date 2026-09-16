/**
 * Widgets de bloque para el panel de presentacion.
 *
 * Un widget REEMPLAZA visualmente un tramo de texto por algo dibujado — una
 * tabla, un diagrama, una formula — y desaparece en cuanto el cursor entra a
 * ese tramo, dejando el markdown crudo listo para editar. Igual que el resto
 * del modulo de presentacion, esto NO toca el documento: `Decoration.replace`
 * tapa caracteres, no los borra. Apagar los widgets devuelve el texto intacto.
 *
 * Las librerias pesadas (Mermaid, KaTeX) se cargan la primera vez que hace
 * falta, no al arrancar: un `.md` sin diagramas no paga por ellas.
 */

import { WidgetType, type EditorView } from '@codemirror/view'
import { invoke } from '@tauri-apps/api/core'
import { carpetaActual } from './contexto'

/** Deja el cursor dentro del texto que el widget estaba tapando. */
function alPicar(el: HTMLElement, vista: EditorView, pos: number) {
  el.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('input,a')) return
    e.preventDefault()
    vista.dispatch({ selection: { anchor: pos } })
    vista.focus()
  })
}

// --- tablas -----------------------------------------------------------------

type Alineacion = 'left' | 'center' | 'right' | null

/** Parte una fila por barras, respetando las barras escapadas. */
function celdas(linea: string): string[] {
  const salida: string[] = []
  let actual = ''
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (c === '\\' && linea[i + 1] === '|') {
      actual += '|'
      i++
    } else if (c === '|') {
      salida.push(actual)
      actual = ''
    } else {
      actual += c
    }
  }
  salida.push(actual)
  if (salida.length && salida[0].trim() === '') salida.shift()
  if (salida.length && salida[salida.length - 1].trim() === '') salida.pop()
  return salida.map((s) => s.trim())
}

function alineaciones(linea: string): Alineacion[] {
  return celdas(linea).map((c) => {
    const izq = c.startsWith(':')
    const der = c.endsWith(':')
    return izq && der ? 'center' : der ? 'right' : izq ? 'left' : null
  })
}

/** Negrita, cursiva, codigo, tachado y enlaces dentro de una celda. Nada mas. */
function enriquecer(texto: string): string {
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
  return esc(texto)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>')
}

export class WidgetTabla extends WidgetType {
  constructor(readonly texto: string, readonly pos: number) {
    super()
  }
  eq(otro: WidgetTabla) {
    return otro.texto === this.texto
  }

  toDOM(vista: EditorView) {
    const caja = document.createElement('div')
    caja.className = 'mf-w mf-w-tabla'

    const lineas = this.texto.split('\n').filter((l) => l.trim() !== '')
    const tabla = document.createElement('table')

    // La segunda linea es el delimitador y no se dibuja: solo da la alineacion.
    const alin = lineas.length > 1 ? alineaciones(lineas[1]) : []

    lineas.forEach((linea, i) => {
      if (i === 1) return
      const fila = document.createElement('tr')
      celdas(linea).forEach((c, j) => {
        const celda = document.createElement(i === 0 ? 'th' : 'td')
        celda.innerHTML = enriquecer(c)
        if (alin[j]) celda.style.textAlign = alin[j]!
        fila.append(celda)
      })
      const destino = i === 0 ? tabla.createTHead() : tabla.tBodies[0] ?? tabla.createTBody()
      destino.append(fila)
    })

    caja.append(tabla)
    alPicar(caja, vista, this.pos)
    return caja
  }
}

// --- casillas de tarea ------------------------------------------------------

export class WidgetCasilla extends WidgetType {
  constructor(readonly marcada: boolean, readonly desde: number) {
    super()
  }
  eq(otro: WidgetCasilla) {
    return otro.marcada === this.marcada && otro.desde === this.desde
  }

  toDOM(vista: EditorView) {
    const caja = document.createElement('input')
    caja.type = 'checkbox'
    caja.className = 'mf-casilla'
    caja.checked = this.marcada
    // Picar la casilla edita el documento de verdad: cambia lo que va entre
    // corchetes. Es la unica interaccion de la presentacion que escribe.
    caja.addEventListener('mousedown', (e) => {
      e.preventDefault()
      vista.dispatch({
        changes: { from: this.desde, to: this.desde + 1, insert: this.marcada ? ' ' : 'x' },
      })
    })
    return caja
  }
  ignoreEvent() {
    return false
  }
}

// --- imagenes ---------------------------------------------------------------

/** Ruta del `.md` -> imagen ya leida. Evita releer en cada tecleo. */
const cacheImagenes = new Map<string, Promise<string>>()

/**
 * Una imagen de un `.md` puede venir de la red o del disco. Las del disco se
 * resuelven contra la carpeta del archivo abierto y las lee el nucleo, que las
 * entrega listas para pintar.
 *
 * No se usa el protocolo de recursos del webview porque ese depende de un
 * «scope» de carpetas autorizadas, y este programa justamente no las tiene.
 */
function rutaAbsoluta(fuente: string): string | null {
  if (/^(https?|data|blob):/i.test(fuente)) return null
  if (/^([a-z]:[\\/]|\\\\)/i.test(fuente)) return fuente
  const base = carpetaActual()
  if (!base) return null
  return base + '\\' + decodeURI(fuente).replace(/\//g, '\\')
}

function cargarImagen(fuente: string): Promise<string> {
  const abs = rutaAbsoluta(fuente)
  if (!abs) return Promise.resolve(fuente)
  let pendiente = cacheImagenes.get(abs)
  if (!pendiente) {
    pendiente = invoke<string>('leer_imagen', { ruta: abs })
    cacheImagenes.set(abs, pendiente)
  }
  return pendiente
}

export class WidgetImagen extends WidgetType {
  constructor(readonly fuente: string, readonly alt: string, readonly pos: number) {
    super()
  }
  eq(otro: WidgetImagen) {
    return otro.fuente === this.fuente && otro.alt === this.alt
  }

  toDOM(vista: EditorView) {
    const caja = document.createElement('div')
    caja.className = 'mf-w mf-w-imagen'
    const img = document.createElement('img')
    img.alt = this.alt
    img.addEventListener('error', () => {
      caja.classList.add('mf-w-rota')
      caja.textContent = 'No se pudo mostrar la imagen: ' + this.fuente
    })

    cargarImagen(this.fuente)
      .then((dato) => { img.src = dato })
      .catch((e: unknown) => {
        caja.classList.add('mf-w-rota')
        caja.textContent = String(e)
      })

    caja.append(img)
    if (this.alt) {
      const pie = document.createElement('figcaption')
      pie.textContent = this.alt
      caja.append(pie)
    }
    alPicar(caja, vista, this.pos)
    return caja
  }
}

// --- Mermaid, cargado la primera vez que aparece un diagrama ----------------

let mermaidListo: Promise<any> | null = null
let contador = 0

function cargarMermaid() {
  if (!mermaidListo) {
    mermaidListo = import('mermaid').then((m) => m.default)
  }
  return mermaidListo
}

export class WidgetMermaid extends WidgetType {
  /**
   * `oscuro` viaja dentro del widget para que `eq` lo tenga en cuenta: al
   * cambiar de tema, el diagrama deja de ser igual y CodeMirror lo redibuja.
   * Sin eso, los diagramas se quedaban en el tema con el que nacieron.
   */
  constructor(readonly codigo: string, readonly pos: number, readonly oscuro: boolean) {
    super()
  }
  eq(otro: WidgetMermaid) {
    return otro.codigo === this.codigo && otro.oscuro === this.oscuro
  }

  toDOM(vista: EditorView) {
    const caja = document.createElement('div')
    caja.className = 'mf-w mf-w-mermaid'
    caja.textContent = 'Dibujando el diagrama…'

    cargarMermaid()
      .then((mermaid) => {
        mermaid.initialize({
          startOnLoad: false,
          theme: this.oscuro ? 'dark' : 'default',
          securityLevel: 'strict',
          fontFamily: 'Segoe UI Variable Text, Segoe UI, system-ui, sans-serif',
        })
        return mermaid.render('mf-diagrama-' + contador++, this.codigo)
      })
      .then(({ svg }: { svg: string }) => {
        caja.innerHTML = svg
      })
      .catch((e: unknown) => {
        caja.classList.add('mf-w-rota')
        caja.textContent = 'Mermaid no pudo dibujarlo: ' + String(e).split('\n')[0]
      })

    alPicar(caja, vista, this.pos)
    return caja
  }
}

// --- KaTeX ------------------------------------------------------------------

let katexListo: Promise<any> | null = null

function cargarKatex() {
  if (!katexListo) {
    katexListo = Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
      ([k]) => k.default,
    )
  }
  return katexListo
}

export class WidgetMate extends WidgetType {
  constructor(readonly formula: string, readonly bloque: boolean, readonly pos: number) {
    super()
  }
  eq(otro: WidgetMate) {
    return otro.formula === this.formula && otro.bloque === this.bloque
  }

  toDOM(vista: EditorView) {
    const caja = document.createElement(this.bloque ? 'div' : 'span')
    caja.className = this.bloque ? 'mf-w mf-w-mate' : 'mf-mate-linea'
    caja.textContent = this.formula

    cargarKatex()
      .then((katex) => {
        katex.render(this.formula, caja, {
          displayMode: this.bloque,
          throwOnError: false,
          output: 'html',
        })
      })
      .catch(() => {
        caja.classList.add('mf-w-rota')
      })

    alPicar(caja, vista, this.pos)
    return caja
  }
}
