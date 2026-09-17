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
| Revisión | `9073dc7` — árbol limpio, subido |
| Ejecutable | `markflow.exe`, **7.76 MB** |
| Instalador | `MarkFlow_0.1.0_x64-setup.exe`, **4.92 MB**, NSIS, **sin UAC** |
| Cadena | Rust 1.98.1 (MSVC), Node 22, Tauri 2, Vite 8, TypeScript 6 |
| WebView2 | ya venía en la máquina, v153 |

> ⚠️ **Lo instalado en `%LOCALAPPDATA%\MarkFlow` es del build de las 16:43, de
> antes de la auditoría.** El instalador vigente es de las 22:57 y es el que
> lleva los arreglos de seguridad. Mientras no se reinstale, lo que corre en la
> máquina es la versión con el agujero del enlace `javascript:` abierto.

### Lo que el programa hace

- Abre cualquier `.md` de cualquier carpeta. **Sin bóvedas**, sin registrar nada.
- Dos paneles lado a lado, los dos editables, con edición *inside*. Se puede
  dejar sólo uno: *Fuente* · *Ambos* · *Vista*.
- Dibuja en el panel de presentación: **tablas** (con alineaciones), **Mermaid**,
  **KaTeX** en línea y en bloque, **imágenes** locales y remotas, **avisos**
  (`[!NOTA]`, `[!AVISO]`, `[!PELIGRO]`, `[!TIP]`, `[!EJEMPLO]`, `[!CITA]`) y
  **casillas de tarea** que se pican. El frontmatter YAML sale como metadatos.
- **Sintaxis**: notas al pie `[^1]`, `==resaltado==`, avisos con los 13 tipos de
  Obsidian y título propio, en inglés y español, mayúscula o minúscula.
- **Convivencia con agentes**: al recuperar el foco, si otro programa tocó el
  archivo se recarga solo; si había cambios locales, pregunta.
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

### Lo que la auditoría dejó abierto

- **La política de contenido y el guardián de navegación no se han probado con
  todas las funciones.** Compilan, y el ataque conocido está cerrado y verificado,
  pero KaTeX, Mermaid, las imágenes y los diálogos merecen una pasada completa.
- **El instalador no va firmado.** Al publicar, Windows mostrará el aviso de
  editor desconocido en cada instalación.
- **`leer_imagen` no mira las dimensiones declaradas.** Un PNG de 100 KB que
  declare 20000×20000 descomprime a ~1.6 GB. Anotado fuera de encargo por un
  validador; no revisado.
- **Sin control de instancia única.** Dos ventanas sobre la misma nota ya no
  comparten el temporal, pero pueden seguir pisándose el guardado.

---

## Números medidos, no supuestos

| | |
|---|---|
| Arranque, `.md` sencillo | **110 ms** (mediana de 5) |
| Arranque, con diagrama y fórmulas | **92 ms** |
| Línea base del esqueleto vacío | 111 ms |
| Bundle de entrada | 279 KB — Mermaid y KaTeX cargan aparte, bajo demanda |
| Pruebas del núcleo | **16 de 16** (`cargo test --lib`) |
| Pruebas del frontend | **13 de 13** (`npm run probar`) |

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

## Lo que sigue

1. **Reinstalar** con el `MarkFlow_0.1.0_x64-setup.exe` de las 22:57, que es el
   que lleva los arreglos de la auditoría.
2. ~~Tomar la asociación a mano.~~ **Hecho.** El `UserChoice` de `.md` ya dice
   `MarkFlow.nota` —— comprobado por lectura del registro el 2026-09-16. Ningún
   instalador puede ponerlo: Windows 11 lo firma con un hash, así que esto sólo
   se hace desde *Abrir con* → *Elegir otra aplicación* → *Usar siempre*, y ya
   está hecho.
3. **Fase C de la migración**: correr `migracion-zettlr/salida-zettlr.ps1`
   —primero sin argumentos para ver qué haría, luego con `-Ejecutar`— para
   desinstalar Zettlr y recuperar **648 MB medidos**. El script comprueba el
   punto 2 y **se niega si no se cumple**, a propósito: desinstalar antes
   dejaría el `UserChoice` apuntando a un programa que ya no existe.

   En esa carpeta hay **dos** scripts. El bueno es `salida-zettlr.ps1`. El otro,
   `fase-c-salida-zettlr.ps1`, es el primer intento —— sin BOM y con acentos en
   los identificadores, que es justo lo que reventó en PowerShell 5.1. Bórralo
   para no correrlo por equivocación.

## Sin decidir

- **Tablas editables desde la presentación.** Hoy se dibujan, y para tocarlas el
  cursor las devuelve a texto. Editar celda por celda sobre la tabla dibujada
  exigiría escribir de vuelta al markdown, que es lo que este proyecto tiene
  prohibido. Si se quiere, va como pieza aparte y muy probada.
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
