# La marca

Los originales del logo de MarkFrame, de donde sale todo lo demás. **Aquí no se
edita nada**: si el logo cambia, llega uno nuevo y se vuelve a generar.

| Archivo | Qué es |
|---|---|
| `logo-markframe.ai` | El original de Illustrator. La fuente de verdad |
| `logo-markframe.svg` | Exportación vectorial, con los metadatos de Illustrator dentro |
| `logo-markframe.png` | 2726 × 2321, con el símbolo arriba y la palabra abajo |
| `icono-fuente-1024.png` | **El que alimenta los iconos**: sólo el símbolo, cuadrado, sobre baldosa blanca |

## Cómo se regeneran los iconos

```
npx tauri icon marca/icono-fuente-1024.png
```

Escribe todo `src-tauri/icons/`. **Deja también carpetas `android/` e `ios/` que
este programa no usa: bórralas**, o se quedan ahí para siempre.

## Por qué el icono lleva baldosa blanca

Se compararon cuatro variantes a 16, 24, 32, 48, 64 y 128 px, sobre fondo claro y
oscuro a la vez, que es donde esto se decide y no en una pantalla de diseño.

- **Transparente** —— la M es negra y **desaparece en la barra de tareas oscura**.
  Queda flotando la F azul sola.
- **Baldosa azul** —— la F del logo es azul y se funde con el fondo. A 128 px casi
  no está.
- **Baldosa tinta**, con la M pasada a blanco: se ve bien, pero altera el logo.
- **Baldosa blanca** —— elegida por Lalo el 2026-09-17. Conserva el logo tal como
  se diseñó y se lee sobre cualquier fondo.

La palabra «MarkFrame» **no entra en el icono**: a 16 píxeles es una mancha gris.

## Lo que todavía no usa el logo

El cuadrito de la barra de título (`index.html`, `.marca-mf`) sigue siendo un
«MF» de texto sobre un cuadrado de acento, dibujado a mano antes de que existiera
el logo. Para usar el símbolo real habría que sacarlo del SVG, que trae once
`path` con gradientes de Illustrator y nombres generados. A 17 píxeles la
ganancia es pequeña, así que está anotado como pendiente y no como deuda urgente.
