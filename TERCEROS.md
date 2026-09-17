# Software de terceros

MarkFrame incluye trabajo de otras personas dentro del ejecutable. Este archivo
recoge sus avisos de copyright, porque sus licencias lo exigen al redistribuir.

Los textos completos de las licencias están en [`licencias/`](licencias/).

**Los datos de abajo se leyeron de los paquetes instalados el 2026-09-17**, no
de memoria.

---

## Tipografías · SIL Open Font License 1.1

Las seis familias van **dentro del `.exe`**, en formato `woff2`. La OFL obliga a
distribuir el aviso de copyright con la fuente. Texto completo en
[`licencias/OFL-1.1.txt`](licencias/OFL-1.1.txt).

| Familia | Aviso de copyright |
|---|---|
| **Inter** | Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter) |
| **JetBrains Mono** | Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono) |
| **IBM Plex Mono** | Copyright 2017 IBM Corp. All rights reserved. |
| **Newsreader** | Copyright 2020 The Newsreader Project Authors (http://github.com/productiontype/Newsreader) |
| **Space Grotesk** | Copyright 2020 The Space Grotesk Project Authors (https://github.com/floriankarsten/space-grotesk) |
| **Source Serif 4** | Ver la nota de abajo |

> **Nota sobre Source Serif 4.** El archivo de licencia que trae el paquete
> `@fontsource-variable/source-serif-4@5.3.0` **no incluye una línea de
> copyright en el formato habitual**: empieza con «Google Inc.» y sigue con el
> texto de la OFL. El aviso canónico hay que tomarlo del proyecto original de
> Adobe. **Queda pendiente de completar antes de publicar** —— no se inventa aquí.

Todas se instalaron desde [Fontsource](https://fontsource.org/), versión 5.3.0,
sin modificar. Al no modificarlas, la cláusula de la OFL sobre nombres
reservados no llega a aplicar.

---

## Bibliotecas · MIT

Texto de la licencia en [`licencias/MIT-katex.txt`](licencias/MIT-katex.txt) ——
es el mismo texto para todas, cambiando el titular.

| Biblioteca | Versión | Aviso de copyright |
|---|---|---|
| **CodeMirror 6** (`@codemirror/*`, `@lezer/*`) | 6.x | Copyright (C) 2018-2021 by Marijn Haverbeke <marijn@haverbeke.berlin> and others |
| **KaTeX** | 0.18.7 | Copyright (c) 2013-2020 Khan Academy and other contributors |
| **Mermaid** | 12.0.0 | Copyright (c) 2014 - 2022 Knut Sveidqvist |

## Bibliotecas · otras licencias

| Biblioteca | Versión | Licencia |
|---|---|---|
| **DOMPurify** | 3.4.15 | MPL-2.0 **o** Apache-2.0, a elección de quien la use. Llega dentro de Mermaid |
| **Tauri** y su árbol de dependencias de Rust | 2.11.5 | MIT **o** Apache-2.0 |
| **Vite**, **TypeScript** | —— | Sólo herramientas de compilación: **no van dentro del ejecutable** |

> **El árbol de Rust no está enumerado aquí.** Son cientos de crates, y la lista
> se genera —— no se escribe a mano—— con `cargo about` o `cargo license`. Si se
> publica, ahí es donde se produce el anexo. Mejor una lista generada y exacta
> que una escrita a mano y desactualizada.

---

## Lo que MarkFrame **no** incluye

No hay telemetría, no hay analítica, no hay actualización automática y no se
conecta a ningún servidor. La única salida a la red que el programa puede hacer
es **cargar una imagen que el propio documento pida**, y para eso pregunta antes
con un aviso en rojo —— ver la auditoría.
