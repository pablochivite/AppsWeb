# Script completo para el proceso de seeding
# Este script guía al usuario a través de todo el proceso

param(
    [string]$userId = ""
)

Write-Host "🌱 Proceso Completo de Seeding de Datos" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Paso 1: Verificar que el emulador esté corriendo
Write-Host "Paso 1: Verificando emulador..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "[OK] Emulador detectado" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] El emulador no está corriendo" -ForegroundColor Red
    Write-Host "   Ejecuta primero: .\scripts\start-emulators-with-key.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Paso 2: Verificar datos del usuario
Write-Host "Paso 2: Verificando datos del usuario..." -ForegroundColor Yellow
$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"

$checkResult = node scripts/check-emulator-data.js 2>&1
Write-Host $checkResult

# Extraer User ID si no se proporcionó
if (-not $userId) {
    Write-Host ""
    Write-Host "Por favor, ingresa tu User ID:" -ForegroundColor Cyan
    Write-Host "(Puedes obtenerlo desde la consola del navegador después de iniciar sesión)" -ForegroundColor Gray
    Write-Host ""
    $userId = Read-Host "User ID"
    
    if (-not $userId -or $userId.Trim() -eq "") {
        Write-Host "[ERROR] User ID es requerido" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Paso 3: Verificando que tengas al menos una sesión completada..." -ForegroundColor Yellow

# Verificar sesiones completadas
$checkSessions = node -e "
import('firebase-admin').then(async (admin) => {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'demo-regain' });
  }
  const db = admin.firestore();
  const sessionsRef = db.collection('users').doc('$userId').collection('completedSessions');
  const snapshot = await sessionsRef.limit(1).get();
  if (snapshot.empty) {
    console.log('NO_SESSIONS');
    process.exit(1);
  } else {
    console.log('HAS_SESSIONS');
    process.exit(0);
  }
}).catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
" 2>&1

if ($LASTEXITCODE -ne 0 -or $checkSessions -match "NO_SESSIONS") {
    Write-Host "[ADVERTENCIA] No se encontraron sesiones completadas" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Necesitas completar al menos una sesión antes de ejecutar el seeding." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pasos:" -ForegroundColor Cyan
    Write-Host "  1. Abre tu app en el navegador" -ForegroundColor Gray
    Write-Host "  2. Inicia sesión con tu usuario" -ForegroundColor Gray
    Write-Host "  3. Completa al menos una sesión de entrenamiento" -ForegroundColor Gray
    Write-Host "  4. Vuelve a ejecutar este script" -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "¿Ya completaste una sesión? (s/n)"
    if ($continue -ne "s" -and $continue -ne "S") {
        Write-Host "Por favor completa una sesión y vuelve a ejecutar este script." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "[OK] Sesiones encontradas" -ForegroundColor Green
Write-Host ""

# Paso 4: Ejecutar seeding
Write-Host "Paso 4: Ejecutando seeding de datos..." -ForegroundColor Yellow
Write-Host "   Esto generará ~208 sesiones (1 año, 4 sesiones/semana)" -ForegroundColor Gray
Write-Host "   Con progresión realista de peso, sets y reps" -ForegroundColor Gray
Write-Host ""

$confirm = Read-Host "¿Continuar con el seeding? (s/n)"
if ($confirm -ne "s" -and $confirm -ne "S") {
    Write-Host "Seeding cancelado." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Ejecutando seeding (esto puede tomar unos minutos)..." -ForegroundColor Cyan
Write-Host ""

node scripts/seed-user-history.js --userId=$userId --days=365 --sessionsPerWeek=4

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Seeding completado exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Próximos pasos:" -ForegroundColor Cyan
    Write-Host "  1. Completa una nueva sesión en la app" -ForegroundColor Gray
    Write-Host "  2. Al finalizar, se generará automáticamente el informe LangGraph" -ForegroundColor Gray
    Write-Host "  3. El informe incluirá análisis de tu progresión histórica" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Error durante el seeding" -ForegroundColor Red
    Write-Host "   Revisa los mensajes de error arriba" -ForegroundColor Yellow
    exit $LASTEXITCODE
}


