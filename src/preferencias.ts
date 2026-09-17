/**
 * Preferencias del programa.
 *
 * Viven en `localStorage`, que en Tauri es propio de la aplicacion y sobrevive
 * a las actualizaciones. NO son estado del documento: si se pierden, el
 * programa arranca con los valores de fabrica y no pasa nada.
 *
 * Casi todas se aplican escribiendo variables CSS en <html>, porque el tema de
 * CodeMirror ya las consume. Asi no hay que reconstruir el editor para cambiar
 * de letra o de tamano.
 */

export type Tema = 'sistema' | 'claro' | 'oscuro'
export type Profundidad = 'suave' | 'normal' | 'profundo'
export type Paleta = 'tinta' | 'notas' | 'sobria'
export type Sangria = '2' | '4' | 'tab'

export interface Preferencias {
  tema: Tema
  /** Que tan oscuro es el oscuro. No aplica al claro. */
  profundidad: Profundidad
  paleta: Paleta
  fuenteTexto: string
  fuenteMono: string
  tamano: number
  interlineado: number
  /**
   * Ancho maximo de la columna de texto, en rem. **0 = sin limite**, que es lo
   * de fabrica: con un ancho fijo, maximizar la ventana solo engorda los
   * margenes y el texto se queda igual de angosto.
   */
  ancho: number
  numerosLinea: boolean
  /** Picar un bloque lleva el otro panel a ese mismo bloque y lo enmarca. */
  eco: boolean
  sangria: Sangria
  /**
   * Cargar imagenes de internet sin preguntar.
   *
   * **De fabrica esta APAGADO, y es una decision de seguridad.** Un `.md` que
   * te manda un tercero puede llevar `![](https://del-atacante/pixel.png)`: al
   * pintarla, tu equipo contacta ese servidor, confirma que abriste el archivo,
   * revela tu IP y, si la url lleva datos en la ruta, los filtra. Es el vector
   * de exfiltracion por imagen que los proveedores grandes parchearon en la
   * capa de renderizado. Las imagenes del disco no tienen este problema.
   */
  imagenesRemotas: boolean
  /** Reabrir el ultimo archivo al arrancar. */
  reabrir: boolean
  ultimoArchivo: string | null
  /** Fraccion de ancho del panel de fuente, de 0 a 1. */
  division: number
  modo: 'fuente' | 'ambos' | 'presentacion'
}

export const DE_FABRICA: Preferencias = {
  tema: 'sistema',
  profundidad: 'normal',
  paleta: 'tinta',
  fuenteTexto: 'Sistema',
  fuenteMono: 'Sistema',
  tamano: 15.5,
  interlineado: 1.7,
  ancho: 0,
  numerosLinea: true,
  eco: true,
  sangria: '4',
  imagenesRemotas: false,
  reabrir: false,
  ultimoArchivo: null,
  division: 0.5,
  modo: 'ambos',
}

/** Familias empaquetadas. `null` = la del sistema, sin descargar nada. */
export const FUENTES_TEXTO: Array<{ id: string; pila: string | null; nota: string }> = [
  { id: 'Sistema', pila: null, nota: 'Segoe UI, la de Windows' },
  { id: 'Newsreader', pila: '"Newsreader", Georgia, serif', nota: 'serif — la de Notas y Nodos' },
  { id: 'Source Serif 4', pila: '"Source Serif 4", Georgia, serif', nota: 'serif, más sobria' },
  { id: 'Space Grotesk', pila: '"Space Grotesk", system-ui, sans-serif', nota: 'sans — la de Notas y Nodos' },
  { id: 'Inter', pila: '"Inter", system-ui, sans-serif', nota: 'sans, muy neutra' },
]

export const FUENTES_MONO: Array<{ id: string; pila: string | null; nota: string }> = [
  { id: 'Sistema', pila: null, nota: 'Cascadia Code o Consolas' },
  { id: 'IBM Plex Mono', pila: '"IBM Plex Mono", ui-monospace, monospace', nota: 'la de Notas y Nodos' },
  { id: 'JetBrains Mono', pila: '"JetBrains Mono", ui-monospace, monospace', nota: 'ligaduras apagadas' },
]

const PILA_SISTEMA_TEXTO = '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif'
const PILA_SISTEMA_MONO = '"Cascadia Code", "Consolas", ui-monospace, monospace'

/** Tonos del fondo en oscuro. El suave es el del icono del programa. */
/**
 * Los tres tonos del oscuro.
 *
 * **`--linea-activa` no esta aqui a proposito.** La pone `styles.css` con alfa,
 * y tiene que seguir asi: un color solido tapa la seleccion entera, porque
 * CodeMirror la dibuja en una capa con `z-index: -2` y la linea activa es un
 * fondo del flujo normal. Estos valores eran solidos hasta el 2026-09-17, y ese
 * era el motivo de que seleccionar texto no se viera.
 */
const PROFUNDIDAD: Record<Profundidad,
  { papel: string; barra: string; titulo: string; codigo: string }> = {
  suave:    { papel: '#20232a', barra: '#191c23', titulo: '#131519', codigo: '#252932' },
  normal:   { papel: '#16181e', barra: '#101217', titulo: '#0b0c10', codigo: '#1d2027' },
  profundo: { papel: '#0c0d11', barra: '#07080a', titulo: '#040507', codigo: '#131519' },
}

