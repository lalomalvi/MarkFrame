# MarkFrame — instrucciones para quien toque este código

Editor y lector de `.md` para Windows 11. Tauri 2 (Rust + WebView2) al frente,
CodeMirror 6 adentro.

**Antes de tocar nada, lee [ESPEC.md](ESPEC.md).** Ahí están las decisiones y,
más importante, **por qué se descartó lo otro**. El estado vigente vive en
[docs/estado.md](docs/estado.md).

## Las tres reglas que este proyecto se salta a su costa

1. **La velocidad de apertura gana cualquier empate.** Es la razón de existir del
   programa. Toda dependencia que sume al arranque tiene que justificarse.

2. **Nunca conviertas HTML editado de vuelta a markdown.** Lo que impide que eso
   haga falta es que **el panel derecho no es HTML**: es el mismo texto con los
   marcadores decorados, así que editarlo es editar markdown y no hay nada que
   traducir de vuelta. Esto no es preferencia de estilo: es la lección que costó
   bloquear 6 bloques en el editor Folio. Si te ves escribiendo un serializador
   inverso, párate y relee ESPEC.md §2.

   **El mecanismo, para que no lo busques donde no está:** son **dos
   `EditorState`**, uno por panel —— CodeMirror 6 no permite compartir uno entre
   dos vistas—— y cada transacción se refleja en el otro con la anotación
   `espejo` de `editor.ts`, que corta la ida y vuelta infinita. Es el patrón que
   documenta CodeMirror para esto. Hasta el 2026-09-17 este archivo decía «el
   mismo `EditorState`», que era falso y mandaba a buscar algo que no existe.

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

**Y nunca pruebes sobre los archivos reales de nadie.** Copia una muestra a una
carpeta temporal y prueba ahí. El 2026-09-16 una prueba sobre los originales
metió una letra en el encabezado de un documento real: se automatizó la
interfaz, una pulsación cayó en la ventana y **el autoguardado la escribió a
disco**. El programa hizo lo que se le pidió; el método estaba mal.

De ahí salió la decisión de quitar el autoguardado —— **el guardado es explícito,
no lo vuelvas a automatizar.** Hay un `.md` de demostración en
[`assets/demo.md`](assets/demo.md) para probar sin tocar nada de nadie.

## Registro de Windows

El instalador registra la asociación `.md`. **No edites el registro a mano**, ni
siquiera en `HKEY_CURRENT_USER`: la asociación de extensiones en Windows 10 y 11
lleva una firma por usuario, y escribirla a mano hace que Windows la descarte y
vuelva al programa anterior. Sólo la puede fijar la persona, desde la interfaz
del sistema.

## Si eres un agente y este repo no es tuyo

El estado de [`docs/estado.md`](docs/estado.md) es el que manda sobre lo que el
programa hace hoy, y su sección de **trampas conocidas** existe para que no
vuelvas a caer donde ya se cayó. Está escrito en español, como todo el código y
sus comentarios: **síguelo**, no lo traduzcas a medias.
