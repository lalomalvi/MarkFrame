/**
 * Todo `id` que el código busca tiene que existir en el HTML.
 *
 * Esta prueba existe por un fallo real del 2026-09-16: `main.ts` pedía
 * `$('titulo')` y ese `<header>` sólo tenía la CLASE `titulo`, no el id.
 * `getElementById` devolvió `null`, el `addEventListener` reventó, y como eso
 * pasa en el cuerpo del módulo, **cortó el arranque entero**: el editor quedó
 * vacío y las pestañas no se pintaron nunca.
 *
 * TypeScript no puede avisar de esto, porque `$` afirma el tipo con un `as`.
 * Por eso se comprueba aquí.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const html = readFileSync(join(raiz, 'index.html'), 'utf8')

const enElHtml = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))

let hechas = 0
function prueba(nombre: string, fn: () => void) {
  fn()
  hechas++
  console.log('  ok  ' + nombre)
}

console.log('\nIdentificadores — el HTML y el código de acuerdo\n')

for (const archivo of ['src/main.ts', 'src/preferencias.ts']) {
  const codigo = readFileSync(join(raiz, archivo), 'utf8')
  const pedidos = new Set(
    [...codigo.matchAll(/\$(?:<[^>]+>)?\('([^']+)'\)/g)].map((m) => m[1]),
  )
  prueba(`${archivo} no pide ningún id inexistente`, () => {
    const faltan = [...pedidos].filter((id) => !enElHtml.has(id))
    assert.deepEqual(faltan, [],
      `${archivo} busca ids que el HTML no tiene: ${faltan.join(', ')}`)
  })
}

prueba('los ids del HTML no se repiten', () => {
  const todos = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1])
  const vistos = new Set<string>()
  const repes = todos.filter((id) => (vistos.has(id) ? true : (vistos.add(id), false)))
  assert.deepEqual(repes, [], `ids repetidos: ${repes.join(', ')}`)
})

prueba('los elementos que el arranque necesita están presentes', () => {
  // Si falta uno de estos, el programa no llega ni a pintar.
  const imprescindibles = [
    'titulo', 'pestanas', 'paneles', 'division',
    'caja-fuente', 'caja-presentacion',
    'abrir', 'guardar', 'deshacer', 'rehacer',
    'v-fuente', 'v-ambos', 'v-presentacion',
    'tema', 'opciones', 'panel-op', 'velo-op', 'velo',
    'win-min', 'win-max', 'win-cerrar',
  ]
  const faltan = imprescindibles.filter((id) => !enElHtml.has(id))
  assert.deepEqual(faltan, [], `faltan en el HTML: ${faltan.join(', ')}`)
})

console.log(`\n${hechas} pruebas, todas pasan.\n`)
