/**
 * Las preferencias: que sobrevivan al cierre y que un valor imposible no deje
 * el programa sin arrancar.
 *
 * **Por qué existe este archivo.** Lalo pidió el 2026-09-17 que la elección de
 * panel —— *Fuente*, *Ambos* o *Vista*— persista: si cierras una nota en Vista,
 * la que abras mañana abre en Vista. Ya funcionaba, así que aquí no se arregla
 * nada: se **fija**, para que nadie lo rompa sin que salte algo.
 *
 * La otra mitad viene de la auditoría del 2026-09-16, donde un valor de
 * `profundidad` fuera de los tres esperados **mataba el arranque en todos los
 * arranques**, sin nada en la interfaz para deshacerlo.
 */

// Lo mínimo de navegador: un `localStorage` de mentira y el <html> que `aplicar`
// necesita. Se pone antes de los imports porque los módulos se evalúan al
// importarse.
const g = globalThis as Record<string, unknown>
const almacen = new Map<string, string>()
g.localStorage ??= {
  getItem: (k: string) => almacen.get(k) ?? null,
  setItem: (k: string, v: string) => { almacen.set(k, String(v)) },
  removeItem: (k: string) => { almacen.delete(k) },
  clear: () => { almacen.clear() },
}

import assert from 'node:assert/strict'
import { leer, guardar, DE_FABRICA, type Preferencias } from '../src/preferencias.ts'

let hechas = 0
function prueba(nombre: string, fn: () => void) {
  fn()
  hechas++
  console.log('  ok  ' + nombre)
}

const CLAVE = 'markflow.preferencias'
const limpiar = () => almacen.clear()
/** Escribe en el almacén lo que escribiría una versión vieja, o alguien a mano. */
const plantar = (obj: unknown) => almacen.set(CLAVE, JSON.stringify(obj))

console.log('\nPreferencias — lo que sobrevive al cierre\n')

prueba('sin nada guardado se arranca de fabrica', () => {
  limpiar()
  assert.deepEqual(leer(), DE_FABRICA)
})

prueba('el modo de panel sobrevive al cierre', () => {
  // Esto es lo que pidio Lalo: cierras en Vista, mañana abres en Vista.
  limpiar()
  for (const modo of ['fuente', 'ambos', 'presentacion'] as const) {
    guardar({ ...DE_FABRICA, modo })
    assert.equal(leer().modo, modo, `se perdio el modo ${modo}`)
  }
})

prueba('el reparto del divisor y el tema tambien sobreviven', () => {
  limpiar()
  guardar({ ...DE_FABRICA, division: 0.37, tema: 'oscuro', tamano: 19 })
  const p = leer()
  assert.equal(p.division, 0.37)
  assert.equal(p.tema, 'oscuro')
  assert.equal(p.tamano, 19)
})

prueba('una version vieja no deja campos sin definir', () => {
  // Un ajuste guardado antes de que existieran `modo` o `division`.
  limpiar()
  plantar({ tema: 'claro', tamano: 17 })
  const p = leer()
  assert.equal(p.tema, 'claro', 'lo que si estaba se respeta')
  assert.equal(p.modo, DE_FABRICA.modo, 'lo que falta sale de fabrica')
  assert.equal(p.division, DE_FABRICA.division)
})

prueba('un modo imposible cae en el de fabrica y no rompe nada', () => {
  limpiar()
  plantar({ ...DE_FABRICA, modo: 'pantalla-completa' })
  assert.equal(leer().modo, DE_FABRICA.modo)
})

prueba('un valor imposible nunca deja el programa sin arrancar', () => {
  // El fallo de la auditoria: `profundidad` fuera de los tres esperados dejaba
  // un `undefined` que mataba el arranque -- todos los arranques, para siempre.
  for (const veneno of [
    { profundidad: 'ultraoscuro' },
    { profundidad: null },
    { tema: 42 },
    { sangria: -5 },
    { sangria: '9999' },
    { tamano: Number.NaN },
    { tamano: Infinity },
    { division: -3 },
    { division: 'mitad' },
    { interlineado: 0 },
    { fuenteTexto: 'Comic Sans que no existe' },
    { numerosLinea: 'si' },
    { ultimoArchivo: 12345 },
  ]) {
    limpiar()
    plantar({ ...DE_FABRICA, ...veneno })
    const p = leer()
    assert.ok(['suave', 'normal', 'profundo'].includes(p.profundidad), String(veneno))
    assert.ok(['sistema', 'claro', 'oscuro'].includes(p.tema), String(veneno))
    assert.ok(['2', '4', 'tab'].includes(p.sangria), String(veneno))
    assert.ok(Number.isFinite(p.tamano) && p.tamano >= 8, String(veneno))
    assert.ok(p.division >= 0.05 && p.division <= 0.95, String(veneno))
    assert.ok(p.interlineado >= 1, String(veneno))
    assert.equal(typeof p.numerosLinea, 'boolean', String(veneno))
    assert.ok(p.ultimoArchivo === null || typeof p.ultimoArchivo === 'string')
  }
})

prueba('un almacen corrupto no tumba la lectura', () => {
  for (const basura of ['{', 'null', '[]', '"texto suelto"', '', 'undefined']) {
    limpiar()
    almacen.set(CLAVE, basura)
    const p = leer() as Preferencias
    assert.equal(typeof p.modo, 'string', `reventó con: ${JSON.stringify(basura)}`)
  }
})

prueba('las imagenes de internet siguen apagadas de fabrica', () => {
  // Es una decision de seguridad, no un ajuste de gusto: que no se cambie sin
  // que salte algo.
  assert.equal(DE_FABRICA.imagenesRemotas, false)
})

console.log(`\n${hechas} pruebas, todas pasan.\n`)
