import { crearPar, type Par } from './editor'
import { refrescarPresentacion } from './livepreview'
import { archivoInicial, escribir, leer, pedirArchivo, pedirDestino,
         type FinDeLinea } from './archivo'
import { fijarCarpeta } from './contexto'
import * as prefs from './preferencias'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWindow } from '@tauri-apps/api/window'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const cajaFuente = $('caja-fuente')
const cajaPresentacion = $('caja-presentacion')
const paneles = $('paneles')
const division = $('division')
const elNombre = $('nombre')
const elEstado = $('estado')
const btGuardar = $<HTMLButtonElement>('guardar')
const btTema = $('tema')
const zonaSoltar = $('soltar')
const velo = $('velo')

let P = prefs.leer()

// El tema se pinta antes de construir el editor para que no haya destello.
prefs.aplicar(P)

// --- estado del documento ----------------------------------------------------

let ruta: string | null = null
let nombre = 'Sin archivo'
let finDeLinea: FinDeLinea = 'lf'
let soloLectura = false
let sucio = false
let guardando = false

/**
 * El guardado es EXPLICITO a proposito.
 *
 * Hubo autoguardado hasta el 2026-09-16 y Lalo lo quito: una tecla accidental
 * quedaba escrita en disco sin que nadie lo pidiera. Ahora se guarda con el
 * boton o con Ctrl+S, y al cerrar con cambios el programa pregunta.
 */
function pintar(mensaje?: string, fallo = false) {
  elNombre.textContent = nombre + (soloLectura ? '  (solo lectura)' : '')
  elNombre.title = ruta ?? nombre
  btGuardar.disabled = !sucio || soloLectura || guardando
  document.title = (sucio ? '• ' : '') + (ruta ? `${nombre} — MarkFlow` : 'MarkFlow')
  elEstado.classList.toggle('fallo', fallo)
  if (mensaje !== undefined) { elEstado.textContent = mensaje; return }
  elEstado.textContent = guardando ? 'Guardando…'
    : soloLectura ? 'Solo lectura'
    : sucio ? 'Sin guardar'
    : ruta ? 'Guardado' : ''
}

function alEditar() {
  if (sucio) return
  sucio = true
  pintar()
}

const par: Par = crearPar(cajaFuente, cajaPresentacion, '', alEditar)

/** Vuelca a la vista todo lo que depende de las preferencias. */
function aplicarTodo() {
  prefs.aplicar(P)
  par.verNumeros(P.numerosLinea)
  par.fijarSangria(P.sangria)
  par.activarEco(P.eco)
  btTema.classList.toggle('tema-oscuro', prefs.oscuroActivo(P))
  btTema.title = P.tema === 'sistema' ? 'Tema: sigue a Windows'
    : P.tema === 'claro' ? 'Tema: claro' : 'Tema: oscuro'
  // Los diagramas llevan el tema dentro: hay que pedirles que se redibujen.
  par.presentacion.dispatch({ effects: refrescarPresentacion.of(null) })
}

const recordar = () => prefs.guardar(P)

// --- dialogo -----------------------------------------------------------------

type Salida = 'guardar' | 'descartar' | 'cancelar'

function mostrarDialogo(titulo: string, texto: string, detalle?: string) {
  $('dlg-titulo').textContent = titulo
  $('dlg-texto').textContent = texto
  const d = $('dlg-detalle')
  d.textContent = detalle ?? ''
  d.hidden = !detalle
  velo.hidden = false
}

/** Aviso de una sola salida. */
function avisar(titulo: string, texto: string, detalle?: string): Promise<void> {
  mostrarDialogo(titulo, texto, detalle)
  for (const id of ['dlg-guardar', 'dlg-descartar', 'dlg-cancelar']) $(id).hidden = true
  const aceptar = $('dlg-aceptar')
  aceptar.hidden = false
  aceptar.focus()

  return new Promise((resolver) => {
    const cerrar = () => {
      velo.hidden = true
      document.removeEventListener('keydown', porTecla, true)
      resolver()
    }
    const porTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); cerrar() }
    }
    aceptar.onclick = cerrar
    document.addEventListener('keydown', porTecla, true)
  })
}

