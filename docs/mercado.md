# MarkFlow — el campo, y dónde cae

> **El programa se llama MarkFrame desde el 2026-09-17.** Este informe conserva
> el nombre viejo a propósito: se escribió antes del cambio, y **el cambio lo
> provocó lo que este informe encontró** —— que `MarkFlow` estaba tomado por un
> editor de markdown en Tauri con 2 393 estrellas. Reescribirlo al nombre nuevo
> volvería incomprensible su propia conclusión. Todo «MarkFlow» de aquí abajo es
> el programa de Lalo; `MarkFlowy` y `vorojar/MarkFlow` son ajenos.

**17 de septiembre de 2026.** Investigación de mercado previa a publicar.

**Método.** Los pesos de instalador no son estimados: salen de los bytes reales
del *asset* en la API de GitHub o del `Content-Length` del servidor de descarga,
consultados hoy. Van en **MiB**, que es lo que muestra el Explorador de Windows.
Cada afirmación sobre un programa ajeno lleva su URL. Lo que no pude comprobar
está en el §7, no rellenado con suposiciones.

**Lo que se midió aquí, en esta máquina, hoy:**

| Dato | Medición |
|---|---|
| Instalador | `MarkFlow_0.1.0_x64-setup.exe` = **5 181 284 bytes** = **4.94 MiB** |
| Pruebas | **112**: 81 de interfaz (`npm run probar`) + 31 de Rust (`cargo test --lib`). **Todas pasan** |

---

## 1. El veredicto, en cinco líneas

1. **El hueco «abre un `.md` suelto, sin bóveda» ya no está vacío: está lleno.**
   Typora, MarkText, Notepad++, VS Code, Zed y el propio Bloc de notas de
   Windows 11 lo hacen; y en Tauri hay ~20 proyectos de 2025-2026 en ese mismo
   nicho, dos de los cuales —**Paperling** (541★) y **Bokuchi** (109★)— lo venden
   con las mismas palabras de la ESPEC.
2. **El peso dejó de ser argumento.** 4.94 MiB es excelente contra Obsidian
   (315.7) o Joplin (344.1), y **empate técnico** contra la banda Tauri, que va
   de 2.78 a 18.34 MiB. Y la memoria —436 MB— no es una ventaja: es el precio de
   WebView2, y es comparable a Electron.
3. **Lo que no encontré en nadie: los dos paneles editables a la vez.** Todos
   los demás hacen una de dos cosas —dejan la vista formateada de sólo lectura
   (VS Code, MDHero, Paperling, Zettlr, la vista de lectura de Obsidian) o
   **borran el panel de fuente** (Typora, MarkText). Nadie mantiene los dos vivos.
4. **La auditoría publicada es el activo más raro que tiene**, más que cualquier
   función —— pero con la reclamación estrecha, no la ancha: Obsidian tiene cuatro
   auditorías externas y Standard Notes otras cuatro; lo que **nadie** de nueve
   encuestados tiene es **modelo de amenaza publicado junto con las mitigaciones
   que lo cierran**. Y el modelo está validado por los hechos: Typora acumula
   **diez CVE**, y el Bloc de notas de Windows tuvo ejecución de comandos por un
   enlace de markdown **siete meses después** de estrenar la función.
5. **Dos problemas de publicación, no de programa.** El nombre está tomado:
   `drl990114/MarkFlowy` tiene 2 393★ y `vorojar/MarkFlow` es un editor de
   markdown homónimo. Y el repo no tiene `LICENSE` ni `AGENTS.md`.

---

## 2. El campo

Pesos en MiB, medidos hoy. La columna que importa es la última.

### Los que exigen bóveda o carpeta

| Programa | Licencia | Precio | Plataformas | Instalador Win | ¿Exige bóveda? | Último release |
|---|---|---|---|---|---|---|
| **Obsidian** 1.13.8 | propietaria | gratis; Sync $4/mes | Win/mac/Linux/móvil | **315.7** | **SÍ** | 2026-08-21 |
| **Logseq** 2.0.1 | AGPL-3.0 | gratis | Win/mac/Linux/móvil | **134.9** | **SÍ**, grafo | 2026-07-13 |
| **Joplin** 3.7.18 | AGPL-3.0+ | gratis; Cloud 2.99 €/mes | todas | **344.1** | **SÍ**, y peor: no abre `.md` | 2026-09-11 |
| **Notable** 1.8.4 | cerrado desde 1.5.1 | gratis | Win/mac/Linux | 86.4 | **SÍ** | **2020-01-21** ☠️ |
| **QOwnNotes** 26.9.7 | GPL-2.0 | gratis | + FreeBSD | 51.2 (ZIP) | **PARCIAL**: carpeta, sin «abrir archivo» | 2026-09-17 |
| **HackMD / CodiMD / HedgeDoc** | AGPL / cerrado | $0 a $5/asiento | web | — | **SÍ**, son servicios web | 2026-08-21 |

- Obsidian, textual: *«The first time you open Obsidian, you'll be asked to add a
  new vault»* — https://obsidian.md/help/vault. Un moderador cerró la petición de
  abrir un `.md` fuera de bóveda con *«This is not possible»* (25-nov-2020) —
  https://forum.obsidian.md/t/opening-markdown-file-without-assigning-it-to-a-vault/9026,
  y seguía igual en agosto de 2025 —
  https://forum.obsidian.md/t/allow-opening-of-a-md-file-with-obsidian-to-open-it-within-its-vault/104195
- Joplin guarda en SQLite, no en archivos —
  https://joplinapp.org/help/dev/spec/architecture/ — y su FAQ avisa de que los
  archivos de sincronización no son editables por el usuario:
  https://joplinapp.org/help/faq/
- **Logseq cambió de arquitectura**: la 2.0 es la beta de la *DB version*, con
  aviso propio de que *«data loss is possible»* —
  https://github.com/logseq/logseq#-database-version. El `.md` plano deja de ser
  la fuente de verdad. Es el argumento de la ESPEC, confirmado por los hechos.

### Los que abren cualquier archivo — o sea, la competencia real

