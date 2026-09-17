# Decidido, y la cola de trabajo

**2026-09-17.** Lalo cerró las tres decisiones que bloqueaban publicar y todo el
bloque de contenido. **Ya no hay nada esperando su palabra.** Lo que queda es
trabajo, y está listado abajo con su estado.

El estado del programa está en [estado.md](estado.md). El campo y la
competencia, en [mercado.md](mercado.md) —— que conserva el nombre viejo a
propósito, y explica por qué. Los precedentes de seguridad, en
[auditoria/precedentes.md](../auditoria/precedentes.md).

---

## Lo decidido el 2026-09-17

| | Decisión | Por qué |
|---|---|---|
| **Publicar** | **Sí** | El paquete es barato y el trabajo ya está hecho |
| **El nombre** | **MarkFrame**, antes MarkFlow | `MarkFlow` estaba tomado por `drl990114/MarkFlowy` (2 393★, editor de markdown **en Tauri**, activo) y por `vorojar/MarkFlow`; 219 repos coinciden. `MarkFrame` está prácticamente libre —— 7 repos, **ninguno es un editor** —— y el monograma **MF del logo sirve igual** |
| **Licencia** | **MIT** | Es un editor de escritorio, no una plataforma: no hay patentes que defender ni contribuciones que gobernar |
| **El historial de git** | **`filter-repo`** quitando `migracion-zettlr/` | Lleva 5 rutas del disco de Lalo y 3 volcados de `HKCU`. Nadie tiene clones, así que el `push --force` no rompe a nadie, y conserva los 34 commits |
| **El informe de auditoría** | **Se publica, con nota de cierre** | Su «lo que queda abierto» tiene 4 puntos y 3 están cerrados. Sin la nota, un desconocido leería agujeros que no existen |
| **El instalador** | **En el release, con su SHA-256** | Sin él hacen falta Node y Rust para probarlo |
| **Los issues** | **Apagados** | «Uso personal, sin soporte» en el README |
| **La versión** | **1.0.0** | Lleva días en uso diario y con la auditoría cerrada. El 0.1.0 decía «experimento» |
| **Corrector ortográfico** | **Descartado** | No está en la intención del programa |

### Fuera del alcance de la 1.0, pero escrito

Lalo lo dejó como **alcance registrado, no alcanzable en esta versión.** No se
empieza ninguno antes de publicar.

| | Qué es | Nota para cuando se retome |
|---|---|---|
| **Traducción** | Español, inglés y portugués; arranque en el idioma de Windows | ~150 cadenas, `src/idioma.ts`, selector en Configuración, **sin dependencias nuevas**. La prosa del panel de Configuración es la parte caras: **el portugués no lo va a poder revisar Lalo** |
| **Mermaid `sandbox`** | Postura más resistente que `strict` | Cuesta la interactividad y el tema claro/oscuro: un iframe en caja de arena no hereda el CSS. **Hoy Mermaid 12.0.0 no tiene avisos vigentes**, así que no urge |
| **Exportar a PDF** | Lo primero que echaría de menos un desconocido | **No choca con «sin bóvedas»**: es el documento abierto y una ruta de salida, y WebView2 ya sabe imprimir |
| **Multiplataforma** | Hoy sólo Windows | Toda la banda Tauri es multiplataforma con el mismo código; el día que interese cuesta poco. No se puede probar lo que no se tiene |

---

## La cola de trabajo

| | Qué | Estado |
|---|---|---|
| 1 | **Renombrado a MarkFrame** —— configuración, código, identificador, documentación | ✅ hecho |
| 2 | **`LICENSE` MIT** y los campos de licencia en `package.json` y `Cargo.toml` | ⏳ |
| 3 | **Versión 1.0.0** en los tres sitios | ⏳ |
| 4 | **[TERCEROS.md](../TERCEROS.md) y `licencias/`** —— lo único con filo legal | ✅ hecho, con un hueco marcado: el paquete de Source Serif 4 no trae su línea de copyright |
| 5 | **Capturas** —— tema claro y oscuro, los tres modos, el panel de formato, el aviso de imagen remota, el índice, las tablas editables | ⏳ |
| 6 | **README para alguien que no es Lalo**, con las capturas y el aviso de editor desconocido | ⏳ |
| 7 | **Nota de cierre en el informe de auditoría** | ⏳ |
| 8 | **`AGENTS.md`** canónico, con `CLAUDE.md` reducido a un *import* | ⏳ |
| 9 | **Quitar la ruta absoluta** de `auditoria/architecture.md` | ⏳ |
| 10 | **Recompilar** con el nombre y la versión nuevos | ⏳ |
| 11 | **`filter-repo` y renombrar el repo en GitHub** —— lo último, y se avisa antes del `push --force` | ⏳ |

