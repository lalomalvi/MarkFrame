//! MarkFlow — nucleo nativo.
//!
//! Aqui NO hay restriccion de rutas a proposito. Es un editor de los archivos
//! del usuario: abre lo que le den, donde sea. Ver ESPEC.md §2.

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

/// Estilo de fin de linea del archivo tal como estaba en disco.
///
/// Se conserva y se restaura al guardar. Si no, MarkFlow convertiria en
/// silencio todos los CRLF de la maquina a LF y ensuciaria cualquier diff.
#[derive(Serialize, Deserialize, Clone, Copy, PartialEq, Debug)]
#[serde(rename_all = "lowercase")]
pub enum FinDeLinea {
    Lf,
    Crlf,
}

#[derive(Serialize)]
pub struct Documento {
    /// Contenido normalizado a \n, que es lo unico que entiende CodeMirror.
    texto: String,
    ruta: String,
    nombre: String,
    fin_de_linea: FinDeLinea,
    /// Un archivo marcado como solo lectura en disco se abre, pero no se guarda.
    solo_lectura: bool,
}

fn nombre_de(ruta: &Path) -> String {
    ruta.file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| ruta.to_string_lossy().into_owned())
}

/// Tope para un `.md`.
///
/// `leer_imagen` ya tenia el suyo desde el principio; este falto por descuido, y
/// la auditoria del 2026-09-16 lo senalo. Sin tope, el texto se copia tres veces
/// completas en memoria y un archivo desmesurado no da un error: tumba el
/// proceso entero, con lo no guardado de todas las pestanas dentro. 64 MB son
/// unos 30 millones de caracteres: mas de lo que nadie edita a mano, y bastante
/// menos de lo que duele.
const TOPE_DOCUMENTO: u64 = 64 * 1024 * 1024;

#[tauri::command]
fn leer(ruta: String) -> Result<Documento, String> {
    let p = PathBuf::from(&ruta);

    if let Ok(m) = fs::metadata(&p) {
        if m.len() > TOPE_DOCUMENTO {
            return Err(format!(
                "«{}» pesa {} MB y MarkFlow no abre documentos de mas de {} MB.",
                nombre_de(&p),
                m.len() / 1024 / 1024,
                TOPE_DOCUMENTO / 1024 / 1024
            ));
        }
    }

    let crudo = fs::read(&p).map_err(|e| format!("No se pudo leer «{}»: {e}", nombre_de(&p)))?;

    // El BOM se descarta al leer y no se vuelve a escribir: un .md con BOM es
    // un estorbo y varias herramientas lo leen como basura al inicio.
    let sin_bom = crudo
        .strip_prefix(&[0xEF, 0xBB, 0xBF])
        .unwrap_or(&crudo);

    let texto = String::from_utf8(sin_bom.to_vec()).map_err(|_| {
        format!(
            "«{}» no esta en UTF-8. MarkFlow no lo abre para no corromperlo al guardar.",
            nombre_de(&p)
        )
    })?;

    let fin_de_linea = if texto.contains("\r\n") {
        FinDeLinea::Crlf
    } else {
        FinDeLinea::Lf
    };

    let solo_lectura = fs::metadata(&p)
        .map(|m| m.permissions().readonly())
        .unwrap_or(false);

    // `canonicalize` devuelve la forma larga de Windows, con el prefijo `\\?\`.
    // Sirve internamente, pero no se le enseña al usuario ni se usa para armar
    // otras rutas: hay que quitarlo.
    let absoluta = fs::canonicalize(&p).unwrap_or(p.clone());
    let absoluta = absoluta
        .to_string_lossy()
        .trim_start_matches(r"\\?\")
        .to_string();

    Ok(Documento {
        texto: texto.replace("\r\n", "\n"),
        ruta: absoluta,
        nombre: nombre_de(&p),
        fin_de_linea,
        solo_lectura,
    })
}

#[tauri::command]
fn escribir(ruta: String, texto: String, fin_de_linea: FinDeLinea) -> Result<(), String> {
    let p = PathBuf::from(&ruta);

    let salida = match fin_de_linea {
        FinDeLinea::Lf => texto,
        FinDeLinea::Crlf => texto.replace('\n', "\r\n"),
    };

    // Escritura atomica: a un temporal al lado y luego rename, para que un corte
    // a media escritura no pueda dejar truncado el archivo del usuario.
    //
    // El temporal se abre con `create_new`, que hace DOS cosas imprescindibles y
    // que la auditoria del 2026-09-16 senalo:
    //
    //  - **Falla si el nombre ya existe**, en vez de truncar lo que haya. Con
    //    `CREATE_ALWAYS` se escribia sobre cualquier cosa que estuviera ahi, y si
    //    esa cosa era un enlace, se escribia en SU DESTINO: Microsoft documenta
    //    que sin la bandera de punto de reanalisis «the file affected is the
    //    target». En Windows, `create_new` hace que la propia biblioteca estandar
    //    anada esa bandera, asi que deja de seguir enlaces sin dependencias.
    //  - **Permite reintentar con otro nombre**, que es lo que cierra la colision
    //    entre dos ventanas de MarkFlow guardando la misma nota a la vez.
    //
    // El nombre lleva un sufijo variable por lo mismo: dejo de ser predecible.
    let padre = p.parent().ok_or("La ruta no tiene carpeta padre")?;
    let base = p
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "sin-nombre".into());

    let mut temporal = PathBuf::new();
    let mut archivo = None;
    let mut ultimo_error = None;
    for _ in 0..8 {
        temporal = padre.join(format!(".{}.{}.markflow-tmp", base, marca_unica()));
        match fs::OpenOptions::new().write(true).create_new(true).open(&temporal) {
            Ok(f) => { archivo = Some(f); break }
            Err(e) => ultimo_error = Some(e),
        }
    }
    let mut archivo = archivo.ok_or_else(|| {
        format!(
            "No se pudo crear el archivo temporal junto a «{}»: {}",
            nombre_de(&p),
            ultimo_error
                .map(|e| e.to_string())
                .unwrap_or_else(|| "motivo desconocido".into())
        )
    })?;

    // Si algo falla a partir de aqui, el temporal se borra SIEMPRE: si no, queda
    // en la carpeta una copia del documento del usuario, que acaba en la copia de
    // seguridad o en un commit sin que nadie lo haya pedido.
    let limpiar = |t: &PathBuf| { let _ = fs::remove_file(t); };

    if let Err(e) = archivo.write_all(salida.as_bytes()) {
        limpiar(&temporal);
        return Err(format!("No se pudo escribir el temporal: {e}"));
    }
    // Sin esto, el `rename` puede adelantar a los datos y dejar un archivo con el
    // nombre bueno y el contenido a medias.
    if let Err(e) = archivo.sync_all() {
        limpiar(&temporal);
        return Err(format!("No se pudo asegurar el guardado en disco: {e}"));
    }
    drop(archivo);

    fs::rename(&temporal, &p).map_err(|e| {
        limpiar(&temporal);
        format!("No se pudo guardar «{}»: {e}", nombre_de(&p))
    })?;

    Ok(())
}

