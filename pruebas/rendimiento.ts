/**
 * Medir, no suponer.
 *
 * Esto **no es una prueba** —— no falla ni pasa: imprime números. Se corre a mano
 * con `npm run medir` cuando se toca el panel de presentación o se sospecha que
 * algo va lento, y los números que salen se anotan en `docs/estado.md`.
 *
 * Lo que se mide es `construir()`, que es lo que **se paga en cada pulsación**:
 * recorre el documento entero, en el hilo de la interfaz, sin presupuesto de
 * tiempo. Si algo va a arruinar la sensación de ligereza, es ahí.
 *
 * El análisis sintáctico se cronometra aparte, porque es de CodeMirror y se hace
 * una vez al abrir; mezclarlos escondería cuál de los dos manda.
 */

// Lo mínimo de navegador, igual que en las pruebas de presentación.
const g = globalThis as Record<string, unknown>
g.document ??= { documentElement: { getAttribute: () => 'oscuro' } }
g.matchMedia ??= () => ({ matches: true })

import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { construir } from '../src/livepreview.ts'
import { formatosActivos } from '../src/formato.ts'

/** Un `.md` que se parece a los de Lalo: prosa, tablas, código y fórmulas. */
function notaDe(kb: number): string {
  const trozo = `## Sección de ejemplo

Un párrafo de prosa técnica con **negrita**, *cursiva*, \`código\` y una nota al
pie[^1]. La carga axial resiste $P_u = \\phi P_n$ cuando $\\phi = 0.90$.

| Concepto | Cantidad | Unidad |
|:---|---:|---|
| Cemento | 350 | kg |
| Arena | 700 | kg |

- [ ] una tarea pendiente
- [x] una tarea hecha

\`\`\`rust
fn ejemplo() -> u32 { 42 }
\`\`\`

> [!NOTA]
> Un aviso de los que usa.

[^1]: El texto de la nota.

`
  const veces = Math.max(1, Math.ceil((kb * 1024) / trozo.length))
  return trozo.repeat(veces)
}

const crono = (fn: () => void) => {
  const t = performance.now()
  fn()
  return performance.now() - t
}

/** La mediana de varias corridas: una sola medición dice poco. */
function medianaDe(veces: number, fn: () => void): number {
  const tiempos: number[] = []
  for (let i = 0; i < veces; i++) tiempos.push(crono(fn))
  tiempos.sort((a, b) => a - b)
  return tiempos[Math.floor(tiempos.length / 2)]
}

const TAMANOS = [10, 50, 100, 250, 500, 1000, 2000, 3000]

console.log('\nRendimiento del panel de presentación')
console.log('(mediana de 5; el tope de la vista son 2 MB)\n')
console.log('   tamaño    analizar   construir   decoraciones   veredicto')
console.log('  ' + '-'.repeat(66))

for (const kb of TAMANOS) {
  const texto = notaDe(kb)
  const real = (texto.length / 1024).toFixed(0)

  const estado = EditorState.create({
    doc: texto,
    selection: { anchor: texto.length },
    extensions: [markdown({ base: markdownLanguage })],
  })

  const analizar = crono(() => { ensureSyntaxTree(estado, texto.length, 30_000) })
  const construirMs = medianaDe(5, () => { construir(estado) })
  const cuantas = construir(estado).size

  // 16 ms es un fotograma a 60 Hz: por encima de eso, escribir se nota.
  const veredicto = construirMs < 8 ? 'suave'
    : construirMs < 16 ? 'se aguanta'
    : construirMs < 50 ? 'se nota'
    : 'malo'

  console.log(
    `  ${real.padStart(6)} KB   ${analizar.toFixed(0).padStart(6)} ms   ` +
    `${construirMs.toFixed(1).padStart(7)} ms   ${String(cuantas).padStart(10)}   ${veredicto}`,
  )
}

// --- el panel de formato, que corre al soltar el raton ---------------------- //

console.log('\nDetección de formato activo (al soltar el ratón)\n')
console.log('   tamaño   formatosActivos   veredicto')
console.log('  ' + '-'.repeat(46))

for (const kb of [100, 500, 2000]) {
  const texto = notaDe(kb)
  const estado = EditorState.create({
    doc: texto,
    extensions: [markdown({ base: markdownLanguage })],
  })
  ensureSyntaxTree(estado, texto.length, 30_000)
  // Una selección en el medio del documento, que es el caso malo: hay que subir
  // por el árbol y buscar el bloque.
  const medio = Math.floor(texto.length / 2)
  const ms = medianaDe(9, () => { formatosActivos(estado, medio, medio + 20) })
  const veredicto = ms < 1 ? 'instantáneo' : ms < 8 ? 'suave' : ms < 50 ? 'se nota' : 'malo'
  console.log(
    `  ${(texto.length / 1024).toFixed(0).padStart(6)} KB   ` +
    `${ms.toFixed(2).padStart(13)} ms   ${veredicto}`,
  )
}

console.log()
