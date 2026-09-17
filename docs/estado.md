# Estado vigente

**Última actualización: 2026-09-16.** MarkFlow v0.1.0, las cuatro etapas cerradas
y la auditoría de seguridad aplicada.

Esto es **estado**, no bitácora. El relato de cómo se llegó aquí está en los
mensajes de los commits; las decisiones y su porqué, en [ESPEC.md](../ESPEC.md);
la auditoría, en [auditoria/INFORME.md](../auditoria/INFORME.md).

---

## Qué hay hoy

| | |
|---|---|
| Repo | `lalomalvi/MarkFlow`, privado. Remoto por **HTTPS** con el token de `gh`: la clave SSH no está disponible desde la sesión de trabajo |
| Ejecutable | `markflow.exe`, **7.79 MB** |
| Instalador | `MarkFlow_0.1.0_x64-setup.exe`, **4.93 MB**, NSIS, **sin UAC** |
| Cadena | Rust 1.98.1 (MSVC), Node 22, Tauri 2, Vite 8, TypeScript 6 |
| WebView2 | ya venía en la máquina, v153 |

> **Instalado y en uso** en `%LOCALAPPDATA%\MarkFlow`, con los arreglos de la
> auditoría dentro —— comprobado contra el binario, no contra el reporte del
> instalador. Ver *La migración, cerrada*.

### Lo que el programa hace

- Abre cualquier `.md` de cualquier carpeta. **Sin bóvedas**, sin registrar nada.
- Dos paneles lado a lado, los dos editables, con edición *inside*. Se puede
  dejar sólo uno: *Fuente* · *Ambos* · *Vista*.
- Dibuja en el panel de presentación: **tablas** (con alineaciones), **Mermaid**,
  **KaTeX** en línea y en bloque, **imágenes** locales y remotas, **avisos**
  (`[!NOTA]`, `[!AVISO]`, `[!PELIGRO]`, `[!TIP]`, `[!EJEMPLO]`, `[!CITA]`) y
  **casillas de tarea** que se pican. El frontmatter YAML sale como metadatos.
- **Tablas editables**: un clic en una celda la edita. Ver más abajo.
- **Buscar dentro de la nota** (Ctrl+F), en la barra arriba a la derecha. Enter y
  Shift+Enter recorren, con contador de coincidencias.
- **Panel de formato al seleccionar**: resaltar, negrita, cursiva y tachado, sin
  salir de la vista.
- **Sintaxis**: notas al pie `[^1]`, `==resaltado==`, avisos con los 13 tipos de
  Obsidian y título propio, en inglés y español, mayúscula o minúscula.
- **Convivencia con agentes**: al recuperar el foco **y al volver a una pestaña**,
  si otro programa tocó el archivo se recarga solo; si había cambios locales,
  pregunta. Lo segundo se añadió el 2026-09-16: la revisión sólo miraba la
  pestaña activa y sólo al recuperar el foco de la ventana, así que una pestaña
  de fondo podía quedarse indefinidamente con una copia vieja —— y escribir encima
  de lo que el agente ya había guardado.
- **Una sola ventana.** Abrir un `.md` con MarkFlow en marcha lo manda como
  pestaña a la ventana existente, en vez de levantar otra.
- **Imágenes de internet bloqueadas de fábrica** y caracteres invisibles marcados.
- **Guardado explícito**: botón *Guardar*, Ctrl+S, punto en el título cuando hay
  cambios, y diálogo al cerrar o al abrir otro archivo con cambios pendientes.
  **Si un guardado falla, sale un diálogo**, no un texto chico en la barra.
- Deshacer y rehacer con botones y con Ctrl+Z / Ctrl+Y.
- **Tema claro / oscuro / sistema**, con botón que cicla los tres y recuerda la
  elección. Los diagramas de Mermaid se redibujan con el tema.
