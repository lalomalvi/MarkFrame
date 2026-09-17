/**
 * Pruebas de frontera de las pestañas.
 *
 * Se corren con `npm run probar`. Node ejecuta el TypeScript directamente
 * quitando los tipos, sin compilar nada: `pestanas.ts` sólo tiene imports de
 * tipo, así que se puede cargar aislado del resto del programa.
 */

import assert from 'node:assert/strict'
import { crear, limiteNombre, rotulo, buscarPorRuta, TOPE } from '../src/pestanas.ts'

let hechas = 0
function prueba(nombre: string, fn: () => void) {
  fn()
  hechas++
  console.log('  ok  ' + nombre)
}

console.log('\nPestañas — pruebas de frontera\n')

prueba('el rótulo no supera nunca el límite pedido', () => {
  const casos = ['a', 'nota.md', 'x'.repeat(300) + '.md', '', 'sin-extension',
                 'muchos.puntos.en.el.nombre.md', '.md', 'ñandú-acentuación.md']
  for (const n of casos) {
    for (const lim of [6, 9, 12, 18, 26]) {
      const r = rotulo(n, lim)
      assert.ok(r.length <= Math.max(lim, 1),
        `«${n.slice(0, 20)}…» con límite ${lim} dio ${r.length} caracteres`)
    }
  }
})

prueba('un nombre que cabe no se toca', () => {
  assert.equal(rotulo('nota.md', 26), 'nota.md')
  assert.equal(rotulo('', 10), '')
})

prueba('al recortar se conserva la extensión si cabe', () => {
  const r = rotulo('un-nombre-larguisimo-de-verdad.md', 18)
  assert.ok(r.endsWith('.md'), `no conservó la extensión: ${r}`)
  assert.ok(r.includes('…'))
})

prueba('una extensión desmesurada no rompe el recorte', () => {
  // `.esto-no-es-una-extension` mide más que el límite entero.
  const r = rotulo('archivo.esto-no-es-una-extension', 9)
  assert.ok(r.length <= 9, `dio ${r.length}`)
})

prueba('el límite baja al crecer las pestañas y nunca cae de 6', () => {
  let previo = Infinity
  for (const n of [1, 3, 4, 6, 7, 10, 11, 16, 17, 30, 500]) {
    const l = limiteNombre(n)
    assert.ok(l <= previo, `el límite subió de ${previo} a ${l} con ${n} pestañas`)
    assert.ok(l >= 6, `límite demasiado corto (${l}) con ${n} pestañas`)
    previo = l
  }
})

prueba('buscar por ruta ignora mayúsculas y el tipo de barra', () => {
  const lista = [
    crear({ ruta: 'C:\\Users\\Lalo\\Notas\\uno.md', nombre: 'uno.md' }),
    crear({ ruta: null, nombre: 'Sin título' }),
    crear({ ruta: 'D:\\obra\\dos.md', nombre: 'dos.md' }),
  ]
  assert.equal(buscarPorRuta(lista, 'C:/Users/Lalo/Notas/uno.md'), 0)
  assert.equal(buscarPorRuta(lista, 'c:\\users\\lalo\\notas\\UNO.MD'), 0)
  assert.equal(buscarPorRuta(lista, 'D:\\obra\\dos.md'), 2)
  assert.equal(buscarPorRuta(lista, 'C:\\otra\\cosa.md'), -1)
})

prueba('una pestaña sin ruta nunca se confunde con otra', () => {
  const lista = [crear(), crear(), crear()]
  assert.equal(buscarPorRuta(lista, 'C:\\lo-que-sea.md'), -1)
})

prueba('cada pestaña nace con un identificador propio', () => {
  const ids = new Set(Array.from({ length: 200 }, () => crear().id))
  assert.equal(ids.size, 200)
})

prueba('el tope es un número de trabajo, no simbólico', () => {
  assert.ok(TOPE >= 10 && TOPE <= 100, `tope fuera de lo razonable: ${TOPE}`)
})

console.log(`\n${hechas} pruebas, todas pasan.\n`)
