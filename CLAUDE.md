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

## Verificar, no suponer

Es un programa de escritorio: compila y **ábrelo**. «Debería funcionar» no es
reporte. Los tiempos de arranque se **miden** y se anotan con su número.

## Registro de Windows

El instalador registra la asociación `.md`. **No se edita el registro a mano**,
ni siquiera en `HKEY_CURRENT_USER`. Las reglas de esta máquina lo prohíben.
