fn main() {
    // El icono de la ventana y del Explorador **no se lee del disco al
    // arrancar**: se incrusta en el `.exe` como recurso de Windows, y ese
    // recurso lo genera este script.
    //
    // Cargo cachea los scripts de compilacion por sus entradas declaradas, y
    // `tauri_build::build()` no declara la carpeta de iconos. Sin la linea de
    // abajo, cambiar el icono no vuelve a ejecutar este script: el recurso
    // viejo se reutiliza y **el ejecutable sigue saliendo con el icono
    // anterior**, aunque `icons/icon.ico` ya sea el nuevo y el instalador diga
    // que todo fue bien.
    //
    // Paso el 2026-09-17 con el logo de MarkFrame: el `.ico` del proyecto era el
    // bueno desde las 00:52 y el `resource.lib` seguia siendo del dia anterior.
    // Se vio extrayendo el icono del `.exe` instalado, no mirando los archivos
    // del proyecto —— que es lo que llevaba a dar por bueno algo que no lo era.
    println!("cargo:rerun-if-changed=icons");

    tauri_build::build()
}
