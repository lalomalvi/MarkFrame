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
import { acotada, MARCAS, formatosActivos, tramoConFormato } from '../src/formato.ts'
import { titulosDe, tituloEn } from '../src/indice.ts'

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

// --- el panel de formato ----------------------------------------------------
//
// Lo que se prueba es el recorte de la selección, que es lo único capaz de
// estropear el documento: si los límites están mal, la marca cae donde no debe.

/** Un estado suelto: `acotada` sólo necesita leer el documento. */
const vistaDe = (texto: string) => EditorState.create({ doc: texto })

/** Un estado CON el lenguaje markdown y el árbol ya analizado. */
function estadoMd(texto: string) {
  const e = EditorState.create({
    doc: texto,
    extensions: [markdown({ base: markdownLanguage })],
  })
  ensureSyntaxTree(e, texto.length, 5000)
  return e
}

prueba('la seleccion se recorta por los dos lados', () => {
  const v = vistaDe('  hola mundo  ')
  assert.deepEqual(acotada(v, 0, 14), { desde: 2, hasta: 12 })
})

prueba('resaltar un titulo no le quita el espacio a la almohadilla', () => {
  // ESTE es el fallo del 2026-09-17. En la vista el `# ` está oculto, así que
  // seleccionar el título empezaba en el espacio y salía `#==Titulo==`, que ya
  // no es un título para markdown.
  const doc = '# Pasada de funciones'
  const v = vistaDe(doc)
  const { desde, hasta } = acotada(v, 1, doc.length)   // desde el espacio
  assert.equal(desde, 2, 'tiene que saltarse el espacio que sigue al #')
  const nuevo = doc.slice(0, desde) + '==' + doc.slice(desde, hasta) + '==' + doc.slice(hasta)
  assert.equal(nuevo, '# ==Pasada de funciones==')
  assert.ok(nuevo.startsWith('# '), 'sigue siendo un titulo')
})

prueba('las marcas quedan pegadas al texto, como pide markdown', () => {
  // `** texto **` no es negrita: las marcas tienen que tocar el texto.
  const doc = 'con  espacios  alrededor'
  const v = vistaDe(doc)
  const { desde, hasta } = acotada(v, 3, 15)
  const envuelto = doc.slice(desde, hasta)
  assert.ok(!envuelto.startsWith(' '), envuelto)
  assert.ok(!envuelto.endsWith(' '), envuelto)
})

prueba('un salto de linea no se queda dentro de la marca', () => {
  const doc = 'primera\nsegunda'
  const v = vistaDe(doc)
  assert.deepEqual(acotada(v, 7, 15), { desde: 8, hasta: 15 })
})

prueba('una seleccion de puro espacio se queda vacia y no se envuelve', () => {
  const v = vistaDe('a     b')
  const { desde, hasta } = acotada(v, 1, 6)
  assert.ok(desde >= hasta, 'sin nada que marcar, `alternar` se retira')
})

prueba('las marcas son markdown de siempre', () => {
  // Si alguien cambia esto por sintaxis propia, un .md tocado aquí deja de
  // abrirse igual en Obsidian o GitHub. Era la condición de Lalo, y esta
  // prueba está para que añadir un formato obligue a pensarlo otra vez —— saltó
  // al añadir el código en línea, que es justo lo que se le pide.
  assert.deepEqual({ ...MARCAS }, {
    resaltar: '==', negrita: '**', cursiva: '*', tachado: '~~', codigo: '`',
  })
})

prueba('reconoce el codigo en linea', () => {
  assert.deepEqual([...activosEn('esto es `codigo` en linea', 'codigo')], ['codigo'])
  // Y dentro de una cerca de varias lineas NO es código en línea.
  assert.deepEqual([...activosEn('```\nno es en linea\n```', 'no es')], [])
})

// --- el índice del documento ------------------------------------------------ //

const titulosTexto = (doc: string) => titulosDe(estadoMd(doc)).map((t) => t.texto)

prueba('saca los titulos con su nivel y en orden', () => {
  const doc = '# Uno\n\ntexto\n\n## Dos\n\n### Tres\n\n## Cuatro\n'
  const ts = titulosDe(estadoMd(doc))
  assert.deepEqual(ts.map((t) => [t.nivel, t.texto]), [
    [1, 'Uno'], [2, 'Dos'], [3, 'Tres'], [2, 'Cuatro'],
  ])
  // Y cada uno apunta a donde empieza de verdad.
  for (const t of ts) assert.ok(doc.slice(t.desde).startsWith('#'))
})

prueba('una almohadilla dentro de codigo NO es un titulo', () => {
  // Éste es el motivo de leer el árbol en vez de usar una expresión regular:
  // un `#` en un bloque de código es un comentario de shell, no una sección.
  const doc = '# De verdad\n\n```bash\n# solo un comentario\n```\n\n## Tambien de verdad\n'
  assert.deepEqual(titulosTexto(doc), ['De verdad', 'Tambien de verdad'])
})

prueba('los titulos subrayados tambien cuentan', () => {
  // `===` y `---` debajo del texto son títulos válidos en markdown, y una regex
  // de almohadillas no los vería.
  assert.deepEqual(titulosTexto('Uno\n===\n\nDos\n---\n'), ['Uno', 'Dos'])
})

