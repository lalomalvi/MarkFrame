# MarkFrame — mapa de arquitectura para la auditoría

**Fase 1 (reconocimiento). Fecha: 2026-09-16.**
Objetivo: la raíz de este repositorio.
Revisión leída: `23561e2` («Seguridad de renderizado y la sintaxis que faltaba»), árbol de
trabajo **limpio** (`git status` sin cambios; `auditoria/` sin seguimiento).
Método: **sólo lectura de código.** No se compiló, no se ejecutó, no se instalaron
dependencias, no se hizo ninguna petición de red — ver §7.

---

## 1. Producto, principales y recursos protegidos

Editor y lector de Markdown de escritorio para Windows 11, pensado para ocupar el lugar
del Bloc de notas: doble clic en un `.md` cualquiera, de cualquier carpeta, y se edita
(`ESPEC.md` §1). Se va a publicar como software libre, así que **el archivo `.md` de
procedencia desconocida es un principal de menor confianza de primera clase**, no un caso
raro.

| Principal | Autoridad de diseño |
|---|---|
| Lalo (el usuario del escritorio) | Todo: abre, edita y guarda cualquier ruta que su cuenta pueda tocar |
| Un `.md` de terceros (contenido) | Ninguna. Es dato a dibujar |
| Otro proceso local de la misma cuenta (agente, script) | Escribe el archivo abierto y el perfil de WebView2; MarkFrame lo detecta y reconcilia |
| Un servidor remoto (imágenes) | Ninguna hasta que se autorice una imagen; entonces recibe una petición |

Recursos protegidos: la **integridad de los `.md` del usuario** (prioridad declarada del
proyecto: nunca cambiar un byte que no se pidió), el **disco entero de la cuenta** a
través del puente nativo, y la **discreción de la máquina** (que no se avise a un tercero
de que se abrió su archivo).

Comparable con procedencia en el propio repositorio: **Obsidian** (de donde se copia la
edición *inside*, `ESPEC.md` §2) y **Zettlr** (el programa al que releva,
`migracion-zettlr/`). Los dos aceptan la misma concesión de fondo —el editor abre
cualquier archivo sin sandbox de rutas— y los dos han tenido que endurecer el renderizado
del markdown, que es exactamente donde está la superficie aquí. Sirve para calibrar
esfuerzo, no para descartar hallazgos.

---

## 2. Componentes y cómo se comunican

```
  Windows                                      Proceso MarkFrame.exe
  ───────                                      ─────────────────────
  Explorador (doble clic .md)
  línea de comandos            ┌──────────────────── Rust / Tauri 2 ────────────────────┐
  arrastrar y soltar  ────────▶│ lib.rs  run()  invoke_handler[leer, escribir,          │
                               │                 leer_imagen, huella, archivo_inicial] │
  disco (FS)       ◀──────────▶│ std::fs, SIN restricción de rutas (a propósito)        │
                               │ plugins: dialog, opener                               │
                               └──────────▲────────────────────────────┬───────────────┘
                                          │  IPC de Tauri (invoke)     │  eventos
                                          │                            ▼
                               ┌──────────┴──────── WebView2 (sin CSP) ────────────────┐
                               │ index.html  →  main.ts  (orquestador, pestañas, UI)   │
                               │   archivo.ts  puente tipado con los 5 comandos        │
                               │   editor.ts   DOS EditorView de CodeMirror 6          │
                               │      ├ fuente        (markdown crudo)                 │
                               │      └ presentacion  (livepreview.ts decora)          │
                               │   livepreview.ts → widgets.ts (tabla, mermaid, katex,  │
                               │                     imagen, casilla)                  │
                               │   preferencias.ts ↔ localStorage                       │
                               │   contexto.ts  (carpeta del archivo abierto)          │
                               └───────────────────────────────────────────────────────┘
  red (imágenes remotas) ◀──────── <img src="https://…"> sólo si se autoriza
```

Dos hechos de arquitectura que cambian el análisis:

1. **No hay serializador inverso.** Los dos paneles son dos `EditorView` sobre el mismo
   texto; el derecho sólo *decora* (`src/livepreview.ts:1-17`, `src/editor.ts:1-9`). Los
   cambios de un panel se reflejan en el otro por `dispatchTransactions`
   (`src/editor.ts:106-115`). Nada de lo que se dibuja vuelve al documento — con **una
   excepción**: la casilla de tarea (`src/widgets.ts:129-134`).