const CLAVE = 'markflow.preferencias'

/**
 * Comprueba lo que viene de `localStorage` antes de usarlo.
 *
 * No es defensa contra un atacante -- quien pueda escribir ahi ya tiene mas de
 * lo que esto protege -- sino contra el programa mismo: la auditoria del
 * 2026-09-16 encontro que un valor de `profundidad` fuera de los tres
 * esperados dejaba `PROFUNDIDAD[...]` en `undefined` y **mataba el arranque en
 * todos los arranques**, sin nada en la interfaz que permitiera deshacerlo. Y
 * una `sangria` negativa reventaba en `' '.repeat()`.
 *
 * Un ajuste guardado por una version vieja, o a medio escribir, no puede dejar
 * el programa inservible para siempre.
 */
function sanear(p: Preferencias): Preferencias {
  const enLista = <T extends string>(v: unknown, lista: readonly T[], porOmision: T): T =>
    (typeof v === 'string' && (lista as readonly string[]).includes(v) ? v as T : porOmision)

  const enRango = (v: unknown, min: number, max: number, porOmision: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, min), max) : porOmision

  const D = DE_FABRICA
  return {
    tema: enLista(p.tema, ['sistema', 'claro', 'oscuro'] as const, D.tema),
    profundidad: enLista(p.profundidad, ['suave', 'normal', 'profundo'] as const, D.profundidad),
    paleta: enLista(p.paleta, ['tinta', 'notas', 'sobria'] as const, D.paleta),
    fuenteTexto: FUENTES_TEXTO.some((f) => f.id === p.fuenteTexto) ? p.fuenteTexto : D.fuenteTexto,
    fuenteMono: FUENTES_MONO.some((f) => f.id === p.fuenteMono) ? p.fuenteMono : D.fuenteMono,
    tamano: enRango(p.tamano, 8, 48, D.tamano),
    interlineado: enRango(p.interlineado, 1, 4, D.interlineado),
    ancho: enRango(p.ancho, 0, 200, D.ancho),
    numerosLinea: typeof p.numerosLinea === 'boolean' ? p.numerosLinea : D.numerosLinea,
    eco: typeof p.eco === 'boolean' ? p.eco : D.eco,
    sangria: enLista(p.sangria, ['2', '4', 'tab'] as const, D.sangria),
    imagenesRemotas: typeof p.imagenesRemotas === 'boolean' ? p.imagenesRemotas : D.imagenesRemotas,
    reabrir: typeof p.reabrir === 'boolean' ? p.reabrir : D.reabrir,
    ultimoArchivo: typeof p.ultimoArchivo === 'string' ? p.ultimoArchivo : null,
    division: enRango(p.division, 0.05, 0.95, D.division),
    modo: enLista(p.modo, ['fuente', 'ambos', 'presentacion'] as const, D.modo),
  }
}

export function leer(): Preferencias {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return { ...DE_FABRICA }
    // Se mezcla con los valores de fabrica para que una version vieja no deje
    // campos sin definir, y se sanea: un valor imposible no puede dejar el
    // programa sin arrancar.
    return sanear({ ...DE_FABRICA, ...JSON.parse(crudo) })
  } catch {
    return { ...DE_FABRICA }
  }
}

export function guardar(p: Preferencias) {
  try { localStorage.setItem(CLAVE, JSON.stringify(p)) } catch { /* da igual */ }
}

/** ¿Se está pintando en oscuro ahora mismo? */
export function oscuroActivo(p: Preferencias): boolean {
  if (p.tema === 'oscuro') return true
  if (p.tema === 'claro') return false
  return matchMedia('(prefers-color-scheme: dark)').matches
}

/** Vuelca las preferencias a variables CSS de <html>. */
export function aplicar(p: Preferencias) {
  const raiz = document.documentElement
  const est = raiz.style

  if (p.tema === 'sistema') raiz.removeAttribute('data-tema')
  else raiz.setAttribute('data-tema', p.tema)

  raiz.setAttribute('data-paleta', p.paleta)

  const texto = FUENTES_TEXTO.find((f) => f.id === p.fuenteTexto)?.pila ?? PILA_SISTEMA_TEXTO
  const mono = FUENTES_MONO.find((f) => f.id === p.fuenteMono)?.pila ?? PILA_SISTEMA_MONO
  est.setProperty('--fuente-texto', texto)
  est.setProperty('--fuente-mono', mono)
  est.setProperty('--cuerpo', `${p.tamano}px`)
  est.setProperty('--interlineado', String(p.interlineado))
  est.setProperty('--ancho-columna', p.ancho > 0 ? `${p.ancho}rem` : 'none')

  // El tono del fondo solo manda en oscuro; en claro el papel es blanco.
  if (oscuroActivo(p)) {
    const t = PROFUNDIDAD[p.profundidad]
    est.setProperty('--papel', t.papel)
    est.setProperty('--papel-barra', t.barra)
    est.setProperty('--papel-titulo', t.titulo)
    est.setProperty('--codigo-fondo', t.codigo)
  } else {
    for (const v of ['--papel', '--papel-barra', '--papel-titulo',
                     '--codigo-fondo']) {
      est.removeProperty(v)
    }
    est.setProperty('--papel-titulo', '#e9edf3')
  }
}