| Programa | Licencia | Precio | Plataformas | Instalador Win | Paneles | Último release |
|---|---|---|---|---|---|---|
| **MarkFlow** 0.1.0 | *sin definir* | — | **sólo Win** | **4.94** | **dos, los dos editables** | inédito |
| **Bloc de notas** 11.2512.10 | propietaria, del sistema | incluido | sólo Win 11 | — | uno, con conmutador | 2026-01-21 |
| **Typora** | propietaria | **$14.99** único, 3 equipos | Win/mac/Linux | **108.4** | uno (WYSIWYG) | bin. 2026-09-11 |
| **MarkText** 0.19.1 | MIT | gratis | Win/mac/Linux | **105.7** | uno (WYSIWYG) | 2026-06-06 |
| **Notepad++** 8.9.8 | GPL-3.0 | gratis | **sólo Win** | **6.63** | fuente; vista por complemento | 2026-08-23 |
| **VS Code** 1.138 | MIT / binario propietario | gratis | Win/mac/Linux | **225.1** | vista de **sólo lectura** | 2026-09-15 |
| **Zed** 1.20.2 | GPL-3.0+ | $0 / Pro $10 mes | Win **estable** | **81.7** | vista de sólo lectura | 2026-09-17 |
| **Markdown Monster** | propietaria | **$99** por usuario | sólo Win | no verif. | vista sincronizada | no verif. |
| **MarkEdit** | MIT | gratis | **sólo macOS 15+** | ~4 (app) | vista por extensión | no verif. |
| **Abricotine** 1.1.4 | GPL-3.0 | gratis | Win/mac/Linux | 68.4 | uno | **2022-06-09** ☠️ archivado |
| **Remarkable** | MIT | gratis | Linux (Win prometido) | **no existe** | dos | 2024-09-22 ☠️ |
| **ghostwriter** 2.1.6 | GPL-3.0+ | gratis | Linux; Win portable | 156.9 (ZIP, 2022) | vista de sólo lectura | Win ☠️ 2022 |
| **Apostrophe** 3.4 | GPL-3.0+ | gratis | **sólo Linux** | no aplica | uno | 2025-09-29 |
| **Mark My Words** | MIT | gratis | **sólo Linux** | no existe | — | 2017 ☠️ |
| **Dillinger** | MIT | gratis | **web** | no aplica | vista de sólo lectura | 2016 (etiquetado) |

**Corrección a una suposición del encargo: MarkText no está muerto.** Estuvo
quieto 4 años y 2 meses (v0.17.1 en 2022-03-07), y **resucitó**: v0.19.0 el
2026-05-28, v0.19.1 el 2026-06-06, y `v0.20.0-rc.4` publicada **hoy**, con 95
commits en los últimos 60 días y 61 525 estrellas —
https://api.github.com/repos/marktext/marktext/releases

**Y el que más cambia el encuadre: el Bloc de notas de Windows 11 ya entiende
markdown.** Microsoft metió *lightweight formatting* en mayo de 2025 —negritas,
cursivas, enlaces, títulos y listas —
https://blogs.windows.com/windows-insider/2025/05/30/text-formatting-in-notepad-begin-rolling-out-to-windows-insiders/
— y en enero de 2026 añadió tachado y listas anidadas —
https://blogs.windows.com/windows-insider/2026/01/21/notepad-and-paint-updates-begin-rolling-out-to-windows-insiders/
**No hace tablas, ni fórmulas, ni diagramas, y conmuta entre vista formateada y
sintaxis en vez de mostrar las dos.** Pero ocupa el mismo asiento que la ESPEC
reclamaba, y viene firmado y preinstalado.

Con un detalle que conviene tener a mano: **siete meses después de estrenar
markdown, el Bloc de notas tuvo ejecución de comandos por un enlace de un `.md`**
(CVE-2026-20841, CVSS 8.8 — §3.5). Firmado y preinstalado no es lo mismo que
seguro.

Matiz a favor: **`.md` no viene asociado de fábrica en Windows 11**. Hay que
ponerlo a mano y hay hilos de gente que no puede —
https://learn.microsoft.com/en-us/answers/questions/4175555/cannot-set-default-app-for-md-on-windows-11.
Que el instalador registre el manejador sigue valiendo. (Cuidado con la
redacción: el instalador **registra el manejador**; quién queda por omisión lo
decide Windows con la elección del usuario, y ningún instalador puede tomarla.)

### La banda Tauri 2025-2026 — la competencia que no estaba en la lista

Unos veinte proyectos, casi todos nacidos en el último año. Los que importan:

| Proyecto | ★ | Licencia | Instalador Win | ¿Bóveda? | Último release |
|---|---|---|---|---|---|
| **MarkFlowy** | **2 393** | AGPL-3.0 | 18.34 (o 222.26 con WebView2) | no | 2026-09-12 |
| **Ferrite** (Rust + egui, sin webview) | 1 813 | MIT | 13.67 | no | 2026-05-22 |
| **SoloMD** | 1 065 | MIT | 12.92 | carpeta | 2026-09-13 |
| **Markra** | 876 | AGPL-3.0 | 11.30 | *«single file or folder»* | **2026-09-17** |
| **Paperling** | **541** | Apache-2.0 | 12.55 | **no, explícito** | 2026-09-11 |
| **markamd** | 480 | MIT | 8.31 | no | 2026-09-14 |
| **TizuMark** | 356 | GPL-3.0 | 8.74 | no | 2026-09-09 |
| **md-reader** | 170 | MIT | 4.22 | no | 2026-09-14 |
| **MDHero** | 162 | MIT | 5.15 | **no** | 2026-09-13 |
| **Bokuchi** | 109 | MIT | 14.10 | **no, explícito** | 2026-09-06 |
| **mdedit** | 4 | MIT | **2.78** | no | 2026-09-12 |

**Paperling dice la tesis de la ESPEC casi literalmente:** *«A no-setup Markdown
reader and editor. Open any `.md` file and read it beautifully… No vaults, no
plugins, no heavy app»*, y justifica igual: *«Tools like Obsidian are powerful,
but vaults, graphs, and plugins are overkill if you only want to open a file and
edit it»* — https://github.com/Razee4315/Paperling

**Bokuchi también:** *«No vault, no lock-in. Bokuchi opens plain `.md` / `.txt`
files directly, like a text editor — not a knowledge base.»* —
https://github.com/Bokuchi-Editor/bokuchi

Esto no invalida MarkFlow. Significa que **el argumento de venta no puede ser
«sin bóvedas»**, porque ya lo dicen otros y con más estrellas. Tiene que ser lo
del §3.

---

## 3. Lo que tenemos y casi nadie tiene

### 3.1 Los dos paneles editables — no encontré ningún otro

Verificado uno por uno, y el patrón es tan limpio que vale más que la lista:
**quien hace editable la vista formateada, borra el panel de fuente; quien
conserva los dos paneles, deja el formateado de sólo lectura.** Nadie mantiene
los dos vivos a la vez.