- **Pestañas en la barra de título**, como el Bloc de notas nuevo: Ctrl+T nueva,
  Ctrl+W cerrar, Ctrl+Tab girar, botón central del ratón para cerrar. El nombre
  del archivo vive ahí, y el punto de color dice cuál tiene cambios sin guardar.
- **Barra de título propia.** La ventana va sin decoraciones para que las
  pestañas quepan arriba, así que minimizar, maximizar y cerrar los dibuja el
  programa, con las medidas de Windows 11.
- Arrastrar y soltar, **varios archivos a la vez**, uno por pestaña. Arranque con
  el archivo como argumento.
- **Divisor arrastrable** en modo Ambos, con doble clic para volver al 50/50.
- **Panel de Configuración** (Ctrl+`,`), sin botón de aceptar: cada cambio se
  aplica y se guarda al instante.

### La marca y el icono

**El logo llegó el 2026-09-17** y los originales viven en
[marca/](../marca/LEEME.md) —— el `.ai`, el `.svg` y el `.png`. Ahí no se edita
nada: si el logo cambia, llega uno nuevo y se regenera todo con
`npx tauri icon marca/icono-fuente-1024.png`.

**El icono lleva sólo el símbolo, sobre baldosa blanca.** La palabra «MarkFlow»
no entra: a 16 píxeles es una mancha gris. La baldosa se eligió comparando cuatro
variantes a tamaños reales sobre fondo claro y oscuro —— sin fondo, la M negra
**desaparece en la barra de tareas oscura**, y sobre baldosa azul la F del logo
se funde con ella.

**El símbolo también está en la barra de título**, con la M en `currentColor`
para que tome el color del texto: en negro fijo desaparecería con el tema
oscuro.

### Paleta

Sale del icono del programa: tinta `#20232a` / `#191c23` y azul de `#0061f5` a
`#12a2fc`. El acento fue ámbar hasta el 2026-09-16.

### Las pestañas

Cada pestaña se lleva **los dos estados completos de CodeMirror**, no sólo su
texto: ahí viven la historia de deshacer y la selección. Volver a una pestaña la
devuelve tal como estaba, no la reabre del disco. El editor sigue siendo uno
solo; cambiar de pestaña guarda los estados de la que sale y le pone los de la
que entra.

**Tope: 30 pestañas.** Cada una guarda esos dos estados con su árbol sintáctico,
y pasado ese punto el programa pesa más de lo que ayuda. Al llegar lo dice en vez
de tragar hasta atragantarse — probado con 34 intentos seguidos.

El nombre se recorta según cuántas hay: 26 caracteres con 3 o menos, y bajando
hasta 6 con más de 16. Nunca menos de 6, porque por debajo de eso todas las
pestañas se parecen y dejan de servir para distinguir. Al recortar se conserva la
extensión si cabe.

Abrir un archivo **ya abierto** no lo duplica: va a su pestaña. Y una pestaña en
blanco y sin tocar se reaprovecha en vez de sumar otra.

### La barra de título

`decorations: false` en la configuración de Tauri. A cambio hay que dibujar los
botones de ventana y manejar el arrastre con `data-tauri-drag-region`.

**Cerrar llama a `close`, no a `destroy`.** `close` dispara `onCloseRequested`,
que es donde se pregunta por las pestañas con cambios sin guardar; `destroy` se
lo saltaría y perdería trabajo.

El botón de tema alterna **dos** estados, claro y oscuro, partiendo de lo que se
ve para que el primer clic siempre cambie algo. «Sigue a Windows» está en
Configuración, que es donde se elige a propósito.

### El divisor

**20 % – 80 %, y a la vez mínimo 320 px por panel.** Gana el más restrictivo.
La fracción sola no dice nada: un cuarto de 1200 px son 300, donde el markdown
se parte cada tres palabras; un cuarto de 2560 son 640, de sobra. Al pasarse del
mínimo por un margen claro, el panel **se cierra** y se pasa al modo único, en
vez de topar contra un muro.

### Configuración

