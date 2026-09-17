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
import { carpetaActual } from './contexto.ts'
import { pedirRefresco } from './refresco.ts'

/** Deja el cursor dentro del texto que el widget estaba tapando. */
function alPicar(el: HTMLElement, vista: EditorView, pos: number) {
  el.addEventListener('mousedown', (e) => {
    // Una celda de tabla en edicion se queda con su raton: si no, el primer
    // clic dentro mandaria el cursor al markdown y cerraria la edicion.
    if ((e.target as HTMLElement).closest('input,a,.mf-celda-edit')) return
    e.preventDefault()
    vista.dispatch({ selection: { anchor: pos } })
    vista.focus()
  })
}

// --- tablas -----------------------------------------------------------------

type Alineacion = 'left' | 'center' | 'right' | null

/** Una celda de una fila: su markdown y donde vive dentro de la linea. */
export type Celda = { texto: string; desde: number; hasta: number }

/**
 * Parte una fila por barras, respetando las barras escapadas, y **dice donde
 * empieza y acaba cada celda**.
 *
 * Las posiciones son lo que hace posible editar una tabla sin volver a escribir
 * el markdown entero: con ellas, cambiar una celda es un reemplazo de un tramo
 * conocido, no una reconstruccion. Ver `WidgetTabla`.
 *
 * `texto` viene **desescapado** (un `\|` del documento llega como `|`) y sin
 * espacios a los lados; `desde` y `hasta` apuntan al texto tal cual esta en el
 * documento, ya sin esos espacios.
 */
export function celdasCon(linea: string): Celda[] {
  const salida: Celda[] = []
  let actual = ''
  let inicio = 0
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (c === '\\' && linea[i + 1] === '|') {
      actual += '|'
      i++
    } else if (c === '|') {
      salida.push({ texto: actual, desde: inicio, hasta: i })
      actual = ''
      inicio = i + 1
    } else {
      actual += c
    }
  }
  salida.push({ texto: actual, desde: inicio, hasta: linea.length })

  if (salida.length && salida[0].texto.trim() === '') salida.shift()
  if (salida.length && salida[salida.length - 1].texto.trim() === '') salida.pop()

  // Se recortan los espacios, y el rango se encoge con ellos. El desescapado no
  // descuadra esta cuenta: `\|` no es un espacio, asi que la cantidad de huecos
  // al principio y al final es la misma en el texto y en el documento.
  return salida.map((c) => {
    const izq = c.texto.length - c.texto.trimStart().length
    const der = c.texto.length - c.texto.trimEnd().length
    return { texto: c.texto.trim(), desde: c.desde + izq, hasta: c.hasta - der }
  })
}

/** Parte una fila por barras, respetando las barras escapadas. */
function celdas(linea: string): string[] {
  return celdasCon(linea).map((c) => c.texto)
}

/**
 * Deja un texto en condiciones de vivir dentro de una celda.
 *
 * Una celda es **una linea y un tramo entre barras**: un salto de linea la
 * partiria en dos filas y una barra sin escapar le abriria una columna a toda
 * la tabla. Esto no es cosmetica -- es lo que impide que editar una celda
 * estropee el documento.
 */