| Programa | Qué hace de verdad | Fuente |
|---|---|---|
| **Typora** | WYSIWYG único, **sin vista dividida**. Lo pidieron y el asunto está cerrado | https://github.com/typora/typora-issues/issues/3453 · *«It removes the preview window, mode switcher»* — https://typora.io/ |
| **Obsidian** | `Ctrl`+clic abre edición y lectura a la vez, pero *«Editing view lets you make changes»*: la de lectura no edita | https://obsidian.md/help/edit-and-read |
| **VS Code** | Vista de sólo lectura, y con CSP estricta por omisión | https://code.visualstudio.com/docs/languages/markdown |
| **MDHero** | `Cmd+E` **conmuta** ver/editar | https://github.com/vaibhav-kakde-in/mdhero |
| **Paperling** | *«Reader / Code / Split view — Ctrl+E to toggle»*, con sincronía de **scroll**, no de edición | https://github.com/Razee4315/Paperling |
| **MarkEdit** | La vista es una **extensión aparte**, de sólo lectura | https://github.com/MarkEdit-app/MarkEdit-preview |
| **Zettlr** | Un panel con marcadores decorados | https://github.com/Zettlr/Zettlr |
| Extensión *Document Viewer* de VS Code | Edita en la vista, pero **quitando la división**: *«avoiding the split view of raw md and preview pane»* | https://www.syncfusion.com/blogs/post/markdown-preview-vscode-extension |

**Cuidado con cómo se redacta esto**, porque hay un detalle técnico que la propia
documentación del proyecto tiene mal (ver §7): CodeMirror 6 **no permite dos
vistas sobre un mismo `EditorState`** —la selección es un campo del estado—. El
patrón oficial son dos estados que se reflejan las transacciones, y *«non-document
state (like selection) isn't shared between the editors»* —
https://codemirror.net/examples/split/. Eso es exactamente lo que hace
`src/editor.ts` con la anotación `espejo`, y está bien hecho. **Lo que no hay es
conversión inversa**, que es el invariante que importa. La frase defendible es
«un documento, dos vistas editables, sin serializador inverso», no «el mismo
`EditorState`».

### 3.2 Tablas celda por celda, con el markdown como fuente de verdad

Aquí la reclamación hay que estrecharla para que sea cierta.

- **Obsidian no lo hace.** La petición está en el archivo de funciones, y el
  planteamiento describe el comportamiento actual: *«Editing the table transforms
  the whole table to its source markdown format»* (16-mar-2022, sin respuesta del
  equipo) —
  https://forum.obsidian.md/t/live-preview-support-editing-a-table-cell-by-cell/34110
- **Typora y MarkText sí editan tablas visualmente** —pero son WYSIWYG de un solo
  panel y **con serializador inverso**: MarkText parte de un Marked.js modificado
  con DOM virtual sobre bloques — https://marktext.me/docs/dev/architecture. Es
  precisamente la arquitectura que la ESPEC descartó por lo de Folio.
- **Paperling tiene algo parecido**: *«Visual table editing: a toolbar appears
  when the caret is in a table»* — https://github.com/Razee4315/Paperling. Es
  barra de herramientas sobre la tabla, no edición de celda en la vista; sólo
  verificado por el texto del README, no probado.
- **SiYuan y compañía quedan fuera del criterio**: guardan `.sy` en JSON, no
  markdown — https://github.com/siyuan-note/siyuan/issues/8712

**Lo defendible:** editar celda por celda en la vista formateada **sin convertir
nada de vuelta**, con el `.md` como único documento. La combinación no la vi en
ningún otro.

### 3.3 Que el panel diga qué formato ya está puesto

**No encontré ningún editor de markdown que lo documente.** Tampoco encontré
evidencia de que no exista, así que esto es un hueco de búsqueda, no un hecho
(§7). Lo que sí se puede afirmar:

- La mayoría **no tiene barra flotante de selección**. En Obsidian hace falta un
  complemento (`cMenu`), que no documenta estado activo y lleva **cinco años sin
  actualizarse** — https://community.obsidian.md/plugins/cmenu-plugin
- **No es una idea novedosa en general**: indicar el formato activo es estándar
  en editores de texto rico (Word, Google Docs, Notion). Lo raro es verlo en un
  editor de markdown.
- En MarkFlow está implementado con `aria-pressed` además de la clase visual
  (`src/formato.ts`), o sea que también funciona con lector de pantalla. Ese
  detalle sí es inusual.

**Recomendación:** no venderlo como primicia. Venderlo como lo que es —quita la
duda de «¿ya estaba en negritas o se lo acabo de poner?»— y dejar el superlativo
fuera.

### 3.4 El aviso de imagen remota

Aquí el programa es **más fuerte** de lo que decía el encargo. No es un aviso:
`preferencias.ts` trae `imagenesRemotas: false` por omisión, y el permiso es
**por documento** y no se hereda al cambiar de pestaña (`main.ts`). Es
consentimiento explícito, no advertencia.

**Honestidad: hay precedente, y bueno.** VS Code trae seguridad `Strict` por
omisión en su vista de markdown, que *«Only loads trusted content and disables
script execution. Blocks `http` images»* —
https://code.visualstudio.com/docs/languages/markdown. Y en correo es doctrina
vieja: **Thunderbird bloquea contenido remoto por omisión**, justamente por
píxeles de rastreo y por no entregar IP ni ubicación.

**Pero entre editores de markdown no encontré ninguno que lo haga**, y la
evidencia por la vía contraria es elocuente: en Obsidian el problema se resuelve
con complementos de la comunidad que **descargan** las imágenes a la bóveda
(`obsidian-local-images`, `obsidian-local-images-plus`) —— o sea que los usuarios
lo rodean en vez de que la aplicación lo defienda. Zettlr sólo advierte que
*«Images can contain malicious code»*, sin mencionar la fuga de IP.

De todas las mitigaciones de la auditoría, **ésta es la que menos precedente
tiene en el nicho.**

Y el hallazgo nº 2 de la auditoría —la ruta UNC `\\servidor\pub\x.png` que abría
sesión SMB y entregaba una respuesta NTLMv2— **es una clase de ataque
documentada, no una hipótesis**: es el mecanismo de CVE-2023-23397 en Outlook,
donde una ruta UNC en un recordatorio filtraba el *hash* NTLMv2 sin interacción
del usuario, con CVSS 9.8 —
https://www.microsoft.com/en-us/security/blog/2023/03/24/guidance-for-investigating-attacks-using-cve-2023-23397/
Ese hallazgo, solo, justifica la auditoría entera.

### 3.5 La auditoría publicada — el activo más raro

Hay que separar dos cosas que se confunden:

**Buzón de avisos (`SECURITY.md`): lo tienen varios.** Verificado hoy por HTTP:
Joplin ✅, Zettlr ✅, MDHero ✅, Paperling ✅; MarkText ❌, `obsidian-releases` ❌.
El de Zettlr es el que más se acerca a un modelo de amenaza —distingue qué es y
qué no es un problema de seguridad, y admite que la aplicación *«has to strike a
balance between being secure and being useful»* —
https://github.com/Zettlr/Zettlr/blob/HEAD/SECURITY.md. Los de MDHero y Paperling
son política de reporte y alcance, sin hallazgos.