prueba('las almohadillas de cierre no se cuelan en el rotulo', () => {
  assert.deepEqual(titulosTexto('## Con cierre ##\n'), ['Con cierre'])
  assert.deepEqual(titulosTexto('###   con espacios de sobra   ###\n'), ['con espacios de sobra'])
})

prueba('un titulo vacio existe y no rompe el indice', () => {
  const ts = titulosDe(estadoMd('##\n\ntexto\n'))
  assert.equal(ts.length, 1)
  assert.equal(ts[0].texto, '', 'vacío, y la interfaz lo pinta como «(sin título)»')
})

prueba('un documento sin titulos da una lista vacia', () => {
  assert.deepEqual(titulosTexto('solo texto\n\ny mas texto\n'), [])
  assert.deepEqual(titulosTexto(''), [])
})

prueba('saber en que seccion cae el cursor', () => {
  const doc = '# Uno\n\naaa\n\n## Dos\n\nbbb\n'
  const ts = titulosDe(estadoMd(doc))
  assert.equal(tituloEn(ts, 0), 0, 'sobre el primer título')
  assert.equal(tituloEn(ts, doc.indexOf('aaa')), 0, 'en el cuerpo de la primera')
  assert.equal(tituloEn(ts, doc.indexOf('bbb')), 1, 'en el cuerpo de la segunda')
  assert.equal(tituloEn([], 5), -1, 'sin títulos no hay sección')
})

prueba('el indice no se dispara con un documento de puros titulos', () => {
  // Un archivo generado puede traer miles. El tope está para que la interfaz no
  // se atasque pintando una lista que nadie va a recorrer.
  const doc = '# t\n'.repeat(3000)
  const arranque = Date.now()
  const ts = titulosDe(estadoMd(doc))
  const tardo = Date.now() - arranque
  assert.ok(ts.length <= 500, `salieron ${ts.length}, el tope son 500`)
  assert.ok(tardo < 2000, `tardo ${tardo} ms`)
})

// --- saber qué formato lleva ya lo seleccionado ----------------------------- //
//
// Esto es lo que enciende los botones del panel. Lo pidió Lalo el 2026-09-17
// tras ver que el panel callaba sobre un texto que ya estaba en cursiva.

/** Los formatos activos en el tramo que ocupa `aguja` dentro del documento. */
function activosEn(doc: string, aguja: string) {
  const i = doc.indexOf(aguja)
  assert.ok(i >= 0, `la prueba está mal: «${aguja}» no está en el documento`)
  return formatosActivos(estadoMd(doc), i, i + aguja.length)
}

prueba('reconoce negrita, cursiva y tachado exactos', () => {
  assert.deepEqual([...activosEn('esto **va** asi', 'va')], ['negrita'])
  assert.deepEqual([...activosEn('esto *va* asi', 'va')], ['cursiva'])
  assert.deepEqual([...activosEn('esto ~~va~~ asi', 'va')], ['tachado'])
})

prueba('reconoce el formato aunque las marcas esten lejos', () => {
  // EL caso de Lalo: seleccionar unas palabras de en medio de un párrafo que
  // está entero en cursiva. Las marcas quedan a decenas de caracteres, así que
  // mirar sólo los bordes de la selección no las ve.
  const doc = '*Propuesta de un protocolo para que varios LLMs trabajen juntos.*'
  assert.deepEqual([...activosEn(doc, 'protocolo para que varios')], ['cursiva'])
})

prueba('reconoce el resaltado, que no esta en el arbol', () => {
  // `==texto==` no es markdown estándar: el analizador no lo conoce y hay que
  // buscarlo a mano. Que funcione igual es el punto.
  assert.deepEqual([...activosEn('esto ==va== asi', 'va')], ['resaltar'])
  assert.deepEqual(
    [...activosEn('un ==tramo largo de varias palabras== aqui', 'largo de varias')],
    ['resaltar'],
  )
})

prueba('reconoce dos formatos a la vez', () => {
  const puestos = activosEn('esto **~~va~~** asi', 'va')
  assert.ok(puestos.has('negrita'), 'la negrita de fuera')
  assert.ok(puestos.has('tachado'), 'y el tachado de dentro')
})

prueba('no inventa formatos donde no hay', () => {
  assert.deepEqual([...activosEn('texto del todo normal', 'del todo')], [])
  // Marcas de otro tramo, que no envuelven a lo seleccionado.
  assert.deepEqual([...activosEn('**otra cosa** y esto suelto', 'esto suelto')], [])
})

prueba('el tramo devuelto incluye las marcas, para poder quitarlas', () => {
  const doc = 'esto **va** asi'
  const i = doc.indexOf('va')
  const t = tramoConFormato(estadoMd(doc), i, i + 2, 'negrita')
  assert.ok(t, 'tendria que encontrarlo')
  assert.equal(doc.slice(t!.abre, t!.cierra), '**va**', 'de marca a marca')
  assert.equal(doc.slice(t!.desde, t!.hasta), 'va', 'y el texto de dentro')
})

prueba('el arbol sin analizar no da falsos positivos', () => {
  // Sin lenguaje montado no hay árbol: la respuesta correcta es «no sé», que
  // aquí significa no encender nada —— nunca encender de más.
  const doc = 'esto **va** asi'
  const crudo = EditorState.create({ doc })
  const i = doc.indexOf('va')
  assert.equal(tramoConFormato(crudo, i, i + 2, 'negrita'), null)
})

console.log(`\n${hechas} pruebas, todas pasan.\n`)
