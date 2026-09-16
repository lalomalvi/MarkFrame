# Estado vigente

**Última actualización: 2026-09-16**

## Dónde vamos

**Etapa 1 — cimientos.** ✅ Terminada el 2026-09-16.

| Pieza | Estado |
|---|---|
| Cadena de Rust | ✅ rustup 1.29.1, rustc 1.98.1, toolchain `stable-x86_64-pc-windows-msvc` |
| Enlazador MSVC | ✅ verificado compilando y enlazando un binario de prueba |
| WebView2 Runtime | ✅ ya venía en la máquina, v153.0.4234.32 |
| Repo | ✅ local, rama `main`, sin remoto por decisión del 2026-09-16 |
| Esqueleto de Tauri 2 | ✅ plantilla `vanilla-ts` con Vite 8 y TypeScript 6 |
| Identidad en la config | ✅ `MarkFlow`, `com.lalomalvi.markflow`, ventana 1200×800 |
| Primera compilación release | ✅ `MarkFlow.exe`, **4.02 MB** |
| Instaladores | ✅ `.msi` 1.91 MB y `.exe` (NSIS) 1.29 MB |
| Ventana nativa que abre | ✅ verificado: abre, título `MarkFlow`, se cierra limpio |

Etapas 2, 3 y 4: sin empezar. Ver [ESPEC.md](../ESPEC.md) §4.

## Arranque medido — 2026-09-16

Criterio: desde lanzar el proceso hasta que la ventana existe **y ya tiene su
título puesto**. Cinco intentos seguidos.

| | ms |
|---|---|
| Primerísimo arranque, en frío | 1215 |
| Mediana de 5 | **111** |
| Mínimo / máximo | 96 / 329 |

> **Cuidado al comparar después.** Este número es del esqueleto vacío: la ventana
> todavía muestra la plantilla de Tauri, sin CodeMirror ni pipeline de markdown.
> Es la **línea base**, no el número final. Volver a medir al cerrar la etapa 2 y
> anotar cuánto costó el editor.

## Etapa 2 — ✅ terminada el 2026-09-16

| Pieza | Estado |
|---|---|
| Dos paneles, ambos editables | ✅ |
| Edición *inside*: marcadores que se ocultan y vuelven con el cursor | ✅ |
| Abrir y guardar en cualquier ruta, sin bóvedas | ✅ |
| Guardado explícito: botón, Ctrl+S, y pregunta al cerrar | ✅ 2026-09-16 |
| Deshacer / rehacer, botones y Ctrl+Z / Ctrl+Y | ✅ |
| Alternar paneles: Fuente · Ambos · Vista | ✅ |
| Tema claro/oscuro siguiendo a Windows | ✅ |
| Arrastrar y soltar un `.md` sobre la ventana | ✅ |
| Arranque con un `.md` como argumento | ✅ |

### Verificado de punta a punta

Escribir en el panel de **presentación** → autoguardado → revisar el disco:

```
ANTES      bytes=662 CR=32
DESPUES    bytes=702 CR=34   marca presente, CRLF=34, LF sueltos=0
TRAS UNDO  bytes=662 CR=32   vuelta al original byte por byte
```

7 de 7 pruebas del núcleo pasan (`cargo test --lib`): ida y vuelta sin alterar
bytes, CRLF y LF detectados, BOM descartado, UTF-8 inválido rechazado en vez de
corromper, sin temporales regados, y escritura fuera de toda carpeta de proyecto.

### Arranque, medido otra vez

| | Línea base (etapa 1) | Con el editor completo |
|---|---|---|
| Mediana de 5 | 111 ms | **111 ms** |
| Mínimo | 96 ms | 96 ms |

El editor no le costó nada medible a la aparición de la ventana. Ojo con el
matiz: el criterio mide hasta que la ventana existe con su título, que ocurre
un instante antes de que CodeMirror termine de pintar el documento.

### El fallo que hubo que arreglar

**Ctrl+Z no deshacía.** El `historyKeymap` de CodeMirror ejecuta el undo sólo en
la vista enfocada, y con dos vistas eso deja las historias desfasadas: el panel
donde escribiste deshace y el otro no, así que al archivo no llegaba nada. Se
sacó ese keymap y los atajos se enrutan a las dos vistas a la vez. Está anotado
en `src/editor.ts` para que nadie lo "simplifique" de vuelta.

## Etapa 3 — ✅ terminada el 2026-09-16

Seis cosas que el panel de presentación ahora dibuja, todas con el mismo
mecanismo: un widget que tapa el texto y **desaparece en cuanto el cursor entra**.

| | Estado |
|---|---|
| Tablas, con alineaciones `:---` `---:` `:---:` | ✅ negrita, código y enlaces dentro de las celdas |
| Diagramas Mermaid | ✅ tema claro/oscuro según Windows |
| Fórmulas KaTeX, en línea y en bloque | ✅ |
| Imágenes locales y remotas | ✅ las lee el núcleo, con caché y tope de 25 MB |
| Avisos `[!NOTA]` `[!AVISO]` `[!PELIGRO]` | ✅ también `tip`, `ejemplo`, `cita` |
| Casillas de tarea | ✅ se pican con el ratón y editan el documento |

### Arranque: Mermaid no lo tocó

| | Mediana de 5 |
|---|---|
| Línea base (esqueleto vacío) | 111 ms |
| Etapa 2 (editor completo) | 111 ms |
| `.md` sencillo | **110 ms** |
| `.md` con diagrama y fórmulas | **92 ms** |

Mermaid y sus dependencias pesan 2.4 MB pero viven en trozos aparte: el bundle
de entrada sigue en 279 KB y sólo se descargan si el documento trae un diagrama.
Matiz: la medición llega hasta que la ventana existe con su título; el diagrama
se dibuja un instante después.

