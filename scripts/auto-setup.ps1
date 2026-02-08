# Script Automático Completo - Configura Todo
# Uso: .\scripts\auto-setup.ps1

Write-Host "=== Configuracion Automatica de REGAIN App ===" -ForegroundColor Cyan
Write-Host ""

# Paso 1: Cerrar procesos que usan los puertos
Write-Host "[1/5] Limpiando puertos..." -ForegroundColor Yellow

$ports = @(4000, 8080, 5001)
$pidsToKill = @()

foreach ($port in $ports) {
    $connections = netstat -ano | Select-String ":$port\s+.*LISTENING"
    if ($connections) {
        foreach ($conn in $connections) {
            $pid = ($conn -split '\s+')[-1]
            if ($pid -and $pid -match '^\d+$') {
                $pidsToKill += $pid
            }
        }
    }
}

if ($pidsToKill.Count -gt 0) {
    $uniquePids = $pidsToKill | Select-Object -Unique
    foreach ($pid in $uniquePids) {
        try {
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            Write-Host "   [OK] Cerrado proceso $pid" -ForegroundColor Green
        } catch {
            # Ignorar errores si el proceso ya no existe
        }
    }
    Start-Sleep -Seconds 2
} else {
    Write-Host "   [OK] Puertos libres" -ForegroundColor Green
}

Write-Host ""

# Paso 2: Verificar/Configurar API Key
Write-Host "[2/5] Configurando OpenAI API Key..." -ForegroundColor Yellow

if (-not $env:OPENAI_API_KEY) {
    Write-Host "   [AVISO] API Key no configurada" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   Necesitas una API Key de OpenAI:" -ForegroundColor Cyan
    Write-Host "   1. Ve a: https://platform.openai.com/api-keys" -ForegroundColor Gray
    Write-Host "   2. Crea o copia una API Key (debe empezar con 'sk-')" -ForegroundColor Gray
    Write-Host ""
    
    $apiKey = Read-Host "   Ingresa tu OpenAI API Key" -AsSecureString
    $apiKeyPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiKey)
    )
    
    if (-not $apiKeyPlain -or -not $apiKeyPlain.StartsWith("sk-")) {
        Write-Host ""
        Write-Host "   [ERROR] La API key debe empezar con 'sk-'" -ForegroundColor Red
        Write-Host "   Puedes configurarla despues con: npm run setup:openai" -ForegroundColor Yellow
        Write-Host ""
        $continue = Read-Host "   Continuar sin API Key? (s/n)"
        if ($continue -ne "s" -and $continue -ne "S") {
            exit 1
        }
    } else {
        $env:OPENAI_API_KEY = $apiKeyPlain
        Write-Host "   [OK] API Key configurada" -ForegroundColor Green
    }
} else {
    $keyPreview = if ($env:OPENAI_API_KEY.Length -gt 20) {
        $env:OPENAI_API_KEY.Substring(0, 20) + "..."
    } else {
        $env:OPENAI_API_KEY
    }
    Write-Host "   [OK] API Key ya configurada: $keyPreview" -ForegroundColor Green
}

Write-Host ""

# Paso 3: Verificar que estamos en el directorio correcto
Write-Host "[3/5] Verificando proyecto..." -ForegroundColor Yellow

if (-not (Test-Path "package.json")) {
    Write-Host "   [ERROR] No se encontro package.json" -ForegroundColor Red
    Write-Host "   Ejecuta este script desde la raiz del proyecto (C:\Dev\AppsWeb)" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "firebase.json")) {
    Write-Host "   [ERROR] No se encontro firebase.json" -ForegroundColor Red
    exit 1
}

Write-Host "   [OK] Proyecto verificado" -ForegroundColor Green
Write-Host ""

# Paso 4: Verificar estado del emulador
Write-Host "[4/5] Verificando estado del emulador..." -ForegroundColor Yellow

$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"

# Intentar conectar al emulador
try {
    $result = node scripts/check-emulator-data.js 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   [OK] Emulador accesible" -ForegroundColor Green
        Write-Host $result -ForegroundColor Gray
    } else {
        Write-Host "   [AVISO] Emulador no esta corriendo o no hay datos" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   [AVISO] No se pudo verificar el emulador (puede que no este corriendo)" -ForegroundColor Yellow
}

Write-Host ""

# Paso 5: Resumen y próximos pasos
Write-Host "[5/5] Resumen y Proximos Pasos" -ForegroundColor Yellow
Write-Host "==============================" -ForegroundColor Yellow
Write-Host ""

Write-Host "[OK] Configuracion completada" -ForegroundColor Green
Write-Host ""

Write-Host "Estado:" -ForegroundColor Cyan
Write-Host "  - Puertos limpiados: OK" -ForegroundColor Gray
if ($env:OPENAI_API_KEY) {
    Write-Host "  - API Key configurada: OK" -ForegroundColor Gray
} else {
    Write-Host "  - API Key configurada: NO (configura con: npm run setup:openai)" -ForegroundColor Gray
}
Write-Host "  - Proyecto verificado: OK" -ForegroundColor Gray
Write-Host ""

Write-Host "Para iniciar los emuladores, ejecuta:" -ForegroundColor Cyan
Write-Host "  npm run emulators:all" -ForegroundColor White
Write-Host ""

Write-Host "Si no tienes datos en el emulador:" -ForegroundColor Yellow
Write-Host "  1. Abre tu app: http://localhost:3000" -ForegroundColor Gray
Write-Host "  2. Autenticate (crea cuenta o inicia sesion)" -ForegroundColor Gray
Write-Host "  3. Completa al menos UNA sesion completa" -ForegroundColor Gray
Write-Host "  4. Verifica: npm run check:emulator" -ForegroundColor Gray
Write-Host "  5. Sembra datos: npm run seed:user-history -- --userId=TU_UID --days=365" -ForegroundColor Gray
Write-Host ""

Write-Host "Tips:" -ForegroundColor Cyan
Write-Host "  - La API Key solo dura mientras esta terminal este abierta" -ForegroundColor Gray
Write-Host "  - Para configurarla permanentemente: npm run setup:openai" -ForegroundColor Gray
Write-Host "  - Usa 'npm run check:emulator' para ver tu UID" -ForegroundColor Gray
Write-Host ""

Write-Host "Todo listo! Ejecuta 'npm run emulators:all' para empezar." -ForegroundColor Green
Write-Host ""