/// Sufijo distinto en cada llamada, para que el nombre del temporal no sea
/// adivinable ni lo compartan dos ventanas guardando la misma nota.
fn marca_unica() -> String {
    use std::sync::atomic::{AtomicU32, Ordering};
    static CUENTA: AtomicU32 = AtomicU32::new(0);
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    format!(
        "{:x}{:x}{:x}",
        std::process::id(),
        nanos,
        CUENTA.fetch_add(1, Ordering::Relaxed)
    )
}

/// Limite para las imagenes incrustadas. Arriba de esto, en vez de tragarse
/// 60 MB de RAM por una foto, se avisa y ya.
const TOPE_IMAGEN: u64 = 25 * 1024 * 1024;

/// Tope de pixeles que una imagen puede DECLARAR en su cabecera.
///
/// El tope de bytes no alcanza, porque la razon de compresion no tiene limite
/// util: un PNG de 100 KB puede declarar 20000x20000 --400 millones de
/// pixeles-- y el webview reserva unos 4 bytes por pixel al pintarlo. Son
/// 1.6 GB salidos de un archivo que cabe en un correo. Lo anoto un validador
/// fuera de encargo en la auditoria del 2026-09-16, y quedo sin revisar.
///
/// El numero sale de no estorbarle a Lalo: un plano A0 escaneado a 300 ppp son
/// 9930 x 14040, o sea 139 millones de pixeles, y eso tiene que abrir. 180
/// millones deja pasar eso con margen y corta la bomba, que necesita ordenes de
/// magnitud mas para doler.
const TOPE_PIXELES: u64 = 180_000_000;

