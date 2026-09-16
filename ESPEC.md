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
4. **Guardado explícito** y **deshacer / rehacer**.

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

- **Guardado explícito.** Botón *Guardar* en la barra, o Ctrl+S. El botón está
  apagado mientras no haya cambios, y el título de la ventana lleva un punto
  cuando los hay.
- **Al cerrar con cambios, el programa pregunta**: *Guardar y salir*, *Salir sin
  guardar*, *Cancelar*.

> **Hubo autoguardado, y se quitó el 2026-09-16.** La v1 guardaba sola un
> segundo después de teclear. Ese mismo día, durante una prueba automatizada,
> una pulsación accidental cayó en la ventana y quedó escrita en un archivo real
> —una transcripción de la NTC de concreto— sin que nadie lo pidiera. Se reparó,
> pero el episodio mostró el problema: **con autoguardado, un roce del teclado
> es indistinguible de una decisión.** Decisión de Lalo: guardado a botón.
- **Deshacer / rehacer:** botones en la barra **y** Ctrl+Z / Ctrl+Y.
- **Tema:** sigue el tema claro/oscuro de Windows.
- **Asociación `.md`:** la registra **el instalador**, bajo doble clic del usuario,
  y se revierte al desinstalar. **No se edita el registro a mano.**

---

## 4. Etapas

| | Etapa | Estado |
|---|---|---|
| 1 | Cimientos: cadena de Rust, repo, esqueleto de Tauri, ventana que abre | ✅ 2026-09-16 |
| 2 | Núcleo: dos vistas sobre un documento, live preview, abrir/guardar en cualquier ruta | ✅ 2026-09-16 |
| 3 | Widgets: tablas, Mermaid, KaTeX, imágenes, avisos, casillas | ✅ 2026-09-16 |
| 4 | Programa: instalador, asociación `.md`, arranque con argumento | ✅ 2026-09-16 |

## 5. Auxiliares que el panel de presentación dibuja

Decidido el 2026-09-16, a petición de Lalo. Todos usan el mismo mecanismo: un
widget que tapa el texto y **se quita cuando el cursor entra al bloque**, así que
ninguno escribe de vuelta al markdown.

- **Tablas**, con alineaciones, y negrita/código/enlaces dentro de las celdas.
- **Mermaid**, con el tema siguiendo al de Windows.
- **KaTeX**, en línea y en bloque. `$100 y $200` no cuenta como fórmula: se exige
  que no haya espacio pegado a los delimitadores.
- **Imágenes** locales y remotas. Las locales las lee el núcleo y las entrega
  listas para pintar, en vez de usar el protocolo de recursos del webview, que
  depende de un «scope» de carpetas y este programa no tiene carpetas.
- **Avisos** `[!NOTA]`, `[!AVISO]`, `[!PELIGRO]`, `[!TIP]`, `[!EJEMPLO]`, `[!CITA]`,
  en español y en inglés.
- **Casillas de tarea**, que se pican con el ratón.

Mermaid y KaTeX **se cargan la primera vez que hacen falta**, no al arrancar: un
`.md` sin diagramas no paga sus 2.4 MB.

## 6. Fuera de la v1

A propósito, para que no se extrañen sin aviso: búsqueda global, explorador de
carpetas, pestañas y exportar a PDF. Ninguno sirve al «abre rápido y edita».