**Auditoría externa publicada: sí la hay, y hay que decirlo.** **Obsidian tiene
cuatro**, con PDF público — Cure53 (dic-2023, oct-2024, dic-2024) y Trail of
Bits (dic-2025, 11 hallazgos, 3 aún abiertos y documentados) —
https://obsidian.md/security. **Standard Notes** tiene otras cuatro, la más
reciente de hace cuatro años. Son auditorías **pagadas a terceros**, y en eso
MarkFlow no compite: la suya es propia.

*(Corrección a la premisa del encargo: **Joplin no pagó una auditoría externa.**
Lo único que existe es una revisión informal y no remunerada de una persona,
publicada el 2020-04-06 por Isaac Potoczny-Jones, sin informe formal. Y el lote
de diez avisos del 2026-09-09 tampoco es una auditoría: al leer los créditos
salen siete investigadores independientes distintos. Es divulgación coordinada
acumulada.)*

**Modelo de amenaza explícito y publicado: 3 de 9.** Cryptee (página propia),
Standard Notes (documento técnico) y **Zettlr** (en el manual de usuario, no en
su `SECURITY.md`). **Logseq y Notesnook no tienen ni `SECURITY.md`**; Typora
tiene uno de una línea con un correo, sin alcance ni modelo, a pesar de sus diez
CVE.

**Y aquí está la afirmación que sí se sostiene, que es más estrecha que
«nadie publica auditorías»: nadie combina las dos cosas.** Obsidian tiene el
mejor expediente de auditoría y **ningún modelo de amenaza publicado**; Cryptee
tiene el mejor modelo de amenaza y **cero auditorías**. Un modelo de amenaza
explícito *con la lista de mitigaciones que lo cierran y lo que se rechazó* no
lo tiene ninguno de los nueve. Lo más parecido es el **postmortem de Zettlr**
(2021), donde su autor escribe: *«I did not consider the case when a user gets
sent a Markdown document and opens it without prior inspecting it in another
editor»* — https://www.zettlr.com/post/postmortem-zettlr-first-security-incident
Es el modelo de amenaza de MarkFlow, admitido por otro autor **después** del
incidente. Ésa es la diferencia: aquí se escribió antes.

**Historial de avisos publicados** (API de avisos de GitHub, hoy):

| Proyecto | Avisos | El más grave |
|---|---|---|
| **Joplin** | **32** | Tanda del 2026-09-09, con toma de cuenta *high* y el *web clipper* secuestrable |
| **Logseq** | 1 | **Crítico**: ejecución remota de código en ≤ 0.10.13 (2025-08-18) |
| **Zettlr** | 1 | *Medium*: inyección de comandos por rutas sin sanear en exportación (2026-03-30) |
| **MarkText** | **0** | — |

Joplin merece el crédito: con 32 avisos publicados tiene una trayectoria de
divulgación que MarkFlow no tiene y no puede fingir. Son cosas distintas —ellos
tienen historial, MarkFlow tiene una auditoría profunda— y conviene decirlo así.

**Por qué el modelo de amenaza está bien elegido, con un caso real:**
**CVE-2023-2317**, XSS basado en DOM en Typora que llevaba a **ejecución de
código**, CVSS 8.6, explotable *al abrir un archivo markdown malicioso* o pegar
texto de una web comprometida; cargaba `typora://app/…/updater/update.html`
dentro de un `<embed>` del propio markdown. Parchado en 1.6.7. Descubierto por
STAR Labs, divulgado el 19-ago-2023 —
https://starlabs.sg/advisories/23/23-2317/ ·
https://github.com/advisories/GHSA-vwv2-9jpv-577p

Es, palabra por palabra, el hallazgo crítico nº 1 de la auditoría de MarkFlow en
otro programa. **La frase para el README es ésa: no es paranoia, ya pasó en el
editor de markdown más vendido.**

Y hay dos precedentes más que dan todavía mejor:

- **El enlace `javascript:` en una tabla ya le pasó a Zettlr y a MarkText.** El
  manual de Zettlr advierte que las celdas de tabla *«could contain malicious
  HTML code that will be executed upon rendering it»* —
  https://github.com/Zettlr/zettlr-docs/blob/master/docs/en/getting-started/a-note-on-security.md
  — y **CVE-2022-21158** es exactamente eso en MarkText &lt;0.17.0: XSS almacenado
  por enlaces con esquema `javascript:` dentro del documento.
- **Y el que cierra cualquier discusión: CVE-2026-20841, en el Bloc de notas de
  Windows.** Microsoft metió markdown en Notepad el 2025-05-30, y siete meses
  después tenía **ejecución de comandos, CVSS 8.8**: un enlace en un `.md`
  llegaba a `ShellExecuteExW()` sin filtrar el esquema, alcanzando `file://` y
  `ms-appinstaller://` sin el aviso normal de Windows. Reportado por Delta
  Obscura vía ZDI, 2026-02-10 —
  https://www.thezdi.com/blog/2026/2/19/cve-2026-20841-arbitrary-code-execution-in-the-windows-notepad
  **El editor de texto más conservador que existe cayó por el mismo vector que
  esta auditoría cerró**, en la misma plataforma, este año. Es el argumento, y
  no hay que adornarlo.

**Una nota de arquitectura que juega a favor:** los RCE de Typora, MarkText y
Joplin dependían todos del último eslabón de Electron —`require('child_process')`
o `window.reqnode` alcanzables desde el webview—. Tauri no expone eso: lo que
corre en el webview sólo llega al sistema por comandos IPC declarados. Un XSS
aquí tendría que encontrar un comando expuesto, que es justo lo que el
`CLAUDE.md` del proyecto llama «el puente». **Pero ese límite también ha
fallado**: **CVE-2026-42184** (Tauri 2.0–2.11.0) comprobaba sólo el primer
subdominio en `is_local_url()`, así que `http://app.evil.com/` pasaba por
origen local — https://github.com/tauri-apps/tauri/security/advisories/GHSA-7gmj-67g7-phm9
**Verificado hoy: `Cargo.lock` resuelve `tauri 2.11.5`, por encima del parche
(2.11.1). Limpio.**

### 3.6 Las bibliotecas base, verificadas contra la base de avisos

La auditoría afirmaba que «la versión de Mermaid es posterior a los CVE
conocidos». **Comprobado hoy**, cruzando las versiones exactas del
`package-lock.json` contra la base de avisos de GitHub (`/advisories?affects=`):

