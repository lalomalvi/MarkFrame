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

    let absoluta = fs::canonicalize(&p).unwrap_or(p.clone());
    let absoluta = absoluta
        .to_string_lossy()
        .trim_start_matches(r"\?\")
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
        .invoke_handler(tauri::generate_handler![leer, escribir, archivo_inicial])
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
