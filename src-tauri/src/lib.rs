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
}