function preguntarQueHacer(): Promise<Salida> {
  mostrarDialogo('Hay cambios sin guardar', `«${nombre}» tiene cambios que no se han guardado.`)
  for (const id of ['dlg-guardar', 'dlg-descartar', 'dlg-cancelar']) $(id).hidden = false
  $('dlg-aceptar').hidden = true
  $<HTMLButtonElement>('dlg-guardar').focus()

  return new Promise((resolver) => {
    const responder = (r: Salida) => {
      velo.hidden = true
      document.removeEventListener('keydown', porTecla, true)
      resolver(r)
    }
    const porTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); responder('cancelar') }
    }
    $('dlg-guardar').onclick = () => responder('guardar')
    $('dlg-descartar').onclick = () => responder('descartar')
    $('dlg-cancelar').onclick = () => responder('cancelar')
    document.addEventListener('keydown', porTecla, true)
  })
}

/** true = se puede continuar (cerrar o abrir otro archivo). */
async function permisoParaDescartar(): Promise<boolean> {
  if (!sucio || soloLectura) return true
  const r = await preguntarQueHacer()
  if (r === 'cancelar') return false
  if (r === 'descartar') return true
  return await guardar()
}

// --- guardar / abrir ---------------------------------------------------------

async function guardar(): Promise<boolean> {
  if (guardando || soloLectura) return false
  if (!sucio) return true
  if (!ruta) {
    const destino = await pedirDestino(nombre.endsWith('.md') ? nombre : 'sin-titulo.md')
    if (!destino) return false
    ruta = destino
    nombre = destino.split(/[\\/]/).pop() ?? destino
    fijarCarpeta(destino)
  }
  guardando = true
  pintar()
  try {
    await escribir(ruta, par.texto(), finDeLinea)
    sucio = false
    guardando = false
    pintar()
    return true
  } catch (e) {
    guardando = false
    pintar('No se guardó', true)
    // Un guardado fallido NO puede pasar desapercibido: si solo se avisa con
    // texto chico en la barra, el usuario cree que su trabajo esta a salvo.
    // Paso de verdad el 2026-09-16 con el Acceso controlado a carpetas de
    // Windows, que bloqueo la escritura sin que el programa lo gritara.
    await avisar(
      'No se pudo guardar',
      `«${nombre}» sigue con los cambios sin guardar. El texto no se ha perdido: ` +
      'está en la ventana. Guárdalo en otra carpeta o resuelve lo de abajo y ' +
      'vuelve a intentarlo.',
      String(e),
    )
    return false
  }
}

async function abrir(destino: string) {
  if (!(await permisoParaDescartar())) return
  try {
    const doc = await leer(destino)
    ruta = doc.ruta
    nombre = doc.nombre
    finDeLinea = doc.fin_de_linea
    soloLectura = doc.solo_lectura
    sucio = false
    // Antes de cargar el texto: las imagenes relativas se resuelven contra esta
    // carpeta en cuanto el panel de presentacion las dibuje.
    fijarCarpeta(doc.ruta)
    par.cargar(doc.texto)
    // `cargar` crea estados nuevos: hay que volver a poner lo configurable.
    par.verNumeros(P.numerosLinea)
    par.fijarSangria(P.sangria)
    P.ultimoArchivo = doc.ruta
    recordar()
    pintar()
    par.enfocar()
  } catch (e) {
    pintar('No se abrió', true)
    await avisar('No se pudo abrir el archivo', 'MarkFlow no pudo leerlo.', String(e))
  }
}

async function elegirYAbrir() {
  const destino = await pedirArchivo()
  if (destino) await abrir(destino)
}

// --- modos de panel ----------------------------------------------------------

const MODOS = {
  fuente: 'v-fuente', ambos: 'v-ambos', presentacion: 'v-presentacion',
} as const
type Modo = keyof typeof MODOS

function ponerModo(m: Modo, recordarlo = true) {
  P.modo = m
  paneles.className = `paneles modo-${m}`
  for (const [k, id] of Object.entries(MODOS)) $(id).classList.toggle('activo', k === m)
  if (m === 'ambos') aplicarDivision(P.division)
  if (recordarlo) recordar()
  // La vista tapada no recalcula su alto; al destaparla hay que avisarle.
  requestAnimationFrame(() => { par.fuente.requestMeasure(); par.presentacion.requestMeasure() })
}

for (const [m, id] of Object.entries(MODOS)) {
  $(id).addEventListener('click', () => ponerModo(m as Modo))
}

// --- divisor arrastrable -----------------------------------------------------