export function saneadaParaCelda(texto: string): string {
  return texto
    .replace(/[\r\n\u2028\u2029]+/g, ' ')
    .replace(/\|/g, '\\|')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function alineaciones(linea: string): Alineacion[] {
  return celdas(linea).map((c) => {
    const izq = c.startsWith(':')
    const der = c.endsWith(':')
    return izq && der ? 'center' : der ? 'right' : izq ? 'left' : null
  })
}

/**
 * Lista blanca de destinos para un enlace de tabla.
 *
 * **Esto cierra el hallazgo mas grave de la auditoria del 2026-09-16**, que se
 * confirmo ejecutandolo: `| [x](javascript:...) |` producia un enlace vivo, y
 * pincharlo ejecutaba ese codigo con el puente nativo entero a su alcance y se
 * llevaba por delante la aplicacion.
 *
 * Se decide por el destino, no por como empieza la cadena. Antes de mirar nada
 * se quitan los caracteres de control, porque `java\tscript:` es una url valida
 * para el navegador y no casaria con una comparacion ingenua.
 *
 * `%28`/`%29` no salvan a nadie: aqui no se acepta el esquema, punto.
 */
export function destinoSeguro(url: string): string | null {
  // Controles y espacios en cualquier posicion: el navegador los ignora al
  // resolver el esquema, asi que aqui tampoco pueden servir de disfraz.
  const limpio = url.replace(/[\u0000-\u0020\u007F]/g, '')
  if (limpio === '') return null

  // Con esquema explicito: solo estos tres.
  const conEsquema = /^([a-z][a-z0-9+.\-]*):/i.exec(limpio)
  if (conEsquema) {
    const esquema = conEsquema[1].toLowerCase()
    return esquema === 'http' || esquema === 'https' || esquema === 'mailto' ? limpio : null
  }

  // Sin esquema: ancla, o ruta relativa. Se rechazan las que empiezan por dos
  // barras, que el navegador trata como «el mismo esquema, otro servidor».
  if (limpio.startsWith('//')) return null
  return limpio
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
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (entero, texto, destino) => {
      const seguro = destinoSeguro(destino)
      // Si el destino no pasa el filtro, se deja el markdown a la vista: el
      // usuario ve que habia un enlace y adonde apuntaba, sin poder pincharlo.
      return seguro === null
        ? entero
        : `<a href="${seguro}" rel="noreferrer noopener" target="_blank">${texto}</a>`
    })
}

/**
 * Una tabla dibujada, **y editable celda por celda**.
 *
 * ### Por que esto no rompe la regla de la casa
 *
 * `CLAUDE.md` prohibe convertir HTML editado de vuelta a markdown, y con razon:
 * es lo que obligo a bloquear seis bloques en Folio. Aqui no se hace nada de
 * eso. **El HTML nunca se lee para reconstruir el documento.**
 *
 * Lo que ocurre es otra cosa: cada celda sabe **en que tramo exacto del
 * documento vive** —— se lo dice `celdasCon`—, asi que confirmar una edicion es
 * un reemplazo de ese tramo y nada mas. El resto del documento no se toca, no se
 * regenera y ni siquiera se lee. Si manana se borra este widget, el markdown
 * sigue intacto.
 *
 * La diferencia con un serializador inverso es toda: uno mira el DOM y escribe
 * un documento; esto mira **dos numeros** y escribe un tramo.
 *
 * ### Como se usa
 *
 * **Un clic en la celda la edita.** Enter o Tab confirman, Escape cancela, y
 * salirse confirma. Lo escrito se limpia con `saneadaParaCelda` antes de entrar
 * al documento.
 *
 * Al entrar en edicion, la celda muestra **su markdown crudo**, no el texto
 * dibujado: si dentro habia `**negrita**`, eso es lo que se edita. Leer el texto
 * ya dibujado perderia el formato en cuanto alguien tocara la celda.
 *
 * **Picar el marco de la tabla --por fuera de las celdas-- sigue llevando el
 * cursor al markdown**, que es como se anaden filas, se quitan columnas o se
 * cambia la alineacion. Por eso la caja lleva un margen para picar.
 *
 * ### Por que un clic y no dos
 *
 * El doble clic se intento primero, para no cambiar nada de lo que ya habia.
 * **No puede funcionar**: `mousedown` llega antes que `dblclick`, asi que el
 * primer clic ya habia mandado el cursor al markdown y deshecho la tabla; el
 * segundo caia sobre texto crudo y el `dblclick` no llegaba nunca. Verificado en
 * la aplicacion el 2026-09-17.
 *
 * Retrasar el primer clic para ver si viene otro habria metido medio segundo de
 * espera en cada clic, y eso choca con la razon de ser del programa. Asi que el
 * gesto cambia: **dentro de una celda manda la celda**, y el markdown de la
 * tabla se alcanza por el marco o por el panel de fuente, que en modo Ambos esta
 * justo al lado.
 *
 * **El markdown no se realinea.** Las barras quedan donde queden: la tabla sigue
 * siendo valida, y realinear obligaria a reescribir filas que el usuario no
 * pidio tocar. Justo lo que aqui no se hace.
 */
export class WidgetTabla extends WidgetType {
  constructor(readonly texto: string, readonly pos: number) {
    super()
  }
  eq(otro: WidgetTabla) {
    return otro.texto === this.texto && otro.pos === this.pos
  }

