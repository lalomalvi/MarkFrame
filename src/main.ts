import { crearPar, type Par } from './editor'
import { refrescarPresentacion } from './livepreview'
import { archivoInicial, escribir, leer, pedirArchivo, pedirDestino } from './archivo'
import { fijarCarpeta } from './contexto'
import * as prefs from './preferencias'
import * as pest from './pestanas'
import type { Pestana } from './pestanas'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWindow } from '@tauri-apps/api/window'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const cajaFuente = $('caja-fuente')
const cajaPresentacion = $('caja-presentacion')
const paneles = $('paneles')
const division = $('division')
const barraPestanas = $('pestanas')
const elEstado = $('estado')
const btGuardar = $<HTMLButtonElement>('guardar')
const btTema = $('tema')
const zonaSoltar = $('soltar')
const velo = $('velo')

let P = prefs.leer()

// El tema se pinta antes de construir el editor para que no haya destello.
prefs.aplicar(P)

// --- pestañas ----------------------------------------------------------------

let abiertas: Pestana[] = []
let activa = -1

const laActiva = (): Pestana | null => abiertas[activa] ?? null

function alEditar() {
  const p = laActiva()
  if (!p || p.sucio) return
  p.sucio = true
  pintar()
}

const par: Par = crearPar(cajaFuente, cajaPresentacion, '', alEditar)

/** Vuelca el estado vivo del editor a la pestaña activa, antes de dejarla. */
function guardarEstadoVivo() {
  const p = laActiva()
  if (!p) return
  const estados = par.capturar()
  p.estadoF = estados.f
  p.estadoP = estados.p
}

