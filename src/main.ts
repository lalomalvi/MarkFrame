import { crearPar, type Par } from './editor'
import { archivoInicial, escribir, leer, pedirArchivo, pedirDestino,
         type FinDeLinea } from './archivo'
import { fijarCarpeta } from './contexto'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWindow } from '@tauri-apps/api/window'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const cajaFuente = $('caja-fuente')
const cajaPresentacion = $('caja-presentacion')
const paneles = $('paneles')
const elNombre = $('nombre')
const elEstado = $('estado')
const zonaSoltar = $('soltar')

// --- estado del documento ----------------------------------------------------

let ruta: string | null = null
let nombre = 'Sin archivo'
let finDeLinea: FinDeLinea = 'lf'
let soloLectura = false
let sucio = false
let guardando = false
let temporizador: number | undefined

const RETARDO_AUTOGUARDADO = 1000

function pintar(mensaje?: string) {
  elNombre.textContent = nombre + (soloLectura ? '  (solo lectura)' : '')
  if (mensaje !== undefined) { elEstado.textContent = mensaje; return }
  elEstado.textContent = guardando ? 'Guardando…' : sucio ? 'Sin guardar' : ruta ? 'Guardado' : ''
}

/** Autoguardado: al dejar de escribir y al perder el foco la ventana. */
function alEditar() {
  sucio = true
  pintar()
  window.clearTimeout(temporizador)
  temporizador = window.setTimeout(guardar, RETARDO_AUTOGUARDADO)
}

const par: Par = crearPar(cajaFuente, cajaPresentacion, '', alEditar)

async function guardar() {
  if (!sucio || guardando || soloLectura) return
  if (!ruta) {
    const destino = await pedirDestino(nombre.endsWith('.md') ? nombre : 'sin-titulo.md')
    if (!destino) return
    ruta = destino
    nombre = destino.split(/[\\/]/).pop() ?? destino
  }
  guardando = true
  pintar()
  try {
    await escribir(ruta, par.texto(), finDeLinea)
    sucio = false
    pintar()
  } catch (e) {
    pintar(String(e))
  } finally {
    guardando = false
  }
}

async function abrir(destino: string) {
  try {
    const doc = await leer(destino)
    window.clearTimeout(temporizador)
    ruta = doc.ruta
    nombre = doc.nombre
    // Antes de cargar el texto: las imagenes relativas se resuelven contra esta
    // carpeta en cuanto el panel de presentacion las dibuje.
    fijarCarpeta(doc.ruta)
    finDeLinea = doc.fin_de_linea
    soloLectura = doc.solo_lectura
    sucio = false
    par.cargar(doc.texto)
    document.title = `${doc.nombre} — MarkFlow`
    pintar()
    par.enfocar()
  } catch (e) {
    pintar(String(e))
  }
}

async function elegirYAbrir() {
  const destino = await pedirArchivo()
  if (destino) await abrir(destino)
}

// --- barra -------------------------------------------------------------------

$('abrir').addEventListener('click', elegirYAbrir)
$('deshacer').addEventListener('click', () => { par.deshacer(); par.enfocar() })
$('rehacer').addEventListener('click', () => { par.rehacer(); par.enfocar() })

const MODOS = { 'v-fuente': 'modo-fuente', 'v-ambos': 'modo-ambos',
                'v-presentacion': 'modo-presentacion' } as const

for (const [id, clase] of Object.entries(MODOS)) {
  $(id).addEventListener('click', () => {
    paneles.className = `paneles ${clase}`
    for (const otro of Object.keys(MODOS)) $(otro).classList.toggle('activo', otro === id)
    // La vista tapada no recalcula su alto; al destaparla hay que avisarle.
    requestAnimationFrame(() => { par.fuente.requestMeasure(); par.presentacion.requestMeasure() })
  })
}

// --- atajos ------------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  if (!e.ctrlKey || e.altKey) return
  const k = e.key.toLowerCase()
  if (k === 'o') { e.preventDefault(); elegirYAbrir() }
  else if (k === 's') { e.preventDefault(); guardar() }
})

// Guardar al perder el foco la ventana: si te vas a otro programa, ya quedo.
window.addEventListener('blur', () => { if (sucio) guardar() })

getCurrentWindow().onCloseRequested(async () => { if (sucio) await guardar() })

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

pintar()
archivoInicial().then((a) => { if (a) abrir(a) })