  toDOM(vista: EditorView) {
    const caja = document.createElement('div')
    caja.className = 'mf-w mf-w-tabla'

    // Las lineas se recorren con su desplazamiento dentro del tramo, para poder
    // sumarle `this.pos` y saber donde vive cada celda en el documento.
    const lineas: { texto: string; desde: number }[] = []
    let off = 0
    for (const l of this.texto.split('\n')) {
      if (l.trim() !== '') lineas.push({ texto: l, desde: off })
      off += l.length + 1
    }

    const tabla = document.createElement('table')

    // La segunda linea es el delimitador y no se dibuja: solo da la alineacion.
    const alin = lineas.length > 1 ? alineaciones(lineas[1].texto) : []

    lineas.forEach((linea, i) => {
      if (i === 1) return
      const fila = document.createElement('tr')
      celdasCon(linea.texto).forEach((c, j) => {
        const celda = document.createElement(i === 0 ? 'th' : 'td')
        celda.innerHTML = enriquecer(c.texto)
        if (alin[j]) celda.style.textAlign = alin[j]!
        this.hacerEditable(celda, vista, c, this.pos + linea.desde)
        fila.append(celda)
      })
      const destino = i === 0 ? tabla.createTHead() : tabla.tBodies[0] ?? tabla.createTBody()
      destino.append(fila)
    })

    caja.append(tabla)
    alPicar(caja, vista, this.pos)
    return caja
  }

  /** Doble clic en una celda: edicion en crudo, y al confirmar un solo cambio. */
  private hacerEditable(
    celda: HTMLElement,
    vista: EditorView,
    c: Celda,
    baseLinea: number,
  ) {
    const desde = baseLinea + c.desde
    const hasta = baseLinea + c.hasta
    const original = c.texto

    celda.title = 'Clic para editar esta celda'

    const abrir = () => {
      // Se edita el markdown, no lo dibujado. Si no, `**negrita**` se perderia
      // en cuanto alguien tocara la celda.
      celda.textContent = original
      celda.contentEditable = 'true'
      celda.classList.add('mf-celda-edit')
      celda.focus()
      const rango = document.createRange()
      rango.selectNodeContents(celda)
      getSelection()?.removeAllRanges()
      getSelection()?.addRange(rango)
    }

    celda.addEventListener('mousedown', (e) => {
      // **La celda se queda con su raton.** Sin este `stopPropagation`, el
      // manejador de la caja mandaria el cursor al markdown, el bloque dejaria
      // de estar decorado y la tabla se desharia en el primer clic -- que es
      // justo lo que pasaba cuando esto se intento con doble clic: el
      // `mousedown` llega antes que el `dblclick`, asi que el segundo clic ya
      // caia sobre texto crudo y el doble clic no llegaba nunca.
      e.stopPropagation()
      if (celda.isContentEditable) return
      // Sin esto, el navegador arrastra una seleccion de texto por encima.
      e.preventDefault()
      abrir()
    })

    let cerrando = false
    const cerrar = (guardar: boolean) => {
      if (cerrando || !celda.isContentEditable) return
      cerrando = true
      const escrito = saneadaParaCelda(celda.textContent ?? '')
      celda.contentEditable = 'false'
      celda.classList.remove('mf-celda-edit')

      // Si no cambio nada, no se ensucia el documento ni la historia de
      // deshacer: se repinta la celda y ya.
      if (!guardar || escrito === saneadaParaCelda(original)) {
        celda.innerHTML = enriquecer(original)
        cerrando = false
        return
      }

      // El unico cambio que esta tabla hace al documento: un tramo conocido.
      vista.dispatch({ changes: { from: desde, to: hasta, insert: escrito } })
      // No se repinta a mano: el cambio reconstruye el widget entero.
    }

    celda.addEventListener('keydown', (e) => {
      if (!celda.isContentEditable) return
      e.stopPropagation()
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        cerrar(true)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cerrar(false)
      }
    })