| Biblioteca | Versión instalada | Aviso más reciente del paquete | ¿Alcanza? |
|---|---|---|---|
| KaTeX | **0.18.7** | CVE-2025-23207, afecta ≤ 0.16.20 | **no** |
| Mermaid | **12.0.0** | CVE-2026-71439 y 3 más, afectan < 11.16.1 | **no** |
| DOMPurify | **3.4.15** | GHSA-55q2-fjhq-7xh7 (2026-08-07), afecta ≤ 3.4.12 | **no** |
| marked | **16.4.2** *(la mete Mermaid)* | CVE-2026-41680 *high*, afecta 18.0.0–18.0.1 | **no** |

**Cero avisos vigentes en las cuatro.** La consulta filtrada por versión
instalada (`affects=katex@0.18.7`, etc.) devuelve lista vacía en los cuatro
casos. La afirmación de la auditoría queda respaldada, y además extendida a
KaTeX, DOMPurify y `marked`, que no estaban en ella.

Vale la pena anotar el contexto, porque es el argumento de por qué esto no se
revisa una vez y se olvida: **Mermaid acumula 16 avisos, `marked` 18 y DOMPurify
28**, con tandas tan recientes como agosto de 2026. Son las bibliotecas que
convierten texto de procedencia desconocida en DOM; es donde salen los fallos.
Que hoy estén limpias es una foto, no un estado permanente.

**Y dos matices que corrigen el razonamiento de la auditoría, no su resultado:**

- **`trust:false` no cubre todo lo de KaTeX.** De sus cinco CVE, **dos no pasan
  por `trust`**: CVE-2024-28243 (`\edef`) y CVE-2024-28244 (sub/superíndices
  Unicode) evaden el contador `maxExpand` y son bombas de expansión TeX —bucle
  casi infinito, agotamiento de memoria—. Con KaTeX &lt;0.16.10, `trust:false` no
  salva de eso. **Aquí no aplica: 0.18.7 está por encima.** Pero el argumento
  escrito «KaTeX con `trust:false`» es más débil de lo que suena, y conviene
  saberlo antes de publicarlo.
- **El XSS más relevante para este stack vivía en la intersección Mermaid+KaTeX.**
  **CVE-2025-54881**: las etiquetas de diagramas de secuencia llegaban a un
  `innerHTML` en `calculateMathMLDimensions` **cuando KaTeX está activo**. El
  sumidero es de Mermaid, así que `trust:false` no lo detiene. Estuvo abierto
  casi dos años (10.9.0 → parchado en 10.9.4/11.10.0). **Aquí tampoco aplica:
  Mermaid 12.0.0.** Su hermano CVE-2025-54880 era explotable **con la
  configuración por omisión** (`securityLevel: "strict"`); el único nivel que lo
  habría contenido es `"sandbox"`, que renderiza en un iframe aislado, y es lo
  que recomiendan los avisos de 2026. **Verificado: `src/widgets.ts:624` usa
  `securityLevel: 'strict'`**, que es el nivel que esos dos CVE atravesaron. Hoy
  no importa —la versión 12.0.0 los tiene parchados—, pero **`'sandbox'` es la
  postura que sobrevive al siguiente**, y es la única acción concreta que sale de
  todo este apartado. Tiene contrapartida: el iframe aislado cambia cómo se
  hereda el tema claro/oscuro, así que no es un cambio de una línea.

**El tope de dimensiones declaradas también tiene su CVE**, y es casi idéntico:
**CVE-2026-55497** (Cloudreve, 2026-07-24). La aplicación validaba **el tamaño
comprimido e ignoraba las dimensiones declaradas en la cabecera**, así que un
archivo de **65 bytes** forzaba la reserva de varios gigabytes y tumbaba el
proceso entero —— y uno de los vectores era la generación de miniaturas, activa por
omisión — https://advisories.gitlab.com/golang/github.com/cloudreve/cloudreve/v4/CVE-2026-55497/
En Pillow es doctrina establecida desde hace años (`MAX_IMAGE_PIXELS`,
`DecompressionBombError`), con CVE propios por **evadir** el control por rutas
alternas. La mitigación de la auditoría es la correcta y no es teórica.

---

## 4. Lo que nos falta

Ordenado por lo que más echaría de menos alguien que se baja MarkFlow y no es
Luis.

### No choca con «sin bóvedas» — son candidatas legítimas

1. **Exportar a PDF y HTML.** Lo primero que se va a extrañar, con diferencia. Es
   lo que hace que un `.md` sirva para entregar algo. Typora, Obsidian, Markdown
   Monster y Zettlr lo tienen. **No necesita carpetas**: es el documento abierto
   y una ruta de salida. Y WebView2 ya sabe imprimir.
2. **Multiplataforma.** Sólo Windows. Toda la banda Tauri es Win/mac/Linux con el
   mismo código; MDHero y Paperling además. Para un despacho con una sola máquina
   no importa; para que alguien más lo use, es la mitad del público.
3. **Corrector ortográfico.** Zettlr, Typora, ghostwriter y QOwnNotes lo traen.
   En un editor donde se escribe prosa técnica en español se nota rápido.
4. **Interfaz en inglés.** La i18n está en curso; sin ella, el público es el
   hispanohablante y nada más. Barato y de mucho efecto.
5. **Instalador firmado.** Decidido que no se firma (A2). El costo es real: aviso
   de editor desconocido en cada instalación. Ver §5 para cómo se redacta, y una
   salida que no cuesta dinero (SignPath).
6. **Pegar e insertar imágenes.** Arrastrar una imagen y que se guarde junto al
   documento es de lo más pedido en editores de markdown.
7. **Modo Vim.** Nicho, pero el nicho es ruidoso. CodeMirror 6 tiene paquete.
8. **Impresión directa.** Hermana pequeña del PDF.

### Choca con «sin bóvedas» — no son candidatas

Estas exigen que el programa conozca **un conjunto de archivos**, no un archivo.
Nombrarlas como descartadas a propósito vale más que callarlas:

- **Enlaces `[[wiki]]`.** Resolver un nombre a un archivo exige indexar una
  carpeta. Es la bóveda por la puerta de atrás.
- **Grafo de notas.** Imposible sin el índice anterior.
- **Búsqueda global entre archivos.** Ya está fuera de la v1 por decisión; ésta
  es la razón de fondo, no sólo la de velocidad.
- **Explorador de carpetas.** Es literalmente la bóveda.
- **Retroenlaces y etiquetas transversales.** Mismo problema.
- **Sincronización.** En teoría podría ser por archivo; en la práctica, todos los
  que la ofrecen sincronizan una carpeta, y arrastra cuentas y servidor.

### Ni choca ni se extraña tanto