### Dos fallos que costaron la etapa

**Barras invertidas comidas por heredoc.** Tres sitios quedaron rotos al escribir
archivos con `cat > x <<EOF`: `[\\/]` quedó en `[\/]` y `r"\\?\"` en `r"\?\"`.
Compilaba, pasaba tipos y pruebas, y las imágenes no aparecían. Está anotado en
`CLAUDE.md` como regla del proyecto y hay una prueba que fija el prefijo.

**La arquitectura del módulo de presentación cambió.** CodeMirror prohíbe que un
plugin de vista genere decoraciones que se traguen saltos de línea, y una tabla o
un diagrama hacen eso. Ahora es un `StateField`. El precio: recorre el documento
entero en vez de sólo lo visible. Si algún día un `.md` enorme va lento, es ahí.

## Etapa 4 — ✅ terminada el 2026-09-16

| Pieza | Estado |
|---|---|
| Instalador | ✅ `MarkFlow_0.1.0_x64-setup.exe`, 4.08 MB |
| Sin permisos de administrador | ✅ `installMode: currentUser`, sin UAC |
| Se desinstala desde Windows | ✅ y quita sus asociaciones al irse |
| ProgId propio | ✅ `MarkFlow.nota` — **no** se llama `Markdown`, que es el de Zettlr |
| Extensiones registradas | ✅ `.md`, `.markdown`, `.mdown`, `.mkd` |
| Arranque con el archivo como argumento | ✅ |
| Frontmatter YAML como metadatos, no como título | ✅ |

Se dejó de generar el `.msi`: WiX instala para toda la máquina y pide
administrador. Un solo instalador, y sin UAC.

### Prueba de aceptación — los cinco archivos de Zettlr

Los cinco que quedaron abiertos en Zettlr (ver el documento de migración):
rutas con acentos, tildes en mayúsculas, paréntesis, espacios y una en `D:`.

```
1.  CLAUDE.md                          1335 ms (en frio)   intacto
2.  NOTA.md            (unidad D:)      317 ms             intacto
3.  1.1100-Diagrama-Balance-Obra.md     138 ms             intacto
4.  03_Criterios-Analisis-Diseno.md     122 ms             intacto   83 KB
5.  12_Diaphragms.md                    123 ms             intacto
```

Integridad comprobada con SHA-256 antes y después. El de 83 KB abriendo en
122 ms confirma que el `StateField` no penaliza a esta escala.

### Lo que falta, y no lo puede hacer el instalador

Windows 11 protege la asociación efectiva con un `UserChoice` firmado por hash.
Zettlr la tiene tomada hoy. **Ningún instalador puede arrebatarla**, y el
registro no se toca a mano. El relevo exige que Lalo lo haga desde Windows:
clic derecho en un `.md` → *Abrir con* → *Elegir otra aplicación* → MarkFlow →
**Usar siempre**.

### Incidente del 2026-09-16 — un archivo real alterado

Durante la prueba, `03_Criterios-Analisis-Diseno.md` quedó con una letra `a`
delante del frontmatter. **Reparado y verificado**; los otros cuatro, intactos.

La causa fue el método de prueba, no el programa: se abrieron los **originales**
en vez de copias, mientras se automatizaba la interfaz con ratón y teclado. Una
pulsación cayó en la ventana de MarkFlow y el autoguardado la persistió.

**Regla que queda:** ninguna prueba de MarkFlow toca archivos reales. Se copian
al scratchpad y se prueba ahí.

## Cambio de criterio: fuera el autoguardado — 2026-09-16

A raíz del incidente, Lalo lo quitó. Ahora:

- Botón **Guardar** en la barra, apagado mientras no haya cambios, más Ctrl+S.
- Un punto en el título de la ventana cuando hay cambios sin guardar.
- Al cerrar con cambios, diálogo propio: *Guardar y salir* · *Salir sin guardar*
  · *Cancelar*. También al abrir otro archivo con cambios pendientes.

Verificado sobre copia, los cuatro pasos:

```
1. escribir y esperar 4 s  -> NO guardo solo
2. Ctrl+S                  -> guardo
3. cerrar con cambios      -> saco el dialogo, no escribio
4. Guardar y salir         -> guardo y cerro
```

## Lo que sigue

- **Instalar** con `MarkFlow_0.1.0_x64-setup.exe` y tomar la asociación a mano.
- Luego la **fase C** de la migración: desinstalar Zettlr (650 MB).

## Decisiones tomadas hoy

- **Nombre:** MarkFlow.
- **Sin bóvedas.** Anula lo propuesto el 2026-08-15 en `notasynodos/ESCRITORIO.md` §4.
- **Motor:** Tauri, no Electron ni Python.
- **Repo local, sin GitHub por ahora.**
- **Proyecto aparte de `notasynodos`**, que no se toca.

## Pendiente de decidir

- **Tablas editables desde la presentación.** Hoy la tabla se dibuja, y para
  tocarla hay que meter el cursor, que la devuelve a texto. Editar celda por
  celda sobre la tabla dibujada exigiría escribir de vuelta al markdown, que es
  justo lo que este proyecto tiene prohibido. Si se quiere, va como pieza aparte
  y muy probada.
- **Scroll sincronizado entre los dos paneles.** No se pidió; se nota al usarlo.

## Ya decidido

- El icono: monograma **MF** sobre azul tinta, con la barra ámbar. Hecho.
- Repo en GitHub: `lalomalvi/MarkFlow`, **privado**. Usa HTTPS con el token de
  `gh` porque la clave SSH no está disponible desde la sesión de trabajo.
