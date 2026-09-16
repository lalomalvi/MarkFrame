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
| Instalador | `MarkFlow_0.1.0_x64-setup.exe`, 4.08 MB, NSIS, **sin UAC** |
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
- Deshacer y rehacer con botones y con Ctrl+Z / Ctrl+Y.
- Tema claro/oscuro siguiendo a Windows. Arrastrar y soltar. Arranque con el
  archivo como argumento.

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
- **Scroll sincronizado** entre los dos paneles. No se pidió; se nota al usarlo.
- **Tamaño de letra ajustable.** Zettlr estaba en 18 px; MarkFlow usa 15.5 px.

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
