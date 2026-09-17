/**
 * Pruebas de frontera: lo que pasa en los extremos.
 *
 * Aquí no se comprueba que las cosas funcionen —— eso lo hacen los otros
 * archivos—— sino que **no reventemos** con entradas que nadie escribiría a
 * mano pero que aparecen: un archivo de una sola línea gigantesca, markdown a
 * medio escribir, marcas sin cerrar, caracteres de otros alfabetos, emoji,
 * texto de derecha a izquierda.
 *
 * El criterio es uno solo: **el programa sigue en pie y el documento no se
 * estropea**. Que la vista quede más o menos bonita en un caso absurdo da
 * igual; que lance una excepción dentro de `toDOM`, no —— eso se lleva el panel
 * entero, y con él la posibilidad de guardar.
 *
 * Lalo las pidió el 2026-09-17. Se corren con `npm run probar`.
 */

const g = globalThis as Record<string, unknown>
g.document ??= { documentElement: { getAttribute: () => 'oscuro' } }
g.matchMedia ??= () => ({ matches: true })

import assert from 'node:assert/strict'
import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { construir } from '../src/livepreview.ts'
import { acotada, formatosActivos, tramoConFormato } from '../src/formato.ts'
import { celdasCon, saneadaParaCelda, destinoSeguro, rutaAbsoluta } from '../src/widgets.ts'
import { rotulo, limiteNombre } from '../src/pestanas.ts'

let hechas = 0
function prueba(nombre: string, fn: () => void) {
  fn()
  hechas++
  console.log('  ok  ' + nombre)
}

function estadoDe(texto: string, conArbol = true) {
  const e = EditorState.create({
    doc: texto,
    selection: { anchor: Math.min(texto.length, texto.length) },
    extensions: [markdown({ base: markdownLanguage })],
  })
  if (conArbol) ensureSyntaxTree(e, Math.min(texto.length, 200_000), 5000)
  return e
}

/** Pasa un texto por todo lo que lo toca. Si algo lanza, la prueba falla. */
function pasarPorTodo(texto: string) {
  const e = estadoDe(texto)
  construir(e)
  const medio = Math.floor(texto.length / 2)
  acotada(e, Math.max(0, medio - 10), Math.min(texto.length, medio + 10))
  formatosActivos(e, Math.max(0, medio - 5), Math.min(texto.length, medio + 5))
  for (const linea of texto.split('\n').slice(0, 40)) {
    celdasCon(linea)
    saneadaParaCelda(linea)
  }
}

console.log('\nFrontera — lo que pasa en los extremos\n')

// --- documentos imposibles -------------------------------------------------- //

prueba('el documento vacio no rompe nada', () => {
  pasarPorTodo('')
  const e = estadoDe('')
  assert.equal(construir(e).size, 0)
  assert.deepEqual(acotada(e, 0, 0), { desde: 0, hasta: 0 })
  assert.deepEqual([...formatosActivos(e, 0, 0)], [])
})

prueba('un documento de un solo caracter', () => {
  for (const c of ['#', '*', '=', '|', '~', '$', '\n', ' ', 'a', 'á', '😀']) {
    pasarPorTodo(c)
  }
})

prueba('una sola linea larguisima', () => {
  // Un .md exportado de otra herramienta puede venir sin saltos de linea.
  const linea = 'palabra '.repeat(30_000)          // ~240 KB en una linea
  const arranque = Date.now()
  pasarPorTodo(linea)
  const tardo = Date.now() - arranque
  assert.ok(tardo < 8000, `tardo ${tardo} ms en una linea de 240 KB`)
})

prueba('muchisimas lineas vacias', () => {
  pasarPorTodo('\n'.repeat(50_000))
})

// --- markdown a medio escribir ---------------------------------------------- //