- **Plugins.** No contradice nada —Typora tiene temas, MarkText no tiene
  plugins— pero abre superficie de ataque y contradice la auditoría más que la
  ESPEC. **Es la que yo dejaría fuera con más ganas.**

---

## 5. El patrón de los README

De 24 README leídos en crudo. El orden que aguanta en 7 de 8:

```
identidad (logo + nombre) → una frase de qué es → insignias → CAPTURA
→ prosa corta de qué es y para quién → instalación → funciones
→ desarrollo → contribución → licencia
```

- **La captura**: una sola en el 80 %. Anclada con `<img width="900">` en HTML,
  no con markdown, porque GitHub la infla a todo lo ancho. GIF animado sólo en 2
  de 24. Va **justo después del párrafo de qué-es**.
- **No hace falta un README largo.** `zed-industries/zed` tiene 48 líneas, 2
  insignias, ninguna captura.
- **Insignias: cuatro o cinco, estilo plano.** Las que sobreviven: licencia,
  versión, CI nativo de Actions, descargas, chat. Se ven a viejo: Gitter,
  AppVeyor, Coveralls, «issues still open», compartir en Twitter y
  `style=for-the-badge`. La tendencia de 2026 son insignias **descriptivas del
  stack** (`Tauri v2`, `Rust`, `Windows 10|11`), que es lo que le conviene.
- **Tabla comparativa: sólo 1 de 24, y funciona porque le debía algo a su
  antecesor.** La alternativa que yo copiaría es la de Spacedrive: una pregunta
  como encabezado — *«Is this a replacement for Finder or Explorer? No.»* —
  https://github.com/spacedriveapp/spacedrive. Cuesta un párrafo, no se queda
  obsoleto y no invita a discutir. Para MarkFlow: *«¿Sustituye a Obsidian o a
  Zettlr? No.»*

### Uso personal sin sonar hostil — citas reales

El mejor modelo es el más discreto. **Tolaria** (Tauri, markdown, un autor) no
tiene sección de descargo: lo mete en sus principios —
https://github.com/refactoringhq/tolaria

> «I built this for myself and for sharing it with others.»

**peek** es el más explícito sin ser agresivo, y su remate redirige en vez de
rechazar — https://github.com/unwrntd/peek

> «This is a hobby project with no warranty, no support, and no guarantees»

> «If you need a production-ready, supported dashboard solution, please consider
> commercial alternatives.»

Frente a **DuckStation**, que con la misma política escribe *«do not email me
about issues about it»* — https://github.com/stenzek/duckstation. Misma
política, tono opuesto.

Las cuatro palancas que separan lo firme de lo hostil: **declara procedencia, no
limitación** («lo hice para mí» explica el diseño; «no doy soporte» sólo niega);
**habla del software, no del lector**; **redirige**; y **dilo una sola vez, arriba**.

### El instalador sin firmar

**Dato que cambió y conviene saber**, de la doctrina oficial de Tauri —
https://v2.tauri.app/distribute/sign/windows/

> «Since 2024, an EV Certificate no longer gives your app an immediate reputation
> with Microsoft SmartScreen.»

O sea: pagar un certificado EV **ya no salta el aviso**. La reputación se
construye firmando cada versión con el mismo certificado. Decidir no firmar
cuesta menos de lo que parece.

**Ninguno de los 7 editores de markdown clásicos menciona el tema.** Los buenos
ejemplos vienen de fuera del nicho, y el mejor es de tres capas:

1. **Pegado al enlace de descarga**, como Sigma File Manager: *«Unsigned
   installable (might see antivirus errors)»* —
   https://github.com/aleksey-hoffman/sigma-file-manager
2. **En instalación**, como patch.doc: *«Neither app is actually unsafe, just
   unsigned»* / *«on Windows it's just More info → Run anyway»* —
   https://github.com/hendrik-haehner/patch.doc
3. **Una subsección de verificación**, como InstallerClean: *«Every download's
   SHA-256 is on its release page»* —
   https://github.com/no-faff/InstallerClean

La tercera es la que encaja con el criterio de ingeniería: en vez de pedir fe,
dar con qué comprobar. SHA-256 por *release* y enlace al *workflow* que lo
construyó.

**Y una salida que no cuesta dinero:** la **SignPath Foundation** firma gratis
proyectos de código abierto. InstallerClean explica por qué sirve a un proyecto
de una persona: *«The certificate belongs to the foundation rather than to me,
because a certificate has to be issued to a legal entity and a one-person
project isn't one»*. Kando también la usa —
https://github.com/kando-menu/kando

### Lo que el programa NO hace

**Ningún README de los 24 usa el encabezado `## Non-goals`.** Las formas que sí
existen, y la mejor para este caso es la segunda:

- **`## What it doesn't do`**, cada viñeta con la alternativa: *«no hago X, para
  eso usa Y»* (InstallerClean).
- **`## Known limits`**, con la razón detrás de cada límite. El encabezado de
  flac-verifier hace todo el trabajo: *«They are physical limits, not bugs. They
  are measured and documented on purpose»* —
  https://github.com/FraysKosher/flac-verifier — y varios cierran con *«That is
  deliberate»*.

Esa segunda forma es la que conviene, y no por estilo: **un límite con su razón y
la palabra «deliberado» es un sello de doctrina.** Dentro de un año, cuando te
topes con el límite, el README te dice si fue una decisión o un pendiente. Es la
categoría «NO FUNCIONÓ» del cuartel de estrategia, metida en el README.

---

## 6. Que un agente entienda el proyecto

### `AGENTS.md` es la apuesta, y ya no es de nadie

Nació en agosto de 2025 (Codex, Amp, Jules, Cursor, Factory) y el **9 de
diciembre de 2025 OpenAI lo donó a la Agentic AI Foundation** de la Linux
Foundation, junto con MCP y goose —
https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation
Eso es lo que más importa: **el formato dejó de pertenecer a un fabricante.**

Lo leen nativamente 23 herramientas según el sitio oficial —Codex, Cursor,
Copilot, Zed, Gemini CLI, Devin, Windsurf, Jules…— https://agents.md/

**Adopción, con la trampa señalada:**

| Cifra | Qué mide | Fuente |
|---|---|---|
| «más de 60 000 proyectos» | búsqueda `path:AGENTS.md` sin forks | Linux Foundation, **9-dic-2025** |
| **4 416 proyectos** | con `AGENTS.md` en una muestra de **128 018** repos | Robbes et al., datos 21-feb-2026 — https://arxiv.org/abs/2601.18341 |

La cifra de 60 000 **es la misma en el comunicado de diciembre de 2025 y en el
sitio de hoy**: es piso histórico, no cuenta actual. En el mismo estudio,
`CLAUDE.md` aparece en **12 053** proyectos —más que `AGENTS.md`—, aunque no
comparan igual (Claude Code también se detecta por el *trailer* de coautoría).

