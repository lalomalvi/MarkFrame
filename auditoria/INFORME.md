# Auditoría de seguridad de MarkFlow

**16 de septiembre de 2026.** Revisión auditada: `23561e2`. Protocolo: el de
auditoría de seguridad de Cloudflare, seis fases.

---

## Qué se hizo

| Fase | Trabajo |
|---|---|
| 1 · Reconocimiento | Mapa de arquitectura, fronteras de confianza y **14 unidades de cobertura** |
| 2 · Caza | **5 cazadores aislados**, sin verse entre ellos · 112 comprobaciones · 20 candidatos |
| 3 · Validación | **5 validadores adversariales** cuyo encargo era *refutar*, no confirmar |
| 4 · Salida | Registros en `caza/*.json` y `validacion/*.json` |
| 5 · Verificación | Un hallazgo crítico **confirmado por ejecución observada** |
| 6 · Informe | Este documento |

**Superficie:** 2513 líneas — TypeScript sobre CodeMirror 6 y Rust sobre Tauri 2.
**Modelo de amenaza:** un archivo `.md` de procedencia desconocida, porque el
programa se va a publicar.

**Sin ejecución de código del objetivo**, salvo una excepción razonada: el hecho
decisivo del hallazgo crítico era si WebView2 evalúa un `href="javascript:"`. La
carga útil la escribió el auditor, era `document.body.style.background='red'`, y
corrió sobre una copia. El protocolo prohíbe ejecutar código *controlado por el
objetivo*; aquí lo controlaba el auditor por completo.

---

## Hallazgos confirmados

### 1 · Crítico — ejecución de código por un enlace de tabla · CERRADO

`| [texto](javascript:…) |` producía un enlace vivo. Al pincharlo, WebView2
evaluaba el código **con el puente nativo entero a su alcance** —lectura y
escritura en cualquier ruta del disco— y reemplazaba el documento, llevándose la
aplicación y todo lo no guardado.

**Observado, no deducido.** La ventana quedó en blanco, sin pestañas y **sin
botones de cerrar**, porque la barra de título es HTML: hubo que matar el
proceso.

Dos cazadores discreparon sobre si la captura `[^)]+` dificultaba la escalada. El
validador lo resolvió: **no**. Una URL `javascript:` se percent-decodifica antes
de evaluarse, así que `%28`/`%29` restituyen los paréntesis.

> **Arreglado** con lista blanca de destinos en `enriquecer()`, política de
> contenido con `script-src 'self'`, y guardián de navegación.
> **Verificado repitiendo el ataque**: el markdown se queda a la vista, sin
> enlace, y la aplicación sigue en pie.

### 2 · Alta — ruta UNC en una imagen · CERRADO

`![](\\servidor\pub\x.png)` no empieza por `http`, así que la puerta de imágenes
remotas ni se enteraba. La ruta llegaba a `fs::metadata`, y Windows abría sesión
SMB contra el servidor del atacante **con sólo abrir el archivo**: IP, nombre de
equipo, usuario y una respuesta NTLMv2.

Era el mismo daño que la puerta existe para evitar, por la puerta de al lado.

> **Arreglado** decidiendo por destino resuelto y no por prefijo de cadena. El
> arreglo ingenuo no servía: Chromium normaliza `\\host\x.png` a `//host/x.png` y
> lo pide por HTTP igual.

### 3 · Alta — un enlace normal sacaba a la aplicación de su documento · CERRADO

Sin manejador de navegación, un `https://` en una tabla **reemplazaba la
aplicación** con esa página: pérdida de todo lo no guardado, sin preguntar, y sin
señal de que eso ya no era MarkFlow.

> **Arreglado** con un complemento de navegación: los enlaces se abren en el
> navegador del sistema. `tauri::Builder` no tiene ese gancho — el arreglo que
> proponía el cazador no habría compilado.

### 4 y 5 · Altas — dos expresiones regulares con coste cuadrático · CERRADAS

La de referencia de nota al pie no excluía `[` de su clase; la de detección de
Mermaid se aplicaba al bloque entero. Medido: **5×10¹¹ pasos con 1 MB** en la
primera; segundos por pulsación con 30 KB en la segunda. Corren en el hilo de
interfaz, la primera al abrir el archivo.

> **Arregladas las dos**, más una tercera de la misma familia que el validador
> encontró de paso. Y sobre todo: **tope de tamaño para la vista**, que es la red
> para la próxima. Parchear una a una es jugar al topo.

