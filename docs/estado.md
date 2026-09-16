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
| Autoguardado (1 s tras teclear, y al perder foco) | ✅ |
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

## Lo que sigue

**Etapa 4 — programa terminado.** Instalador, asociación `.md` y arranque con el
archivo como argumento (esto último ya funciona).

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