### `CLAUDE.md` no migró. Textual de la documentación oficial

> «Claude Code reads `CLAUDE.md`, not `AGENTS.md`.»
> — https://code.claude.com/docs/en/memory

Y la misma página da la solución: un `CLAUDE.md` de una línea con `@AGENTS.md`.
**Para esta máquina importa el aviso que sigue**: en Windows el symlink exige
privilegio de administrador o Modo Desarrollador, así que la forma correcta aquí
es el *import*, no el enlace.

### `llms.txt`: tu sospecha era correcta, no aplica

Es un archivo **en la raíz de un dominio web**, para que un agente encuentre la
documentación de un sitio — https://llmstxt.org/. No tiene nada que ver con un
repo de código. Y la evidencia de que lo usen es mala: John Mueller, de Google,
citado con registros de servidor de por medio —

> «none of the AI services have said they're using LLMs.TXT (and you can tell
> when you look at your server logs that they don't even check for it)»
> — https://ppc.land/llms-txt-adoption-stalls-as-major-ai-platforms-ignore-proposed-standard/

**No lo pongas.** Si algún día hay sitio de documentación, entonces, y con
expectativas bajas.

### La evidencia incómoda, que es la parte útil

Hay **un estudio con método** sobre si estos archivos sirven: Gloaguen et al.,
ETH Zúrich, arXiv:2602.11988 — https://arxiv.org/abs/2602.11988. Banco propio de
138 instancias sobre 12 repos, con archivos escritos por sus propios
desarrolladores.

- Los generados por un LLM **bajan** el rendimiento (sin significancia).
- Los escritos por humanos suben 2.4 % (tampoco significativo), pero **superan a
  los generados por LLM en 7 %, y eso sí es significativo** (p = 0.038).
- Ambos **encarecen**: +20 % y +23 % de coste, y varios pasos más, con p < 0.001.
- **Los resúmenes de arquitectura no sirven, y lo midieron**: contaron los pasos
  hasta que el agente toca por primera vez un archivo del parche real, y con
  resumen de repo **no baja**. Conclusión literal: *«context files are not
  effective at providing a repository overview»*.

Y converge con la doctrina oficial de Anthropic, que al recortar quita *«directory
layouts, dependency lists, and architecture overviews»* y conserva *«pitfalls,
rationale, and conventions that differ from tool defaults»* —
https://code.claude.com/docs/en/memory

**Traducción para este repo: el archivo vale por lo que el agente no puede
deducir del código, y por nada más.** El `CLAUDE.md` que ya existe está, por
casualidad o por criterio, exactamente en ese registro: son cicatrices
—heredoc que se come barras, no probar sobre archivos reales, no editar el
registro— no un mapa de carpetas. Eso es lo que hay que conservar al partirlo.

### Los ejemplos que valen la pena copiar

- **`astral-sh/uv`** (Rust) — el mejor estilo: `AGENTS.md` de 2 347 bytes, ~25
  líneas, una regla por línea con verbo al frente (`ALWAYS`, `NEVER`, `PREFER`,
  `AVOID`), y `CLAUDE.md` de **11 bytes**: `@AGENTS.md` —
  https://github.com/astral-sh/uv/blob/main/AGENTS.md
- **`zed-industries/zed`** — lo más valioso para este caso: una sección de
  **higiene del propio archivo de reglas**, con `What NOT to put in .rules` y
  `No drive-by additions` — https://github.com/zed-industries/zed/blob/main/.rules
  Es el antídoto escrito contra que el archivo se vuelva marco rígido.
- **`rolldown/rolldown`** — separa de verdad contexto permanente (`AGENTS.md`) de
  procedimiento bajo demanda (`.claude/skills/`) —
  https://github.com/rolldown/rolldown
- **`spacedriveapp/spacedrive`** (Tauri) — saquea sus comandos de Tauri, pero no
  su tamaño: **750 líneas**, casi 4× el límite que recomienda Anthropic.
- **`tauri-apps/tauri` no tiene ninguno.** No hay doctrina que heredar de arriba.

### Lo que le conviene a este repo

```
AGENTS.md                  ← canónico, todo el criterio. Menos de 150 líneas
CLAUDE.md                  ← una línea: @AGENTS.md  (+ lo que sea sólo de Claude)
.claude/skills/<nombre>/SKILL.md   ← lo largo: empaquetado, release. Carga bajo demanda
.claude/rules/rust.md      ← opcional, con paths: ["src-tauri/**/*.rs"]
```

**No poner**: `llms.txt`, `.cursorrules` ni `.windsurfrules` (obsoletos por
declaración oficial), `GEMINI.md`, metadatos para agentes en el README (no es
práctica real), symlink en lugar del *import*. `.github/copilot-instructions.md`
tampoco hace falta: Copilot ya lee `AGENTS.md` en cualquier parte del repo —
https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions

**Y el argumento de fondo para las skills**, que resuelve la objeción de siempre:
una skill en `.claude/skills/` **no cobra contexto en toda sesión** —sólo se
carga su nombre y descripción, y el cuerpo entra cuando la tarea casa—
https://code.claude.com/docs/en/skills. Es el lugar correcto para lo que hoy
tienta meter en `CLAUDE.md`.

---

## 7. Lo que no pude verificar

**Huecos de esta investigación:**

1. **Lo que queda del censo de CVE.** El barrido sí se completó: Typora (10 CVE),
   Joplin (15 más el lote de 2026-09-09), MarkText (8), Obsidian (CVE-2023-2110,
   y es *gusano*: se propaga a otras notas de la bóveda vía `obsidian://new`),
   VS Code (**un solo CVE en el visor nativo en toda su historia**, CVE-2021-34479
   —caja de arena y CSP con nonce funcionaron—, mientras que la extensión
   *Markdown Preview Enhanced* acumula 7), y las cuatro bibliotecas base.
   **Lo que sigue sin revisar y es lo más relevante para este stack: los avisos
   de RustSec para los crates `image`, `png` y `resvg`**, que es por donde entra
   una imagen en el lado Rust. Ese hueco sigue abierto.
   Y tres identificadores que **no deben citarse**: CVE-2017-17461 (rechazado),
   GHSA-32vw-r77c-gm67 (retirado) y CVE-2025-7969 (disputado por el mantenedor
   de markdown-it). CVE-2026-41610 existe en VS Code pero **Microsoft no nombra
   el componente**: atribuirlo al visor de markdown sería inventar.
