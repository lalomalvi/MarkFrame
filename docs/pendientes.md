# Matriz de pendientes

**2026-09-16.** Todo lo que la auditoría abrió está cerrado **menos la firma**.
Lo que queda se parte en dos: lo que espera una decisión de Lalo, y lo que es
trabajo y ya tiene orden.

El estado del programa está en [estado.md](estado.md). Esto es sólo la cola.

---

## A · Bloqueado por una decisión de Lalo

### A1 · Publicar el repositorio · **la decisión madre**

Hoy es **privado y sin licencia**. Lalo dijo desde el principio que quería
hacerlo público, y de esto cuelgan A2 y A4.

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

### A2 · Firmar el instalador · *depende de A1*

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

### A3 · El icono definitivo

El que hay es un monograma provisional. Lalo estaba afinando el suyo.

> **Recomendación: que decida cuándo quiera, no bloquea nada.** Si se publica,
> conviene que sea el bueno desde el primer día: cambiar el icono después obliga
> a reinstalar para que Windows refresque su caché.

### A4 · Tablas editables desde la presentación

Hoy se dibujan, y para tocarlas el cursor las devuelve a texto.

| Opción | Qué implica |
|---|---|
| **Dejarlo así** | Cero riesgo. Editar una tabla es editar su markdown, que siempre funciona |
| **Editar celda por celda** | Exige **escribir de vuelta al markdown**, que es lo que este proyecto tiene prohibido por la regla 2 —— la lección que costó bloquear 6 bloques en Folio |

> **Recomendación: dejarlo así.** Y si algún día se quiere, que vaya como pieza
> aparte, acotada a la tabla y muy probada —— nunca como un serializador general.

### A5 · Paleta que siga al color de acento de Windows

> **Recomendación: no hacerlo.** Ese color se elige pensando en la barra de
> tareas. En rojo o verde lima, el resaltado de código se vuelve ilegible, y el
> programa se vería roto por culpa de un ajuste del sistema.

---

## B · No bloqueado · lo que sigue, en este orden

### B1 · Pruebas de la presentación

**Es la lección del botón *Mostrarla*.** Ese fallo vivió desde que existe el
botón y sólo salió en una pasada manual. Hoy las 13 pruebas del frontend cubren
las pestañas y los `id` del HTML; **de los widgets y las decoraciones no hay ni
una**, que es justo donde está la lógica difícil.

Objetivo: que `construir()` y los widgets se puedan probar sin abrir la ventana
—— qué decora, qué no, qué pasa al conceder un permiso, qué pasa con una entrada
torcida. Ahí habría caído el fallo de `eq()` solo.

### B2 · Etiquetas de Mermaid en tema oscuro

Las etiquetas de las flechas (`si`, `no`) salen con un fondo gris claro que las
recorta. Se lee, pero se ve mal. Es el `edgeLabelBackground` del tema de Mermaid.
Cosmético y de un rato.

### B3 · Dimensiones declaradas en AVIF

Quedó fuera del tope a propósito: su cabecera vive en cajas ISOBMFF anidadas.
Hoy sólo lo cubre el tope de bytes. Vale la pena **sólo si se publica**: para un
`.md` propio, nadie se va a mandar una bomba a sí mismo.

### B4 · README para alguien que no es Lalo

Trabajo de A1. Se hace cuando esa decisión esté tomada.

---

## Lo que NO está pendiente, para no volver a abrirlo

- **La advertencia del build.** El enlazador de MSVC imprime «Creando
  biblioteca…» en español y Rust lo reporta como advertencia. Es ruido de una
  herramienta, no un defecto: no hay nada que arreglar.
- **La instancia única, el tope de dimensiones y la pasada de funciones.**
  Cerrados y verificados el 2026-09-16.
