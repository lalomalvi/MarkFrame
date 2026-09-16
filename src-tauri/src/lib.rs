//! MarkFlow — nucleo nativo.
//!
//! Aqui NO hay restriccion de rutas a proposito. Es un editor de los archivos
//! del usuario: abre lo que le den, donde sea. Ver ESPEC.md §2.

use serde::{Deserialize, Serialize};
use std::fs;
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

#[tauri::command]
fn leer(ruta: String) -> Result<Documento, String> {
    let p = PathBuf::from(&ruta);

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

    // Escritura atomica: a un temporal al lado y luego rename. Con autoguardado
    // cada segundo, un corte a media escritura no puede dejar el archivo del
    // usuario truncado.
    let padre = p.parent().ok_or("La ruta no tiene carpeta padre")?;
    let temporal = padre.join(format!(
        ".{}.markflow-tmp",
        p.file_name().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default()
    ));

    fs::write(&temporal, salida.as_bytes())
        .map_err(|e| format!("No se pudo escribir el temporal: {e}"))?;

    fs::rename(&temporal, &p).map_err(|e| {
        let _ = fs::remove_file(&temporal);
        format!("No se pudo guardar «{}»: {e}", nombre_de(&p))
    })?;

    Ok(())
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

/// El `.md` con el que Windows lanzo el programa, si lo hubo.
#[tauri::command]
fn archivo_inicial() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|a| !a.starts_with('-'))
        .filter(|a| Path::new(a).is_file())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![leer, escribir, leer_imagen, archivo_inicial])
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