| Aspecto | Letra | Editor |
|---|---|---|
| Tema: sistema · claro · oscuro | Texto: 5 familias | Números de línea |
| Profundidad del oscuro: suave · normal · profundo | Mono: 3 familias | Sangría: 2 · 4 · tabulador |
| Colores del código: tinta · Notas y Nodos · sobria | Tamaño 11–26 px | **Eco al picar un bloque** |
| | Interlineado 1.2–2.4 | Reabrir el último archivo |
| | Ancho de columna (0 = sin límite) | |

También se recuerdan el reparto del divisor y el modo de panel.

**Lo que se lee de `localStorage` se sanea antes de usarse.** No contra un
atacante —quien pueda escribir ahí ya tiene más de lo que esto protege— sino
contra el programa mismo: un valor de `profundidad` fuera de los tres esperados
dejaba un `undefined` que **mataba el arranque en todos los arranques**, sin nada
en la interfaz para deshacerlo. Un ajuste guardado por una versión vieja no puede
dejar el programa inservible para siempre.

### Tipografías

Empaquetadas, **sólo los subconjuntos latino y latino extendido**: el paquete
completo trae 42 ficheros por familia con cirílico, griego y vietnamita. Son 22
archivos, 859 KB.

- **Texto:** Newsreader y Space Grotesk (las de Notas y Nodos), Source Serif 4,
  Inter, y la del sistema.
- **Monoespaciada:** IBM Plex Mono (la de Notas y Nodos), JetBrains Mono, y la
  del sistema.

Las **ligaduras van apagadas** en todo el editor: JetBrains Mono convierte `->`
en flecha y `!=` en un símbolo, y en un `.md` con Mermaid eso confunde la vista
aunque no cambie el texto guardado.

### Las tablas editables

**Un clic en una celda la edita.** Enter o Tab confirman, Escape cancela, salirse
confirma. La celda muestra **su markdown crudo** mientras se edita —— si había
`**negrita**`, eso es lo que se edita—, y se ve en monoespaciada para que se note
sin tener que explicarlo.

**Picar el marco de la tabla, por fuera de las celdas, sigue llevando el cursor
al markdown**: es como se añaden filas, se quitan columnas o se cambia la
alineación. Por eso la caja lleva un margen para picar.

> **Esto no rompe la regla 2 del proyecto**, la que prohíbe convertir HTML
> editado de vuelta a markdown. El HTML nunca se lee para reconstruir el
> documento. Cada celda sabe **en qué tramo exacto del documento vive** —— se lo
> dice `celdasCon`—, así que confirmar es reemplazar ese tramo y nada más. La
> diferencia con un serializador inverso es toda: uno mira el DOM y escribe un
> documento; esto mira **dos números** y escribe un tramo.

**El markdown no se realinea.** Las barras quedan donde queden: la tabla sigue
siendo válida, y realinear obligaría a reescribir filas que nadie pidió tocar ——
justo lo que aquí no se hace.

Lo que se escribe pasa por `saneadaParaCelda`: las barras se escapan y los saltos
de línea se vuelven espacios. No es cosmética —— cualquiera de las dos cosas
partiría la tabla **en el archivo del usuario**, no sólo en la vista.

#### Por qué un clic y no dos

El doble clic se intentó primero, para no cambiar nada de lo que ya había. **No
puede funcionar, y se comprobó en la aplicación**: `mousedown` llega antes que
`dblclick`, así que el primer clic ya había mandado el cursor al markdown y
deshecho la tabla; el segundo caía sobre texto crudo y el `dblclick` no llegaba
nunca.

Retrasar el primer clic para ver si venía otro habría metido medio segundo de
espera en cada clic del programa, y eso choca con su razón de ser.

### Buscar y dar formato

**El buscador mira este archivo y ninguno más.** Decisión de Lalo del
2026-09-17, sobre tres opciones: sólo el archivo, la carpeta al vuelo, o un
índice persistente de carpetas registradas. La tercera habría sido una bóveda.