2. **Peso del instalador de Obsidian: 315.7 MiB** viene de la API de GitHub de un
   *release* anterior (v1.13.7); el más reciente (v1.13.8) sólo publica el `.apk`
   de Android. No lo pude medir yo por HTTP: su CDN devuelve `Content-Length: 0`.
3. **Markdown Monster**: tengo el precio ($99 por usuario, perpetuo) y que su
   fuente está en GitHub, pero **no verifiqué la licencia del código ni el peso
   del instalador**.
4. **MarkEdit**: el «~4 MB» es lo que declara su propio README, no una medición.
5. **Huella de memoria de la competencia: casi nadie la publica.** Obsidian,
   Typora, Zettlr, MarkText, Logseq y Notepad++ no dan cifra oficial. Las únicas
   con fuente son QOwnNotes (*«a little over 100MB»*, prensa, XDA, 21-ene-2026) y
   Zed (*«~600MB»*, **su propia página de ventas**). **Conclusión operativa: los
   436 MB de MarkFlow no se pueden comparar con nadie, así que no se pueden
   presentar como ventaja ni defender como igualdad.** Y hay un dato que empeora
   el asunto: MDHero publica 45 MB en reposo — pero **medido en macOS con
   Activity Monitor**, donde Tauri usa WKWebView y no WebView2, así que no es
   comparable — https://mdhero.app/blogs/building-native-viewer-8mb/. La propia
   incidencia de Tauri lo dice: *«Tauri using Edge WebView 2 had similar memory
   usage with Electron, which makes sense given both are based on Chromium»* —
   https://github.com/tauri-apps/tauri/issues/5889
6. **«¿Exige bóveda?» sin prueba empírica en cinco casos**: ghostwriter,
   Apostrophe, Abricotine, Remarkable y Mark My Words. El «no exige» es
   documental y negativo —ninguna documentación menciona bóveda— y no instalé
   ninguno. Con evidencia positiva y explícita: Typora, MarkText, Notepad++,
   VS Code, Zettlr, Zed, Obsidian, Logseq, Joplin.
7. **Que nadie tenga los dos paneles editables** es ausencia de evidencia, no
   evidencia de ausencia. Verifiqué los 8 candidatos con más probabilidad. Si se
   publica esa afirmación, conviene redactarla como «no encontré ninguno», no
   como «es el único».
8. **Lo mismo, y más débil, con el indicador de formato activo** (§3.3): las
   búsquedas devolvieron documentación de componentes comerciales y nada del
   nicho. Es el hueco más flojo del informe.
9. **La edición visual de tablas de Paperling** sólo está verificada por el texto
   de su README. No ejecuté el programa.
10. **Precio del Logseq Sync**: todas las cifras que aparecen ($5/mes) son de
    agregadores; no está en su sitio oficial. No lo doy por bueno.

### Nota de método, para no volver a pagarla

Lo que funcionó y lo que no, por si hay otro barrido de este tipo:

- **Los pesos de instalador**: `api.github.com/repos/X/releases` da el campo
  `size` en bytes, y `curl -sIL` da `Content-Length` para descargas fuera de
  GitHub. Ninguna página de producto hace falta.
- **Las versiones vulnerables**: `api.github.com/advisories?ecosystem=npm&affects=paquete@version`
  devuelve **lista vacía si esa versión está limpia**. Es la consulta que
  convierte «creo que estamos al día» en dato.
- **Para verificar un CVE**: `github.com/advisories/GHSA-…`, la pestaña
  `/security/advisories` del propio proyecto, `api.osv.dev/v1/vulns/<id>` y
  `cveawg.mitre.org/api/cve/<id>`. **NVD es JavaScript y devuelve página vacía;
  cvedetails y vuldb dan 403.** No se pierda el tiempo ahí.
- **Lo que no se pudo**: la búsqueda de código de GitHub exige sesión, así que
  las cuentas del tipo «cuántos repos tienen tal archivo» no se pueden
  reproducir; hay que citar la cifra de alguien más, con su fecha.

### Discrepancias entre el encargo y el propio repositorio

Tres cosas que el encargo afirmaba y el repo contradice. Ninguna es grave, pero
las tres irían a un README público, así que conviene resolverlas antes:

1. **«Autoguardado con escritura atómica».** La escritura atómica existe; **el
   autoguardado se quitó el 2026-09-16** y el guardado es explícito —ESPEC.md §3
   y `CLAUDE.md`, que además pide no volver a automatizarlo. Si se anuncia
   autoguardado, se anuncia algo que se decidió quitar por una razón buena.
2. **«Pestañas» e «instancia única».** Están en el programa, pero ESPEC.md §6 las
   sigue listando como *fuera de la v1*, y la auditoría cierra con *«sin control
   de instancia única»* entre lo abierto. **La ESPEC se quedó atrás**, no el
   programa.
3. **«Los dos paneles son vistas sobre el mismo `EditorState`»** (ESPEC.md §2 y
   `CLAUDE.md`). **Eso no es lo que hace el código, y no es posible en
   CodeMirror 6**: la selección es un campo del estado, y el patrón oficial son
   dos estados que se reflejan las transacciones —
   https://codemirror.net/examples/split/. `src/editor.ts` crea
   `estadoFuente` y `estadoPresentacion` por separado y los refleja con la
   anotación `espejo`, saltándose `undo`/`redo` a propósito. **El código está
   bien; la descripción está mal.** Y es la clase de error que cuesta caro en un
   `CLAUDE.md`: el siguiente agente va a buscar un estado compartido que no
   existe. El invariante que de verdad manda —**nunca hay conversión inversa**—
   se sostiene entero.

### Dos avisos de publicación que no son técnicos

- **El nombre está tomado, dos veces.** `drl990114/MarkFlowy` (2 393★, AGPL-3.0,
  editor WYSIWYG de markdown en Tauri, activo) y `vorojar/MarkFlow` (8★, *«Elegant
  ultra-lightweight Markdown editor»*). La búsqueda de repos por nombre devuelve
  **218 coincidencias** con «markflow». No es un impedimento legal ni técnico,
  pero sí garantiza confusión y vuelve el proyecto invisible en cualquier
  búsqueda. **Es decisión de Luis, y se toma antes de publicar, no después.**
- **Falta el paquete mínimo**: no hay `LICENSE`, ni `SECURITY.md`, ni `AGENTS.md`,
  ni `.github/`. El remoto ya está configurado (`github.com/lalomalvi/MarkFlow`),
  con 34 commits. La licencia es una de las tres decisiones con filo que ya
  estaban anotadas en `pendientes.md` (A1); de los comparables, la banda Tauri se
  reparte entre MIT (MDHero, Bokuchi, Ferrite), Apache-2.0 (Paperling) y AGPL-3.0
  (MarkFlowy, Markra).