### 6 · Media — la caché de imágenes sin tope · CERRADO

~25 KB de markdown apuntando a un archivo ya presente en el disco retenían
~1.6 GB, porque cada ruta equivalente era una clave distinta y nada la vaciaba.

### 7 · Media — el diálogo no bloqueaba los atajos · CERRADO

Un `div` con `aria-modal` no bloquea nada. Con un diálogo en pantalla, **Ctrl+Tab
cargaba el contenido de una pestaña dentro de otra**, borrándole la historia; y
**Ctrl+W dejaba la promesa sin resolver para siempre**, apagando en silencio la
detección de cambios externos el resto de la sesión.

### 8 · Media — `decodeURI` mataba el panel · CERRADO

`descuento-50%.png` es un nombre de archivo legal en Windows, y lanzaba dentro de
`toDOM`, que CodeMirror llama sin protección. El eslabón que ningún cazador vio:
si lanza el panel de presentación, **el de fuente nunca recibe el cambio — y
fuente es lo que se guarda**.

### 9 · Endurecimiento · HECHO

Se quitó el **protocolo de recursos** con alcance `**` —permiso para leer
cualquier binario desde el webview, sin un solo consumidor—, se puso política de
contenido, y se saneó `withGlobalTauri`.

---

## Rechazados o reclasificados

La fase de validación **degradó más hallazgos de los que confirmó**, que es
exactamente para lo que existe.

| Candidato | Veredicto | Por qué |
|---|---|---|
| Enlace simbólico en el temporal | Severidad **baja** | Mecanismo real y documentado, pero los enlaces de Windows exigen privilegio y **no viajan en zips ni repositorios** |
| Nombre de temporal predecible | Robustez | Ruidoso, reversible, sin nadie que gane nada |
| `rename` pierde ACL y flujos | Robustez | Precio conocido de todo guardado atómico, y lo dispara el usuario |
| Temporal huérfano | Robustez | El residuo cae junto al documento que ya se estaba leyendo |
| Tres copias en `leer` | Robustez | Un fallo de reserva **no es un pánico**: llama a `handle_alloc_error` |
| `std::env::args()` | Robustez | Se llama una sola vez, sin pestañas sucias que perder |
| Preferencias envenenadas | Robustez | Requiere editar `localStorage` a mano; quien pueda ya tiene más |
| Búsquedas lineales anidadas | Robustez | `tocado` es lineal — el cazador se equivocó, y su arreglo **habría causado falsos negativos silenciosos** |
| Permiso de imagen entre pestañas | Baja | Sólo alcanza a la URL idéntica ya autorizada |

**Limpio, con evidencia:** el HTML embebido en un `.md` nunca se renderiza ·
Mermaid está saneado por DOMPurify y su versión es posterior a los CVE conocidos ·
KaTeX tiene `trust: false` por omisión · el SVG **no** ejecuta scripts, sólo llega
a `img.src` · no hay contaminación de prototipo · no hay inyección de CSS · la
aritmética de rangos es correcta en los 17 sitios · ningún camino trunca ni borra
el archivo del usuario.

---

## Lo que queda abierto

- **La política de contenido y el guardián de navegación no se han probado con
  todas las funciones.** Compilan y el ataque conocido está cerrado, pero KaTeX,
  Mermaid, las imágenes y el diálogo merecen una pasada completa.
- **El instalador no va firmado.** Al publicar, Windows mostrará el aviso de
  editor desconocido en cada instalación.
- **`leer_imagen` no mira las dimensiones declaradas.** Un PNG de 100 KB que
  declare 20000×20000 descomprime a ~1.6 GB. Hallazgo anotado fuera de encargo
  por un validador; no revisado.
- **Sin control de instancia única.** Dos ventanas sobre la misma nota ya no
  comparten el temporal, pero pueden seguir pisándose el guardado.

---

## El patrón

Los tres hallazgos más graves son **el mismo error de forma**: mirar cómo empieza
una cadena en vez de a dónde apunta. `esRemota` comprobaba `/^https?:/`.
`enriquecer()` escapaba caracteres sin validar el esquema. La diferencia entre
`/^https?:/` y «resuelve el destino y decide» es toda la superficie de ataque de
este programa.

Y varios de los peores son la contrapartida de decisiones acertadas. La barra de
título propia convierte un cuelgue en una ventana que no se puede cerrar. La
escritura atómica con temporal abre la vía del enlace. No hay decisión sin
contrapartida; hay contrapartidas que no se ven al decidir.