prueba('marcas sin cerrar, en todas las combinaciones', () => {
  for (const caso of [
    '**negrita sin cerrar',
    '*cursiva sin cerrar',
    '~~tachado sin cerrar',
    '==resaltado sin cerrar',
    '***',
    '****',
    '*****',
    '==',
    '===',
    '====',
    '~~~~',
    '`codigo sin cerrar',
    '```cerca sin cerrar',
    '$formula sin cerrar',
    '$$bloque sin cerrar',
    '[enlace sin cerrar](',
    '![imagen sin cerrar](',
    '[^nota sin cerrar',
    '> cita\n> sin\n> fin',
    '| tabla | sin |\n| delimitador |',
    '|---|---|',              // delimitador huerfano
    '---',                    // regla o frontmatter a medias
    '---\nsolo: abre\n',      // frontmatter sin cerrar
  ]) {
    pasarPorTodo(caso)
  }
})

prueba('marcas anidadas hasta lo absurdo', () => {
  pasarPorTodo('*'.repeat(200) + 'texto' + '*'.repeat(200))
  pasarPorTodo('**'.repeat(100) + 'x' + '**'.repeat(100))
  pasarPorTodo('=='.repeat(100) + 'x' + '=='.repeat(100))
  pasarPorTodo('> '.repeat(200) + 'cita muy anidada')
  pasarPorTodo('#'.repeat(50) + ' titulo con demasiadas almohadillas')
})

prueba('una tabla degenerada no descuadra ni revienta', () => {
  for (const caso of [
    '|',
    '||',
    '|'.repeat(500),
    '| a |\n|---|\n' + '| x |\n'.repeat(2000),   // 2000 filas
    '| ' + 'col | '.repeat(200) + '\n|' + '---|'.repeat(200),  // 200 columnas
    '| \\| | \\\\| | \\\\\\| |',                  // barras escapadas raras
  ]) {
    pasarPorTodo(caso)
    for (const l of caso.split('\n')) {
      const cs = celdasCon(l)
      for (const c of cs) {
        assert.ok(c.desde <= c.hasta, 'una celda al reves')
        assert.ok(c.desde >= 0 && c.hasta <= l.length, 'una celda fuera de la linea')
      }
    }
  }
})

// --- alfabetos, emoji y direccion ------------------------------------------- //

prueba('acentos, alfabetos y emoji no descuadran las posiciones', () => {
  for (const texto of [
    '# Título con acentos: ñ á é í ó ú ü Ñ Á',
    '# Заголовок на русском',
    '# 中文标题也可以',
    '# عنوان بالعربية',                  // de derecha a izquierda
    '# Τίτλος στα ελληνικά',
    'emoji **en negrita** 🚀 y *cursiva* 😀 y ==resaltado== 🎯',
    'familia 👨‍👩‍👧‍👦 con marca de unión',   // grafema de varios puntos
    'bandera 🇲🇽 de dos puntos',
    'á con tilde combinante',
  ]) {
    pasarPorTodo(texto)
    // Y lo que importa: que el recorte no parta un carácter.
    const e = estadoDe(texto)
    const { desde, hasta } = acotada(e, 0, texto.length)
    assert.ok(desde >= 0 && hasta <= texto.length)
    assert.ok(desde <= hasta)
  }
})

prueba('el recorte de la seleccion nunca sale del documento', () => {
  const texto = '  hola  '
  const e = estadoDe(texto)
  // Se le pasan crudos, incluso al reves y fuera del documento: `acotada`
  // tiene que ordenarlos y meterlos dentro ella misma.
  for (const [a, b] of [[0, 0], [0, 8], [8, 8], [3, 3], [-5, 99], [7, 2], [99, -5]] as const) {
    const { desde, hasta } = acotada(e, a, b)
    assert.ok(desde >= 0, `desde negativo con (${a},${b})`)
    assert.ok(hasta <= texto.length, `hasta fuera con (${a},${b})`)
    assert.ok(desde <= hasta, `al reves con (${a},${b})`)
  }
})