    celda.addEventListener('blur', () => cerrar(true))
  }

  /**
   * Nada de lo que pasa dentro de esta tabla es del editor.
   *
   * Es el comportamiento por omision de CodeMirror, y se deja escrito porque
   * **aqui importa mas que en los demas widgets**: con una celda en edicion, el
   * tecleo tiene que quedarse en el `contenteditable`. Si CodeMirror lo tomara
   * por suyo, metria el texto en el documento por su cuenta, ademas del cambio
   * que despacha `cerrar` —— y lo escribiria donde estuviera el cursor, que no
   * es donde esta la celda.
   */
  ignoreEvent() {
    return true
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

/**
  * Ruta -> imagen ya leida. Evita releer en cada tecleo.
  *
  * Con tope, y no por elegancia: la auditoria mostro que ~25 KB de markdown
  * apuntando a un archivo que ya esta en el disco podian retener 1.6 GB, porque
  * cada ruta distinta al mismo archivo era una entrada nueva y nada la vaciaba.
  */
const cacheImagenes = new Map<string, Promise<string>>()
const TOPE_CACHE = 24

function recordarImagen(clave: string, dato: Promise<string>) {
  // Se descarta la mas vieja: `Map` conserva el orden de insercion.
  if (cacheImagenes.size >= TOPE_CACHE) {
    const primera = cacheImagenes.keys().next()
    if (!primera.done) cacheImagenes.delete(primera.value)
  }
  cacheImagenes.set(clave, dato)
}

/**
 * Permiso para cargar imagenes de internet.
 *
 * Apagado por omision. Una imagen remota en un `.md` ajeno hace que tu equipo
 * contacte al servidor de quien lo escribio en cuanto la pintas: confirma que
 * abriste el archivo, revela tu IP, y si la url lleva datos los filtra. Mientras
 * no se permita, se muestra un aviso con la direccion y un boton.
 */
let remotasPermitidas = false
const permitidasSueltas = new Set<string>()

export function permitirRemotas(v: boolean) {
  remotasPermitidas = v
}

/** Llamada al abrir otro archivo: los permisos de una nota no valen para otra. */
export function olvidarPermisosSueltos() {
  permitidasSueltas.clear()
}

const esRemota = (fuente: string) => /^https?:/i.test(fuente)

/**
 * Una imagen de un `.md` puede venir de la red o del disco. Las del disco se
 * resuelven contra la carpeta del archivo abierto y las lee el nucleo, que las
 * entrega listas para pintar.
 *
 * No se usa el protocolo de recursos del webview porque ese depende de un
 * «scope» de carpetas autorizadas, y este programa justamente no las tiene.
 */
/**
 * Resuelve el destino de una imagen local, o `null` si no debe pedirse.
 *
 * **Decide por el destino, no por como empieza la cadena**, que es la leccion
 * del hallazgo de la auditoria del 2026-09-16: `esRemota` comprobaba
 * `/^https?:/` y se le colaba `\\servidor\pub\x.png`. Una ruta UNC hacia que
 * Windows abriera sesion SMB contra el servidor del atacante con solo abrir el
 * `.md`: revelaba IP, equipo, usuario y una respuesta NTLMv2. Exactamente el
 * dano que la puerta de imagenes remotas existe para evitar, por la puerta de
 * al lado.
 *
 * Tampoco vale devolver la cadena cruda cuando no hay carpeta base: Chromium
 * normaliza `\\host\x.png` a `//host/x.png` y lo pide por red igual.
 */
export function rutaAbsoluta(fuente: string): string | null {
  if (/^(https?|data|blob):/i.test(fuente)) return null

  // UNC en cualquiera de sus formas, incluida la larga de Windows. Nunca se
  // resuelve: no hay caso legitimo en el que un `.md` deba traer una imagen de
  // un servidor de archivos sin que el usuario lo sepa.
  if (/^[\\/]{2}/.test(fuente)) return null

  // Dispositivos de Windows: `\\.\` y `\\?\` ya caen arriba por las dos barras.
  if (/^[a-z]:[\\/]/i.test(fuente)) return fuente        // absoluta con unidad
  if (/^[\\/]/.test(fuente)) return fuente               // absoluta sin unidad

  const base = carpetaActual()
  if (!base) return null

  // `decodeURI` lanza con un porcentaje mal formado -- y `descuento-50%.png` es
  // un nombre de archivo legal en Windows. Sin este try, la excepcion sube por
  // `toDOM`, que CodeMirror llama sin proteccion, y mata el panel entero.
  let relativa = fuente
  try { relativa = decodeURI(fuente) } catch { /* se usa tal cual */ }

  return base + '\\' + relativa.replace(/\//g, '\\')
}

function cargarImagen(fuente: string): Promise<string> {
  const abs = rutaAbsoluta(fuente)
  // `null` significa «esto no se pide»: o es remota y ya paso por la puerta, o
  // es una UNC que no se resuelve nunca. Devolver la cadena cruda aqui seria
  // dejar que el navegador la pida por su cuenta.
  if (!abs) {
    if (/^(https?|data|blob):/i.test(fuente)) return Promise.resolve(fuente)
    return Promise.reject(
      new Error('Destino de imagen no permitido: ' + fuente),
    )
  }
  let pendiente = cacheImagenes.get(abs)
  if (!pendiente) {
    pendiente = invoke<string>('leer_imagen', { ruta: abs })
    recordarImagen(abs, pendiente)
  }
  return pendiente
}

export class WidgetImagen extends WidgetType {
  /**
   * Si la imagen estaba bloqueada **cuando nacio este widget**.
   *
   * Se congela en el constructor a proposito, y entra en `eq()`. CodeMirror
   * reutiliza el DOM de un widget cuando `eq()` dice que el nuevo es igual al
   * viejo, y `fuente` y `alt` no cambian al conceder el permiso: el boton
   * «Mostrarla» anotaba el permiso y pedia el refresco, el campo de estado
   * reconstruia las decoraciones, y CodeMirror **tiraba el widget nuevo y
   * dejaba en pantalla la caja bloqueada**. El boton no hacia nada visible.
   *
   * Calcularlo al vuelo dentro de `eq()` no sirve: los dos lados leerian el
   * mismo estado global en el mismo instante y siempre coincidirian. Lo que
   * distingue al widget viejo del nuevo es el permiso que habia **al nacer**.
   *
   * Encontrado en la pasada de funciones del 2026-09-16. No lo causo la
   * politica de contenido; estaba ahi desde que existe el boton.
   */
  readonly bloqueada: boolean

  constructor(readonly fuente: string, readonly alt: string, readonly pos: number) {
    super()
    this.bloqueada =
      esRemota(fuente) && !remotasPermitidas && !permitidasSueltas.has(fuente)
  }
  eq(otro: WidgetImagen) {
    return (
      otro.fuente === this.fuente &&
      otro.alt === this.alt &&
      otro.bloqueada === this.bloqueada
    )
  }

  toDOM(vista: EditorView) {
    const caja = document.createElement('div')
    caja.className = 'mf-w mf-w-imagen'

    // Una imagen de internet no se pide hasta que alguien lo autorice.
    if (this.bloqueada) {
      caja.classList.add('mf-w-bloqueada')
      const texto = document.createElement('div')
      texto.className = 'mf-bloq-texto'
      texto.textContent = 'Imagen de internet, sin cargar'
      const url = document.createElement('div')
      url.className = 'mf-bloq-url'
      url.textContent = this.fuente
      const boton = document.createElement('button')
      boton.className = 'mf-bloq-boton'
      boton.textContent = 'Mostrarla'
      boton.title = 'Cargarla sólo esta vez, sin cambiar la configuración'
      boton.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        permitidasSueltas.add(this.fuente)
        // Redibuja el panel para que el widget se reconstruya ya permitido.
        vista.dispatch({ effects: pedirRefresco() })
      })
      const nota = document.createElement('div')
      nota.className = 'mf-bloq-nota'
      nota.textContent =
        'Pedirla avisa a ese servidor de que abriste este archivo y le revela tu IP.'
      caja.append(texto, url, boton, nota)
      alPicar(caja, vista, this.pos)
      return caja
    }

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
        // El tema `dark` de Mermaid pinta el fondo de las etiquetas de flecha
        // --el `si`/`no` de una condicion-- con un gris claro suyo, que en un
        // panel oscuro queda como un recorte pegado encima del diagrama. Se le
        // da el fondo real de la caja para que la etiqueta tape la linea sin
        // verse. Se lee del CSS y no se escribe a mano para que siga al tema,
        // incluso si alguien cambia la paleta.
        const fondo =
          getComputedStyle(document.documentElement)
            .getPropertyValue('--codigo-fondo').trim() ||
          (this.oscuro ? '#252932' : '#f1f4f9')

        mermaid.initialize({
          startOnLoad: false,
          theme: this.oscuro ? 'dark' : 'default',
          securityLevel: 'strict',
          fontFamily: 'Segoe UI Variable Text, Segoe UI, system-ui, sans-serif',
          themeVariables: { edgeLabelBackground: fondo },
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