Vive en la barra y no en un panel que aparece y desaparece: es el gesto que más
se repite. Ctrl+F lleva el foco ahí, Enter y Shift+Enter recorren, Escape limpia.
El contador dice «3/17», y por encima de mil coincidencias pone `1000+` —— contar
todas en cada tecla se paga, y el número exacto ya no le dice nada a nadie.
Trabaja sobre **el panel que se está mirando**.

**El panel de formato** sale al soltar el ratón sobre texto seleccionado, y se va
al picar fuera, al hacer scroll o con Escape. Lleva resaltar, **N**, *K* y ~~S~~,
y cada botón se ve como lo que hace.

Las cuatro marcas son **markdown de toda la vida**: `==resaltado==`,
`**negrita**`, `*cursiva*` y `~~tachado~~`. Lalo eligió un solo color de
resaltado en vez de inventar sintaxis propia para tres, y tachado en lugar de
subrayado —— que en markdown no existe sin meter HTML. La ganancia es que un `.md`
tocado aquí se abre igual en Obsidian, en GitHub o en el Bloc de notas.

> Escribe con el mismo principio que las tablas: **reemplaza tramos conocidos**,
> nunca reconstruye. Y para saber si algo ya está envuelto mira **por fuera** de
> la selección, porque quien selecciona una palabra en negrita selecciona la
> palabra, no los asteriscos. Sin eso saldría `****texto****`.

### El eco entre paneles

Picar un bloque en un panel lleva el otro a ese mismo bloque, lo centra y lo
enmarca con una barra de acento durante 2.6 s. Funciona en los dos sentidos y no
hace nada si el otro panel está oculto.

> **Sustituyó al scroll ligado, quitado el 2026-09-16.** Ligar los dos scrolls se
> sentía como una resistencia rara al mover la rueda, y la causa era de diseño:
> el `scrollIntoView` del panel de destino competía con el gesto del usuario por
> el mismo scroll. Con el eco, el otro panel sólo se mueve cuando se le pide.

El bloque se busca subiendo por el árbol del documento hasta el hijo directo de
la raíz —el párrafo, la tabla, la lista entera—, que es la unidad que uno
reconoce como «esto de aquí».

---

## Seguridad

Auditoría de seis fases del **2026-09-16**, protocolo de Cloudflare: 5 cazadores
aislados, 112 comprobaciones, 20 candidatos, 5 validadores adversariales.
**Nueve hallazgos cerrados.** El informe completo, con lo rechazado y por qué,
está en [auditoria/INFORME.md](../auditoria/INFORME.md).

**El modelo de amenaza es un `.md` de procedencia desconocida**, porque el
programa se va a publicar. No es el sistema de archivos.

### Doctrina: el puente nativo no restringe rutas, a propósito

`leer`, `escribir` y `leer_imagen` alcanzan cualquier ruta del disco. **Es el
requisito número uno del proyecto** —abrir cualquier `.md` de cualquier carpeta a
cualquier hora— y quien pueda ejecutar el programa ya podía leer esos archivos.

La consecuencia es la que hay que tener presente: **cualquier ejecución de código
dentro del webview hereda ese puente entero.** Por eso la defensa no está en la
frontera de rutas, sino en que nunca corra código que venga del documento.

### Lo que lo sostiene

| Capa | Qué hace |
|---|---|
| Lista blanca en `destinoSeguro()` | Un enlace sólo sobrevive si su esquema es `http`, `https` o `mailto`. Todo lo demás sale como texto plano |
| Política de contenido | `script-src 'self'`. El `'unsafe-inline'` de estilos es obligado por KaTeX y Mermaid; el de scripts no está |
| Guardián de navegación | Complemento propio: los enlaces se abren en el navegador del sistema, no reemplazan la aplicación. `tauri::Builder` no tiene ese gancho |
| `rutaAbsoluta()` | Rechaza **UNC**. Decide por destino resuelto, no por prefijo de cadena |
| Sin `protocol-asset` | Tenía alcance `**` y ni un consumidor. Las imágenes las sirve `leer_imagen` como data URL |
| `TOPE_VISTA` = 2 MB | Red de seguridad del panel de presentación, no parche de un fallo |
| `TOPE_DOCUMENTO` = 64 MB · `TOPE_CACHE` = 24 | |
| `escribir()` | Temporal con `create_new` y nombre irrepetible (pid + nanos + contador), `sync_all`, `rename`, y limpieza del temporal ante cualquier fallo |

