# La marca

Los originales del logo de MarkFrame, de donde sale todo lo demás. **Aquí no se
edita nada**: si el logo cambia, llega uno nuevo y se vuelve a generar.

| Archivo | Qué es |
|---|---|
| `logo-markframe.ai` | El original de Illustrator. La fuente de verdad |
| `logo-markframe.svg` | Exportación vectorial, con los metadatos de Illustrator dentro |
| `logo-markframe.png` | 2726 × 2321, con el símbolo arriba y la palabra abajo |
| `icono-fuente-1024.png` | **El que alimenta los iconos y el README**: sólo el símbolo, cuadrado, sobre baldosa blanca |

> ## ⚠ Los tres primeros dicen «MarkFlow», no «MarkFrame»
>
> El nombre del archivo se cambió el 2026-09-17 al renombrar el programa, pero
> **la palabra dibujada dentro sigue siendo la vieja.** Así que de esos tres
> **sólo sirve el símbolo**, nunca la versión con texto.
>
> **Pendiente: Lalo va a pasar el logo con el texto nuevo.** Cuando llegue, se
> sustituyen los tres y se puede usar la versión con palabra en el README y en
> cualquier sitio ancho. Hasta entonces, todo lo que se publique usa
> `icono-fuente-1024.png`, que **no tiene texto y por eso no envejeció**.

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

## La barra de título ya lleva el símbolo real

Salió del SVG en tres `path` y 1.5 KB, con la M en `currentColor` para que tome
el color del texto de la barra —— en negro fijo desaparecería con el tema oscuro.
El gradiente se renombró a `mf-degradado`: los de Illustrator traen
identificadores de cincuenta caracteres, y dos iguales en la misma página se
pisan.

Hasta el 2026-09-17 este archivo decía que seguía siendo un «MF» dibujado a
mano. Era falso: se había sustituido horas antes.
