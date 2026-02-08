# LangSmith Setup Guide

Este documento explica cómo configurar LangSmith para ver los traces de LangGraph en producción.

## ¿Qué es LangSmith?

LangSmith es la plataforma de observabilidad de LangChain que permite ver en tiempo real:
- Los nodos del workflow que se están ejecutando
- Las llamadas a LLM (OpenAI)
- Los errores y validaciones
- El tiempo de ejecución de cada paso

## Problema Actual

Si no ves los traces en LangSmith, es porque las variables de entorno de LangSmith no están configuradas en Firebase Cloud Functions (producción).

## Solución: Configurar Variables de Entorno en Firebase Functions

### Paso 1: Obtener tu API Key de LangSmith

1. Ve a [https://smith.langchain.com/](https://smith.langchain.com/)
2. Inicia sesión o crea una cuenta
3. Ve a **Settings** > **API Keys**
4. Crea una nueva API key o copia una existente

### Paso 2: Configurar Variables de Entorno en Firebase Functions

Firebase Functions v2 usa **Secret Manager** para variables de entorno sensibles. El código ya está configurado para usar secretos automáticamente.

#### Configurar LANGCHAIN_API_KEY como Secreto

```bash
# Configurar LANGCHAIN_API_KEY como secreto
firebase functions:secrets:set LANGCHAIN_API_KEY

# Cuando te pida el valor, pega tu API key de LangSmith
# Ejemplo: ls_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Configurar Variables de Entorno (Opcional)

Para las otras variables (no sensibles), puedes configurarlas como variables de entorno:

```bash
# Opción 1: Usando Firebase CLI (para variables no sensibles)
firebase functions:config:set \
  langchain.tracing_v2=true \
  langchain.endpoint="https://api.smith.langchain.com" \
  langchain.project="Regain"
```

**Nota**: El código ya tiene valores por defecto para estas variables, así que no es estrictamente necesario configurarlas. Solo necesitas configurar `LANGCHAIN_API_KEY` como secreto.

#### Alternativa: Usando Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto Firebase
3. Ve a **Secret Manager** (en el menú izquierdo)
4. Crea un nuevo secreto llamado `LANGCHAIN_API_KEY`
5. Pega tu API key de LangSmith
6. Asegúrate de que el secreto esté accesible para Cloud Functions

### Paso 3: El Código Ya Está Configurado

✅ El código ya está actualizado para usar Secret Manager automáticamente. No necesitas hacer cambios adicionales en el código.

### Paso 4: Verificar la Configuración

Después de configurar las variables, despliega las funciones:

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

Luego, cuando ejecutes una generación de workout, deberías ver:
1. Logs en la consola de Firebase Functions mostrando la configuración de LangSmith
2. Traces apareciendo en [LangSmith Dashboard](https://smith.langchain.com/)

## Configuración Local (Desarrollo)

Para desarrollo local con el emulador, las variables se cargan desde el archivo `.env` en la raíz del proyecto:

```env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT="https://api.smith.langchain.com"
LANGCHAIN_API_KEY=tu-api-key-aqui
LANGCHAIN_PROJECT="Regain"
```

## Verificación

Para verificar que el tracing está funcionando:

1. **En los logs de Firebase Functions:**
   - Busca: `[Generate Workout] LangSmith Configuration Setup:`
   - Busca: `[Generate Workout] LangSmith Tracing Status:`
   - Deberías ver que `LANGCHAIN_API_KEY` está configurado (mostrado como `***set***`)

2. **En LangSmith Dashboard:**
   - Ve a [https://smith.langchain.com/](https://smith.langchain.com/)
   - Selecciona el proyecto "Regain" (o el que hayas configurado en `LANGCHAIN_PROJECT`)
   - Ve a la pestaña **Runs** o **Traces**
   - Deberías ver los traces apareciendo en tiempo real cuando se ejecuta el workflow
   - Cada ejecución mostrará todos los nodos del workflow: router, analyze, planner, filter, blueprint, assemble, validate, etc.

## Troubleshooting

### No veo traces en LangSmith

1. **Verifica que LANGCHAIN_API_KEY esté configurado:**
   ```bash
   # Verificar que el secreto existe
   firebase functions:secrets:access LANGCHAIN_API_KEY
   
   # O verificar en Google Cloud Console:
   # Secret Manager > LANGCHAIN_API_KEY
   ```

2. **Verifica los logs de Firebase Functions:**
   - Busca mensajes que empiecen con `[Generate Workout] LangSmith`
   - Si ves "not set" o "⚠️ WARNING", las variables no están configuradas correctamente
   - Deberías ver `✅ LangSmith environment variables configured`

3. **Verifica que el proyecto en LangSmith sea "Regain":**
   - El nombre del proyecto debe coincidir con `LANGCHAIN_PROJECT` (por defecto es "Regain")
   - Puedes cambiarlo en el código o configurando la variable de entorno

4. **Asegúrate de haber re-desplegado las funciones después de configurar el secreto:**
   ```bash
   cd functions
   npm run build
   cd ..
   firebase deploy --only functions
   ```

5. **Verifica que el secreto esté incluido en la función:**
   - El código ya incluye `secrets: [langchainApiKey]` en la configuración de la función
   - Esto asegura que el secreto esté disponible en tiempo de ejecución

### Los traces aparecen con retraso

- LangSmith puede tardar unos segundos en mostrar los traces
- Refresca la página en LangSmith Dashboard
- Los traces aparecen en orden cronológico

### Error: "LANGCHAIN_API_KEY not found"

- Asegúrate de haber configurado el secreto en Firebase Functions
- Verifica que el secreto esté accesible para Cloud Functions
- Re-despliega las funciones después de configurar el secreto

## Referencias

- [LangSmith Documentation](https://docs.smith.langchain.com/)
- [Firebase Functions Secrets](https://firebase.google.com/docs/functions/config-env#secret-manager)
- [LangChain Tracing](https://python.langchain.com/docs/langsmith/tracing)