/**
 * Limites del reparto.
 *
 * La fraccion sola no dice nada: un cuarto de 1200 px son 300, donde el
 * markdown se parte cada tres palabras; un cuarto de 2560 son 640, de sobra.
 * Por eso mandan los dos a la vez y gana el mas restrictivo. Y al pasarse del
 * minimo el panel se cierra, en vez de topar contra un muro: si arrastras al
 * extremo, lo que quieres es quedarte con uno solo.
 */
const MIN_FRACCION = 0.2
const MIN_PIXELES = 320

function aplicarDivision(f: number) {
  cajaFuente.style.flexGrow = '0'
  cajaFuente.style.flexShrink = '0'
  cajaFuente.style.flexBasis = `${(f * 100).toFixed(3)}%`
  cajaPresentacion.style.flex = '1 1 0'
}

division.addEventListener('dblclick', () => {
  P.division = 0.5
  aplicarDivision(0.5)
  recordar()
  par.fuente.requestMeasure()
  par.presentacion.requestMeasure()
})

division.addEventListener('pointerdown', (e) => {
  if (P.modo !== 'ambos') return
  e.preventDefault()
  division.setPointerCapture(e.pointerId)
  division.classList.add('agarrada')
  paneles.classList.add('arrastrando')

  const caja = paneles.getBoundingClientRect()
  let colapsar: Modo | null = null

  const mover = (ev: PointerEvent) => {
    const ancho = caja.width
    let f = (ev.clientX - caja.left) / ancho

    const minF = Math.max(MIN_FRACCION, MIN_PIXELES / ancho)
    const maxF = 1 - minF

    // Pasarse del limite por un margen claro se entiende como «quítame el otro».
    colapsar = f < minF - 0.04 ? 'presentacion' : f > maxF + 0.04 ? 'fuente' : null

    f = Math.min(Math.max(f, minF), maxF)
    P.division = f
    aplicarDivision(f)
  }

  const soltar = () => {
    division.releasePointerCapture(e.pointerId)
    division.classList.remove('agarrada')
    paneles.classList.remove('arrastrando')
    division.removeEventListener('pointermove', mover)
    division.removeEventListener('pointerup', soltar)
    if (colapsar) ponerModo(colapsar)
    else {
      recordar()
      par.fuente.requestMeasure()
      par.presentacion.requestMeasure()
    }
  }

  division.addEventListener('pointermove', mover)
  division.addEventListener('pointerup', soltar)
})

// --- panel de opciones -------------------------------------------------------

const panelOp = $('panel-op')
const veloOp = $('velo-op')

function llenarFuentes() {
  const st = $<HTMLSelectElement>('op-fuente-texto')
  const sm = $<HTMLSelectElement>('op-fuente-mono')
  st.innerHTML = ''
  sm.innerHTML = ''
  for (const f of prefs.FUENTES_TEXTO) st.add(new Option(`${f.id} — ${f.nota}`, f.id))
  for (const f of prefs.FUENTES_MONO) sm.add(new Option(`${f.id} — ${f.nota}`, f.id))
}

function pintarOpciones() {
  $<HTMLSelectElement>('op-tema').value = P.tema
  $<HTMLSelectElement>('op-profundidad').value = P.profundidad
  $<HTMLSelectElement>('op-paleta').value = P.paleta
  $<HTMLSelectElement>('op-fuente-texto').value = P.fuenteTexto
  $<HTMLSelectElement>('op-fuente-mono').value = P.fuenteMono
  $<HTMLInputElement>('op-tamano').value = String(P.tamano)
  $('op-tamano-v').textContent = `${P.tamano} px`
  $<HTMLInputElement>('op-interlineado').value = String(P.interlineado)
  $('op-interlineado-v').textContent = P.interlineado.toFixed(2)
  $<HTMLInputElement>('op-ancho').value = String(P.ancho)
  $('op-ancho-v').textContent = P.ancho > 0 ? `${P.ancho} rem` : 'sin límite'
  $<HTMLInputElement>('op-numeros').checked = P.numerosLinea
  $<HTMLSelectElement>('op-sangria').value = P.sangria
  $<HTMLInputElement>('op-eco').checked = P.eco
  $<HTMLInputElement>('op-reabrir').checked = P.reabrir
}

