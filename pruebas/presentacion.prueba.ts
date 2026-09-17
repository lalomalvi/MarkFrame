/**
 * Pruebas del panel de presentación, sin abrir una ventana.
 *
 * **Por qué existe este archivo.** El 2026-09-16, una pasada manual encontró
 * que el botón *Mostrarla* de las imágenes de internet no hacía nada, y llevaba
 * roto desde que existe. Ninguna prueba podía verlo: las 13 que había cubrían
 * las pestañas y los `id` del HTML, y de los widgets y las decoraciones no
 * había una sola. Justo donde está la lógica difícil.
 *
 * `construir()` toma un `EditorState` y devuelve decoraciones. Eso es puro y
 * corre en Node: `toDOM` no se llama, así que no hace falta navegador.
 *
 * Aquí se fija sobre todo **lo que la auditoría cerró**, para que nadie lo
 * reabra sin que salte algo.
 */

// Lo minimo de navegador que `construir()` toca: al crear un widget de Mermaid
// pregunta el tema con `esOscuro()`, que lee un atributo del <html> y, si no
// esta, consulta a Windows. No se finge un navegador -- se dan esas dos cosas y
// ya. Va antes de los imports porque los modulos se evaluan al importarse.
const g = globalThis as Record<string, unknown>
g.document ??= { documentElement: { getAttribute: () => 'oscuro' } }
g.matchMedia ??= () => ({ matches: true })

import assert from 'node:assert/strict'
import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { construir } from '../src/livepreview.ts'
import { destinoSeguro, rutaAbsoluta, permitirRemotas, olvidarPermisosSueltos,
         celdasCon, saneadaParaCelda,
         WidgetImagen, WidgetTabla } from '../src/widgets.ts'

let hechas = 0
function prueba(nombre: string, fn: () => void) {
  fn()
  hechas++
  console.log('  ok  ' + nombre)
}

/** Qué widgets salen de un documento, por su nombre de clase. */
function widgetsDe(texto: string): { nombre: string; desde: number; hasta: number; w: unknown }[] {
  // El mismo lenguaje que monta el editor de verdad: sin el no hay arbol
  // sintactico, y las tablas, las cercas y las casillas se detectan por ahi.
  const estado = EditorState.create({
    doc: texto,
    // El cursor se manda al final a proposito. Un bloque que el cursor toca se
    // muestra CRUDO -- es la edicion «inside», no un fallo-- y un estado
    // recien creado pone el cursor en 0, o sea dentro del primer bloque. Sin
    // esto, ninguna prueba veria nunca decorado el primer bloque.
    selection: { anchor: texto.length },
    extensions: [markdown({ base: markdownLanguage })],
  })
  // El analisis es perezoso. Se fuerza con un presupuesto amplio para que la
  // prueba no dependa de cuanto alcanzo a analizar por su cuenta.
  ensureSyntaxTree(estado, texto.length, 5000)
  const set = construir(estado)
  const salida: { nombre: string; desde: number; hasta: number; w: unknown }[] = []
  const iter = set.iter()
  while (iter.value) {
    const spec = iter.value.spec as { widget?: { constructor: { name: string } } }
    if (spec.widget) {
      salida.push({
        nombre: spec.widget.constructor.name,
        desde: iter.from,
        hasta: iter.to,
        w: spec.widget,
      })
    }
    iter.next()
  }
  return salida
}

const nombres = (texto: string) => widgetsDe(texto).map((d) => d.nombre)

console.log('\nPresentación — qué se decora y qué no\n')

// --- lo que la auditoría cerró ---------------------------------------------- //

prueba('solo http, https y mailto sobreviven como enlace', () => {
  assert.equal(destinoSeguro('https://ejemplo.com'), 'https://ejemplo.com')
  assert.equal(destinoSeguro('http://ejemplo.com'), 'http://ejemplo.com')
  assert.equal(destinoSeguro('mailto:a@b.c'), 'mailto:a@b.c')
  assert.equal(destinoSeguro('#ancla'), '#ancla')
  assert.equal(destinoSeguro('otra.md'), 'otra.md')
})

prueba('el esquema javascript se rechaza, venga como venga', () => {
  // El hallazgo crítico de la auditoría, que se confirmó ejecutándolo.
  for (const malo of [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'java\tscript:alert(1)',   // el navegador ignora el tabulador al resolver
    'java\nscript:alert(1)',
    ' javascript:alert(1)',
    'jav\u0000ascript:alert(1)',
    'vbscript:msgbox(1)',
    'data:text/html,<h1>x</h1>',
    'file:///C:/Windows/System32',
  ]) {
    assert.equal(destinoSeguro(malo), null, `deberia rechazar: ${JSON.stringify(malo)}`)
  }
})

