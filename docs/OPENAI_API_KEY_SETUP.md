# Configuración de OpenAI API Key

Este documento explica cómo configurar la API key de OpenAI para que LangGraph funcione correctamente.

## Error Común

Si ves este error en los logs del emulador:
```
401 Incorrect API key provided: sksvcacc...
```

Significa que la API key no está configurada o es inválida.

---

## Solución: Configurar Variable de Entorno

Para desarrollo local con el emulador, la forma más simple es usar una variable de entorno.

### Paso 1: Obtener tu API Key de OpenAI

1. Ve a https://platform.openai.com/api-keys
2. Inicia sesión en tu cuenta de OpenAI
3. Crea una nueva API key o copia una existente
4. **IMPORTANTE**: La key debe empezar con `sk-` (no `sksvcacc-`)

### Paso 2: Configurar en PowerShell (Windows)

**Opción A: Configurar antes de iniciar emuladores (Recomendado)**

1. Abre una nueva terminal PowerShell
2. Configura la variable de entorno:

```powershell
$env:OPENAI_API_KEY="sk-tu-api-key-aqui"
```

3. Verifica que se configuró correctamente:

```powershell
echo $env:OPENAI_API_KEY
```

4. **En la misma terminal**, inicia los emuladores:

```powershell
npm run emulators:all
```

**Nota**: La variable de entorno solo dura mientras la terminal esté abierta. Si cierras la terminal, tendrás que configurarla de nuevo.

---

**Opción B: Configurar permanentemente (Sistema)**

Para que la variable persista entre sesiones:

1. Abre PowerShell como Administrador
2. Ejecuta:

```powershell
[System.Environment]::SetEnvironmentVariable('OPENAI_API_KEY', 'sk-tu-api-key-aqui', 'User')
```

3. Cierra y vuelve a abrir todas las terminales
4. Verifica:

```powershell
echo $env:OPENAI_API_KEY
```

---

### Paso 3: Verificar que Funciona

1. Inicia los emuladores con la variable configurada
2. Completa una sesión en la app
3. Solicita un análisis (el informe de LangGraph)
4. Revisa los logs del emulador (`http://localhost:4000` → Logs)

**Deberías ver:**
- ✅ Sin errores de autenticación
- ✅ Logs de "Workflow completed" exitosamente
- ✅ Respuestas del LLM en los logs

---

## Alternativa: Usar Firebase Functions Config (Producción)

Para producción, puedes configurar la API key usando Firebase CLI:

```bash
firebase functions:config:set openai.key="sk-tu-api-key-aqui"
```

Luego despliega:

```bash
firebase deploy --only functions
```

**Nota**: Esto solo funciona en producción, no en el emulador local.

---

## Troubleshooting

### Error: "OpenAI API key not configured"

**Solución**: Asegúrate de que `OPENAI_API_KEY` esté configurada antes de iniciar los emuladores.

### Error: "401 Incorrect API key provided"

**Posibles causas:**
1. La API key es inválida o ha expirado
2. La API key está mal copiada (espacios, caracteres extra)
3. La variable de entorno no se configuró en la terminal correcta

**Solución:**
1. Verifica que la key empiece con `sk-` (no `sksvcacc-`)
2. Obtén una nueva API key desde https://platform.openai.com/api-keys
3. Asegúrate de configurar la variable en la misma terminal donde ejecutas los emuladores

### La variable se pierde al cerrar la terminal

**Solución**: Usa la Opción B (configuración permanente) o crea un script `.ps1` que configure la variable automáticamente.

---

## Script Helper (Opcional)

Puedes crear un archivo `start-emulators.ps1` en la raíz del proyecto:

```powershell
# start-emulators.ps1
$env:OPENAI_API_KEY="sk-tu-api-key-aqui"
npm run emulators:all
```

Luego ejecuta:

```powershell
.\start-emulators.ps1
```

**Nota**: No subas este archivo a Git si contiene tu API key real. Agrégalo a `.gitignore`.

---

## Seguridad

⚠️ **IMPORTANTE**: 
- Nunca subas tu API key a Git
- No compartas tu API key públicamente
- Si accidentalmente la subiste, revócala inmediatamente en https://platform.openai.com/api-keys
- Usa variables de entorno o archivos `.env` que estén en `.gitignore`

