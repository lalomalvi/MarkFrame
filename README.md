# MarkFlow

Abre cualquier archivo `.md`, de cualquier carpeta, y edítalo. Sin bóvedas, sin
bibliotecas que mantener, sin configuración. Como el Bloc de notas, pero que
entiende markdown.

- Dos paneles lado a lado: la fuente y el texto formateado, **los dos editables**
- Autoguardado, deshacer y rehacer
- Ventana nativa de Windows, `.exe` con instalador
- Se registra como programa predeterminado para `.md`

Uso personal. Especificación en [ESPEC.md](ESPEC.md).

## Desarrollo

```
npm install
npm run tauri dev      # ventana de desarrollo
npm run tauri build    # ejecutable e instalador
```

Requiere Node y la cadena de Rust (`winget install Rustlang.Rustup`).
