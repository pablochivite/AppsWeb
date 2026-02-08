# ✅ Configuración Completa del Emulador y Seeding

## Cambios Realizados

### 1. ✅ Script de Inicio del Emulador Mejorado
**Archivo**: `scripts/start-emulators-with-key.ps1`

- Ahora configura correctamente todas las variables de entorno
- Muestra un resumen de las variables configuradas
- Asegura que `OPENAI_API_KEY` esté disponible para las funciones

### 2. ✅ Utilidad de Inicialización de Firebase Admin
**Archivo**: `functions/src/utils/admin-init.ts` (NUEVO)

- Detecta automáticamente si está en modo emulador
- Configura Firebase Admin correctamente para emulador o producción
- Logs informativos para debugging

### 3. ✅ Endpoints de API Actualizados
**Archivos actualizados**:
- `functions/src/api/analyze.ts`
- `functions/src/api/generate-workout.ts`
- `functions/src/api/generate-workout-report.ts`
- `functions/src/api/suggestExercises.ts`

Todos ahora usan la inicialización correcta con soporte para emulador.

### 4. ✅ Script de Seeding Mejorado
**Archivo**: `scripts/seed-user-history.js`

- Detecta automáticamente si está usando el emulador
- No requiere service account cuando usa emulador
- Mensajes más claros sobre el modo de operación

### 5. ✅ Script PowerShell para Seeding
**Archivo**: `scripts/seed-user-history.ps1` (NUEVO)

- Facilita la ejecución del seeding
- Verifica que el emulador esté corriendo
- Configura automáticamente las variables de entorno

## Cómo Usar

### Paso 1: Iniciar el Emulador

```powershell
.\scripts\start-emulators-with-key.ps1
```

Este script:
- Te pedirá la API key de OpenAI si no está configurada
- Configurará todas las variables de entorno necesarias
- Compilará las funciones si es necesario
- Iniciará los emuladores de Firestore y Functions

### Paso 2: Obtener tu User ID

1. Abre la app en el navegador (debe estar apuntando al emulador)
2. Inicia sesión
3. Abre la consola del navegador (F12)
4. Ejecuta:
   ```javascript
   import { auth } from './config/firebase.config.js';
   console.log('Tu User ID:', auth.currentUser?.uid);
   ```
5. Copia el User ID

### Paso 3: Completar una Sesión Real (Template)

Antes de ejecutar el seeding, **debes completar al menos una sesión real** en la app. Esta sesión se usará como template para generar las sesiones históricas.

### Paso 4: Ejecutar el Seeding

**Opción A: Usando el script PowerShell (Recomendado)**

```powershell
.\scripts\seed-user-history.ps1 -userId "TU_UID_AQUI" -days 365 -sessionsPerWeek 4
```

**Opción B: Usando Node.js directamente**

```powershell
# Asegúrate de que las variables estén configuradas
$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"
$env:FUNCTIONS_EMULATOR_HOST = "localhost:5001"

node scripts/seed-user-history.js --userId=TU_UID --days=365 --sessionsPerWeek=4
```

### Paso 5: Verificar los Datos

```powershell
node scripts/check-emulator-data.js
```

O visita `http://localhost:4000` y navega a Firestore para ver los datos.

### Paso 6: Probar el Informe LangGraph

1. Completa una nueva sesión en la app
2. Al finalizar, el sistema automáticamente:
   - Guardará la sesión
   - Generará un reporte
   - Llamará a LangGraph para análisis

## Solución de Problemas

### Error: "OpenAI API key not configured"

**Causa**: Las funciones no pueden acceder a la API key.

**Solución**:
1. Asegúrate de ejecutar `start-emulators-with-key.ps1` (no solo `npm run emulators:all`)
2. Verifica que `OPENAI_API_KEY` esté configurada:
   ```powershell
   echo $env:OPENAI_API_KEY
   ```
3. Si no está, ejecuta el script de inicio del emulador de nuevo

### Error: "No completedSessions found"

**Causa**: No tienes ninguna sesión completada como template.

**Solución**: Completa al menos una sesión real en la app antes de ejecutar el seeding.

### Error: "Cannot connect to emulator"

**Causa**: El emulador no está corriendo.

**Solución**:
1. Verifica que el emulador esté activo: `http://localhost:4000`
2. Si no está, ejecuta `.\scripts\start-emulators-with-key.ps1`

### Las funciones no se conectan al emulador

**Causa**: Firebase Admin no está configurado para usar el emulador.

**Solución**: 
- Las funciones ahora detectan automáticamente el emulador
- Asegúrate de que `FIRESTORE_EMULATOR_HOST=localhost:8080` esté configurado
- El script `start-emulators-with-key.ps1` lo configura automáticamente

## Estructura de Datos Generada

El seeding genera:

1. **~208 sesiones completadas** (4 por semana × 52 semanas)
   - Cada sesión con estructura completa (warmup, workout, cooldown)
   - Sets con peso, reps, y progresión realista

2. **Historial de ejercicios** por cada ejercicio/variación
   - Progresión temporal coherente
   - Incluye plateaus y deloads

3. **Reportes de sesión** básicos
   - Listos para ser enriquecidos por LangGraph

## Próximos Pasos

Una vez que tengas los datos:

1. ✅ Completa una nueva sesión
2. ✅ Verifica que se genere el informe LangGraph
3. ✅ Revisa los insights y recomendaciones generadas
4. ✅ Prueba diferentes consultas en el análisis

## Notas Importantes

- Los datos se generan hacia atrás desde hoy
- La progresión es coherente y realista
- Los datos son sintéticos pero útiles para testing
- El emulador mantiene los datos hasta que lo detengas