### La lección, en una línea

**Mirar a dónde apunta, no cómo empieza.** Los tres hallazgos más graves son ese
mismo error: `esRemota` comprobaba `/^https?:/`; `enriquecer()` escapaba
caracteres sin validar el esquema. La diferencia entre comprobar un prefijo y
resolver el destino es toda la superficie de ataque de este programa.

Y varios de los peores son la contrapartida de decisiones acertadas: la barra de
título propia convierte un cuelgue en una ventana que no se puede cerrar, y la
escritura atómica con temporal abre la vía del enlace simbólico. No hay decisión
sin contrapartida; hay contrapartidas que no se ven al decidir.

### La pasada de funciones · 2026-09-16

Se ejercitaron las 13 secciones de un `.md` de prueba **en el binario instalado,
con la política puesta**. Tablas, KaTeX en línea y en bloque, los dos tipos de
Mermaid, imagen local, avisos, casillas, notas al pie, resaltado y código: todo
dibuja. **La política no rompió nada.**

Los enlaces, que eran el punto: `https:` y `mailto:` viven; `javascript:` y
`data:` salen como texto plano. Al pinchar el `https:` se abrió **Chrome** y
MarkFlow siguió en pie.

**Pero la pasada encontró un fallo propio**, que no venía de la auditoría: el
botón *Mostrarla* de las imágenes de internet no hacía nada. Ver la trampa del
`eq()` más abajo.

### Lo que la auditoría dejó abierto

- ~~La política y el guardián sin probar con todas las funciones.~~ **Hecho**,
  arriba.
- ~~`leer_imagen` no mira las dimensiones declaradas.~~ **Cerrado** con
  `TOPE_PIXELES`. Verificado con un PNG de **74 bytes** que declara 20000×20000:
  sale rechazado con un mensaje que explica el porqué, y el resto del documento
  se dibuja igual.
- ~~Sin control de instancia única.~~ **Cerrado**, por decisión de Lalo del
  2026-09-16: **una sola ventana**. Abrir un `.md` con MarkFlow en marcha lo
  manda como pestaña a la ventana que ya existe y la trae al frente. Verificado:
  dos lanzamientos, **un proceso**, dos pestañas.
- **El instalador no va firmado.** Al publicar, Windows mostrará el aviso de
  editor desconocido en cada instalación. **Es lo único que queda abierto**, y
  depende de un certificado.

### Las dimensiones declaradas

`TOPE_PIXELES` son **180 millones**. No es un número redondo por gusto: un plano
A0 escaneado a 300 ppp son 9930 × 14040, o sea 139 millones, **y eso tiene que
abrir** —— hay una prueba que lo fija. La bomba necesita órdenes de magnitud más.

Se leen las cabeceras de **PNG, GIF, BMP, JPEG, WEBP y AVIF** sin descomprimir
nada. Quedan fuera **ICO** (256×256 como máximo por formato, no hay bomba
posible) y **SVG** (vectorial, no reserva un mapa de bits).

En AVIF las medidas viven en cajas `ispe` dentro de `meta > iprp > ipco`, y
**puede haber varias** —— la principal, las miniaturas, las capas. Se recorren
todas y **se toma la mayor**: la pregunta no es cuánto mide la imagen sino si el
archivo declara algo desmesurado, y para eso la única respuesta segura es la peor
de todas. De paso evita tener que decidir cuál es la principal, que es justo
donde un parseo a medias se equivocaría.