2. **El panel de presentación reconstruye TODAS las decoraciones del documento entero en
   cada cambio de texto y en cada movimiento del cursor** (`src/livepreview.ts:379-390`,
   condición en la línea 384). Es un `StateField`, no un `ViewPlugin`, y el propio módulo
   lo declara como el precio pagado. Todo coste por carácter se multiplica ahí.

---

## 3. Fronteras de confianza

| # | Qué entra | De dónde viene | Control más fuerte visible en código |
|---|---|---|---|
| F1 | **Contenido de un `.md`** | Tercero | El texto **no** se renderiza como HTML: se decora. `HTMLBlock`/`HTMLTag` no están en los mapas `LINEA`/`TRAMO` (`src/livepreview.ts:36-54`), así que **el HTML embebido en el markdown se queda como texto**. Las tres salidas a HTML son acotadas: celdas de tabla, Mermaid y KaTeX |
| F2 | **Celdas de tabla** | Tercero (F1) | Escapado a mano de `& < > "` **antes** de aplicar cinco sustituciones de regex (`src/widgets.ts:64-73`), y luego `innerHTML` (`:98`) |
| F3 | **Código Mermaid** | Tercero (F1) | `securityLevel: 'strict'` (`src/widgets.ts:297`) y el SVG resultante a `innerHTML` (`:303`). La limpieza la hace Mermaid 12.0.0 con DOMPurify 3.4.15 (transitivo, `package-lock.json:2530`, `:2127`) |
| F4 | **Fórmulas KaTeX** | Tercero (F1) | `throwOnError: false`, `output: 'html'` y **sin** `trust`, o sea `trust: false` por omisión (`src/widgets.ts:343-347`). KaTeX 0.18.7 (`package-lock.json:2224`) |
| F5 | **Rutas de imagen local** | Tercero (F1) | Se resuelven contra la carpeta del archivo abierto por concatenación de cadenas (`src/widgets.ts:177-183`), y las lee el núcleo **sin restricción de rutas**. Filtro por extensión, tope de 25 MB (`src-tauri/src/lib.rs:116,118-131,148`) |
| F6 | **URL de imagen remota** | Tercero (F1) | Apagado de fábrica (`src/preferencias.ts:68`); se pide permiso por documento y los permisos se olvidan al abrir otro (`src/widgets.ts:155-167,209-235`; `src/main.ts:364,585,603`). La detección de «remota» es `/^https?:/i` (`src/widgets.ts:167`) |
| F7 | **Nombres y rutas de archivo** | Tercero / sistema de archivos | Se pintan con `textContent` y `createElement`, nunca con HTML (`src/main.ts:56-99`), y van a `document.title` (`:164`) y a `title`/`aria-label` |
| F8 | **Argumento de línea de comandos** | Explorador, otro proceso local, acceso directo | Se toma el primer argumento que no empiece por `-` y se exige `is_file()` (`src-tauri/src/lib.rs:189-195`). **No se comprueba la extensión** |
| F9 | **Arrastrar y soltar** | Otra aplicación / el Explorador | Lista de rutas del evento nativo, abiertas en bucle sin tope propio (`src/main.ts:716-725`); el tope de pestañas se comprueba dentro de `abrirRuta` (`:344`) |
| F10 | **`localStorage`** | Cualquier script del webview; cualquier proceso que escriba el perfil de WebView2 en disco | `JSON.parse` en `try` y mezcla con los valores de fábrica, **sin validar tipos ni rangos** (`src/preferencias.ts:103-113`) |
| F11 | **Contenido del archivo reeditado por otro programa** | Agente / script local | Huella `mtime`+`tamaño` (`src-tauri/src/lib.rs:176-186`); sin cambios locales recarga sola, con cambios locales pregunta (`src/main.ts:573-620`) |
| F12 | **Mensajes de error del núcleo** | Sistema de archivos | Viajan como texto a diálogos por `textContent` (`src/main.ts:334,375`) y a `caja.textContent` (`src/widgets.ts:241,248,307`). `leer_imagen` incluye **la ruta completa** a propósito (`src-tauri/src/lib.rs:146`) |
| F13 | **Todo lo que llegue a ejecutarse dentro del webview** | Consecuencia de F2–F4 | Aquí no hay control: ver §5 |

---

## 4. Superficies de entrada, con archivo y línea

**Núcleo nativo** (`src-tauri/src/lib.rs`) — los cinco comandos alcanzables por `invoke`
desde cualquier script del webview:

