# Estado vigente

**Última actualización: 2026-09-16.** MarkFlow v0.1.0, las cuatro etapas cerradas.

Esto es **estado**, no bitácora. El relato de cómo se llegó aquí está en los
mensajes de los commits; las decisiones y su porqué, en [ESPEC.md](../ESPEC.md).

---

## Qué hay hoy

| | |
|---|---|
| Repo | `lalomalvi/MarkFlow`, privado. Remoto por **HTTPS** con el token de `gh`: la clave SSH no está disponible desde la sesión de trabajo |
| Ejecutable | `MarkFlow.exe`, ~7 MB |
| Instalador | `MarkFlow_0.1.0_x64-setup.exe`, **4.93 MB**, NSIS, **sin UAC** |
| Cadena | Rust 1.98.1 (MSVC), Node 22, Tauri 2, Vite 8, TypeScript 6 |
| WebView2 | ya venía en la máquina, v153 |

### Lo que el programa hace

- Abre cualquier `.md` de cualquier carpeta. **Sin bóvedas**, sin registrar nada.
- Dos paneles lado a lado, los dos editables, con edición *inside*. Se puede
  dejar sólo uno: *Fuente* · *Ambos* · *Vista*.
- Dibuja en el panel de presentación: **tablas** (con alineaciones), **Mermaid**,
  **KaTeX** en línea y en bloque, **imágenes** locales y remotas, **avisos**
  (`[!NOTA]`, `[!AVISO]`, `[!PELIGRO]`, `[!TIP]`, `[!EJEMPLO]`, `[!CITA]`) y
  **casillas de tarea** que se pican. El frontmatter YAML sale como metadatos.
- **Guardado explícito**: botón *Guardar*, Ctrl+S, punto en el título cuando hay
  cambios, y diálogo al cerrar o al abrir otro archivo con cambios pendientes.
  **Si un guardado falla, sale un diálogo**, no un texto chico en la barra.
- Deshacer y rehacer con botones y con Ctrl+Z / Ctrl+Y.
- **Tema claro / oscuro / sistema**, con botón que cicla los tres y recuerda la
  elección. Los diagramas de Mermaid se redibujan con el tema.
- Arrastrar y soltar. Arranque con el archivo como argumento.
- **Divisor arrastrable** en modo Ambos, con doble clic para volver al 50/50.
- **Panel de Opciones** (Ctrl+`,`), sin botón de aceptar: cada cambio se aplica
  y se guarda al instante.

### Paleta

Sale del icono del programa: tinta `#20232a` / `#191c23` y azul de `#0061f5` a
`#12a2fc`. El acento fue ámbar hasta el 2026-09-16.

### El divisor

**20 % – 80 %, y a la vez mínimo 320 px por panel.** Gana el más restrictivo.
La fracción sola no dice nada: un cuarto de 1200 px son 300, donde el markdown
se parte cada tres palabras; un cuarto de 2560 son 640, de sobra. Al pasarse del
mínimo por un margen claro, el panel **se cierra** y se pasa al modo único, en
vez de topar contra un muro.

### Opciones

| Aspecto | Letra | Editor |
|---|---|---|
| Tema: sistema · claro · oscuro | Texto: 5 familias | Números de línea |
| Profundidad del oscuro: suave · normal · profundo | Mono: 3 familias | Sangría: 2 · 4 · tabulador |
| Colores del código: tinta · Notas y Nodos · sobria | Tamaño 11–26 px | Scroll: independiente · ligado |
| | Interlineado 1.2–2.4 | Reabrir el último archivo |
| | Ancho de columna (0 = sin límite) | |

También se recuerdan el reparto del divisor y el modo de panel.

### Tipografías

Empaquetadas, **sólo los subconjuntos latino y latino extendido**: el paquete
completo trae 42 ficheros por familia con cirílico, griego y vietnamita. Son 22
archivos, 859 KB, y suben el instalador de 4.08 a 4.93 MB.

- **Texto:** Newsreader y Space Grotesk (las de Notas y Nodos), Source Serif 4,
  Inter, y la del sistema.
- **Monoespaciada:** IBM Plex Mono (la de Notas y Nodos), JetBrains Mono, y la
  del sistema.

Las **ligaduras van apagadas** en todo el editor: JetBrains Mono convierte `->`
en flecha y `!=` en un símbolo, y en un `.md` con Mermaid eso confunde la vista
aunque no cambie el texto guardado.

El **scroll ligado va por renglón, no por píxeles**: los dos paneles no miden lo
mismo de alto —una tabla dibujada ocupa más que su markdown, un diagrama mucho
más— así que igualar `scrollTop` los desalinea a los pocos bloques.

### Números medidos, no supuestos

| | |
|---|---|
| Arranque, `.md` sencillo | **110 ms** (mediana de 5) |
| Arranque, con diagrama y fórmulas | **92 ms** |
| Línea base del esqueleto vacío | 111 ms |
| Bundle de entrada | 279 KB — Mermaid y KaTeX cargan aparte, bajo demanda |
| Pruebas del núcleo | **10 de 10** (`cargo test --lib`) |

El criterio de la medición llega hasta que la ventana existe con su título; los
diagramas se dibujan un instante después.

**Prueba de aceptación:** los cinco archivos que quedaron abiertos en Zettlr
—acentos, tildes en mayúsculas, paréntesis, espacios, uno en `D:`, uno de 83 KB—
abren todos, el mayor en 122 ms, y **ninguno cambia un byte** (SHA-256).

---

## Lo que sigue

1. **Instalar** con `MarkFlow_0.1.0_x64-setup.exe`.
2. **Tomar la asociación a mano**, porque ningún instalador puede: clic derecho
   en un `.md` → *Abrir con* → *Elegir otra aplicación* → MarkFlow → *Usar
   siempre*. Windows 11 protege la asociación efectiva con un `UserChoice`
   firmado por hash, y hoy la tiene Zettlr.
3. **Fase C de la migración**: desinstalar Zettlr y recuperar 650 MB. El plan
   está en `migracion-zettlr/MIGRACION.md` (local, fuera del repo).

## Sin decidir

- **Tablas editables desde la presentación.** Hoy se dibujan, y para tocarlas el
  cursor las devuelve a texto. Editar celda por celda sobre la tabla dibujada
  exigiría escribir de vuelta al markdown, que es lo que este proyecto tiene
  prohibido. Si se quiere, va como pieza aparte y muy probada.
- **Pestañas**, al estilo del Bloc de notas nuevo. Acordado el 2026-09-16 que va
  aparte, como su propia etapa: hoy el programa asume un documento —una ruta, un
  estado sucio, una historia de deshacer— y con pestañas todo eso se multiplica.
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
el documento entero: si un `.md` enorme va lento, es ahí.

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

**Acceso controlado a carpetas.** Defender puede bloquear la escritura en las
carpetas de Documentos. No es un fallo del programa; la app tiene que estar en
la lista de permitidas, y eso lo hace Lalo desde Seguridad de Windows.

**Una caja con scroll propio dentro del editor lleva `width: 0` y
`min-width: 100%`.** Sin eso, una tabla ancha empuja el ancho de `.cm-content` y
le da scroll horizontal al panel entero, cortando títulos y diagramas. Aplica a
`.mf-w-tabla` y a `.mf-w-mermaid`.

**WebView2 pinta un fondo claro en el botón enfocado**, y queda como si
estuviera encendido. Se sustituye por un aro de acento en `:focus-visible` y se
suelta el foco tras el clic.