El recorrido está acotado en profundidad y en número de cajas. **Una caja que
declara un tamaño menor que su propia cabecera no avanza nunca** —— es la forma
más fácil de colgar a un lector de ISOBMFF, y hay una prueba que la usa.

---

## Números medidos, no supuestos

| | |
|---|---|
| Arranque, `.md` sencillo | **110 ms** (mediana de 5) |
| Arranque, con diagrama y fórmulas | **92 ms** |
| Línea base del esqueleto vacío | 111 ms |
| Bundle de entrada | 279 KB — Mermaid y KaTeX cargan aparte, bajo demanda |
| Pruebas del núcleo | **31 de 31** (`cargo test --lib`) |
| Pruebas del frontend | **37 de 37** (`npm run probar`) — 9 de pestañas, 4 de `id`, **24 de la presentación** |

El criterio de la medición llega hasta que la ventana existe con su título; los
diagramas se dibujan un instante después.

Las 13 del frontend son 9 de frontera de las pestañas —nombres de 300
caracteres, vacíos, extensiones más largas que el límite entero, acentos, rutas
con barras mezcladas y mayúsculas distintas— y 4 que comprueban que todo `id` que
busca el código exista en el HTML.

**Prueba de aceptación:** los cinco archivos que quedaron abiertos en Zettlr
—acentos, tildes en mayúsculas, paréntesis, espacios, uno en `D:`, uno de 83 KB—
abren todos, el mayor en 122 ms, y **ninguno cambia un byte** (SHA-256).

**El ataque crítico, repetido después del arreglo:** la celda muestra
`[PINCHAR AQUI](javascript:…)` como texto, sin enlace; el fondo sigue oscuro
(R=22 G=24 B=30) y la aplicación sigue en pie. Antes del arreglo, la misma
prueba dejó la ventana en blanco y sin botones de cerrar — hubo que matar el
proceso.

**`cargo` no está en el PATH de la sesión.** Se invoca por ruta completa:
`~/.cargo/bin/cargo.exe`.

---

## La migración, cerrada

**El 2026-09-16 quedó terminada.** MarkFlow es el editor de `.md` de la máquina y
Zettlr ya no está.

| Comprobado por lectura, no por el reporte del script | |
|---|---|
| `AppData\Local\Programs\Zettlr` · `Roaming\Zettlr` · acceso directo | los tres, ausentes |
| Entradas de desinstalación y ProgIds de Zettlr en el registro | ninguna |
| `UserChoice` de `.md` | `MarkFlow.nota` |
| Ejecutable instalado | idéntico al compilado **salvo 3 bytes** de 8 140 800 |

Esos 3 bytes son `__TAURI_BUNDLE_TYPE_VAR_NSS` contra `…_UNK`: la marca que NSIS
estampa para que Tauri sepa cómo se instaló. **Es la forma de verificar que un
build llegó de verdad a la máquina** —— comparar por huella da distinto siempre, y
no significa nada malo.

La política de contenido, extraída del `.exe` instalado, lleva `script-src
'self'`: el arreglo del hallazgo crítico está en lo que corre.

La configuración de Zettlr quedó respaldada en `migracion-zettlr/config-zettlr/`.

## Lo que sigue

Las tres etapas de puesta en marcha —instalar, asociar, sacar Zettlr— están
cerradas, y con ellas todo lo que la auditoría dejó abierto **menos una cosa**:

1. **Firmar el instalador.** Sin firma, Windows muestra el aviso de editor
   desconocido en cada instalación. Es lo único que separa a MarkFlow de poder
   publicarse, y depende de conseguir un certificado —— decisión de Lalo, no
   trabajo de código.

Todo lo demás de esta lista se cerró el 2026-09-16: la pasada de funciones con la
política puesta, el tope de dimensiones y la instancia única.

## Sin decidir

- ~~Tablas editables desde la presentación.~~ **Decidido el 2026-09-17: se
  hacen.** Ver más abajo.