### Lo que el renombrado sí rompe, y está aceptado

Al cambiar el identificador de `com.lalomalvi.markflow` a
`com.lalomalvi.markframe`, **WebView2 deja de encontrar las preferencias
guardadas**: tema, tipografía, reparto del divisor y último archivo. Se vuelven a
poner en un minuto. Avisado antes de hacerlo.

Y el sufijo de los temporales pasa de `.markflow-tmp` a `.markframe-tmp`, así que
un temporal huérfano del nombre viejo **ya no lo barre la limpieza**. Son
residuos raros y visibles; no vale la pena arrastrar el nombre viejo por esto.

### Lo que NO se renombró, a propósito

**Los registros de la auditoría** —— `auditoria/caza/*.json`,
`auditoria/validacion/*.json`, `coverage-ledger.json`. Son la evidencia cruda de
unas corridas fechadas sobre un programa que entonces se llamaba MarkFlow.
Reescribirlos sería falsificar un registro, y eso es peor que la confusión que
evita. El informe sí lleva el nombre nuevo, y su nota de cierre explicará el
cambio.

---

## Lo cerrado antes, para no volver a discutirlo

| | |
|---|---|
| **Tablas editables** | Se hacen. Hechas, y Lalo tenía razón contra mi recomendación |
| **El icono** | El logo del 2026-09-17, ya dentro del `.exe` y de la barra |
| **Buscador** | Sólo el archivo abierto. Un índice de carpetas sería una bóveda |
| **Resaltado** | Un solo color, con `==texto==`. Nada de sintaxis propia |
| **Subrayado** | No existe en markdown: la S del panel es tachado |
| **Paleta del acento de Windows** | No se hace. En rojo o verde lima el resaltado de código es ilegible |
| **Firmar el instalador** | No por ahora. Gasto recurrente para un programa sin usuarios fuera de esta máquina |
| **Rendimiento** | Medido: nada que mejorar sin pagar con seguridad o fluidez. **No reabrir sin un dato nuevo** |
| **Actualización automática** | No se pone. Sin firma cuesta más de lo que vale; el canal es el release |
| **Plugins** | No. Abren superficie de ataque y contradicen la auditoría |
| **Wikilinks, grafo, búsqueda global, explorador de carpetas** | Ninguno. Todos exigen indexar una carpeta —— la bóveda por la puerta de atrás |
| **La advertencia del build** | El enlazador de MSVC imprime «Creando biblioteca…» en español y Rust lo llama advertencia. Ruido de herramienta |

### El rendimiento, zanjado con números

`construir()` tarda **2.4 ms con 100 KB**. El `.md` más grande de Lalo tiene
**35 KB** y ninguno de sus 108 pasa de 100 KB; el punto de inflexión está en
medio mega. La memoria son **436 MB**, de los que **406 son Chromium**: se
intentó bajarla apagando servicios de navegador y **no sirvió de nada** (446,
439, 436 contra 436). Es el precio de WebView2, pagado al elegir Tauri —— a
cambio, instalador de 4.9 MB y arranque en 110 ms.

### Y lo que conviene no olvidar

**Los seis fallos del 2026-09-17 los encontró Lalo usando el programa, no las
112 pruebas** —— incluido el panel de fuente que no se ensanchaba al salir del
modo Ambos. Ninguno era detectable sin abrir la ventana: las pruebas cubren lo
que se puede cubrir sin ella, y ahí son buenas. **Después de tocar la interfaz,
abrir el programa y mirar.**