| Comando | Líneas | Entrada | Efecto |
|---|---|---|---|
| `leer` | 39-83 | `ruta: String` | Lee cualquier ruta; descarta BOM, exige UTF-8, normaliza CRLF, devuelve ruta canónica sin `\\?\` |
| `escribir` | 86-112 | `ruta`, `texto`, `fin_de_linea` | Escribe cualquier ruta: temporal `.<nombre>.markframe-tmp` junto al destino (98-101) y `fs::rename` encima (106) |
| `leer_imagen` | 139-162 | `ruta: String` | Lee cualquier ruta, decide el tipo MIME **por la extensión** (118-131, incluye `image/svg+xml` en la 125) y devuelve `data:` en base64 |
| `huella` | 177-186 | `ruta: String` | `mtime` en ms y tamaño |
| `archivo_inicial` | 190-195 | `std::env::args()` | Primer argumento que no empiece por `-` y sea archivo |

**Puente y arranque del frontend**

- `src/archivo.ts:18-28` — los cinco `invoke` tipados.
- `src/main.ts:735-738` — arranque: `archivoInicial()` y, si no, `P.ultimoArchivo` de
  `localStorage` (**sólo si `P.reabrir`**).
- `src/main.ts:340-377` — `abrirRuta`: única puerta de apertura; tope de pestañas (344),
  `leer` (347), fija la carpeta base (362) y olvida permisos de imagen (364).
- `src/main.ts:379-382` — diálogo nativo de abrir; filtro de extensiones en
  `src/archivo.ts:16`.
- `src/main.ts:716-725` — arrastrar y soltar (`ev.payload.paths`, 722).
- `src/main.ts:622` — el evento `focus` de la ventana dispara la revisión de cambios
  externos.
- `src/main.ts:681-695` — atajos globales de teclado.
- `src/main.ts:701-712` — `onCloseRequested`: pregunta por cada pestaña sucia.

**Renderizado del markdown de terceros** (`src/livepreview.ts`, función `construir`, 110-377)

| Qué detecta | Líneas | Nota |
|---|---|---|
| Frontmatter YAML | 151-162 | Tapa desde el byte 0 hasta el cierre |
| Tabla | 174-184 | Pasa el texto crudo del nodo a `WidgetTabla` |
| `mermaid` en bloque cercado | 186-197 | Regex de la 188 sobre el texto del nodo |
| Imagen | 199-209 | Regex de la 201; captura destino y `alt` |
| Casilla de tarea | 211-220 | Guarda el desplazamiento `nodo.from + 1` |
| Avisos `[!tipo]` | 226-247 | Regex 230; `ocultar.range` con aritmética de índices en 243-244 |
| Destino de enlace | 273-280 | Oculta la URL, no la desactiva |
| Fórmula en bloque `$$…$$` | 292-301 | `matchAll` sobre **todo** el documento |
| Notas al pie `[^n]` | 315-333 | Dos pasadas `matchAll`, más aritmética de índices |
| `==resaltado==` | 336-345 | Regex con anticipación y retrospección |
| Caracteres invisibles | 355-361 | `RE_INVISIBLES`, definido en 91-101 |
| Fórmula en línea `$…$` | 365-372 | Regex con anticipación y retrospección |

**Salidas a HTML y a la red** (`src/widgets.ts`)

- `64-73` `enriquecer()` → `98` `celda.innerHTML`.
- `294-300` `mermaid.initialize` + `render` → `303` `caja.innerHTML = svg`.
- `343-347` `katex.render` escribiendo dentro del elemento.
- `177-183` `rutaAbsoluta` (concatena base + `\` + `decodeURI(fuente)` con `/`→`\`) →
  `185-194` `cargarImagen` → `190` `invoke('leer_imagen')`; caché sin tope en `145`.
- `209-235` puerta de la imagen remota; `224` concede el permiso suelto; `245` `img.src`.
- `129-134` la casilla de tarea escribe un carácter en el documento.

**Estado persistente** (`src/preferencias.ts`)

- `101` clave `markframe.preferencias`; `103-113` lectura; `115-117` escritura.
- `127-158` `aplicar()`: vuelca valores a atributos `data-*` y a variables CSS con
  `setProperty` (138-142).
- Consumidores sensibles: `src/main.ts:26` (arranque), `:186` (`permitirRemotas`),
  `:393` (`paneles.className`), `:737` (`ultimoArchivo`).

---

## 5. Privilegios: qué puede hacer el programa

**Sistema de archivos: sin restricción, a propósito y por contrato.** Está declarado en
`ESPEC.md` §2 («Sin restricción de rutas»), en la cabecera de `src-tauri/src/lib.rs:3-4`,
y fijado por una prueba que existe justamente para que no se «arregle» por descuido:
`se_puede_escribir_fuera_de_toda_carpeta_del_proyecto` (`src-tauri/src/lib.rs:356-364`).
Cualquier código que corra en el webview lee y escribe con la autoridad completa de la
cuenta de Windows. Esto **no es un hallazgo**; es el contexto que le da impacto a todo lo
demás.

**Capacidades de Tauri concedidas** (`src-tauri/capabilities/default.json:8-20`, ventana
`main`): `core:default`, `opener:default`, `dialog:default`, más ocho permisos de ventana
(`destroy`, `set-title`, `minimize`, `toggle-maximize`, `close`, `start-dragging`,
`is-maximized`, `internal-toggle-maximize`) que existen porque la barra de título se
dibuja en HTML (`decorations: false`, `src-tauri/tauri.conf.json:20`).

Expansión efectiva, leída del artefacto generado local `src-tauri/gen/schemas/acl-manifests.json`
(**carpeta ignorada por git**, `src-tauri/.gitignore`, así que es un hecho de esta máquina,
no de la revisión):

- `opener:default` = `allow-open-url` + `allow-reveal-item-in-dir` + `allow-default-urls`.
  **No** incluye `allow-open-path`, o sea que el webview no puede pedirle al sistema que
  abra una ruta arbitraria (que sería ejecución de programas). Sí puede abrir URL del
  ámbito por omisión.
- `dialog:default` = `allow-message` + `allow-save` + `allow-open`.
- El plugin `opener` se inicializa en `src-tauri/src/lib.rs:201` **pero el frontend nunca
  lo llama**: no hay un solo uso de `opener`/`openUrl` en `src/` ni en `index.html`. Queda
  concedido sin consumidor.

**Política del webview** (`src-tauri/tauri.conf.json:12-35`) — tres decisiones que
amplifican cualquier ejecución en el DOM:

1. `"csp": null` (línea 27): **sin Content-Security-Policy**.
2. `"withGlobalTauri": true` (línea 13): `window.__TAURI__` queda expuesto a todo script
   de la página, con los cinco comandos y las capacidades de arriba.
3. `assetProtocol` habilitado con `"scope": ["**"]` (28-33) y la característica
   `protocol-asset` en `src-tauri/Cargo.toml:21` — el protocolo de recursos alcanza todo
   el disco, aunque el código de imágenes **no lo use** (usa `leer_imagen`,
   `src-tauri/src/lib.rs:133-137).

