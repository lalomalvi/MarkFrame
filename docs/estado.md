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

## Lo que sigue

**Etapa 2, el núcleo.** CodeMirror 6 con dos vistas sobre un solo `EditorState`,
live preview en el panel derecho, y abrir/guardar en cualquier ruta del disco.

## Decisiones tomadas hoy

- **Nombre:** MarkFlow.
- **Sin bóvedas.** Anula lo propuesto el 2026-08-15 en `notasynodos/ESCRITORIO.md` §4.
- **Motor:** Tauri, no Electron ni Python.
- **Repo local, sin GitHub por ahora.**
- **Proyecto aparte de `notasynodos`**, que no se toca.

## Pendiente de decidir

- ¿Subirlo a GitHub privado, como `notasynodos`?
- El icono: MarkFlow necesita el suyo. El de Folio es del blog y se queda allá.