prueba('las dos barras del principio se rechazan', () => {
  // `//servidor/x` es «el mismo esquema, otro servidor»: sale a la red.
  assert.equal(destinoSeguro('//evil.example/x'), null)
  assert.equal(destinoSeguro('///evil.example/x'), null)
})

prueba('una ruta UNC nunca se resuelve como imagen', () => {
  // El hallazgo alto: `\\servidor\pub\x.png` abria sesion SMB contra el
  // servidor del atacante con solo abrir el .md, y revelaba una respuesta
  // NTLMv2. Chromium normaliza las barras, asi que se prueban las dos formas.
  assert.equal(rutaAbsoluta('\\\\servidor\\pub\\x.png'), null)
  assert.equal(rutaAbsoluta('//servidor/pub/x.png'), null)
  assert.equal(rutaAbsoluta('\\/servidor/pub/x.png'), null)
})

prueba('un nombre de archivo con % no tumba la resolucion', () => {
  // `descuento-50%.png` es legal en Windows y hacia lanzar a `decodeURI`
  // dentro de `toDOM`, que CodeMirror llama sin proteccion.
  assert.doesNotThrow(() => rutaAbsoluta('descuento-50%.png'))
  assert.doesNotThrow(() => rutaAbsoluta('%%%.png'))
  assert.doesNotThrow(() => rutaAbsoluta('a%ZZ.png'))
})

// --- el fallo del boton, que ninguna prueba veia ---------------------------- //

prueba('el permiso de una imagen remota entra en eq()', () => {
  // ESTE es el fallo del 2026-09-16. CodeMirror reutiliza el DOM cuando eq()
  // dice que el widget nuevo es igual al viejo: si el permiso no entra en la
  // comparacion, conceder el permiso no repinta nada y el boton no hace nada.
  const url = 'https://ejemplo.com/foto.png'

  permitirRemotas(false)
  olvidarPermisosSueltos()
  const bloqueado = new WidgetImagen(url, 'alt', 0)
  assert.equal(bloqueado.bloqueada, true, 'de fabrica, una remota nace bloqueada')

  permitirRemotas(true)
  const permitido = new WidgetImagen(url, 'alt', 0)
  assert.equal(permitido.bloqueada, false)

  assert.equal(
    bloqueado.eq(permitido),
    false,
    'si eq() los da por iguales, CodeMirror deja la caja bloqueada en pantalla',
  )

  permitirRemotas(false)
  olvidarPermisosSueltos()
})

prueba('una imagen local nunca nace bloqueada', () => {
  permitirRemotas(false)
  const w = new WidgetImagen('foto.png', 'alt', 0)
  assert.equal(w.bloqueada, false)
})

// --- qué decora cada cosa --------------------------------------------------- //

prueba('una tabla se dibuja como tabla', () => {
  const d = widgetsDe('| a | b |\n|---|---|\n| 1 | 2 |\n')
  assert.deepEqual(d.map((x) => x.nombre), ['WidgetTabla'])
})

prueba('una cerca de mermaid se dibuja, una de rust no', () => {
  assert.deepEqual(nombres('```mermaid\ngraph TD\nA-->B\n```\n'), ['WidgetMermaid'])
  assert.deepEqual(nombres('```rust\nfn main() {}\n```\n'), [])
})

prueba('el idioma de la cerca se compara sin mayusculas', () => {
  assert.deepEqual(nombres('```MERMAID\ngraph TD\nA-->B\n```\n'), ['WidgetMermaid'])
})

prueba('las formulas se dibujan en linea y en bloque', () => {
  assert.deepEqual(nombres('$$\nx = 1\n$$\n'), ['WidgetMate'])
  assert.deepEqual(nombres('vale $x = 1$ y ya\n'), ['WidgetMate'])
})

prueba('las casillas de tarea se dibujan, marcadas o no', () => {
  assert.deepEqual(nombres('- [ ] una\n'), ['WidgetCasilla'])
  assert.deepEqual(nombres('- [x] otra\n'), ['WidgetCasilla'])
  // Una lista normal no lleva casilla.
  assert.deepEqual(nombres('- una\n'), [])
})