**Empaquetado**: NSIS, `installMode: currentUser`, sin UAC
(`src-tauri/tauri.conf.json:66-74`; `docs/estado.md:16`). Asociación de `.md`, `.markdown`,
`.mdown`, `.mkd` declarada en `bundle.fileAssociations`
(`src-tauri/tauri.conf.json:48-61`) — o sea, **doble clic en un archivo de terceros es el
camino de entrada previsto**.

Dependencias fijadas: `package-lock.json` y `src-tauri/Cargo.lock` están en el repositorio.
No hay secretos, ni `.env`, ni claves; `.gitignore` excluye `dist/`, `node_modules/` y
`migracion-zettlr/` (que lleva volcados del registro y configuración personal).

---

## 6. Rutas de arranque para el cazador

```
src-tauri/src/lib.rs          los 5 comandos, 365 líneas
src-tauri/tauri.conf.json     CSP nula, withGlobalTauri, assetProtocol **
src-tauri/capabilities/default.json
src/widgets.ts                las 3 salidas a HTML y el puente de imágenes
src/livepreview.ts            el constructor de decoraciones
src/main.ts                   orquestación, pestañas, reconciliación con el disco
src/preferencias.ts           localStorage
src/contexto.ts               la carpeta base de las imágenes
```

**Módulos del protocolo seleccionados**, con la frontera que los pide:

- `DESKTOP-MOBILE-AND-LOCAL-IPC.md` — hay puente nativo con cinco comandos
  (`Over-broad native bridge capabilities`), apertura por asociación de archivo y arrastre
  (`File-open and intent authority confusion`), y escritura privilegiada por
  temporal+`rename` (`Local file ownership and TOCTOU`).
- `CLIENT-SIDE.md` — hay tres sumideros de HTML alimentados por dato de tercero
  (`DOM-based XSS`), navegación desde enlaces dibujados
  (`Client-side navigation confusion`) y estado de seguridad en `localStorage`
  (`Browser-storage disclosure and stale authorization`).
- `ATTACK-CLASSES.md` — `Injection`, `Resource and file handling`, `Business logic`,
  `Chained vulnerabilities and trust boundaries`, `Obvious things`.