function pintarPestanas() {
  const limite = pest.limiteNombre(abiertas.length)
  barraPestanas.replaceChildren(
    ...abiertas.map((p, i) => {
      const caja = document.createElement('div')
      caja.className = 'pestana' + (i === activa ? ' activa' : '')
      caja.title = p.ruta ?? p.nombre
      caja.setAttribute('role', 'tab')
      caja.setAttribute('aria-selected', String(i === activa))

      const punto = document.createElement('span')
      punto.className = 'pest-punto'
      punto.hidden = !p.sucio

      const rot = document.createElement('span')
      rot.className = 'pest-nombre'
      rot.textContent = pest.rotulo(p.nombre, limite)

      const cerrar = document.createElement('button')
      cerrar.className = 'pest-cerrar'
      cerrar.setAttribute('aria-label', `Cerrar ${p.nombre}`)
      cerrar.textContent = '×'
      cerrar.addEventListener('mousedown', (e) => e.stopPropagation())
      cerrar.addEventListener('click', (e) => { e.stopPropagation(); cerrarPestana(i) })

      caja.append(punto, rot, cerrar)
      caja.addEventListener('mousedown', () => activar(i))
      // Botón central del ratón: cerrar, como en cualquier navegador.
      caja.addEventListener('auxclick', (e) => { if (e.button === 1) cerrarPestana(i) })
      return caja
    }),
  )

  const mas = document.createElement('button')
  mas.className = 'pest-mas'
  mas.title = 'Pestaña nueva (Ctrl+T)'
  mas.setAttribute('aria-label', 'Pestaña nueva')
  mas.textContent = '+'
  mas.addEventListener('click', () => nuevaVacia())
  barraPestanas.append(mas)

  barraPestanas.hidden = abiertas.length === 0
  barraPestanas.querySelector('.pestana.activa')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function activar(i: number) {
  if (i === activa || i < 0 || i >= abiertas.length) return
  guardarEstadoVivo()
  activa = i
  const p = abiertas[i]
  fijarCarpeta(p.ruta)
  if (p.estadoF && p.estadoP) par.restaurar(p.estadoF, p.estadoP)
  else par.cargar('')
  par.verNumeros(P.numerosLinea)
  par.fijarSangria(P.sangria)
  pintar()
  par.enfocar()
}

function nuevaVacia() {
  if (abiertas.length >= pest.TOPE) return avisoTope()
  guardarEstadoVivo()
  abiertas.push(pest.crear())
  activa = abiertas.length - 1
  fijarCarpeta(null)
  par.cargar('')
  par.verNumeros(P.numerosLinea)
  par.fijarSangria(P.sangria)
  pintar()
  par.enfocar()
}

function avisoTope() {
  return avisar(
    'Demasiadas pestañas',
    `MarkFlow no abre más de ${pest.TOPE} a la vez. Cada pestaña guarda el ` +
    'documento entero con su historia de deshacer, y pasado ese punto el ' +
    'programa empieza a pesar más de lo que ayuda. Cierra alguna y vuelve a ' +
    'intentarlo.',
  )
}

async function cerrarPestana(i: number) {
  const p = abiertas[i]
  if (!p) return
  if (p.sucio && !p.soloLectura) {
    if (i !== activa) activar(i)
    if (!(await permisoParaDescartar())) return
  }
  abiertas.splice(i, 1)
  if (abiertas.length === 0) {
    // Nunca se queda sin ninguna: se abre una en blanco.
    activa = -1
    nuevaVacia()
    return
  }
  const destino = Math.min(i, abiertas.length - 1)
  activa = -1          // fuerza que `activar` haga el trabajo
  activar(destino)
}

// --- estado del documento ----------------------------------------------------

let guardando = false

function pintar(mensaje?: string, fallo = false) {
  const p = laActiva()
  btGuardar.disabled = !p || !p.sucio || p.soloLectura || guardando
  document.title = p
    ? (p.sucio ? '• ' : '') + `${p.nombre} — MarkFlow`
    : 'MarkFlow'

  if (mensaje !== undefined) {
    elEstado.textContent = mensaje
    elEstado.hidden = false
    elEstado.classList.toggle('fallo', fallo)
  } else {
    // El estado normal ya no se escribe: lo dicen el botón Guardar y el punto
    // de la pestaña. Aquí sólo quedan los avisos de que algo salió mal.
    elEstado.hidden = true
    elEstado.textContent = ''
    elEstado.classList.remove('fallo')
  }
  pintarPestanas()
}

/** Vuelca a la vista todo lo que depende de las preferencias. */
function aplicarTodo() {
  prefs.aplicar(P)
  par.verNumeros(P.numerosLinea)
  par.fijarSangria(P.sangria)
  par.activarEco(P.eco)
  btTema.classList.toggle('tema-oscuro', prefs.oscuroActivo(P))
  const rot = P.tema === 'sistema' ? 'Tema: sigue a Windows'
    : P.tema === 'claro' ? 'Tema: claro' : 'Tema: oscuro'
  btTema.title = rot
  $('tema-texto').textContent = P.tema === 'sistema' ? 'Tema' : rot.replace('Tema: ', 'Tema ')
  // Los diagramas llevan el tema dentro: hay que pedirles que se redibujen.
  par.presentacion.dispatch({ effects: refrescarPresentacion.of(null) })
}

const recordar = () => prefs.guardar(P)

// --- diálogo -----------------------------------------------------------------

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

function preguntarQueHacer(nombre: string): Promise<Salida> {
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

/** true = se puede continuar con la pestaña activa (cerrarla o dejarla). */
async function permisoParaDescartar(): Promise<boolean> {
  const p = laActiva()
  if (!p || !p.sucio || p.soloLectura) return true
  const r = await preguntarQueHacer(p.nombre)
  if (r === 'cancelar') return false
  if (r === 'descartar') return true
  return await guardar()
}

// --- guardar / abrir ---------------------------------------------------------

async function guardar(): Promise<boolean> {
  const p = laActiva()
  if (!p || guardando || p.soloLectura) return false
  if (!p.sucio) return true
  if (!p.ruta) {
    const destino = await pedirDestino(p.nombre.endsWith('.md') ? p.nombre : 'sin-titulo.md')
    if (!destino) return false
    p.ruta = destino
    p.nombre = destino.split(/[\\/]/).pop() ?? destino
    fijarCarpeta(destino)
  }
  guardando = true
  pintar()
  try {
    await escribir(p.ruta, par.texto(), p.finDeLinea)
    p.sucio = false
    guardando = false
    P.ultimoArchivo = p.ruta
    recordar()
    pintar()
    return true
  } catch (e) {
    guardando = false
    pintar('No se guardó', true)
    // Un guardado fallido NO puede pasar desapercibido: si sólo se avisa con
    // texto chico en la barra, el usuario cree que su trabajo está a salvo.
    // Pasó de verdad el 2026-09-16 con el Acceso controlado a carpetas de
    // Windows, que bloqueó la escritura sin que el programa lo gritara.
    await avisar(
      'No se pudo guardar',
      `«${p.nombre}» sigue con los cambios sin guardar. El texto no se ha ` +
      'perdido: está en la ventana. Guárdalo en otra carpeta o resuelve lo de ' +
      'abajo y vuelve a intentarlo.',
      String(e),
    )
    return false
  }
}

async function abrirRuta(destino: string) {
  // Si ya está abierto, no se duplica: se va a su pestaña.
  const ya = pest.buscarPorRuta(abiertas, destino)
  if (ya >= 0) { activar(ya); return }
  if (abiertas.length >= pest.TOPE) return avisoTope()

  try {
    const doc = await leer(destino)
    guardarEstadoVivo()

    // Una pestaña en blanco y sin tocar se reaprovecha en vez de sumar otra.
    const p = laActiva()
    const reusar = p && !p.ruta && !p.sucio && abiertas.length > 0
    const nueva = pest.crear({
      ruta: doc.ruta,
      nombre: doc.nombre,
      finDeLinea: doc.fin_de_linea,
      soloLectura: doc.solo_lectura,
    })
    if (reusar) abiertas[activa] = nueva
    else { abiertas.push(nueva); activa = abiertas.length - 1 }

    fijarCarpeta(doc.ruta)
    par.cargar(doc.texto)
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
  if (destino) await abrirRuta(destino)
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
 * Límites del reparto.
 *
 * La fracción sola no dice nada: un cuarto de 1200 px son 300, donde el
 * markdown se parte cada tres palabras; un cuarto de 2560 son 640, de sobra.
 * Por eso mandan los dos a la vez y gana el más restrictivo. Y al pasarse del
 * mínimo el panel se cierra, en vez de topar contra un muro: si arrastras al
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
    // Pasarse del límite por un margen claro se entiende como «quítame el otro».
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

// --- configuración -----------------------------------------------------------

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
  $('op-ancho-v').textContent = P.ancho > 0 ? `${P.ancho} rem` : 'todo el panel'
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
  else if (k === 't') { e.preventDefault(); nuevaVacia() }
  else if (k === 'w') { e.preventDefault(); cerrarPestana(activa) }
  else if (e.key === 'Tab') {
    e.preventDefault()
    const paso = e.shiftKey ? -1 : 1
    activar((activa + paso + abiertas.length) % abiertas.length)
  }
})

/**
 * Al cerrar la ventana se pregunta por CADA pestaña con cambios, una por una.
 * Cancelar en cualquiera detiene el cierre entero.
 */
getCurrentWindow().onCloseRequested(async (ev) => {
  const pendientes = abiertas.some((p) => p.sucio && !p.soloLectura)
  if (!pendientes) return
  ev.preventDefault()
  for (let i = 0; i < abiertas.length; i++) {
    if (!abiertas[i].sucio || abiertas[i].soloLectura) continue
    activar(i)
    if (!(await permisoParaDescartar())) return
  }
  // `destroy` cierra sin volver a disparar este evento.
  await getCurrentWindow().destroy()
})

// --- arrastrar y soltar ------------------------------------------------------

getCurrentWebview().onDragDropEvent((ev) => {
  if (ev.payload.type === 'over') zonaSoltar.hidden = false
  else if (ev.payload.type === 'leave') zonaSoltar.hidden = true
  else if (ev.payload.type === 'drop') {
    zonaSoltar.hidden = true
    // Varios archivos a la vez: uno por pestaña, en orden.
    const caidos = ev.payload.paths ?? []
    void (async () => { for (const r of caidos) await abrirRuta(r) })()
  }
})

// --- arranque ----------------------------------------------------------------

llenarFuentes()
conectarOpciones()
aplicarTodo()
ponerModo(P.modo, false)
nuevaVacia()

archivoInicial().then((a) => {
  if (a) return abrirRuta(a)
  if (P.reabrir && P.ultimoArchivo) return abrirRuta(P.ultimoArchivo)
})