prueba('una imagen se dibuja y un enlace normal no', () => {
  assert.deepEqual(nombres('![alt](foto.png)\n'), ['WidgetImagen'])
  assert.deepEqual(nombres('[texto](https://ejemplo.com)\n'), [])
})

// --- lo que NO debe pasar nunca --------------------------------------------- //

prueba('las decoraciones nunca salen del documento', () => {
  const texto = '| a | b |\n|---|---|\n| 1 | 2 |\n\n$$\ny = 2\n$$\n\n- [x] hecho\n'
  const estado = EditorState.create({
    doc: texto,
    selection: { anchor: texto.length },
    extensions: [markdown({ base: markdownLanguage })],
  })
  ensureSyntaxTree(estado, texto.length, 5000)
  const set = construir(estado)
  const iter = set.iter()
  while (iter.value) {
    assert.ok(iter.from >= 0, 'una decoracion empieza antes del documento')
    assert.ok(iter.to <= texto.length, 'una decoracion termina despues del documento')
    assert.ok(iter.from <= iter.to, 'una decoracion va al reves')
    iter.next()
  }
})

prueba('un documento enorme apaga la vista en vez de colgarse', () => {
  // TOPE_VISTA: la red de seguridad que puso la auditoria. Sin ella, una
  // expresion mal escrita cuelga el hilo de interfaz -- y como la barra de
  // titulo es HTML, deja una ventana que no se puede cerrar.
  const enorme = '| a | b |\n|---|---|\n| 1 | 2 |\n'.repeat(90_000)
  assert.ok(enorme.length > 2 * 1024 * 1024, 'la prueba tiene que pasarse del tope')

  // Aqui se mide `construir` a solas, sin el analisis sintactico. No es por
  // hacerlo facil: el tope corta ANTES de mirar el arbol, asi que el estado ni
  // siquiera necesita lenguaje. Cronometrar el analisis de 2.4 MB mediria la
  // velocidad de la maquina, y esta prueba iria fallando sola segun el dia.
  const estado = EditorState.create({ doc: enorme })
  const arranque = Date.now()
  const set = construir(estado)
  const tardo = Date.now() - arranque

  assert.equal(set.size, 0, 'por encima del tope no se decora nada')
  assert.ok(tardo < 100, `se rindio en ${tardo} ms: el tope tiene que cortar de inmediato`)
})

prueba('las expresiones acotadas no se disparan con entradas hostiles', () => {
  // Las dos de coste cuadratico que encontro la auditoria, y la tercera que
  // aparecio de paso. Medido entonces: 5x10^11 pasos con 1 MB.
  for (const [nombre, texto] of [
    ['notas al pie', '[^'.repeat(40_000)],
    ['cercas de mermaid', '~'.repeat(40_000)],
    ['formulas en linea', '$'.repeat(40_000)],
  ] as const) {
    const arranque = Date.now()
    widgetsDe(texto)
    const tardo = Date.now() - arranque
    assert.ok(tardo < 3000, `${nombre}: tardo ${tardo} ms, huele a coste cuadratico`)
  }
})

prueba('una tabla torcida no revienta ni decora de mas', () => {
  for (const caso of [
    '|\n',
    '||||\n',
    '| a |\n',
    '| a | b |\n',                      // sin delimitador: no es tabla
    '| a | b |\n|---|\n| 1 |\n',        // columnas desparejas
    '| a \\| b | c |\n|---|---|\n| 1 | 2 |\n',
  ]) {
    assert.doesNotThrow(() => widgetsDe(caso), `revento con: ${JSON.stringify(caso)}`)
  }
})

// --- tablas editables ------------------------------------------------------- //
//
// Lo que se prueba aquí es la mitad que puede romper el documento: **dónde cree
// cada celda que vive**. Si esos dos números están mal, confirmar una edición
// escribe encima de otra cosa. El dibujado y el doble clic necesitan ventana;
// esto no.

/** Comprueba que cada celda apunta exactamente a su propio texto en la línea. */
function celdasApuntanBien(linea: string) {
  for (const c of celdasCon(linea)) {
    const enLaLinea = linea.slice(c.desde, c.hasta)
    // El texto de la celda viene desescapado, así que se compara contra el
    // tramo con sus escapes deshechos.
    assert.equal(
      enLaLinea.replace(/\\\|/g, '|'),
      c.texto,
      `la celda ${JSON.stringify(c.texto)} no apunta a su sitio en ${JSON.stringify(linea)}`,
    )
  }
}

