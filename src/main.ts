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
const btGuardar = $<HTMLButtonElement>('guardar')
const zonaSoltar = $('soltar')
const velo = $('velo')

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
function pintar(mensaje?: string) {
  elNombre.textContent = nombre + (soloLectura ? '  (solo lectura)' : '')
  btGuardar.disabled = !sucio || soloLectura || guardando
  document.title = (sucio ? '• ' : '') + (ruta ? `${nombre} — MarkFlow` : 'MarkFlow')
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

/** Devuelve true si el documento quedo a salvo en disco. */
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
    pintar()
    return true
  } catch (e) {
    pintar(String(e))
    return false
  } finally {
    guardando = false
    if (!sucio) pintar()
  }
}

// --- el dialogo de cambios sin guardar ---------------------------------------

type Salida = 'guardar' | 'descartar' | 'cancelar'

function preguntarQueHacer(): Promise<Salida> {
  $('dlg-texto').textContent =
    `«${nombre}» tiene cambios que no se han guardado.`
  velo.hidden = false
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

// --- abrir -------------------------------------------------------------------

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
btGuardar.addEventListener('click', () => { guardar().then(() => par.enfocar()) })
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

pintar()
archivoInicial().then((a) => { if (a) abrir(a) })