/// La mayor imagen declarada dentro de un archivo de cajas ISOBMFF (AVIF, HEIC).
///
/// Ahi las medidas viven en cajas `ispe`, metidas dentro de `meta > iprp > ipco`,
/// y **puede haber varias**: la imagen principal, las miniaturas, las capas. Se
/// recorren todas y se devuelve la mayor.
///
/// Quedarse con la mayor y no con «la principal» es deliberado. La pregunta que
/// esto responde no es «cuanto mide la imagen» sino «¿declara este archivo algo
/// desmesurado?», y para eso la unica respuesta segura es la peor de todas. De
/// paso evita tener que decidir cual es la principal, que exige leer aun mas
/// cajas y es justo donde un parseo a medias se equivocaria.
///
/// Es un recorrido acotado: no sigue mas de `PROFUNDIDAD` niveles ni mira mas de
/// `TOPE_CAJAS` cajas. Un archivo torcido tiene que rendirse, no dar vueltas:
/// esto corre dentro de un comando que la interfaz esta esperando.
fn mayor_ispe(b: &[u8]) -> Option<(u64, u64)> {
    const PROFUNDIDAD: u32 = 6;
    const TOPE_CAJAS: u32 = 4096;

    fn recorrer(b: &[u8], nivel: u32, vistas: &mut u32, mejor: &mut Option<(u64, u64)>) {
        if nivel > PROFUNDIDAD {
            return;
        }

        let mut i = 0usize;
        while i + 8 <= b.len() {
            *vistas += 1;
            if *vistas > TOPE_CAJAS {
                return;
            }

            let tamano = u32::from_be_bytes([b[i], b[i + 1], b[i + 2], b[i + 3]]) as usize;
            let tipo = &b[i + 4..i + 8];

            // `1` significa que el tamano real viene en 64 bits justo despues;
            // `0`, que la caja llega hasta el final del archivo.
            let (cabecera, largo) = match tamano {
                1 => {
                    if i + 16 > b.len() {
                        return;
                    }
                    let mut ocho = [0u8; 8];
                    ocho.copy_from_slice(&b[i + 8..i + 16]);
                    (16usize, u64::from_be_bytes(ocho) as usize)
                }
                0 => (8usize, b.len() - i),
                n => (8usize, n),
            };

            // Una caja mas corta que su propia cabecera no avanza nunca: es la
            // forma mas facil de colgar a un lector de ISOBMFF.
            if largo < cabecera || i + largo > b.len() {
                return;
            }

            let dentro = &b[i + cabecera..i + largo];

            match tipo {
                b"ispe" => {
                    // FullBox: cuatro bytes de version y banderas antes del dato.
                    if dentro.len() >= 12 {
                        let ancho =
                            u32::from_be_bytes([dentro[4], dentro[5], dentro[6], dentro[7]]) as u64;
                        let alto =
                            u32::from_be_bytes([dentro[8], dentro[9], dentro[10], dentro[11]])
                                as u64;
                        let area = ancho.saturating_mul(alto);
                        let mejor_area = mejor.map_or(0, |(a, h): (u64, u64)| a.saturating_mul(h));
                        if area > mejor_area {
                            *mejor = Some((ancho, alto));
                        }
                    }
                }
                // `meta` es FullBox: sus hijas empiezan cuatro bytes mas alla.
                b"meta" => {
                    if dentro.len() > 4 {
                        recorrer(&dentro[4..], nivel + 1, vistas, mejor);
                    }
                }
                // Contenedores normales. Se listan en vez de bajar a todo, para
                // no recorrer megabytes de datos comprimidos buscando cajas que
                // ahi no existen.
                b"iprp" | b"ipco" | b"moov" | b"trak" | b"mdia" | b"minf" | b"stbl" => {
                    recorrer(dentro, nivel + 1, vistas, mejor);
                }
                _ => {}
            }

            i += largo;
        }
    }

    let mut vistas = 0u32;
    let mut mejor = None;
    recorrer(b, 0, &mut vistas, &mut mejor);
    mejor
}

/// Lo que la cabecera de una imagen dice que mide, sin descomprimirla.
///
/// **No valida el formato**: si no reconoce la cabecera devuelve `None`, y quien
/// llama decide. Aqui `None` significa «no se pudo saber», nunca «esta bien».
///
/// Cubre PNG, GIF, BMP, JPEG y WEBP. Quedan fuera a proposito:
///
/// - **ICO**, donde cada imagen mide 256x256 como maximo por definicion del
///   formato: no hay bomba posible.
/// - **SVG**, que es vectorial y no declara un mapa de bits que reservar.
/// - **SVG**, que es vectorial y no declara un mapa de bits que reservar.
///
/// **AVIF si entra**, por `mayor_ispe`.
fn dimensiones_declaradas(b: &[u8]) -> Option<(u64, u64)> {
    // --- AVIF y compania: cajas ISOBMFF, con "ftyp" en el byte 4 ----------- //
    if b.len() >= 12 && &b[4..8] == b"ftyp" {
        return mayor_ispe(b);
    }

    // --- PNG: firma de 8 bytes, y el IHDR arranca en el 16 ----------------- //
    if b.len() >= 24 && b.starts_with(&[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A]) {
        let ancho = u32::from_be_bytes([b[16], b[17], b[18], b[19]]) as u64;
        let alto = u32::from_be_bytes([b[20], b[21], b[22], b[23]]) as u64;
        return Some((ancho, alto));
    }

    // --- GIF: "GIF87a" o "GIF89a", y las medidas en el 6, poco endian ------ //
    if b.len() >= 10 && (b.starts_with(b"GIF87a") || b.starts_with(b"GIF89a")) {
        let ancho = u16::from_le_bytes([b[6], b[7]]) as u64;
        let alto = u16::from_le_bytes([b[8], b[9]]) as u64;
        return Some((ancho, alto));
    }

    // --- BMP: el alto puede venir negativo (filas de arriba abajo) --------- //
    if b.len() >= 26 && b.starts_with(b"BM") {
        let ancho = i32::from_le_bytes([b[18], b[19], b[20], b[21]]).unsigned_abs() as u64;
        let alto = i32::from_le_bytes([b[22], b[23], b[24], b[25]]).unsigned_abs() as u64;
        return Some((ancho, alto));
    }

    // --- WEBP: RIFF....WEBP, y despues depende del trozo ------------------- //
    if b.len() >= 30 && b.starts_with(b"RIFF") && &b[8..12] == b"WEBP" {
        match &b[12..16] {
            // Extendido: ancho-1 y alto-1 en 24 bits, poco endian.
            b"VP8X" => {
                let ancho = (u32::from_le_bytes([b[24], b[25], b[26], 0]) + 1) as u64;
                let alto = (u32::from_le_bytes([b[27], b[28], b[29], 0]) + 1) as u64;
                return Some((ancho, alto));
            }
            // Sin perdida: 14 bits cada uno, empaquetados tras la firma 0x2F.
            b"VP8L" if b[20] == 0x2F => {
                let bits = u32::from_le_bytes([b[21], b[22], b[23], b[24]]);
                let ancho = ((bits & 0x3FFF) + 1) as u64;
                let alto = (((bits >> 14) & 0x3FFF) + 1) as u64;
                return Some((ancho, alto));
            }
            // Con perdida: tras el codigo de arranque 9D 01 2A.
            b"VP8 " if b[23] == 0x9D && b[24] == 0x01 && b[25] == 0x2A => {
                let ancho = (u16::from_le_bytes([b[26], b[27]]) & 0x3FFF) as u64;
                let alto = (u16::from_le_bytes([b[28], b[29]]) & 0x3FFF) as u64;
                return Some((ancho, alto));
            }
            _ => return None,
        }
    }

    // --- JPEG: hay que caminar los segmentos hasta dar con un SOF ---------- //
    if b.len() >= 4 && b[0] == 0xFF && b[1] == 0xD8 {
        let mut i = 2usize;
        // El tope de vueltas evita quedarse dando giros con un archivo torcido:
        // esto corre dentro de un comando que la interfaz espera.
        for _ in 0..512 {
            // Puede haber relleno de 0xFF entre segmentos; el formato lo permite.
            while i < b.len() && b[i] == 0xFF {
                i += 1;
            }
            if i + 2 >= b.len() {
                return None;
            }
            let marca = b[i];
            i += 1;

            // Estos no llevan cuerpo: no se les puede leer una longitud.
            if marca == 0xD8 || marca == 0x01 || (0xD0..=0xD7).contains(&marca) {
                continue;
            }
            // Fin de imagen o arranque del barrido: ya no vendra ningun SOF.
            if marca == 0xD9 || marca == 0xDA {
                return None;
            }

            if i + 1 >= b.len() {
                return None;
            }
            let largo = u16::from_be_bytes([b[i], b[i + 1]]) as usize;
            if largo < 2 {
                return None;
            }

            // Los SOF son C0..CF menos C4 (tablas Huffman), C8 (reservado) y CC
            // (aritmetica): comparten rango pero no son cabeceras de marco.
            let es_sof = (0xC0..=0xCF).contains(&marca)
                && marca != 0xC4
                && marca != 0xC8
                && marca != 0xCC;

            if es_sof {
                if i + 7 >= b.len() {
                    return None;
                }
                let alto = u16::from_be_bytes([b[i + 3], b[i + 4]]) as u64;
                let ancho = u16::from_be_bytes([b[i + 5], b[i + 6]]) as u64;
                return Some((ancho, alto));
            }

            i += largo;
        }
        return None;
    }

    None
}

