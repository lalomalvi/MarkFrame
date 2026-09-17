# Los precedentes: por qué cada mitigación tiene un CVE detrás

**17 de septiembre de 2026.** Barrido de vulnerabilidades reales en editores y
visores de markdown, hecho al preparar la publicación. Complementa al
[INFORME](INFORME.md): aquel dice qué se encontró **aquí**; éste dice a quién le
pasó **ya** cada cosa que aquí se cerró.

**Para qué sirve.** Un desconocido que lea que MarkFrame filtra esquemas de enlace
puede pensar que es paranoia de programador. Con estos identificadores deja de
ser opinión.

---

## Lo primero, porque es lo que se pregunta: ¿nos afecta alguno?

**No.** Comprobado el 2026-09-17 contra las versiones instaladas, una por una:

| Biblioteca | Instalada | CVE citados afectan | Veredicto |
|---|---|---|---|
| **Tauri** | 2.11.5 | CVE-2026-42184: 2.0 – 2.11.0 | **Fuera** —— parche en 2.11.1 |
| **KaTeX** | 0.18.7 | CVE-2024-28243/44/45/46, CVE-2025-23207: < 0.16.20 | **Fuera** |
| **Mermaid** | 12.0.0 | CVE-2025-54880/81, CVE-2026-41149/41159/50159: ≤ 11.16.0 | **Fuera** |
| **DOMPurify** | 3.4.15 | Piso seguro al 2026-09-17: 3.4.13 | **Fuera** |
| **marked** | 16.4.2 | CVE-2026-41680: 18.0.0 – 18.0.1 | **Fuera** (rama distinta) |

El de Tauri era el único que habría sido urgente: permitía que una página remota
invocara órdenes marcadas como sólo-locales, en Windows. No aplica.

---

## Los tres que mejor justifican el modelo de amenaza

### 1 · Typora · CVE-2019-20374 · CVSS 9.6 · es nuestra pila exacta

Bloque de Mermaid → mXSS → ejecución de código, **al abrir el archivo**. La
cadena completa está documentada en el issue 3124 de Typora: DOMPurify **1.0.4
pinado y sin actualizar**, el mXSS alcanzable por la tubería de Mermaid, la carga
en etiquetas SVG y `img` codificadas como entidades con un `onerror` que
decodificaba base64, y Electron sin caja de arena entregando `child_process`.

**Lo que enseña:** ninguna de las tres capas era «el fallo». El fallo fue la
composición. Justifica de una vez el saneado de Mermaid, la decisión de no
renderizar HTML embebido, y la disciplina de **no pinar el sanitizador**.

### 2 · Windows Notepad · CVE-2026-20841 · CVSS 8.8 · corregido el 2026-02-10

Microsoft metió markdown en el Bloc de notas el 2025-05-30 y heredó la clase
entera: un enlace con `file://`, ruta SMB o `ms-appinstaller://` llegaba a
`ShellExecuteExW()` **sin el aviso normal de Windows**.

**Lo que enseña:** el editor de texto más conservador del mundo cayó con esto
siete meses después de estrenar la función. Y el problema **no era sólo
`javascript:`**: era todo esquema que el sistema despacha.

### 3 · Joplin · CVE-2024-49362 · CVSS 7.7 · cómo falla una defensa propia

Joplin **sí tenía** un mecanismo de confianza: el atributo `data-from-md` marcaba
los enlaces internos legítimos. No previó que **una biblioteca de terceros
pusiera ese atributo por su cuenta** —— y Mermaid lo hacía.

**Lo que enseña:** si un renderizador que corre después puede emitir la marca de
confianza, la marca no vale. «Mermaid saneado» tiene que significar sanear **su
salida**, no sólo su entrada.

---

## Las otras mitigaciones, con su precedente

| Lo que aquí se cerró | A quién le pasó |
|---|---|
| **Esquema del enlace** | SiYuan CVE-2026-25647 (`[a](javascript:…)` literal) · MarkText CVE-2022-21158 · Open WebUI CVE-2026-44721 · @nuxtjs/mdc CVE-2026-63671 |
| **Tope de dimensiones declaradas** | Cloudreve CVE-2026-55497: protegía «sólo el tamaño comprimido, nunca las dimensiones decodificadas». PNG de 2 147 483 647 × 16 px en menos de 65 bytes → intento de reservar ~128 GB. Y libpng lo documenta desde 2010 (CVE-2010-0205) |
| **Aviso de imagen remota** | Zulip CVE-2022-36048: permitía «inferir la dirección IP del lector y su huella de navegador» · Nextcloud Mail CVE-2021-32707, evadido por `background-image` en CSS |
| **HTML embebido nunca se renderiza** | Las dos evasiones de CVE-2026-63671 existen sólo porque el HTML venía habilitado |

