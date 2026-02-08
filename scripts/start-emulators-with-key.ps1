# Script para iniciar emuladores con OpenAI API Key configurada
# Uso: .\scripts\start-emulators-with-key.ps1

Write-Host "Iniciando Firebase Emulators con OpenAI API Key..." -ForegroundColor Cyan
Write-Host ""

# Función para leer API key desde archivo .env
function Read-EnvFile {
    param([string]$FilePath)
    
    if (-not (Test-Path $FilePath)) {
        return $null
    }
    
    $content = Get-Content $FilePath -Raw
    $lines = $content -split "`n"
    
    foreach ($line in $lines) {
        $line = $line.Trim()
        # Ignorar comentarios y líneas vacías
        if ($line -match '^\s*#' -or $line -eq '') {
            continue
        }
        # Buscar OPENAI_API_KEY (prioridad) o VITE_OPENAI_API_KEY
        if ($line -match '^OPENAI_API_KEY\s*=\s*(.+)$') {
            $keyValue = $matches[1].Trim()
            # Remover comillas si las tiene
            $keyValue = $keyValue -replace '^["'']|["'']$', ''
            return $keyValue
        }
    }
    
    return $null
}

# Intentar leer API key desde .env
$envFilePath = Join-Path $PSScriptRoot "..\.env" | Resolve-Path -ErrorAction SilentlyContinue
if (-not $envFilePath) {
    $envFilePath = Join-Path (Get-Location) ".env"
}

$apiKeyFromEnv = $null
if (Test-Path $envFilePath) {
    Write-Host "Leyendo API key desde archivo .env..." -ForegroundColor Cyan
    # Primero intentar OPENAI_API_KEY (sin VITE_), luego VITE_OPENAI_API_KEY
    $apiKeyFromEnv = Read-EnvFile -FilePath $envFilePath
    
    # Si no encontramos OPENAI_API_KEY, intentar VITE_OPENAI_API_KEY
    if (-not $apiKeyFromEnv) {
        Write-Host "OPENAI_API_KEY no encontrada, buscando VITE_OPENAI_API_KEY..." -ForegroundColor Yellow
        $content = Get-Content $envFilePath -Raw
        $lines = $content -split "`n"
        foreach ($line in $lines) {
            $line = $line.Trim()
            if ($line -match '^VITE_OPENAI_API_KEY\s*=\s*(.+)$') {
                $apiKeyFromEnv = $matches[1].Trim()
                $apiKeyFromEnv = $apiKeyFromEnv -replace '^["'']|["'']$', ''
                Write-Host "[OK] Usando VITE_OPENAI_API_KEY del .env" -ForegroundColor Green
                break
            }
        }
    }
    
    if ($apiKeyFromEnv) {
        Write-Host "[OK] API key encontrada en .env" -ForegroundColor Green
    } else {
        Write-Host "[WARN] API key no encontrada en .env" -ForegroundColor Yellow
    }
}

# Verificar si la API key esta configurada
if (-not $env:OPENAI_API_KEY -and -not $apiKeyFromEnv) {
    Write-Host "ADVERTENCIA: OPENAI_API_KEY no esta configurada." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Configurando API Key..." -ForegroundColor Yellow
    Write-Host "Puedes copiar y pegar tu API key (sk-...)" -ForegroundColor Gray
    Write-Host ""
    
    # Permitir copiar y pegar (sin SecureString)
    $apiKeyPlain = Read-Host "Ingresa tu OpenAI API Key (sk-...)"
    
    if (-not $apiKeyPlain -or -not $apiKeyPlain.StartsWith("sk-")) {
        Write-Host "ERROR: La API key debe empezar con 'sk-'" -ForegroundColor Red
        exit 1
    }
    
    $env:OPENAI_API_KEY = $apiKeyPlain
    Write-Host "API Key configurada correctamente." -ForegroundColor Green
    Write-Host ""
} elseif ($apiKeyFromEnv -and -not $env:OPENAI_API_KEY) {
    # Usar la API key del archivo .env
    $env:OPENAI_API_KEY = $apiKeyFromEnv
    Write-Host "[OK] Usando API key desde archivo .env" -ForegroundColor Green
    Write-Host ""
}

