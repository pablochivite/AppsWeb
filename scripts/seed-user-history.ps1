# Script PowerShell para ejecutar seed-user-history.js con configuración del emulador
# Uso: .\scripts\seed-user-history.ps1 --userId=TU_UID [--days=365] [--sessionsPerWeek=4]

param(
    [Parameter(Mandatory=$true)]
    [string]$userId,
    [int]$days = 365,
    [int]$sessionsPerWeek = 4
)

Write-Host "🌱 Seeding user history..." -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: No se encontro package.json. Ejecuta este script desde la raiz del proyecto." -ForegroundColor Red
    exit 1
}

# Configurar variables de entorno para el emulador
$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"
$env:FUNCTIONS_EMULATOR_HOST = "localhost:5001"

Write-Host "Configuración:" -ForegroundColor Yellow
Write-Host "  User ID: $userId" -ForegroundColor Gray
Write-Host "  Days: $days" -ForegroundColor Gray
Write-Host "  Sessions per week: $sessionsPerWeek" -ForegroundColor Gray
Write-Host "  FIRESTORE_EMULATOR_HOST: $env:FIRESTORE_EMULATOR_HOST" -ForegroundColor Gray
Write-Host ""

# Verificar que el emulador esté corriendo
Write-Host "Verificando conexión con el emulador..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ Emulador detectado" -ForegroundColor Green
} catch {
    Write-Host "⚠️  No se pudo conectar al emulador en http://localhost:4000" -ForegroundColor Yellow
    Write-Host "   Asegúrate de que el emulador esté corriendo:" -ForegroundColor Yellow
    Write-Host "   .\scripts\start-emulators-with-key.ps1" -ForegroundColor Yellow
    Write-Host ""
    $continue = Read-Host "¿Continuar de todas formas? (s/n)"
    if ($continue -ne "s" -and $continue -ne "S") {
        exit 1
    }
}

Write-Host ""
Write-Host "Ejecutando seeding..." -ForegroundColor Cyan
Write-Host ""

# Ejecutar el script de seeding
node scripts/seed-user-history.js --userId=$userId --days=$days --sessionsPerWeek=$sessionsPerWeek

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Seeding completado exitosamente!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Error durante el seeding" -ForegroundColor Red
    exit $LASTEXITCODE
}

