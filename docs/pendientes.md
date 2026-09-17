# Matriz de pendientes

**2026-09-17.** Todo lo que la auditoría abrió está cerrado **menos la firma**,
que es una decisión tomada: no se firma por ahora.

El estado del programa está en [estado.md](estado.md). Esto es sólo la cola.

## Lo decidido el 2026-09-17

| | Decisión de Lalo |
|---|---|
| **A1 · Publicar** | **Todavía no.** Queda en privado |
| **A2 · Firmar** | **No se firma** |
| **A3 · Icono** | **Hecho.** Llegó el logo y los iconos se regeneraron. Baldosa blanca |
| **A4 · Tablas editables** | **Sí, se hacen** —— en contra de mi recomendación, que era dejarlo. Hecho |
| **A5 · Paleta del sistema** | **No se hace** |
| **B · todo** | Adelante. B1, B2 y B3 hechos |

---

## A · Bloqueado por una decisión de Lalo

### A1 · Publicar el repositorio · **la decisión madre** · EN ESPERA

**El 2026-09-17 Lalo decidió que todavía no.** Sigue privado y sin licencia.
Las opciones se dejan escritas para cuando se retome; nada de lo de abajo hay
que hacerlo hoy.

| Opción | Qué implica |
|---|---|
| **Público con licencia MIT** | Cualquiera lo usa, lo modifica y lo vende; sólo debe conservar el aviso de copyright. Es lo que espera quien se encuentra una herramienta así |
| **Público con Apache 2.0** | Igual que MIT, más una concesión expresa de patentes y la obligación de anotar los cambios. Más largo de leer, más protegido |
| **Público sin licencia** | «Todos los derechos reservados» por omisión: nadie puede usarlo legalmente. Publica el código pero no la herramienta |
| **Seguir privado** | Nada que preparar. El trabajo hecho sirve igual para uso propio |

> **Recomendación: público con MIT.** Es un editor de escritorio, no una
> plataforma: no hay patentes que defender ni contribuciones externas que
> gobernar. MIT es corto, todo el mundo lo entiende, y no impone nada a quien lo
> descargue. Apache 2.0 sólo compensa si se espera que una empresa lo adopte.

**Qué habría que preparar antes** —— trabajo mío, media sesión:

- **Un README para alguien que no es Lalo.** Hoy la documentación está escrita
  para él: dice «Lalo» por su nombre y da por sabido el contexto.
- `auditoria/architecture.md` lleva rutas `C:\Users\Luis Martinez\...`.
- Decidir si el informe de auditoría se publica. **Yo lo publicaría**: dice qué
  se buscó, qué se encontró y qué sigue abierto. Muy pocos programas pequeños
  enseñan eso, y es lo que da confianza para instalar algo sin firmar.
- El correo `lalomalvi16@gmail.com` está en todo el historial de commits. Es
  público de todos modos, pero conviene que lo sepa antes, no después.

### A2 · Firmar el instalador · DECIDIDO: no se firma

Sin firma, Windows muestra **«Editor desconocido»** en cada instalación. A Lalo
ya no le afecta —— lo tiene instalado— así que esto **sólo importa si se publica**.

| Opción | Coste aproximado | Qué da |
|---|---|---|
| **No firmar** | 0 | El aviso sale siempre. Se compensa publicando el SHA-256 y el código fuente |
| **Azure Trusted Signing** | ~10 USD al mes | Lo más barato con firma real. Exige verificación de identidad, y para personas físicas los requisitos son más estrictos que para empresas |
| **Certificado OV** | cientos de USD al año | Firma válida. Desde 2023 obliga a guardar la clave en hardware. Exige entidad legal verificable |
| **Certificado EV** | más caro, con llave física | Lo mismo, más reputación inmediata en SmartScreen |

> **Recomendación: no firmar todavía.** Es un gasto recurrente para un programa
> que aún no tiene un solo usuario fuera de esta máquina. Publicar el código, el
> informe de auditoría y el hash da más confianza que una firma comprada, y si
> algún día el programa se usa de verdad, firmar sigue estando a un paso.
>
> **Números sin verificar hoy:** precios y requisitos de firma cambian seguido.
> Si Lalo decide firmar, lo primero es confirmarlos.

### A3 · El icono definitivo · HECHO

El logo llegó el 2026-09-17 y los iconos se regeneraron con él. Se eligió la
baldosa blanca tras comparar cuatro variantes a tamaños reales sobre fondo claro
y oscuro. Los originales viven en `marca/`, con su [LEEME](../marca/LEEME.md).

### A4 · Tablas editables desde la presentación · HECHO

**Lalo lo pidió, y mi recomendación era dejarlo.** Gana lo que quiere hoy.

Lo que me hacía recomendar que no era que «editar celda por celda exige escribir
de vuelta al markdown», prohibido por la regla 2. **Resultó no ser cierto**: hace
falta escribir de vuelta sólo si se lee el DOM para reconstruir el documento.
Como cada celda sabe en qué tramo exacto vive, confirmar es reemplazar ese tramo
—— dos números y un texto, sin mirar el HTML.

Sí acerté en lo otro: va como pieza aparte, acotada a la tabla y muy probada,
nunca como serializador general. Ver *Las tablas editables* en
[estado.md](estado.md).

### A5 · Paleta que siga al color de acento de Windows · DECIDIDO: no se hace

> **Recomendación: no hacerlo.** Ese color se elige pensando en la barra de
> tareas. En rojo o verde lima, el resaltado de código se vuelve ilegible, y el
> programa se vería roto por culpa de un ajuste del sistema.

---

## B · No bloqueado · lo que sigue, en este orden

### ~~B5 · El monograma de la barra de título~~ · HECHO el 2026-09-17

El símbolo salió del SVG en tres `path` y 1.5 KB, con la M en `currentColor` y
el gradiente renombrado —— los de Illustrator traen identificadores de cincuenta
caracteres, y dos iguales en la misma página se pisan.

### ~~B1 · Pruebas de la presentación~~ · HECHO

24 pruebas que corren en Node sin abrir ventana. Fijan lo que la auditoría cerró
—— el esquema `javascript:` en diez disfraces, la UNC, el tope de vista, las
expresiones acotadas—, la lógica de rangos de las celdas, y el fallo del botón
que las motivó.

### ~~B2 · Etiquetas de Mermaid~~ · HECHO

Toman el fondo real de la caja, leído del CSS para que sigan al tema.

### ~~B3 · Dimensiones de AVIF~~ · HECHO

Se recorren todas las cajas `ispe` y se toma la mayor.

### B4 · README para alguien que no es Lalo

Trabajo de A1, que está en «todavía no». Espera a esa decisión.

---

## Lo que NO está pendiente, para no volver a abrirlo

- **La advertencia del build.** El enlazador de MSVC imprime «Creando
  biblioteca…» en español y Rust lo reporta como advertencia. Es ruido de una
  herramienta, no un defecto: no hay nada que arreglar.
- **La instancia única, el tope de dimensiones y la pasada de funciones.**
  Cerrados y verificados el 2026-09-16.
