# Mide la memoria que usa MarkFrame, sumando sus procesos de WebView2.
#
# ESTE ARCHIVO VA EN UTF-8 *CON BOM* y sin acentos en los identificadores.
# Windows PowerShell 5.1 lee como ANSI cualquier .ps1 sin BOM.
#
# Por que hace falta un script y no basta mirar el Administrador de tareas:
# WebView2 arranca varios procesos y **los comparte con otras aplicaciones**.
# En esta maquina hay dos docenas de msedgewebview2.exe, casi todos de otras
# cosas. Sumarlos todos da una cifra alarmante y falsa; hay que seguir el arbol
# de padres desde markframe.exe.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File pruebas\memoria.ps1

$mf = Get-Process markframe -ErrorAction SilentlyContinue
if (-not $mf) {
    Write-Host "MarkFrame no esta abierto. Abrelo y vuelve a correr esto." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Memoria de MarkFrame" -ForegroundColor Cyan
Write-Host ("  " + "-" * 44)
Write-Host ("  {0,-24} {1,8:N1} MB" -f "markframe.exe (Rust)", ($mf.WorkingSet64 / 1MB))

# Los WebView2 que cuelgan de ESE proceso, no todos los de la maquina.
$todos = Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" |
    Select-Object ProcessId, ParentProcessId, CommandLine

$mios = @()
$frontera = @($mf.Id)
while ($frontera.Count -gt 0) {
    $hijos = $todos | Where-Object { $frontera -contains $_.ParentProcessId }
    if (-not $hijos) { break }
    $mios += $hijos
    $frontera = @($hijos.ProcessId)
}

$suma = 0
foreach ($h in $mios) {
    $p = Get-Process -Id $h.ProcessId -ErrorAction SilentlyContinue
    if (-not $p) { continue }
    $suma += $p.WorkingSet64
    $tipo = if ($h.CommandLine -match '--type=([a-zA-Z-]+)') { $Matches[1] } else { 'principal' }
    Write-Host ("  {0,-24} {1,8:N1} MB" -f "WebView2: $tipo", ($p.WorkingSet64 / 1MB))
}

$total = ($mf.WorkingSet64 + $suma) / 1MB
Write-Host ("  " + "-" * 44)
Write-Host ("  {0,-24} {1,8:N1} MB" -f "TOTAL", $total) -ForegroundColor Green
Write-Host ("  {0,-24} {1,8:N1} MB" -f "  de eso, Chromium", ($suma / 1MB))
Write-Host ""
Write-Host ("  procesos de WebView2 de MarkFrame : " + $mios.Count)
Write-Host ("  procesos de WebView2 de otras app: " + ($todos.Count - $mios.Count))
Write-Host ""