- **El icono definitivo.** El que hay es el monograma provisional; Lalo está
  afinando el suyo.
- **Una paleta que siga al color de acento de Windows.** Se puede, pero ese color
  se elige pensando en la barra de tareas, no en leer código: en rojo o verde
  lima el resaltado se vuelve ilegible.

---

## Trampas conocidas, para no volver a caer

**No escribas rutas ni regex con heredoc de bash.** Se come una barra invertida
de cada par, en silencio. Compila, pasa los tipos y las pruebas, y falla en
ejecución. Detalle en [CLAUDE.md](../CLAUDE.md).

**No pruebes sobre archivos reales de Lalo.** Cópialos al scratchpad. Una prueba
sobre los originales le metió un carácter a una transcripción de la NTC.

**El módulo de presentación es un `StateField`, no un `ViewPlugin`.** CodeMirror
prohíbe que un plugin de vista genere decoraciones que se traguen saltos de
línea, y los widgets de tabla y diagrama hacen justo eso. El precio es recorrer
el documento entero: si un `.md` enorme va lento, es ahí — y es la razón de que
exista `TOPE_VISTA`.

**Toda expresión regular que corra en `construir()` se paga en cada tecla**, en
el hilo de la interfaz. La auditoría encontró dos con coste cuadrático: 5×10¹¹
pasos con 1 MB en la de nota al pie, segundos por pulsación con 30 KB en la de
Mermaid. El error de forma es el mismo: dejar dentro de la parte repetida el
mismo carácter con el que arranca cada intento. Acota la longitud o excluye el
carácter de arranque de la clase.

**Deshacer se ejecuta en las dos vistas a la vez**, y por eso no se usa el
`historyKeymap` de CodeMirror: ése deshace sólo en la vista enfocada y desfasa
las historias.

**Un nodo sólo cuenta como tapado si cabe entero en el bloque.** Comparar sólo su
inicio daba por tapado al nodo raíz del documento y cortaba el recorrido del
árbol desde la raíz.

**Un tema de CodeMirror pierde contra el suyo si el selector es más corto.** El
tema base trae cosas como
`.ͼ2.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground` ——
cinco clases—— y un `&.cm-focused .cm-selectionBackground` son tres. **Gana el
suyo, y no avisa de nada.** Pasó con la selección y con el resaltado de
búsqueda: los dos se pintaban con los colores de fábrica de CodeMirror, que sobre
esta paleta casi no se ven. Si un color del editor «no hace caso», mira la
especificidad antes que el valor.

**La selección se dibuja en una capa con `z-index: -2`, así que cualquier fondo
opaco del flujo la tapa.** `.cm-activeLine` con color sólido la escondía entera:
el programa tenía la selección —copiar funcionaba— y en pantalla no salía nada.
Por eso `--linea-activa` va con alfa, y por eso `PROFUNDIDAD` en
`preferencias.ts` ya no la define.

**El resaltado de coincidencias de CodeMirror sólo se dibuja con su panel de
búsqueda abierto.** Con la caja de buscar en la barra y el panel sustituido por
un `div` vacío, la búsqueda saltaba de una coincidencia a otra sin marcar
ninguna: el contador decía «5/5» y el texto no cambiaba. El panel se abre igual,
escondido por CSS, sólo para encender el resaltado.

**Para depurar la interfaz, levanta `npm run dev` y ábrela en un navegador**: ahí
se pueden leer las reglas CSS aplicadas, que es como se encontraron los tres
fallos de arriba en una tarde. **Pero sirve para el CSS, no para el
comportamiento**: fuera de Tauri, `getCurrentWindow()` lanza y corta el arranque
a media página, así que los atajos y todo lo que venga después no llegan a
registrarse. Lo que falle ahí puede estar bien en la aplicación.

