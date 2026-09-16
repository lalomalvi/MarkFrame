# MarkFlow — especificación

Editor y lector de archivos Markdown para Windows 11.
Decidido el **2026-09-16**.

---

## 1. Qué es y qué no es

**Es** el programa con el que abres un `.md` cualquiera, de cualquier carpeta,
lo lees bien formateado y lo editas. Doble clic, abre, escribes, se guarda.
El lugar que hoy ocupa el Bloc de notas, pero que entiende markdown.

**No es** un gestor de notas. No hay bóvedas, no hay carpetas que registrar, no
hay biblioteca que mantener. Un archivo suelto en `Descargas` se abre igual que
uno del proyecto más ordenado.

> **Por qué se descartó el modelo de bóvedas de Obsidian.** Se propuso el
> 2026-08-15 en `notasynodos/ESCRITORIO.md` §4 y quedó **anulado el 2026-09-16**:
> pedirle al usuario que registre una carpeta antes de leer un archivo contradice
> la razón de existir de un lector predeterminado. Si hay que mover el `.md` a una
> carpeta autorizada, el programa no sirve para lo que se hizo.

### Prioridades, en orden

1. **Velocidad de apertura.** Es el criterio que gana cualquier empate.
2. **Edición sin fricción.**
3. **Visualización fiel.**
4. **Autoguardado** y **deshacer / rehacer**.

---

## 2. Decisiones de arquitectura

### Motor: Tauri 2 (Rust + WebView2)

| Exigencia | Cómo se cumple |
|---|---|
| Un `.exe`, no un script | Ejecutable nativo con instalador `.msi` / `.exe` |
| Ventana nativa de Windows | Ventana propia del sistema: barra de título, Alt+Tab, anclaje |
| Nunca una ventana de navegador | WebView2 dibuja **dentro** de la ventana, como un control |
| Sin terminal | El `.exe` arranca solo; la terminal sólo existe al compilar |
| Instalar y olvidarse | Se instala y desinstala desde Windows como cualquier programa |

Se descartó **Electron** (~150 MB y arranque lento: desproporcionado para abrir
un archivo de texto) y **Python con interfaz nativa** (renderizar markdown decente
cuesta mucho y el resultado se ve viejo).

WebView2 **no es Edge**: es un componente del sistema, ya presente en Windows 11
(verificado en esta máquina el 2026-09-16, v153.0.4234.32). No se lanza ningún
navegador ni existe un proceso de navegador visible.

### Los dos paneles: un documento, dos vistas

Por defecto **dos paneles lado a lado**, ambos editables, con opción a dejar sólo
uno. El de la derecha usa la edición *inside* de Obsidian: los marcadores se
ocultan y reaparecen cuando el cursor entra al renglón.

**La decisión que hace que esto no se rompa:** no son dos documentos
sincronizados, es **un solo documento con dos ventanas**. Ambos paneles son vistas
de CodeMirror 6 sobre el **mismo `EditorState`**. El panel derecho no es HTML
renderizado: es el mismo texto con los marcadores decorados.

> **Por qué importa.** El editor Folio (`notasynodos`, 2026-08) sí intentó editar
> sobre la vista formateada, convirtiendo lo editado *de vuelta* a markdown. Hubo
> que **bloquear 6 bloques de 81** —tablas, figura, KaTeX— porque el serializador
> se come renglones. Aquí ese riesgo **no existe**: nunca hay conversión inversa,
> así que es imposible perder un renglón de una tabla.
>
> Estado: **doctrina** — razonada sobre evidencia de Folio, aún no verificada
> en MarkFlow. Se confirma al terminar la etapa 2.

### Sin restricción de rutas

A diferencia de Folio —cuya `rutaSegura()` ancla todo a `contenido/`— MarkFlow
lee y escribe en cualquier ruta. Es un editor de archivos del usuario, y esa es
su función. La decisión es consciente y consta aquí.

---

## 3. Comportamiento fijado

- **Autoguardado:** al dejar de escribir (~1 s) y al perder el foco la ventana.
  Sin botón de guardar.
- **Deshacer / rehacer:** botones en la barra **y** Ctrl+Z / Ctrl+Y.
- **Tema:** sigue el tema claro/oscuro de Windows.
- **Asociación `.md`:** la registra **el instalador**, bajo doble clic del usuario,
  y se revierte al desinstalar. **No se edita el registro a mano.**

---

## 4. Etapas

| | Etapa | Estado |
|---|---|---|
| 1 | Cimientos: cadena de Rust, repo, esqueleto de Tauri, ventana que abre | en curso |
| 2 | Núcleo: dos vistas sobre un documento, live preview, abrir/guardar en cualquier ruta | ⬜ |
| 3 | Oficio: autoguardado, deshacer/rehacer, alternar paneles, tema | ⬜ |
| 4 | Programa: icono, instalador, asociación `.md`, arranque con argumento | ⬜ |

## 5. Fuera de la v1

A propósito, para que no se extrañen sin aviso: búsqueda global, explorador de
carpetas, pestañas y exportar a PDF. Ninguno sirve al «abre rápido y edita».