# Mostrar preview de la key (solo primeros caracteres)
$keyPreview = if ($env:OPENAI_API_KEY.Length -gt 20) {
    $env:OPENAI_API_KEY.Substring(0, 20) + "..."
} else {
    $env:OPENAI_API_KEY
}
Write-Host "Usando API Key: $keyPreview" -ForegroundColor Gray
Write-Host ""

# Verificar que estamos en el directorio correcto
if (-not (Test-Path "package.json")) {
    Write-Host "ERROR: No se encontro package.json. Ejecuta este script desde la raiz del proyecto." -ForegroundColor Red
    exit 1
}

# Configurar variables de entorno para las funciones
Write-Host "Configurando variables de entorno..." -ForegroundColor Cyan
$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"
$env:FUNCTIONS_EMULATOR_HOST = "localhost:5001"

# Asegurar que OPENAI_API_KEY esté disponible globalmente
if ($env:OPENAI_API_KEY) {
    # Configurar también a nivel de proceso para que las funciones lo vean
    [System.Environment]::SetEnvironmentVariable('OPENAI_API_KEY', $env:OPENAI_API_KEY, 'Process')
}

# Mostrar resumen de variables configuradas
Write-Host ""
Write-Host "Variables de entorno configuradas:" -ForegroundColor Green
Write-Host ("  FIRESTORE_EMULATOR_HOST=" + $env:FIRESTORE_EMULATOR_HOST) -ForegroundColor Gray
Write-Host ("  FUNCTIONS_EMULATOR_HOST=" + $env:FUNCTIONS_EMULATOR_HOST) -ForegroundColor Gray
Write-Host ("  OPENAI_API_KEY=" + $keyPreview) -ForegroundColor Gray
Write-Host ""

# Verificar que las funciones esten compiladas
if (-not (Test-Path "functions/lib")) {
    Write-Host "Compilando funciones TypeScript..." -ForegroundColor Yellow
    Set-Location functions
    npm run build
    Set-Location ..
    Write-Host "[OK] Funciones compiladas" -ForegroundColor Green
    Write-Host ""
}

# Iniciar emuladores
Write-Host "Iniciando emuladores..." -ForegroundColor Cyan
Write-Host ""
Write-Host "Nota: La API key de OpenAI esta configurada en esta sesion." -ForegroundColor Gray
Write-Host "Las funciones de Firebase la leeran desde la variable de entorno OPENAI_API_KEY" -ForegroundColor Gray
Write-Host ""

# Crear/actualizar .env en functions para que las funciones lo lean
$functionsEnvPath = Join-Path (Get-Location) "functions\.env"
if ($env:OPENAI_API_KEY) {
    Write-Host "Creando archivo .env en functions/..." -ForegroundColor Cyan
    # Leer .env de la raíz si existe para preservar otras variables
    $rootEnvPath = Join-Path (Get-Location) ".env"
    $envContent = ""
    
    if (Test-Path $rootEnvPath) {
        $rootEnvLines = Get-Content $rootEnvPath
        foreach ($line in $rootEnvLines) {
            # Preservar líneas que no sean OPENAI_API_KEY
            if ($line -notmatch '^\s*OPENAI_API_KEY\s*=' -and $line -notmatch '^\s*VITE_OPENAI_API_KEY\s*=') {
                $envContent += $line + "`n"
            }
        }
    }
    
    # Agregar OPENAI_API_KEY (tiene prioridad)
    $envContent += "OPENAI_API_KEY=$env:OPENAI_API_KEY`n"
    
    # Escribir archivo
    $envContent | Out-File -FilePath $functionsEnvPath -Encoding utf8
    Write-Host "[OK] Archivo .env creado en functions/ con OPENAI_API_KEY" -ForegroundColor Green
    Write-Host ""
}

# Iniciar emuladores con las variables de entorno configuradas
npm run emulators:all