- `RESOURCE-EXHAUSTION-AND-AVAILABILITY.md` — se pide por
  `src/livepreview.ts:379-390`: el documento completo se re-analiza en cada tecla y en
  cada movimiento de cursor, con varias regex de retroceso y varias búsquedas lineales
  anidadas.

**No seleccionados**: `WEB-PROTOCOL-AND-AUTH.md` (no hay servidor, sesiones ni
autenticación), `CLOUD-AND-DEPLOYMENT.md` (no hay despliegue), `AI-AND-LLM.md` (no hay
modelo ni herramientas), `PROTOCOLS-RPC-AND-MESSAGING.md` (el único IPC es el de Tauri,
cubierto por el módulo de escritorio), `DATA-ISOLATION-AND-LIFECYCLE.md` (un solo usuario,
sin almacén multiinquilino). `MEMORY-SAFETY-AND-BINARY.md` y
`SUPPLY-CHAIN-AND-RELEASE.md` quedan **al margen pero anotados**: el Rust del proyecto no
tiene un solo `unsafe` y no hay FFI propio, y la cadena de publicación (firma, actualizador)
todavía no existe en el repositorio — cuando se publique como software libre, ese módulo
pasa a ser trabajo pendiente.

**Cobertura previa**: no existe ningún `coverage-ledger.json` ni `findings.json` anterior
para este repositorio. Esta es la primera pasada; nada de lo que no esté en el registro de
cobertura puede darse por revisado.

---

## 7. Lo que NO se pudo determinar leyendo código

1. **Bloqueo de ejecución: no hay sandbox.** El protocolo exige red aislada, entorno vacío
   con lista blanca, destino de sólo lectura y límites explícitos de CPU, memoria, procesos,
   tamaño de archivo, disco y reloj antes de correr código del objetivo. Esta máquina no los
   ofrece, así que **no se compiló, no se ejecutó y no se instaló nada**. Se reporta como
   bloqueo, no se fuerza. Comandos identificados para una validación futura, **no
   ejecutados**: `npm run probar` (13 pruebas de frontera de pestañas y de `id` del HTML),
   `cargo test --lib` (16 pruebas del núcleo en `src-tauri/src/lib.rs:207-365`),
   `npm run build` (`tsc && vite build`). Los tres son offline; `npm install` y
   `cargo build` **sí** buscarían red y quedan prohibidos para esta corrida.
2. **Navegación del webview.** Si se pica un enlace dibujado en una celda de tabla
   (`src/widgets.ts:72`), quién decide qué pasa con `javascript:`, `file:` o `data:` es el
   manejador de navegación de Tauri 2 y WebView2, y no está configurado ni presente en este
   repositorio. Hace falta comprobarlo en ejecución.
3. **Cabeceras reales servidas.** Con `csp: null`, lo que Tauri inyecta (o deja de
   inyectar) en el protocolo propio es comportamiento del entorno, no del código.
4. **Interior de las bibliotecas de renderizado.** El alcance de
   `securityLevel: 'strict'` en Mermaid 12.0.0 con DOMPurify 3.4.15, y los valores por
   omisión de `trust` y `maxExpand` en KaTeX 0.18.7, están en `node_modules/` (presente en
   disco, **no versionado**). Leerlos es trabajo de la fase 2; darlos por buenos sin leerlos
   no es una opción.
5. **Sistema de archivos real.** Cómo se comporta `fs::rename` frente a enlaces simbólicos,
   uniones de directorio, archivos con ACL restrictiva o el Acceso controlado a carpetas de
   Defender (que ya bloqueó una escritura el 2026-09-16, `src/main.ts:326-328`) exige una
   prueba acotada.
6. **Instalador y firma.** ACL del directorio de instalación, comportamiento del NSIS y
   ausencia de firma de código no se pueden establecer desde el repositorio; sólo consta
   «sin UAC» e instalación por usuario (`docs/estado.md:16`).
7. **Asociación efectiva de `.md`.** `docs/estado.md:166-170` dice que el `UserChoice`
   firmado de Windows 11 la tiene todavía Zettlr, así que la ruta de entrada por doble clic
   está declarada pero **no verificada** en esta máquina.
8. **ACL efectiva de Tauri en una copia limpia.** Lo de §5 se leyó de
   `src-tauri/gen/schemas/`, que está ignorado por git. `Cargo.lock` fija las versiones, así
   que se espera la misma expansión, pero el artefacto leído es local.
9. **`dist/`** contiene un empaquetado anterior (`dist/`, ignorado por git). No se revisó:
   el protocolo prohíbe tratar código generado como si fuera otra revisión.
