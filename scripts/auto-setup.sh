#!/bin/bash
# Script Automático Completo - Configura Todo (Git Bash)
# Uso: ./scripts/auto-setup.sh

echo "🚀 Configuración Automática de REGAIN App"
echo "========================================"
echo ""

# Paso 1: Cerrar procesos que usan los puertos (Windows)
echo "1️⃣  Limpiando puertos..."

# En Windows con Git Bash, usamos netstat y taskkill
ports=(4000 8080 5001)
pids_to_kill=()

for port in "${ports[@]}"; do
    # Buscar procesos usando el puerto
    while IFS= read -r line; do
        if [[ $line =~ LISTENING[[:space:]]+([0-9]+) ]]; then
            pid="${BASH_REMATCH[1]}"
            if [[ ! " ${pids_to_kill[@]} " =~ " ${pid} " ]]; then
                pids_to_kill+=("$pid")
            fi
        fi
    done < <(netstat -ano 2>/dev/null | grep ":$port" | grep LISTENING)
done

if [ ${#pids_to_kill[@]} -gt 0 ]; then
    for pid in "${pids_to_kill[@]}"; do
        taskkill //F //PID "$pid" 2>/dev/null && echo "   ✓ Cerrado proceso $pid" || true
    done
    sleep 2
else
    echo "   ✓ Puertos libres"
fi

echo ""

# Paso 2: Verificar/Configurar API Key
echo "2️⃣  Configurando OpenAI API Key..."

if [ -z "$OPENAI_API_KEY" ]; then
    echo "   ⚠️  API Key no configurada"
    echo ""
    echo "   📝 Necesitas una API Key de OpenAI:"
    echo "      1. Ve a: https://platform.openai.com/api-keys"
    echo "      2. Crea o copia una API Key (debe empezar con 'sk-')"
    echo ""
    
    read -sp "   Ingresa tu OpenAI API Key: " api_key
    echo ""
    
    if [ -z "$api_key" ] || [[ ! "$api_key" =~ ^sk- ]]; then
        echo ""
        echo "   ❌ Error: La API key debe empezar con 'sk-'"
        echo "   💡 Puedes configurarla después con: ./scripts/setup-openai-key.sh"
        echo ""
        read -p "   ¿Continuar sin API Key? (s/n): " continue
        if [ "$continue" != "s" ] && [ "$continue" != "S" ]; then
            exit 1
        fi
    else
        export OPENAI_API_KEY="$api_key"
        echo "   ✅ API Key configurada"
    fi
else
    key_preview="${OPENAI_API_KEY:0:20}..."
    echo "   ✅ API Key ya configurada: $key_preview"
fi

echo ""

# Paso 3: Verificar que estamos en el directorio correcto
echo "3️⃣  Verificando proyecto..."

if [ ! -f "package.json" ]; then
    echo "   ❌ Error: No se encontró package.json"
    echo "   Ejecuta este script desde la raíz del proyecto (C:\Dev\AppsWeb)"
    exit 1
fi

if [ ! -f "firebase.json" ]; then
    echo "   ❌ Error: No se encontró firebase.json"
    exit 1
fi

echo "   ✅ Proyecto verificado"
echo ""

# Paso 4: Verificar estado del emulador
echo "4️⃣  Verificando estado del emulador..."

export FIRESTORE_EMULATOR_HOST="localhost:8080"

# Intentar conectar al emulador
if node scripts/check-emulator-data.js 2>/dev/null; then
    echo "   ✅ Emulador accesible"
else
    echo "   ⚠️  Emulador no está corriendo o no hay datos"
fi

echo ""

# Paso 5: Resumen y próximos pasos
echo "5️⃣  Resumen y Próximos Pasos"
echo "============================"
echo ""

echo "✅ Configuración completada"
echo ""

echo "📋 Estado:"
echo "   • Puertos limpiados: ✓"
if [ -n "$OPENAI_API_KEY" ]; then
    echo "   • API Key configurada: ✓"
else
    echo "   • API Key configurada: ✗ (configura con: ./scripts/setup-openai-key.sh)"
fi
echo "   • Proyecto verificado: ✓"
echo ""

echo "🚀 Para iniciar los emuladores, ejecuta:"
echo "   npm run emulators:all"
echo ""

echo "📝 Si no tienes datos en el emulador:"
echo "   1. Abre tu app: http://localhost:3000"
echo "   2. Autentícate (crea cuenta o inicia sesión)"
echo "   3. Completa al menos UNA sesión completa"
echo "   4. Verifica: npm run check:emulator"
echo "   5. Sembra datos: npm run seed:user-history -- --userId=TU_UID --days=365"
echo ""

echo "💡 Tips:"
echo "   • La API Key solo dura mientras esta terminal esté abierta"
echo "   • Para configurarla permanentemente: ./scripts/setup-openai-key.sh"
echo "   • Usa 'npm run check:emulator' para ver tu UID"
echo ""

echo "✨ ¡Todo listo! Ejecuta 'npm run emulators:all' para empezar."
echo ""

