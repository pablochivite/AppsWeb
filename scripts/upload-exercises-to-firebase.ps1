# Script PowerShell para ejecutar upload-exercises-to-firebase.js
# Este script sube los ejercicios y variaciones desde scripts/data/*.json a Firebase
# Sobrescribe los datos existentes en las colecciones 'exercises' y 'variations'
#
# Uso: .\scripts\upload-exercises-to-firebase.ps1 [--emulator]
#
# Opciones:
#   --emulator    Usa el emulador de Firebase en lugar de producción

param(
    [switch]$emulator = $false
)

Write-Host "🌱 Upload de ejercicios y variaciones a Firebase" -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: No se encontró package.json. Ejecuta este script desde la raíz del proyecto." -ForegroundColor Red
    exit 1
}

# Verificar que existe el directorio de datos
$dataDir = "scripts\data"
if (-not (Test-Path $dataDir)) {
    Write-Host "ERROR: No se encontró el directorio: $dataDir" -ForegroundColor Red
    exit 1
}

# Configurar variables de entorno según el modo
if ($emulator) {
    $env:FIRESTORE_EMULATOR_HOST = "localhost:8080"
    $env:USE_FIREBASE_EMULATOR = "true"
    Write-Host "🔧 Modo: Emulador de Firebase" -ForegroundColor Yellow
    Write-Host "   FIRESTORE_EMULATOR_HOST: $env:FIRESTORE_EMULATOR_HOST" -ForegroundColor Gray
    Write-Host ""
    
    # Verificar que el emulador esté corriendo
    Write-Host "Verificando conexión con el emulador..." -ForegroundColor Cyan
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4000" -TimeoutSec 2 -ErrorAction Stop
        Write-Host "✓ Emulador detectado" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  No se pudo conectar al emulador en http://localhost:4000" -ForegroundColor Yellow
        Write-Host "   Asegúrate de que el emulador esté corriendo:" -ForegroundColor Yellow
        Write-Host "   npm run emulators:all" -ForegroundColor Yellow
        Write-Host ""
        $continue = Read-Host "¿Continuar de todas formas? (s/n)"
        if ($continue -ne "s" -and $continue -ne "S") {
            exit 1
        }
    }
} else {
    # Limpiar variables de emulador si existen
    Remove-Item Env:\FIRESTORE_EMULATOR_HOST -ErrorAction SilentlyContinue
    Remove-Item Env:\USE_FIREBASE_EMULATOR -ErrorAction SilentlyContinue
    Write-Host "🔧 Modo: Producción de Firebase" -ForegroundColor Yellow
    Write-Host "   ⚠️  ADVERTENCIA: Esto sobrescribirá los datos en producción!" -ForegroundColor Red
    Write-Host ""
    
    # Confirmación para producción
    $confirm = Read-Host "¿Estás seguro de que quieres continuar? (escribe 'yes' para confirmar)"
    if ($confirm -ne "yes") {
        Write-Host "Operación cancelada." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "Ejecutando upload..." -ForegroundColor Cyan
Write-Host ""

# Ejecutar el script Node.js
node scripts/upload-exercises-to-firebase.js

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Upload completado exitosamente!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Error durante el upload. Revisa los mensajes anteriores." -ForegroundColor Red
    exit 1
}

