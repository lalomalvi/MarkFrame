# MarkFlow — instrucciones del proyecto

Editor y lector de `.md` para Windows 11. Tauri 2 (Rust + WebView2) al frente,
CodeMirror 6 adentro.

**Antes de tocar nada, lee [ESPEC.md](ESPEC.md).** Ahí están las decisiones y,
más importante, **por qué se descartó lo otro**. El estado vigente vive en
[docs/estado.md](docs/estado.md).

## Las tres reglas que este proyecto se salta a su costa

1. **La velocidad de apertura gana cualquier empate.** Es la razón de existir del
   programa. Toda dependencia que sume al arranque tiene que justificarse.

2. **Nunca conviertas HTML editado de vuelta a markdown.** Los dos paneles son
   vistas de CodeMirror sobre el **mismo `EditorState`**, no dos documentos
   sincronizados. Esto no es preferencia de estilo: es la lección que costó
   bloquear 6 bloques en el editor Folio. Si te ves escribiendo un serializador
   inverso, párate y relee ESPEC.md §2.

3. **Aquí no hay bóvedas.** Si una propuesta obliga al usuario a registrar una
   carpeta antes de abrir un archivo, está mal por definición.

## El enemigo es el documento, no el sistema de archivos

El puente nativo alcanza **cualquier ruta del disco, a propósito**: es la regla 3
puesta en código, y quien pueda ejecutar el programa ya podía leer esos archivos.
No lo «arregles» metiendo una frontera de rutas —— romperías la razón de existir
del programa sin cerrar nada.

La consecuencia sí es la que manda: **cualquier ejecución de código dentro del
webview hereda ese puente entero.** Por eso el modelo de amenaza es **un `.md` de
procedencia desconocida**, y la única defensa real es que nada del documento se
vuelva ejecutable ni navegable. Antes de añadir cualquier widget que meta un
atributo en el DOM, pregúntate qué pasa si el contenido lo escribió un atacante.

**Y el error de forma que ya costó tres hallazgos: mirar cómo empieza una cadena
en vez de a dónde apunta.** `/^https?:/` no dice nada sobre el destino. Resuelve
y decide sobre lo resuelto —— vale para enlaces, para rutas y para imágenes.

Detalle y lo que quedó abierto: [auditoria/INFORME.md](auditoria/INFORME.md).

## Nunca escribas rutas ni regex con heredoc de bash

Este programa vive de manipular rutas de Windows, así que el código está lleno
de barras invertidas. **Un heredoc de bash se come una de cada par en silencio.**
El 2026-09-16 eso metió tres errores de golpe: `[\\/]` quedó en `[\/]` (la clase
dejó de aceptar `\`, y ninguna ruta de Windows se recortaba) y `r"\\?\"` quedó en
`r"\?\"` (el prefijo largo de Windows dejó de quitarse). Compilaba, pasaba los
tipos, y las imágenes simplemente no aparecían.

Cualquier archivo con `\` se escribe con las herramientas de edición, no con
`cat > archivo <<EOF`. Si ya lo hiciste, audítalo con `grep -n -F '\'` antes de
dar nada por bueno.

## Verificar, no suponer

Es un programa de escritorio: compila y **ábrelo**. «Debería funcionar» no es
reporte. Los tiempos de arranque se **miden** y se anotan con su número.

**Y nunca pruebes sobre archivos reales de Lalo.** Cópialos al scratchpad y
prueba ahí. El 2026-09-16 una prueba sobre los originales le metió una letra al
frontmatter de una transcripción de la NTC: se automatizó la interfaz, una
pulsación cayó en la ventana y el autoguardado la escribió a disco. El programa
hizo lo que se le pidió; el método estaba mal. De ahí salió también la decisión
de quitar el autoguardado —— **el guardado es explícito, no lo vuelvas a
automatizar** sin que Lalo lo pida.

## Registro de Windows

El instalador registra la asociación `.md`. **No se edita el registro a mano**,
ni siquiera en `HKEY_CURRENT_USER`. Las reglas de esta máquina lo prohíben.