/** Cada control escribe su campo, aplica y guarda. Sin botón de aceptar. */
function conectarOpciones() {
  const cambia = <K extends keyof prefs.Preferencias>(
    id: string, campo: K, valor: (el: any) => prefs.Preferencias[K], evento = 'change',
  ) => {
    $(id).addEventListener(evento, (e) => {
      P[campo] = valor(e.target)
      aplicarTodo()
      pintarOpciones()
      recordar()
    })
  }

  cambia('op-tema', 'tema', (el) => el.value)
  cambia('op-profundidad', 'profundidad', (el) => el.value)
  cambia('op-paleta', 'paleta', (el) => el.value)
  cambia('op-fuente-texto', 'fuenteTexto', (el) => el.value)
  cambia('op-fuente-mono', 'fuenteMono', (el) => el.value)
  cambia('op-tamano', 'tamano', (el) => Number(el.value), 'input')
  cambia('op-interlineado', 'interlineado', (el) => Number(el.value), 'input')
  cambia('op-ancho', 'ancho', (el) => Number(el.value), 'input')
  cambia('op-numeros', 'numerosLinea', (el) => el.checked)
  cambia('op-sangria', 'sangria', (el) => el.value)
  cambia('op-eco', 'eco', (el) => el.checked)
  cambia('op-reabrir', 'reabrir', (el) => el.checked)

  $('op-fabrica').addEventListener('click', () => {
    const ultimo = P.ultimoArchivo
    P = { ...prefs.DE_FABRICA, ultimoArchivo: ultimo }
    aplicarTodo()
    ponerModo(P.modo)
    pintarOpciones()
    recordar()
  })
}

function abrirOpciones(ver: boolean) {
  panelOp.hidden = !ver
  veloOp.hidden = !ver
  if (ver) pintarOpciones()
}

$('opciones').addEventListener('click', (e) => {
  ;(e.currentTarget as HTMLElement).blur()
  abrirOpciones(!!panelOp.hidden)
})
$('op-cerrar').addEventListener('click', () => abrirOpciones(false))
veloOp.addEventListener('click', () => abrirOpciones(false))

// --- barra -------------------------------------------------------------------

$('abrir').addEventListener('click', elegirYAbrir)
btGuardar.addEventListener('click', () => { guardar().then(() => par.enfocar()) })
$('deshacer').addEventListener('click', () => { par.deshacer(); par.enfocar() })
$('rehacer').addEventListener('click', () => { par.rehacer(); par.enfocar() })

const CICLO: prefs.Tema[] = ['sistema', 'claro', 'oscuro']
btTema.addEventListener('click', () => {
  btTema.blur()
  P.tema = CICLO[(CICLO.indexOf(P.tema) + 1) % CICLO.length]
  aplicarTodo()
  pintarOpciones()
  recordar()
})

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => aplicarTodo())

// --- atajos ------------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !panelOp.hidden) { abrirOpciones(false); return }
  if (!e.ctrlKey || e.altKey) return
  const k = e.key.toLowerCase()
  if (k === 'o') { e.preventDefault(); elegirYAbrir() }
  else if (k === 's') { e.preventDefault(); guardar() }
  else if (k === ',') { e.preventDefault(); abrirOpciones(!!panelOp.hidden) }
})

getCurrentWindow().onCloseRequested(async (ev) => {
  if (sucio && !soloLectura) {
    ev.preventDefault()
    if (await permisoParaDescartar()) {
      // `destroy` cierra sin volver a disparar este evento.
      await getCurrentWindow().destroy()
    }
  }
})

// --- arrastrar y soltar un .md sobre la ventana ------------------------------

getCurrentWebview().onDragDropEvent((ev) => {
  if (ev.payload.type === 'over') zonaSoltar.hidden = false
  else if (ev.payload.type === 'leave') zonaSoltar.hidden = true
  else if (ev.payload.type === 'drop') {
    zonaSoltar.hidden = true
    const primero = ev.payload.paths?.[0]
    if (primero) abrir(primero)
  }
})

// --- arranque ----------------------------------------------------------------

llenarFuentes()
conectarOpciones()
aplicarTodo()
ponerModo(P.modo, false)
pintar()

archivoInicial().then((a) => {
  if (a) return abrir(a)
  // Sin argumento: se reabre el ultimo, si esta pedido y sigue existiendo.
  if (P.reabrir && P.ultimoArchivo) return abrir(P.ultimoArchivo)
})
