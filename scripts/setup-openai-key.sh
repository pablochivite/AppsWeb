#!/bin/bash
# Script para configurar OpenAI API Key en Bash/Git Bash
# Uso: ./scripts/setup-openai-key.sh

echo "🔑 Configuración de OpenAI API Key"
echo ""

# Verificar si ya está configurada
if [ -n "$OPENAI_API_KEY" ]; then
    echo "⚠️  Ya existe una API key configurada:"
    echo "   ${OPENAI_API_KEY:0:20}..."
    read -p "¿Deseas sobrescribirla? (s/n): " overwrite
    if [ "$overwrite" != "s" ] && [ "$overwrite" != "S" ]; then
        echo "✅ Manteniendo la configuración actual."
        exit 0
    fi
fi

echo "📝 Por favor, ingresa tu OpenAI API Key:"
echo "   (Puedes obtenerla en: https://platform.openai.com/api-keys)"
echo ""

read -sp "API Key: " api_key
echo ""

# Validar formato básico
if [ -z "$api_key" ] || [[ ! "$api_key" =~ ^sk- ]]; then
    echo "❌ Error: La API key debe empezar con 'sk-'"
    echo "   Key recibida: ${api_key:0:10}..."
    exit 1
fi

# Configurar variable de entorno para esta sesión
export OPENAI_API_KEY="$api_key"

echo ""
echo "✅ API Key configurada para esta sesión de terminal."
echo ""
echo "📌 Nota: Esta configuración solo dura mientras esta terminal esté abierta."
echo "   Para configurarla permanentemente, agrega a tu ~/.bashrc o ~/.zshrc:"
echo "   export OPENAI_API_KEY='sk-...'"
echo ""
echo "🚀 Ahora puedes ejecutar: npm run emulators:all"