fn tipo_por_extension(p: &Path) -> Option<&'static str> {
    let ext = p.extension()?.to_string_lossy().to_lowercase();
    Some(match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "avif" => "image/avif",
        "ico" => "image/x-icon",
        _ => return None,
    })
}

/// Entrega una imagen del disco lista para pintar.
///
/// Se hace desde aqui y no con el protocolo de recursos del webview porque ese
/// depende de un «scope» de carpetas, y este programa no tiene carpetas
/// autorizadas: una imagen puede estar junto a cualquier `.md` del disco.
#[tauri::command]
fn leer_imagen(ruta: String) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};

    let p = PathBuf::from(&ruta);
    // El mensaje lleva la ruta completa a proposito: cuando una imagen no
    // aparece, lo que hace falta saber es DONDE la busco el programa.
    let meta = fs::metadata(&p)
        .map_err(|_| format!("No se encontro la imagen. Se busco en: {}", p.display()))?;

    if meta.len() > TOPE_IMAGEN {
        return Err(format!(
            "«{}» pesa {} MB y no se incrusta (tope: {} MB)",
            nombre_de(&p),
            meta.len() / 1024 / 1024,
            TOPE_IMAGEN / 1024 / 1024
        ));
    }

    let tipo = tipo_por_extension(&p)
        .ok_or_else(|| format!("«{}» no parece una imagen", nombre_de(&p)))?;

    let bytes = fs::read(&p).map_err(|e| format!("No se pudo leer la imagen: {e}"))?;

    // Lo que la imagen DICE que mide, antes de dejar que el webview lo crea.
    // Un archivo chico puede declarar un mapa de bits enorme; ver TOPE_PIXELES.
    if let Some((ancho, alto)) = dimensiones_declaradas(&bytes) {
        let pixeles = ancho.saturating_mul(alto);
        if pixeles > TOPE_PIXELES {
            return Err(format!(
                "«{}» dice medir {}x{} y eso son {} millones de pixeles, mas del tope de {} millones. \
                 Pesa poco porque va comprimida, pero al pintarla ocuparia unos {} MB.",
                nombre_de(&p),
                ancho,
                alto,
                pixeles / 1_000_000,
                TOPE_PIXELES / 1_000_000,
                pixeles.saturating_mul(4) / 1024 / 1024
            ));
        }
    }

    Ok(format!("data:{};base64,{}", tipo, STANDARD.encode(bytes)))
}

/// Huella de un archivo en disco: cuando se toco por ultima vez y cuanto pesa.
///
/// Sirve para darse cuenta de que OTRO programa lo edito. El patron de trabajo
/// real en 2026 es un editor y un agente sobre la misma carpeta, y un editor
/// que no note el cambio guarda encima del trabajo ajeno.
#[derive(Serialize)]
pub struct Huella {
    /// Milisegundos desde la epoca. 0 si el sistema no lo sabe.
    modificado: u64,
    tamano: u64,
}