// --- lo que escribe en el documento ---------------------------------------- //

prueba('lo saneado para una celda nunca puede partir una tabla', () => {
  for (const hostil of [
    '|', '||', '\\|', '\\\\|', '|||||',
    'a\nb', 'a\r\nb', 'a b', 'a b',
    '\t\t\t', '     ',
    '*'.repeat(100),
    '🚀|🚀',
    '',
  ]) {
    const celda = saneadaParaCelda(hostil)
    assert.ok(!/\n|\r/.test(celda), `quedo un salto: ${JSON.stringify(celda)}`)
    // Una barra sin escapar abriria una columna.
    assert.ok(
      !/(^|[^\\])\|/.test(celda),
      `quedo una barra sin escapar: ${JSON.stringify(celda)}`,
    )
    // Y al releerla, sigue siendo una sola celda.
    assert.equal(celdasCon(`| ${celda} | z |`).length, 2, JSON.stringify(hostil))
  }
})

prueba('detectar formato con posiciones en los bordes no lanza', () => {
  const doc = '**negrita** y *cursiva*'
  const e = estadoDe(doc)
  for (let i = 0; i <= doc.length; i++) {
    for (const f of ['negrita', 'cursiva', 'tachado', 'resaltar'] as const) {
      assert.doesNotThrow(() => tramoConFormato(e, i, Math.min(i + 1, doc.length), f),
        `lanzo en la posicion ${i} con ${f}`)
    }
  }
})

// --- rutas y destinos hostiles ---------------------------------------------- //

prueba('destinos y rutas raras no lanzan ni pasan colandose', () => {
  for (const url of [
    '', ' ', '\n', '\t', ' ',
    'a'.repeat(5000),
    'http://' + 'a'.repeat(3000),
    'javascript:'.repeat(50) + 'alert(1)',
    'HtTpS://ejemplo.com',
    '//' + 'a'.repeat(500),
    'data:'.repeat(100),
    '\\\\servidor\\' + 'x'.repeat(500),
  ]) {
    assert.doesNotThrow(() => destinoSeguro(url), JSON.stringify(url.slice(0, 30)))
    assert.doesNotThrow(() => rutaAbsoluta(url), JSON.stringify(url.slice(0, 30)))
    const d = destinoSeguro(url)
    if (d !== null) {
      assert.ok(!/^\s*javascript:/i.test(d), 'se colo un javascript:')
      assert.ok(!/^\s*data:/i.test(d), 'se colo un data:')
    }
  }
})

// --- nombres de pestaña ----------------------------------------------------- //

prueba('el rotulo de una pestana aguanta cualquier nombre', () => {
  for (const nombre of [
    '', ' ', '.md', '.'.repeat(50),
    'a'.repeat(500) + '.md',
    'sin extension',
    'nombre.con.muchos.puntos.md',
    '🚀 con emoji 🎯.md',
    'Заголовок.md',
    'ácento-combinante.md',
  ]) {
    for (const n of [1, 3, 8, 17, 30]) {
      const limite = limiteNombre(n)
      const r = rotulo(nombre, limite)
      assert.ok(r.length <= limite || nombre.length <= limite,
        `«${r}» pasa del limite ${limite}`)
    }
  }
})

// --- el tope de la vista ---------------------------------------------------- //

prueba('por encima del tope se apaga la vista, sin pensarlo', () => {
  const enorme = 'texto con **marcas** y | tablas |\n'.repeat(70_000)
  assert.ok(enorme.length > 2 * 1024 * 1024)
  const e = EditorState.create({ doc: enorme })
  const arranque = Date.now()
  const set = construir(e)
  const tardo = Date.now() - arranque
  assert.equal(set.size, 0)
  assert.ok(tardo < 100, `tardo ${tardo} ms: el tope tiene que cortar de inmediato`)
})

console.log(`\n${hechas} pruebas, todas pasan.\n`)