**Si el aspecto de un widget depende de algo que no sea el texto, ese algo tiene
que entrar en `eq()`.** CodeMirror reutiliza el DOM de un widget cuando `eq()`
dice que el nuevo es igual al viejo. El botón *Mostrarla* anotaba el permiso,
pedía el refresco, el campo de estado reconstruía las decoraciones —— y CodeMirror
**tiraba el widget nuevo y dejaba la caja bloqueada en pantalla**. El botón no
hacía nada, sin un solo error. Y no vale calcularlo al vuelo dentro de `eq()`:
los dos lados leerían el mismo estado global en el mismo instante y siempre
coincidirían. Lo que distingue al viejo del nuevo es **el estado que había al
nacer**, así que se congela en el constructor.

**Para reconstruir las decoraciones, usa `refrescarPresentacion`, no un dispatch
de selección.** Despachar la selección para forzar el redibujado hace que los
bloques dibujados —la tabla, sobre todo— se crean con el cursor encima y vuelvan
a texto crudo.

**Un `div` con `aria-modal` no bloquea nada.** Con un diálogo en pantalla, Ctrl+Tab
cargaba el contenido de una pestaña dentro de otra y Ctrl+W dejaba la promesa sin
resolver para siempre. El manejador de teclas corta en seco si el velo está
visible.

**Lo que lance dentro de `toDOM` se lleva el panel entero.** CodeMirror lo llama
sin protección, y el eslabón que importa es éste: si revienta el panel de
presentación, **el de fuente nunca recibe el cambio — y fuente es lo que se
guarda**. `decodeURI` lanza con un nombre de archivo tan legal como
`descuento-50%.png`.

**Acceso controlado a carpetas.** Defender puede bloquear la escritura en las
carpetas de Documentos. No es un fallo del programa; la app tiene que estar en
la lista de permitidas, y eso lo hace Lalo desde Seguridad de Windows.

**Una caja con scroll propio dentro del editor lleva `width: 0` y
`min-width: 100%`.** Sin eso, una tabla ancha empuja el ancho de `.cm-content` y
le da scroll horizontal al panel entero, cortando títulos y diagramas. Aplica a
`.mf-w-tabla` y a `.mf-w-mermaid`.

**Un `id` que no existe corta el arranque entero.** El atajo `$()` afirma el
tipo con un `as`, así que TypeScript no avisa: en ejecución devuelve `null`, el
`addEventListener` revienta, y como eso pasa en el cuerpo del módulo se lleva por
delante todo lo que venía después. Pasó con `$('titulo')` cuando ese `<header>`
sólo tenía la clase. Lo cubre `pruebas/ids.prueba.ts`.

**Cuidado con los reemplazos de texto por indentación.** Al mover las pestañas al
título, el reemplazo que debía borrar el `<nav>` viejo coincidió también con el
nuevo, porque la única diferencia era la sangría. Borró los dos.

**`hidden` necesita `!important`.** El atributo aplica `display: none` con la
especificidad más baja posible, así que cualquier regla que fije `display` lo
anula en silencio. Al dar `display: inline-flex` a los botones para meterles
icono, los botones ocultos del diálogo reaparecieron y se veían los cuatro a la
vez. Hay una regla global `[hidden] { display: none !important }`.

**WebView2 pinta un fondo claro en el botón enfocado**, y queda como si
estuviera encendido. Se sustituye por un aro de acento en `:focus-visible` y se
suelta el foco tras el clic.

**`resolveInner` devuelve la raíz del documento cuando la posición cae en un
hueco entre bloques.** Tomarla por «el bloque» enmarcaba el archivo entero. Por
eso `bloqueEn` comprueba raíz, nodo vacío y nodo desmesurado antes de aceptarlo,
y si no, cae al renglón.

**Los scripts de PowerShell van en UTF-8 CON BOM y sin acentos en los
identificadores.** PowerShell 5.1 lee como ANSI un `.ps1` sin BOM, y un
`$claveElección` se vuelve un error de sintaxis sin relación aparente con la
línea que lo causa.