**Dato que vale para el README:** de los editores revisados, **el único que
bloquea imágenes remotas por omisión es VS Code** (nivel «Strict» de su
previsualización). Joplin, Obsidian, Logseq, Standard Notes, Zettlr y Typora no
lo hacen; en Obsidian la comunidad lo rodea con plugins que bajan las imágenes a
local.

---

## Tres cosas que sí conviene mirar, con lo que ya comprobé de cada una

1. **Mermaid `securityLevel: 'strict'`** —— `widgets.ts:624`. CVE-2025-54880 y
   54881 eran explotables **en configuración por omisión**, porque el sumidero
   era `d3.html()` e `innerHTML`, no el manejo de etiquetas. Sólo `'sandbox'`
   los habría contenido, y cuesta la interactividad y el tema claro/oscuro
   —— un iframe en caja de arena no hereda el CSS. **Hoy no aplica (12.0.0 los
   tiene parchados); es una decisión de postura, no un arreglo.**
2. **KaTeX sin cota de expansión.** CVE-2024-28243 y 28244 evadían `maxExpand`
   sin necesidad de `trust`. **Parchados en 0.16.10 y tenemos 0.18.7**, así que
   no aplica —— pero no hay cota de **tiempo** propia: mil fórmulas se dibujan
   las mil. Lo acota de refilón el tope de vista por tamaño de archivo.
3. **`trust: false` es estrictamente mejor que una función `trust` propia**, y
   hay CVE que lo demuestra: CVE-2024-28246 pasaba el protocolo sin normalizar,
   así que un bloqueo razonable de `'javascript'` se evadía con `'Javascript:'`.
   **No escribir una función `trust`.**

---

## Cómo está el sector, y dónde nos deja

De nueve productos revisados —— Typora, Joplin, Obsidian, Zettlr, Logseq,
Standard Notes, Cryptee, Notesnook, Anytype:

- **Auditoría externa real: 2 de 9.** Obsidian tiene cuatro (Cure53 ×3, Trail of
  Bits, PDF públicos y corroborables desde el lado del auditor) y Standard Notes
  otras cuatro, la última de 2022.
- **Modelo de amenaza publicado: 3 de 9** —— Cryptee, Standard Notes y Zettlr.
- **Nadie combina las dos cosas** con el modelo vigente. Ésa es la reclamación
  que aguanta; **«nadie audita» es falsa** y no hay que decirla.

**Corrección a una premisa que traíamos:** Joplin **no pagó** auditoría externa
—— lo único que existe es una revisión informal y no remunerada de una persona, de
2020, sin informe. Y su lote de 10 avisos del 2026-09-09 **no es una auditoría**:
son siete investigadores independientes, divulgación coordinada publicada de
golpe.

**El precedente más cercano a lo que se hizo aquí es el postmortem de Zettlr**
(2021-05-13), que declara en primera persona: no consideró el caso de que a
alguien le manden un documento markdown y lo abra sin inspeccionarlo antes. Es
una confesión a posteriori, no una auditoría a priori.

---

## Lo que NO está verificado

Este documento recoge el barrido de un agente que abrió cada aviso en su página
(`github.com/advisories`, `cveawg.mitre.org`, `api.osv.dev`). **Lo verificado por
mí directamente son las versiones instaladas de la tabla de arriba**, en esta
máquina, hoy. Los identificadores y los CVSS vienen del barrido.

Quedó explícitamente sin verificar:

- **No existe aviso de RustSec ni GHSA de bomba de descompresión para los crates
  `image`, `png`, `webp` ni `resvg`.** El respaldo de esa mitigación viene de C,
  Python, Go y Android —— no de Rust. Conviene saberlo antes de citarlo.
- `roxmltree`, el parser XML bajo resvg, trae `nodes_limit` en `u32::MAX` —— o sea
  sin límite salvo que se ponga. No se ha mirado si nos alcanza.
- CVE-2026-41610 (VS Code): existe, pero Microsoft no nombra el componente. La
  atribución al visor de markdown es de bases generadas automáticamente.
- CVE-2025-7969 (markdown-it): **disputado** por el mantenedor. No citarlo.
- CamoLeak (GitHub Copilot Chat) se cita **sin identificador**: el CVE-2025-59145
  que le atribuyen muchos blogs es de otra cosa.