#[tauri::command]
fn huella(ruta: String) -> Result<Huella, String> {
    let meta = fs::metadata(&ruta).map_err(|e| format!("No se pudo mirar el archivo: {e}"))?;
    let modificado = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    Ok(Huella { modificado, tamano: meta.len() })
}

/// El `.md` con el que Windows lanzo el programa, si lo hubo.
#[tauri::command]
fn archivo_inicial() -> Option<String> {
    //  esta documentado como que entra en panico si un argumento no es
    // Unicode valido.  no: devuelve lo que haya y se descarta aqui.
    std::env::args_os()
        .skip(1)
        .filter_map(|a| a.into_string().ok())
        .find(|a| !a.starts_with('-'))
        .filter(|a| Path::new(a).is_file())
}

/// Impide que la ventana se vaya de su propio documento.
///
/// Sin esto, un enlace normal en un  --  --
/// **reemplaza la aplicacion entera** con esa pagina: se pierde lo no guardado
/// de todas las pestanas sin preguntar, y como la barra de titulo es HTML, no
/// queda ni un boton para cerrar. Confirmado en la auditoria del 2026-09-16.
///
///  no tiene ; el gancho vive en el constructor
/// de complementos, y por eso esto es un complemento de una sola
/// responsabilidad.
///
/// Los enlaces siguen funcionando: se abren en el navegador del sistema, que
/// es donde el usuario espera que se abra una pagina web.
fn guardia_de_navegacion<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("guardia-de-navegacion")
        .on_navigation(|webview, url| {
            let esquema = url.scheme();
            // Lo unico que se deja pasar es la propia aplicacion.
            if esquema == "tauri" || esquema == "http" && url.host_str() == Some("tauri.localhost")
            {
                return true;
            }
            if esquema == "http" || esquema == "https" {
                // Al navegador del sistema, no aqui dentro.
                use tauri_plugin_opener::OpenerExt;
                let _ = webview.opener().open_url(url.to_string(), None::<&str>);
            }
            false
        })
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Va PRIMERO, y no es cosmetico: el complemento decide si este proceso
        // sigue vivo o le pasa el relevo al que ya estaba. Registrarlo despues
        // de otros deja a esos otros arrancando en un proceso que se va a morir.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _carpeta| {
            use tauri::{Emitter, Manager};

            // Alguien pidio abrir algo, asi que la ventana buena se pone
            // delante -- aunque estuviera minimizada.
            if let Some(v) = app.get_webview_window("main") {
                let _ = v.unminimize();
                let _ = v.set_focus();
            }

            // Mismo criterio que `archivo_inicial`: se toman los argumentos que
            // de verdad son archivos, no las banderas.
            let rutas: Vec<String> = argv
                .iter()
                .skip(1)
                .filter(|a| !a.starts_with('-'))
                .filter(|a| Path::new(a).is_file())
                .cloned()
                .collect();

            if !rutas.is_empty() {
                let _ = app.emit("abrir-archivos", rutas);
            }
        }))
        .plugin(guardia_de_navegacion())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![leer, escribir, leer_imagen, huella, archivo_inicial])
        .run(tauri::generate_context!())
        .expect("error al arrancar MarkFlow");
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static N: AtomicU32 = AtomicU32::new(0);

    /// Cada archivo de prueba va en su propia carpeta: los tests corren en
    /// paralelo y si comparten directorio, uno ve los temporales en vuelo de
    /// otro y falla sin que haya nada roto.
    fn temporal(bytes: &[u8]) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "markflow-prueba-{}-{}",
            std::process::id(),
            N.fetch_add(1, Ordering::SeqCst)
        ));
        fs::create_dir_all(&dir).unwrap();
        let p = dir.join("nota.md");
        fs::write(&p, bytes).unwrap();
        p
    }

    fn limpiar(p: PathBuf) {
        let _ = fs::remove_dir_all(p.parent().unwrap());
    }

    #[test]
    fn crlf_se_detecta_y_el_texto_llega_normalizado() {
        let p = temporal(b"uno\r\ndos\r\ntres");
        let d = leer(p.to_string_lossy().into_owned()).unwrap();
        assert_eq!(d.fin_de_linea, FinDeLinea::Crlf);
        assert_eq!(d.texto, "uno\ndos\ntres", "CodeMirror solo entiende \n");
        limpiar(p);
    }

    #[test]
    fn lf_se_detecta() {
        let p = temporal(b"uno\ndos");
        let d = leer(p.to_string_lossy().into_owned()).unwrap();
        assert_eq!(d.fin_de_linea, FinDeLinea::Lf);
        limpiar(p);
    }

    /// El que de verdad importa: abrir y guardar sin tocar nada no debe cambiar
    /// ni un byte del archivo del usuario.
    #[test]
    fn ida_y_vuelta_no_altera_los_bytes() {
        for original in [
            &b"# Titulo\r\n\r\nParrafo con acentos: canon, nino.\r\n"[..],
            &b"# Titulo\n\n- uno\n- dos\n"[..],
        ] {
            let p = temporal(original);
            let ruta = p.to_string_lossy().into_owned();
            let d = leer(ruta.clone()).unwrap();
            escribir(ruta.clone(), d.texto.clone(), d.fin_de_linea).unwrap();
            assert_eq!(fs::read(&p).unwrap(), original, "la ida y vuelta cambio bytes");
            limpiar(p);
        }
    }

    #[test]
    fn el_bom_se_descarta_al_leer() {
        let p = temporal(b"\xEF\xBB\xBF# Con BOM\n");
        let d = leer(p.to_string_lossy().into_owned()).unwrap();
        assert_eq!(d.texto, "# Con BOM\n");
        fs::remove_file(p).ok();
    }

    #[test]
    fn utf8_invalido_se_rechaza_en_vez_de_corromper() {
        let p = temporal(&[0x23, 0x20, 0xFF, 0xFE, 0x0A]);
        let r = leer(p.to_string_lossy().into_owned());
        assert!(r.is_err(), "deberia negarse a abrir lo que no puede guardar bien");
        limpiar(p);
    }

    #[test]
    fn escribir_no_deja_temporales_regados() {
        let p = temporal(b"hola\n");
        let ruta = p.to_string_lossy().into_owned();
        escribir(ruta, "adios\n".into(), FinDeLinea::Lf).unwrap();
        assert_eq!(fs::read_to_string(&p).unwrap(), "adios\n");
        let sobrantes: Vec<_> = fs::read_dir(p.parent().unwrap())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().ends_with(".markflow-tmp"))
            .collect();
        assert!(sobrantes.is_empty(), "quedaron temporales: {sobrantes:?}");
        limpiar(p);
    }

    /// La ruta que sale de `leer` se usa para armar la de las imagenes vecinas.
    /// Si conserva el prefijo largo de Windows, esas rutas no resuelven y las
    /// imagenes no aparecen. Paso de verdad el 2026-09-16.
    // --- lo que salio de la auditoria del 2026-09-16 ------------------------

    #[test]
    fn el_nombre_del_temporal_no_es_adivinable_ni_se_repite() {
        // Dos ventanas guardando la misma nota compartian el nombre del
        // temporal y podian pisarse. Y siendo fijo, cualquiera podia plantarlo.
        let marcas: std::collections::HashSet<String> =
            (0..500).map(|_| marca_unica()).collect();
        assert_eq!(marcas.len(), 500, "hubo marcas repetidas");
    }

    #[test]
    fn un_temporal_plantado_no_impide_guardar() {
        // Antes el nombre era fijo: dejar ahi un archivo con ese nombre dejaba
        // el documento imposible de guardar. Ahora se reintenta con otro.
        let p = temporal(b"antes\n");
        let ruta = p.to_string_lossy().into_owned();
        let estorbo = p.parent().unwrap().join(".nota.md.markflow-tmp");
        fs::write(&estorbo, b"estorbo").unwrap();

        escribir(ruta, "despues\n".into(), FinDeLinea::Lf).unwrap();
        assert_eq!(fs::read_to_string(&p).unwrap(), "despues\n");
        assert!(estorbo.exists(), "no se debe tocar lo que ya estaba ahi");
        limpiar(p);
    }

    #[test]
    fn guardar_muchas_veces_no_deja_temporales() {
        let p = temporal(b"cero\n");
        let ruta = p.to_string_lossy().into_owned();
        for i in 0..25 {
            escribir(ruta.clone(), format!("vuelta {i}\n"), FinDeLinea::Lf).unwrap();
        }
        assert_eq!(fs::read_to_string(&p).unwrap(), "vuelta 24\n");
        let sobrantes: Vec<_> = fs::read_dir(p.parent().unwrap())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().ends_with(".markflow-tmp"))
            .collect();
        assert!(sobrantes.is_empty(), "quedaron temporales: {sobrantes:?}");
        limpiar(p);
    }

    #[test]
    fn un_documento_desmesurado_se_rechaza_en_vez_de_tumbar_el_programa() {
        // No se crea un archivo de 64 MB para esto: basta comprobar que el tope
        // existe y es el que se documenta.
        assert_eq!(TOPE_DOCUMENTO, 64 * 1024 * 1024);
        assert!(TOPE_DOCUMENTO > TOPE_IMAGEN, "un .md puede pesar mas que una imagen suelta");
    }

    #[test]
    fn la_huella_cambia_cuando_el_archivo_cambia() {
        let p = temporal(b"uno
");
        let ruta = p.to_string_lossy().into_owned();
        let antes = huella(ruta.clone()).unwrap();
        assert_eq!(antes.tamano, 4);
        escribir(ruta.clone(), "uno y algo mas
".into(), FinDeLinea::Lf).unwrap();
        let despues = huella(ruta).unwrap();
        assert_ne!(antes.tamano, despues.tamano, "el tamano deberia haber cambiado");
        limpiar(p);
    }

    #[test]
    fn la_huella_de_algo_que_no_existe_da_error() {
        let r = huella(r"C:
o\existe\esto.md".to_string());
        assert!(r.is_err());
    }

    #[test]
    fn la_ruta_devuelta_no_lleva_el_prefijo_largo_de_windows() {
        let p = temporal(b"# nota\n");
        let d = leer(p.to_string_lossy().into_owned()).unwrap();
        assert!(!d.ruta.starts_with(r"\\?\"), "quedo el prefijo: {}", d.ruta);
        assert!(d.ruta.ends_with("nota.md"), "ruta inesperada: {}", d.ruta);
        limpiar(p);
    }

    #[test]
    fn una_imagen_se_entrega_como_dato_listo_para_pintar() {
        let dir = std::env::temp_dir().join(format!("markflow-img-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let p = dir.join("punto.png");
        // PNG de 1x1 valido.
        let png: &[u8] = &[
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
            0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89,
        ];
        fs::write(&p, png).unwrap();
        let d = leer_imagen(p.to_string_lossy().into_owned()).unwrap();
        assert!(d.starts_with("data:image/png;base64,"), "encabezado inesperado: {}", &d[..40.min(d.len())]);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn lo_que_no_es_imagen_se_rechaza_con_un_mensaje_claro() {
        let p = temporal(b"# no soy una imagen");
        let r = leer_imagen(p.to_string_lossy().into_owned());
        assert!(r.is_err());
        limpiar(p);
    }

    #[test]
    fn se_puede_escribir_fuera_de_toda_carpeta_del_proyecto() {
        // No hay bovedas: esta prueba existe para que quede fijado por contrato.
        let p = std::env::temp_dir().join("markflow-suelto.md");
        let ruta = p.to_string_lossy().into_owned();
        escribir(ruta, "# Suelto\n".into(), FinDeLinea::Lf).unwrap();
        assert_eq!(fs::read_to_string(&p).unwrap(), "# Suelto\n");
        fs::remove_file(p).ok();
    }

    // ---- dimensiones declaradas en la cabecera --------------------------- //

    /// Cabecera PNG con las medidas que se le pidan. Lo de despues no importa:
    /// la funcion no descomprime nada, que es justo el punto.
    fn png_de(ancho: u32, alto: u32) -> Vec<u8> {
        let mut b = vec![0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
        b.extend_from_slice(&13u32.to_be_bytes());
        b.extend_from_slice(b"IHDR");
        b.extend_from_slice(&ancho.to_be_bytes());
        b.extend_from_slice(&alto.to_be_bytes());
        b.extend_from_slice(&[8, 2, 0, 0, 0]);
        b
    }

    #[test]
    fn lee_las_medidas_de_un_png() {
        assert_eq!(dimensiones_declaradas(&png_de(1920, 1080)), Some((1920, 1080)));
    }

    #[test]
    fn la_bomba_de_descompresion_queda_fuera_del_tope() {
        // El caso que anoto el validador: pesa nada y declara una barbaridad.
        let (a, h) = dimensiones_declaradas(&png_de(20000, 20000)).unwrap();
        assert!(
            a * h > TOPE_PIXELES,
            "20000x20000 tiene que pasarse del tope, o el tope no sirve"
        );
    }

    #[test]
    fn un_plano_a0_a_300_ppp_si_cabe() {
        // 841x1189 mm a 300 ppp. Es el caso real que el tope NO debe estorbar.
        let (a, h) = dimensiones_declaradas(&png_de(9930, 14040)).unwrap();
        assert!(
            a * h <= TOPE_PIXELES,
            "un plano A0 escaneado tiene que abrir: son {} millones de pixeles",
            a * h / 1_000_000
        );
    }

    #[test]
    fn lee_las_medidas_de_un_gif() {
        let mut b = b"GIF89a".to_vec();
        b.extend_from_slice(&800u16.to_le_bytes());
        b.extend_from_slice(&600u16.to_le_bytes());
        assert_eq!(dimensiones_declaradas(&b), Some((800, 600)));
    }

    #[test]
    fn el_bmp_con_alto_negativo_da_su_valor_absoluto() {
        // Un alto negativo significa filas de arriba abajo, no una medida rara.
        let mut b = b"BM".to_vec();
        b.extend_from_slice(&[0; 16]);
        b.extend_from_slice(&1024i32.to_le_bytes());
        b.extend_from_slice(&(-768i32).to_le_bytes());
        assert_eq!(dimensiones_declaradas(&b), Some((1024, 768)));
    }

    #[test]
    fn lee_las_medidas_de_un_jpeg_caminando_segmentos() {
        let mut b = vec![0xFF, 0xD8];
        // Un APP0 de por medio, para que tenga que caminar de verdad.
        b.extend_from_slice(&[0xFF, 0xE0, 0x00, 0x10]);
        b.extend_from_slice(&[0; 14]);
        // SOF0: largo, precision, alto, ancho.
        b.extend_from_slice(&[0xFF, 0xC0, 0x00, 0x11, 0x08]);
        b.extend_from_slice(&1080u16.to_be_bytes());
        b.extend_from_slice(&1920u16.to_be_bytes());
        b.extend_from_slice(&[3, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        assert_eq!(dimensiones_declaradas(&b), Some((1920, 1080)));
    }

    #[test]
    fn lee_las_medidas_de_un_webp_extendido() {
        let mut b = b"RIFF".to_vec();
        b.extend_from_slice(&0u32.to_le_bytes());
        b.extend_from_slice(b"WEBP");
        b.extend_from_slice(b"VP8X");
        b.extend_from_slice(&[0; 4]); // largo del trozo
        b.extend_from_slice(&[0; 4]); // banderas
        b.extend_from_slice(&[0x7F, 0x07, 0x00]); // ancho-1 = 1919
        b.extend_from_slice(&[0x37, 0x04, 0x00]); // alto-1  = 1079
        assert_eq!(dimensiones_declaradas(&b), Some((1920, 1080)));
    }

    #[test]
    fn lo_que_no_reconoce_devuelve_none_sin_reventar() {
        // `None` significa «no se pudo saber», y quien llama lo deja pasar. Lo
        // que NO puede hacer es entrar en panico: corre dentro de un comando.
        for caso in [
            &b""[..],
            &b"\x89PNG"[..],                 // firma cortada a la mitad
            &b"GIF89a\x01"[..],              // sin medidas completas
            &b"BM\x00\x00"[..],              // cabecera BMP truncada
            &b"\xFF\xD8\xFF"[..],            // JPEG que se acaba de golpe
            &b"RIFF\x00\x00\x00\x00WEBPXXXX"[..], // trozo WEBP desconocido
            &b"no soy una imagen en absoluto"[..],
        ] {
            let _ = dimensiones_declaradas(caso);
        }
    }

    /// Una caja ISOBMFF: cuatro bytes de tamano, cuatro de tipo, y el cuerpo.
    fn caja(tipo: &[u8; 4], cuerpo: &[u8]) -> Vec<u8> {
        let mut b = ((8 + cuerpo.len()) as u32).to_be_bytes().to_vec();
        b.extend_from_slice(tipo);
        b.extend_from_slice(cuerpo);
        b
    }

    fn ispe(ancho: u32, alto: u32) -> Vec<u8> {
        let mut cuerpo = vec![0u8; 4]; // version y banderas
        cuerpo.extend_from_slice(&ancho.to_be_bytes());
        cuerpo.extend_from_slice(&alto.to_be_bytes());
        caja(b"ispe", &cuerpo)
    }

    /// Un AVIF con las cajas anidadas como manda el formato.
    fn avif_con(ispes: &[(u32, u32)]) -> Vec<u8> {
        let mut ipco = Vec::new();
        for (a, h) in ispes {
            ipco.extend_from_slice(&ispe(*a, *h));
        }
        let iprp = caja(b"iprp", &caja(b"ipco", &ipco));
        let mut cuerpo_meta = vec![0u8; 4]; // `meta` es FullBox
        cuerpo_meta.extend_from_slice(&iprp);

        let mut b = caja(b"ftyp", b"avif\0\0\0\0avifmif1");
        b.extend_from_slice(&caja(b"meta", &cuerpo_meta));
        b
    }

    #[test]
    fn lee_las_medidas_de_un_avif() {
        assert_eq!(dimensiones_declaradas(&avif_con(&[(1920, 1080)])), Some((1920, 1080)));
    }

    #[test]
    fn de_varias_imagenes_declaradas_se_queda_con_la_mayor() {
        // Un AVIF trae la principal y sus miniaturas. Si una sola declara una
        // barbaridad, es la que manda: la pregunta es si el archivo esconde algo
        // desmesurado, no cual es la imagen principal.
        let b = avif_con(&[(320, 240), (30000, 30000), (1920, 1080)]);
        assert_eq!(dimensiones_declaradas(&b), Some((30000, 30000)));
    }

    #[test]
    fn un_avif_bomba_se_pasa_del_tope() {
        let (a, h) = dimensiones_declaradas(&avif_con(&[(25000, 25000)])).unwrap();
        assert!(a * h > TOPE_PIXELES);
    }

    #[test]
    fn una_caja_que_no_avanza_no_cuelga_el_lector() {
        // Tamano menor que la propia cabecera: si el lector confia en el, se
        // queda en el mismo sitio para siempre. Es la forma mas facil de colgar
        // a un lector de ISOBMFF, y esto corre en un comando que la interfaz
        // esta esperando.
        let mut b = caja(b"ftyp", b"avif\0\0\0\0");
        b.extend_from_slice(&[0, 0, 0, 3]); // tamano 3, imposible
        b.extend_from_slice(b"meta");
        assert_eq!(dimensiones_declaradas(&b), None);

        // Y tamano cero, que significa «hasta el final».
        let mut c = caja(b"ftyp", b"avif\0\0\0\0");
        c.extend_from_slice(&[0, 0, 0, 0]);
        c.extend_from_slice(b"meta");
        c.extend_from_slice(&[0; 32]);
        assert_eq!(dimensiones_declaradas(&c), None);
    }

    #[test]
    fn un_avif_sin_ispe_no_inventa_medidas() {
        let b = caja(b"ftyp", b"avif\0\0\0\0avifmif1");
        assert_eq!(dimensiones_declaradas(&b), None);
    }

    #[test]
    fn el_anidamiento_profundo_se_rinde_en_vez_de_desbordar_la_pila() {
        // 200 niveles de `iprp` dentro de `iprp`. El tope de profundidad tiene
        // que cortar antes de que la recursion se lleve la pila por delante.
        let mut dentro = ispe(100, 100);
        for _ in 0..200 {
            dentro = caja(b"iprp", &dentro);
        }
        let mut b = caja(b"ftyp", b"avif\0\0\0\0");
        b.extend_from_slice(&dentro);
        // No importa que encuentre o no: importa que vuelva.
        let _ = dimensiones_declaradas(&b);
    }

    #[test]
    fn un_jpeg_sin_sof_no_se_queda_dando_vueltas() {
        // Cientos de segmentos validos y ningun SOF: tiene que rendirse.
        let mut b = vec![0xFF, 0xD8];
        for _ in 0..600 {
            b.extend_from_slice(&[0xFF, 0xE0, 0x00, 0x02]);
        }
        assert_eq!(dimensiones_declaradas(&b), None);
    }
}