prueba('cada celda sabe exactamente en que tramo vive', () => {
  for (const linea of [
    '| a | b |',
    '|a|b|',
    '|   con espacios   |   y mas   |',
    '| a |',
    'a | b',                       // sin barras a los lados: tambien es tabla
    '| **negrita** | `codigo` |',
    '| [x](https://ejemplo.com) | y |',
    '| con \\| barra escapada | otra |',
    '| \\| | \\|\\| |',
    '|  |  |',                     // celdas vacias
    '| á é í | ñ ü |',
  ]) {
    celdasApuntanBien(linea)
  }
})

prueba('reemplazar una celda por su tramo deja la fila entera bien', () => {
  // Esto es exactamente lo que hace el widget al confirmar: un reemplazo del
  // tramo, sin tocar nada mas de la linea.
  const linea = '| uno | dos | tres |'
  const cs = celdasCon(linea)
  const nueva = linea.slice(0, cs[1].desde) + 'DOS' + linea.slice(cs[1].hasta)
  assert.equal(nueva, '| uno | DOS | tres |')
  // Y la tabla sigue teniendo las mismas columnas.
  assert.equal(celdasCon(nueva).length, 3)
})

prueba('reemplazar una celda con barra escapada no descuadra la fila', () => {
  const linea = '| a \\| b | c |'
  const cs = celdasCon(linea)
  assert.equal(cs.length, 2)
  assert.equal(cs[0].texto, 'a | b')
  const nueva = linea.slice(0, cs[0].desde) + saneadaParaCelda('x | y') + linea.slice(cs[0].hasta)
  assert.equal(celdasCon(nueva).length, 2, 'sigue habiendo dos columnas')
  assert.equal(celdasCon(nueva)[0].texto, 'x | y')
})

prueba('lo escrito en una celda no puede partir la tabla', () => {
  // Una barra abre una columna; un salto de linea parte la fila en dos. Las dos
  // cosas estropean el documento de quien escribe, no solo la vista.
  assert.equal(saneadaParaCelda('a | b'), 'a \\| b')
  assert.equal(saneadaParaCelda('a\nb'), 'a b')
  assert.equal(saneadaParaCelda('a\r\nb'), 'a b')
  assert.equal(saneadaParaCelda('a b'), 'a b')
  assert.equal(saneadaParaCelda('  hola   mundo  '), 'hola mundo')
  assert.equal(saneadaParaCelda('|||'), '\\|\\|\\|')
  assert.equal(saneadaParaCelda(''), '')
})

prueba('lo saneado vuelve a leerse como una sola celda', () => {
  // La ida y vuelta: lo que se escribe tiene que releerse igual.
  for (const escrito of [
    'a | b',
    'texto con | barra | y otra',
    'con\nsalto',
    '**negrita**',
    'a \\| ya escapada',
  ]) {
    const celda = saneadaParaCelda(escrito)
    const fila = `| ${celda} | z |`
    const leidas = celdasCon(fila)
    assert.equal(leidas.length, 2, `${JSON.stringify(escrito)} abrio columnas de mas`)
    assert.equal(leidas[1].texto, 'z', 'la celda de al lado tiene que quedar intacta')
  }
})

prueba('eq() de la tabla mira tambien donde esta', () => {
  // Dos tablas con el mismo texto en sitios distintos NO son el mismo widget:
  // sus celdas apuntan a tramos distintos del documento. Si eq() las diera por
  // iguales, CodeMirror reutilizaria el DOM de una para la otra y las celdas
  // escribirian en el sitio equivocado.
  const a = new WidgetTabla('| a | b |\n|---|---|\n| 1 | 2 |', 0)
  const b = new WidgetTabla('| a | b |\n|---|---|\n| 1 | 2 |', 500)
  assert.equal(a.eq(b), false)
  assert.equal(a.eq(new WidgetTabla(a.texto, 0)), true)
})

prueba('el texto de un widget de tabla es el de su tramo', () => {
  const texto = '| a | b |\n|---|---|\n| 1 | 2 |\n'
  const [d] = widgetsDe(texto)
  const w = d.w as WidgetTabla
  assert.equal(
    texto.slice(d.desde, d.hasta),
    w.texto,
    'el widget tiene que llevar exactamente el texto que tapa',
  )
})

console.log(`\n${hechas} pruebas, todas pasan.\n`)
